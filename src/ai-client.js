import { CONFIG } from './config.js';

function repairJson(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;

  try {
    return JSON.parse(s);
  } catch {}

  const cb = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) {
    s = cb[1].trim();
    try { return JSON.parse(s); } catch {}
  }

  s = s.replace(/,\s*([}\]])/g, '$1');

  try { return JSON.parse(s); } catch {}

  const oB = s.indexOf('{');
  const cB = s.lastIndexOf('}');
  if (oB !== -1 && cB > oB) {
    let sub = s.substring(oB, cB + 1);
    sub = sub.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(sub); } catch {}

    let depth = 0;
    let lastValid = -1;
    for (let i = 0; i < sub.length; i++) {
      if (sub[i] === '{' || sub[i] === '[') depth++;
      else if (sub[i] === '}' || sub[i] === ']') {
        depth--;
        if (depth === 0) lastValid = i;
      }
    }
    if (lastValid > 0) {
      try { return JSON.parse(sub.substring(0, lastValid + 1)); } catch {}
    }
  }

  const aMatch = s.match(/\[[\s\S]*\]/);
  if (aMatch) {
    let a = aMatch[0];
    a = a.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(a); } catch {}
  }

  console.error('  [JSON] All repair attempts failed');
  return null;
}

async function callZhipuAPI(apiKey, model, messages, maxTokens, timeout) {
  const url = `${CONFIG.zhipu.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: CONFIG.zhipu.temperature,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API HTTP ${resp.status}: ${errText.substring(0, 300)}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response content');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

async function callWithFallback(apiKey, messages) {
  const errors = [];
  for (const model of CONFIG.zhipu.models) {
    try {
      console.log(`  [AI] Trying model: ${model}...`);
      const content = await callZhipuAPI(
        apiKey,
        model,
        messages,
        CONFIG.zhipu.maxTokens,
        CONFIG.zhipu.timeout
      );
      console.log(`  [AI] ${model} succeeded (${content.length} chars)`);
      return { content, model };
    } catch (err) {
      console.error(`  [AI] ${model} failed: ${err.message}`);
      errors.push({ model, error: err.message });
    }
  }
  throw new Error(`All models failed: ${errors.map((e) => `${e.model}: ${e.error}`).join('; ')}`);
}

function buildAnalysisPrompt(articles) {
  const articleTexts = articles.map((a, i) => {
    return `[${i + 1}] PMID: ${a.pmid}
Title: ${a.title}
Journal: ${a.journal}
Authors: ${a.authors.slice(0, 5).join(', ')}${a.authors.length > 5 ? ' et al.' : ''}
Date: ${a.pubDate}
Abstract: ${a.abstract || 'No abstract available'}`;
  }).join('\n\n---\n\n');

  return [
    {
      role: 'system',
      content: `你是前額葉皮質（PFC）研究領域的專業文獻分析師。你的任務是分析 PubMed 最新文獻，並以繁體中文生成結構化的日報內容。

你需要嚴格按照以下 JSON 格式回應（不要包含任何 markdown 或其他文字，只回應純 JSON）：

{
  "trend_summary": "2-3句話的今日文獻趨勢摘要",
  "articles": [
    {
      "pmid": "PMID",
      "title_zh": "繁體中文標題翻譯",
      "title_en": "英文原標題",
      "journal": "期刊名稱",
      "summary": "2-3句話的繁體中文摘要說明",
      "emoji": "最合適的 emoji",
      "utility": "high/mid/low",
      "tags": ["標籤1", "標籤2"],
      "category": "分類",
      "pico": {
        "P": "Population",
        "I": "Intervention",
        "C": "Comparison",
        "O": "Outcome"
      }
    }
  ],
  "keywords": ["關鍵字1", "關鍵字2", "..."],
  "topic_distribution": {
    "主題名稱": 數量
  }
}

重要規則：
1. 所有中文內容使用繁體中文
2. utility 根據臨床實用性評分：high=高實用性、mid=中、low=低
3. pico 僅對臨床研究適用，若是基礎研究可填 N/A
4. tags 每篇文章 1-3 個標籤
5. 選出 utility 最高的前 5 篇作為精選
6. topic_distribution 涵蓋所有文章的主題分類
7. emoji 要精確反映文章主題`,
    },
    {
      role: 'user',
      content: `以下是今天從 PubMed 搜集到的 ${articles.length} 篇前額葉皮質相關最新文獻，請分析並生成繁體中文日報：

${articleTexts}`,
    },
  ];
}

export async function analyzeArticles(articles, apiKey) {
  if (articles.length === 0) {
    return { trend_summary: '今日無新文獻。', articles: [], keywords: [], topic_distribution: {} };
  }

  const batchSize = 25;
  const allResults = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    console.log(`[AI] Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)} (${batch.length} articles)...`);

    const messages = buildAnalysisPrompt(batch);
    const { content, model } = await callWithFallback(apiKey, messages);

    let parsed = repairJson(content);
    if (!parsed) {
      console.error('  [AI] JSON repair failed, retrying with extraction prompt...');
      const retryMessages = [
        {
          role: 'system',
          content: '你是一個 JSON 修復助手。請將以下內容轉換為有效的 JSON 格式，只輸出純 JSON。',
        },
        {
          role: 'user',
          content: `請修復以下內容為有效 JSON：\n\n${content}`,
        },
      ];
      try {
        const retryResult = await callWithFallback(apiKey, retryMessages);
        parsed = repairJson(retryResult.content);
      } catch (err) {
        console.error(`  [AI] Retry also failed: ${err.message}`);
      }
    }

    if (parsed) {
      const articlesArr = parsed.articles || parsed;
      if (Array.isArray(articlesArr)) {
        allResults.push(...articlesArr);
      }
    } else {
      console.error('  [AI] Could not parse response, creating minimal entries...');
      for (const article of batch) {
        allResults.push({
          pmid: article.pmid,
          title_zh: article.title,
          title_en: article.title,
          journal: article.journal,
          summary: article.abstract ? article.abstract.substring(0, 200) + '...' : 'No abstract available',
          emoji: '📄',
          utility: 'mid',
          tags: ['前額葉'],
          category: 'General',
          pico: { P: 'N/A', I: 'N/A', C: 'N/A', O: 'N/A' },
        });
      }
    }
  }

  const trendSummary = allResults.length > 0
    ? `今日共收錄 ${allResults.length} 篇前額葉皮質相關文獻，涵蓋多個研究領域。`
    : '今日無新文獻。';

  const keywords = [...new Set(allResults.flatMap((a) => a.tags || []))].slice(0, 12);
  const topicDist = {};
  for (const a of allResults) {
    const cat = a.category || '其他';
    topicDist[cat] = (topicDist[cat] || 0) + 1;
  }

  return {
    trend_summary: trendSummary,
    articles: allResults,
    keywords,
    topic_distribution: topicDist,
    model: CONFIG.zhipu.models[0],
  };
}
