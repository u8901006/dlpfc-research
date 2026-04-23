import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { fetchRecentArticles, extractExistingPmids } from './pubmed.js';
import { analyzeArticles } from './ai-client.js';
import { generateDailyPage, generateIndexPage } from './html-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getExistingReports(outputDir) {
  const reports = [];
  try {
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      const match = file.match(new RegExp(`^${CONFIG.output.filePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{4}-\\d{2}-\\d{2})\\.html$`));
      if (match) {
        reports.push({ date: match[1], filename: file });
      }
    }
  } catch {}
  return reports;
}

function isWithinLast7Days(dateStr) {
  const reportDate = new Date(dateStr);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  return reportDate >= sevenDaysAgo;
}

async function main() {
  console.log('=== DLPFC Research Daily Update ===');
  console.log(`Date: ${getToday()}`);

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ZHIPU_API_KEY environment variable is required');
    process.exit(1);
  }

  const ghPagesDir = process.env.GH_PAGES_DIR || path.join(projectRoot, 'gh-pages');
  const outputDir = process.env.OUTPUT_DIR || path.join(projectRoot, CONFIG.output.dir);

  console.log(`[Setup] gh-pages dir: ${ghPagesDir}`);
  console.log(`[Setup] output dir: ${outputDir}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (fs.existsSync(ghPagesDir)) {
    console.log('[Setup] Copying existing gh-pages content...');
    const files = fs.readdirSync(ghPagesDir);
    for (const file of files) {
      const src = path.join(ghPagesDir, file);
      const dst = path.join(outputDir, file);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dst);
      }
    }
  }

  const existingPmids = extractExistingPmids(outputDir);
  console.log(`[Dedup] Found ${existingPmids.size} existing PMIDs in reports`);

  const recentReports = getExistingReports(outputDir).filter((r) => isWithinLast7Days(r.date));
  console.log(`[Dedup] ${recentReports.length} reports within last 7 days`);

  console.log('[PubMed] Fetching recent articles...');
  const articles = await fetchRecentArticles(existingPmids);

  if (articles.length === 0) {
    console.log('[Done] No new articles found. Generating index only...');
    const allReports = getExistingReports(outputDir);
    const indexHtml = generateIndexPage(allReports);
    fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf-8');
    console.log('[Done] Index page updated.');
    return;
  }

  console.log(`[AI] Analyzing ${articles.length} articles...`);
  const analysis = await analyzeArticles(articles, apiKey);
  console.log(`[AI] Analysis complete. ${analysis.articles.length} articles processed.`);

  const today = getToday();
  const dailyFilename = `${CONFIG.output.filePrefix}${today}.html`;
  const dailyHtml = generateDailyPage(today, analysis);
  fs.writeFileSync(path.join(outputDir, dailyFilename), dailyHtml, 'utf-8');
  console.log(`[HTML] Generated: ${dailyFilename}`);

  const allReports = getExistingReports(outputDir);
  const indexHtml = generateIndexPage(allReports);
  fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf-8');
  console.log('[HTML] Index page updated.');

  console.log(`[Done] Total reports: ${allReports.length}`);
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
