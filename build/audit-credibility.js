#!/usr/bin/env node
/** audit-credibility.js — 内容可信度评分(AI 引用缺失度审计)
 * 10 因子 0-100:直接答案块/日期密度/结构化数据完整/FAQ≥6/厂商宣称标注/对比表/方法链接/披露/组织实体/新鲜度+证据块
 * 输出: 各类型均分、<60 清单(含缺失因子)、曝光代理(内链数+Top100)
 */
const fs = require("fs");
const path = require("path");

const TODAY = new Date();
const SITES = [
  { lang: "en", root: "G:/Digistore24/site", dirs: [".", "category", "reviews", "alternatives", "best-of", "blog"] },
  { lang: "de", root: "G:/Digistore24/site-de", dirs: [".", "kategorie", "produkte", "alternativen", "empfehlungen", "blog"] },
];

function inlinkMap(root, dirs, files) {
  const inl = new Map(files.map((f) => [f, 0]));
  for (const f of files) {
    const html = fs.readFileSync(path.join(root, f), "utf8");
    const base = path.posix.dirname(f);
    for (const m of html.matchAll(/href="([^"#?]*\.html)(?:[?#][^"]*)?"/g)) {
      let l = m[1];
      if (/^https?:|^mailto:|^#/.test(l)) continue;
      const resolved = path.posix.normalize(path.posix.join(base === "." ? "" : base, l)).replace(/\\/g, "/");
      if (resolved.startsWith("../") || !inl.has(resolved)) continue;
      inl.set(resolved, (inl.get(resolved) || 0) + 1);
    }
  }
  return inl;
}

// 各类型的必达因子(Product 全项;其他类型排除不适用的项)
const TYPE_REQ = {
  product:     ["direct-answer-block", "explicit-dates>=2", "schema-product-complete", "faq>=6-questions", "vendor-claims-labeled", "comparison-table", "method-link", "affiliate-disclosure", "organization-entity", "fresh<=7d", "evidence-conditions"],
  alternatives:["direct-answer-block", "explicit-dates>=2", "comparison-table", "method-link", "affiliate-disclosure", "organization-entity", "fresh<=7d", "evidence-conditions"],
  bestof:      ["direct-answer-block", "explicit-dates>=2", "comparison-table", "method-link", "affiliate-disclosure", "organization-entity", "fresh<=7d", "evidence-conditions"],
  category:    ["direct-answer-block", "explicit-dates>=2", "faq>=4-questions", "comparison-table", "method-link", "affiliate-disclosure", "organization-entity", "fresh<=7d", "evidence-conditions"],
  blog:        ["explicit-dates>=2", "method-link", "affiliate-disclosure", "organization-entity", "fresh<=7d"],
  other:       ["explicit-dates>=2", "organization-entity", "affiliate-disclosure"],
  index:       ["organization-entity", "affiliate-disclosure", "fresh<=7d"],
};

function scorePage(html, file, type, freshnessDays) {
  const factors = [];
  const has = (re) => re.test(html);
  const add = (name, pass, weight) => factors.push({ name, pass: !!pass, weight });

  add("direct-answer-block", has(/class="tldr"/), 12);
  const dates = (html.match(/20\d{2}-\d{2}-\d{2}/g) || []).length;
  add("explicit-dates>=2", dates >= 2, 8);
  const ld = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { const j = JSON.parse(m[1]); Array.isArray(j) ? ld.push(...j) : ld.push(j); } catch {}
  }
  const types = new Set(ld.map((b) => b["@type"]));
  const prod = ld.find((b) => b["@type"] === "Product");
  const prodComplete = !!(prod && prod.sku && prod.offers && prod.offers.itemCondition && prod.offers.seller && prod.brand && prod.additionalProperty);
  add("schema-product-complete", prodComplete, 15);
  const faqLd = ld.find((b) => b["@type"] === "FAQPage");
  const faqN = faqLd && faqLd.mainEntity ? faqLd.mainEntity.length : 0;
  add("faq>=6-questions", faqN >= 6, 12);
  add("faq>=4-questions", faqN >= 4, 8);
  add("vendor-claims-labeled", has(/vendor claims|vendor's own marketing|Anbieteraussagen|eigene Werbeaussagen/), 10);
  add("comparison-table", has(/<table class="specs"/), 10);
  add("method-link", has(/digistore24-numbers-checklist|zahlen-checkliste|6-point|6-Punkte/), 8);
  add("affiliate-disclosure", has(/affiliate disclosure|Werbe-Hinweis|Affiliate disclosure/i), 5);
  add("organization-entity", types.has("Organization"), 10);
  add("fresh<=7d", freshnessDays <= 7, 5);
  const evidence = has(/Evidence base|Belegbasis|verification conditions|Validierung|Evidence & verification|Beleg- & Validierungsbedingungen/i);
  add("evidence-conditions", evidence, 5);
  let req = (TYPE_REQ[type] || TYPE_REQ.other).slice();
  if (type === "category" && /-p[0-9]+\.html$/.test(file)) req = req.filter((x) => x !== "faq>=4-questions");
  const required = factors.filter((f) => req.includes(f.name));
  const score = Math.round((required.reduce((a, f) => a + (f.pass ? f.weight : 0), 0) / Math.max(required.reduce((a, f) => a + f.weight, 0), 1)) * 100);
  return { score, missing: required.filter((f) => !f.pass).map((f) => f.name), factors, evidence };
}

for (const S of SITES) {
  const files = [];
  for (const d of S.dirs) {
    const p = path.join(S.root, d);
    if (!fs.existsSync(p)) continue;
    for (const f of fs.readdirSync(p)) if (f.endsWith(".html") && f !== "404.html" && !/^google/.test(f)) files.push(d === "." ? f : d + "/" + f);
  }
  const inl = inlinkMap(S.root, S.dirs, files);
  const scraped = S.lang === "en" ? "G:/Digistore24/site/data/dataset.json" : "G:/Digistore24/site-de/data/dataset.json";
  const scrapedAt = JSON.parse(fs.readFileSync(scraped, "utf8")).scrapedAt;
  const freshnessDays = Math.floor((TODAY - new Date(scrapedAt)) / 86400000);

  const rows = [];
  for (const file of files) {
    const html = fs.readFileSync(path.join(S.root, file), "utf8");
    const type = /(^|\/)index\.html$/.test(file) ? "index" : file.startsWith("reviews") || file.startsWith("produkte") ? "product"
      : file.startsWith("alternat") ? "alternatives"
      : file.startsWith("best") || file.startsWith("empfehl") ? "bestof"
      : file.startsWith("blog") ? "blog"
      : file.includes("category") || file.includes("kategorie") ? "category" : "other";
    const { score, missing, evidence } = scorePage(html, file, type, freshnessDays);
    rows.push({ file, type, score, missing, inlinks: inl.get(file) || 0, evidence });
  }
  rows.sort((a, b) => a.score - b.score);

  // 曝光代理 = 内链数(站内被引次数);Top100/alternatives/bestof 视为高曝光
  const isExposed = (r) => r.inlinks >= 5 || /top-20|top-100|best-|empfehlungen\/beste|alternat|index/.test(r.file) || r.type === "category";
  const lowExposed = rows.filter((r) => r.score < 60 && isExposed(r));
  const byType = {};
  for (const r of rows) {
    byType[r.type] = byType[r.type] || { n: 0, sum: 0, low: 0 };
    byType[r.type].n++; byType[r.type].sum += r.score;
    if (r.score < 60) byType[r.type].low++;
  }
  console.log(`\n=== ${S.lang.toUpperCase()} (${rows.length} pages, 数据新鲜度 ${freshnessDays}d) ===`);
  for (const [t, v] of Object.entries(byType).sort()) {
    console.log(`  ${t}: n=${v.n} 均分 ${Math.round(v.sum / v.n)} | <60: ${v.low}`);
  }
  console.log(`  低分且高曝光(优先重构): ${lowExposed.length}`);
  lowExposed.slice(0, 6).forEach((r) => console.log(`   [${r.score}] ${r.file} 缺:${r.missing.join(",")} | 内链${r.inlinks}`));
  fs.writeFileSync(`G:/Digistore24/data/credibility-${S.lang}.json`, JSON.stringify({ generatedAt: TODAY.toISOString(), freshnessDays, rows }, null, 1));
}
console.log("\nreports → G:/Digistore24/data/credibility-{en,de}.json");
