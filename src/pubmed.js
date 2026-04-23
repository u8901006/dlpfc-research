import fs from 'fs';
import { CONFIG, SEARCH_QUERIES } from './config.js';
import { setTimeout as sleep } from 'timers/promises';

function getDateFilter() {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fmt = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  return `("${fmt(sevenDaysAgo)}"[Date - Publication] : "${fmt(now)}"[Date - Publication])`;
}

async function esearch(query, dateFilter, retries = 3) {
  const fullQuery = `${query} AND ${dateFilter}`;
  const url = new URL(`${CONFIG.pubmed.baseUrl}/esearch.fcgi`);
  url.searchParams.set('db', 'pubmed');
  url.searchParams.set('term', fullQuery);
  url.searchParams.set('retmode', 'json');
  url.searchParams.set('retmax', String(CONFIG.pubmed.retMax));
  url.searchParams.set('tool', CONFIG.pubmed.tool);
  url.searchParams.set('email', CONFIG.pubmed.email);
  url.searchParams.set('sort', 'date');
  url.searchParams.set('datetype', 'pdat');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return data.esearchresult?.idlist || [];
    } catch (err) {
      console.error(`  esearch attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) await sleep(2000 * attempt);
    }
  }
  return [];
}

async function esummary(pmids) {
  if (pmids.length === 0) return {};
  const batchSize = 200;
  const allResults = {};

  for (let i = 0; i < pmids.length; i += batchSize) {
    const batch = pmids.slice(i, i + batchSize);
    const url = new URL(`${CONFIG.pubmed.baseUrl}/esummary.fcgi`);
    url.searchParams.set('db', 'pubmed');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('retmode', 'json');
    url.searchParams.set('tool', CONFIG.pubmed.tool);
    url.searchParams.set('email', CONFIG.pubmed.email);

    try {
      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const result = data.result || {};
      const uids = result.uids || [];
      for (const uid of uids) {
        const article = result[uid];
        if (article && !article.error) {
          allResults[uid] = {
            pmid: uid,
            title: article.title || '',
            authors: (article.authors || []).map((a) => a.name || '').filter(Boolean),
            journal: article.fulljournalname || article.source || '',
            pubDate: article.pubdate || '',
            doi: (article.articleids || []).find((id) => id.idtype === 'doi')?.value || '',
            volume: article.volume || '',
            issue: article.issue || '',
            pages: article.pages || '',
            epubDate: article.epubdate || '',
          };
        }
      }
    } catch (err) {
      console.error(`  esummary batch failed: ${err.message}`);
    }
    if (i + batchSize < pmids.length) await sleep(350);
  }
  return allResults;
}

async function fetchAbstracts(pmids) {
  if (pmids.length === 0) return {};
  const batchSize = 50;
  const allAbstracts = {};

  for (let i = 0; i < pmids.length; i += batchSize) {
    const batch = pmids.slice(i, i + batchSize);
    const url = new URL(`${CONFIG.pubmed.baseUrl}/efetch.fcgi`);
    url.searchParams.set('db', 'pubmed');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('rettype', 'abstract');
    url.searchParams.set('retmode', 'xml');
    url.searchParams.set('tool', CONFIG.pubmed.tool);
    url.searchParams.set('email', CONFIG.pubmed.email);

    try {
      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await resp.text();
      const abstracts = parseAbstractsFromXml(xml);
      Object.assign(allAbstracts, abstracts);
    } catch (err) {
      console.error(`  efetch batch failed: ${err.message}`);
    }
    if (i + batchSize < pmids.length) await sleep(350);
  }
  return allAbstracts;
}

function parseAbstractsFromXml(xml) {
  const results = {};
  const articles = xml.split(/<PubmedArticle>/).slice(1);
  for (const block of articles) {
    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) continue;
    const pmid = pmidMatch[1];
    const abstractParts = [];
    const absRegex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let m;
    while ((m = absRegex.exec(block)) !== null) {
      const labelMatch = m[0].match(/Label="([^"]+)"/);
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (text) {
        abstractParts.push(labelMatch ? `${labelMatch[1]}: ${text}` : text);
      }
    }
    results[pmid] = abstractParts.join(' ');
  }
  return results;
}

export function extractExistingPmids(ghPagesDir) {
  const pmids = new Set();
  try {
    const files = fs.readdirSync(ghPagesDir).filter((f) => f.startsWith(CONFIG.output.filePrefix) && f.endsWith('.html'));
    for (const file of files) {
      const content = fs.readFileSync(`${ghPagesDir}/${file}`, 'utf-8');
      const matches = content.matchAll(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/g);
      for (const match of matches) {
        pmids.add(match[1]);
      }
    }
  } catch {
    console.log('  No existing reports found, starting fresh.');
  }
  return pmids;
}

export async function fetchRecentArticles(existingPmids = new Set()) {
  const dateFilter = getDateFilter();
  console.log(`[PubMed] Date filter: ${dateFilter}`);
  console.log(`[PubMed] Existing PMIDs to exclude: ${existingPmids.size}`);

  const allPmids = new Set();
  for (const sq of SEARCH_QUERIES) {
    console.log(`[PubMed] Searching: ${sq.name}...`);
    const ids = await esearch(sq.query, dateFilter);
    console.log(`  Found ${ids.length} results`);
    for (const id of ids) allPmids.add(id);
    await sleep(350);
  }

  const newPmids = [...allPmids].filter((id) => !existingPmids.has(id));
  console.log(`[PubMed] Total unique: ${allPmids.size}, New (not in existing reports): ${newPmids.length}`);

  if (newPmids.length === 0) {
    console.log('[PubMed] No new articles found.');
    return [];
  }

  console.log('[PubMed] Fetching article details...');
  const summaries = await esummary(newPmids);
  const abstracts = await fetchAbstracts(newPmids);

  const articles = [];
  for (const pmid of newPmids) {
    const summary = summaries[pmid];
    if (!summary || !summary.title) continue;
    articles.push({
      ...summary,
      abstract: abstracts[pmid] || '',
    });
  }

  console.log(`[PubMed] Retrieved ${articles.length} complete articles.`);
  return articles;
}
