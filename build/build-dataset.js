#!/usr/bin/env node
/**
 * build-dataset.js — 合并 marketplace 抓取数据 + 销售页研究 → data/dataset.json
 * 输入(均在 G:/Digistore24/data/):
 *   products-en.json    marketplace 产品列表(scrape 阶段输出)
 *   categories-en.json  分类映射(scrape 阶段输出)
 *   promo-fixed.json    特殊产品的真实推广链接(可缺省)
 *   research-en.json    销售页研究 {id: {...}}(fetch-research.js 输出,可缺省)
 * 输出: site/data/dataset.json
 */
const fs = require("fs");
const path = require("path");

const D = "G:/Digistore24/data";
const AFF = process.env.AFF_ID || "adminstore";
const read = (f) => {
  const p = path.join(D, f);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
};

const d = read("products-en.json");
const cats = read("categories-en.json");
const fixed = read("promo-fixed.json") || {};
const research = read("research-en.json") || {};

if (!d) { console.error("missing products-en.json"); process.exit(1); }

const id2cats = {};
if (cats) for (const c of cats.categories) {
  for (const pid of (c.ids || [])) {
    (id2cats[pid] = id2cats[pid] || []).push({ catId: c.catId, label: c.label });
  }
}

function promoLink(p) {
  const s = p.salesPageUrl || "";
  const canonical = `https://www.digistore24.com/redir/${p.productId}/${AFF}`;
  if (!s || /\[[A-Z]+\]/.test(s) || s.includes("#")) return canonical;
  if (fixed[p.id]) {
    const f = fixed[p.id];
    // API 给的 promo 自身也是模板垃圾时,退回规范重定向
    return /\[[A-Z]+\]/.test(f) ? canonical : f;
  }
  const q = s.includes("?") ? "&" : "?";
  // Digistore24 自家域名:查询参数形式(官方追踪格式,如 ?voucher=X&aff=adminstore)
  if (/^https?:\/\/[^/]*(digistore24\.com|checkout-ds24\.com)/i.test(s)) {
    return `${s}${q}aff=${AFF}`;
  }
  // vendor 域名:查询参数 + 锚点双保险(DS24 JS 读 #aff, funnel 工具读 ?aff)
  return `${s}${q}aff=${AFF}#aff=${AFF}`;
}

const products = d.products.map((p) => {
  const img = p.imageUrl && p.imageUrl.startsWith("/pb/") ? "https://www.digistore24.com" + p.imageUrl : null;
  const r = research[p.id] || null;
  return {
    id: p.id,
    productId: p.productId,
    label: p.label,
    type: p.type,
    price: p.price,
    currency: p.currency,
    commission: p.commission,
    conversionRate: p.conversionRate,
    cancelRate: p.cancelRate,
    earningsPerSale: p.earningsPerSale,
    earningsPerClick: p.earningsPerOrderformClick,
    vendorName: p.vendorName,
    description: p.description,
    imageUrl: img,                       // marketplace 官方图(可能为 null)
    salesPageUrl: p.salesPageUrl,
    promoLink: promoLink(p),
    affiliateSupportPageUrl: p.affiliateSupportPageUrl,
    autoAccept: p.acceptsAffiliationsAutomatically,
    billingTypes: p.billingTypes,
    createdAt: p.createdAt,
    categories: (id2cats[p.id] || []).map((c) => c.label),
    categoryIds: (id2cats[p.id] || []).map((c) => c.catId),
    ...(r && !r.error ? { research: r } : {}),
  };
});

const categoryIndex = cats
  ? cats.categories.filter((c) => c.ids.length > 0).map((c) => ({
      catId: c.catId, section: c.section, label: c.label, count: c.ids.length,
    }))
  : [];

const out = {
  affiliateId: AFF,
  scrapedAt: d.scrapedAt,
  researchedAt: fs.existsSync(path.join(D, "research-en.json"))
    ? JSON.parse(fs.readFileSync(path.join(D, "research-meta.json"), "utf8")).researchedAt || null
    : null,
  language: "en",
  total: products.length,
  withResearch: products.filter((p) => p.research).length,
  categories: categoryIndex,
  products,
};

const dst = path.join(__dirname, "..", "data", "dataset.json");
fs.writeFileSync(dst, JSON.stringify(out));
console.log(`dataset.json: ${products.length} products, ${out.withResearch} with sales-page research → ${dst}`);
