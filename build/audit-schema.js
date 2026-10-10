#!/usr/bin/env node
/** audit-schema.js — 逐页 Schema 验证:字段完整性、字段冲突、实体一致性 */
const fs = require("fs");
const path = require("path");

const DATA = {
  en: JSON.parse(fs.readFileSync("G:/Digistore24/site/data/dataset.json", "utf8")),
  de: JSON.parse(fs.readFileSync("G:/Digistore24/site-de/data/dataset.json", "utf8")),
};
const ROOTS = { en: "G:/Digistore24/site", de: "G:/Digistore24/site-de" };
const SITE_URLS = { en: "https://vsyour-cmd.github.io/digistore-picks", de: "https://vsyour-cmd.github.io/digistore-picks-de" };
const DIRS = { en: ["reviews", "category", "alternatives", "best-of", "blog", "vendors", "vendors", "."], de: ["produkte", "kategorie", "alternativen", "empfehlungen", "blog", "hersteller", "hersteller", "."] };
const PAGE_DIR = { en: "reviews", de: "produkte" };
const EXEMPT = /^(404|google[0-9a-f]+)\.html$/;

const issues = [];
const stats = { pages: 0, product: 0, faq: 0, breadcrumb: 0, organization: 0, collectionPage: 0, article: 0, website: 0, itemList: 0 };

for (const lang of ["en", "de"]) {
  const root = ROOTS[lang];
  const data = DATA[lang];
  const byId = new Map(data.products.map((p) => [String(p.id), p]));
  for (const d of DIRS[lang]) {
    const dir = path.join(root, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".html") || EXEMPT.test(f)) continue;
      const rel = d === "." ? f : d + "/" + f;
      stats.pages++;
      const html = fs.readFileSync(path.join(root, rel), "utf8");

      // 提取全部 JSON-LD
      let freeCount = 0;
      const blocks = [];
      for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        try { blocks.push(JSON.parse(m[1])); } catch (e) { issues.push(`${lang}/${rel}: JSON-LD 解析失败`); }
      }
      const types = blocks.map((b) => b["@type"]);

      // 实体混乱检查:每页至多 1 个 Product / 1 个 FAQPage / 1 个 Organization
      const count = (t) => types.filter((x) => x === t).length;
      if (freeCount) stats.free = (stats.free || 0) + 1;
      if (count("Product") > 1) issues.push(`${lang}/${rel}: ${count("Product")} 个 Product 实体(冲突)`);
      if (count("FAQPage") > 1) issues.push(`${lang}/${rel}: ${count("FAQPage")} 个 FAQPage(冲突)`);
      if (count("Organization") > 1) issues.push(`${lang}/${rel}: ${count("Organization")} 个 Organization(冲突)`);

      for (const b of blocks) {
        stats[b["@type"]] = (stats[b["@type"]] || 0) + 1;
        if (b["@type"] === "Product") {
          // 必填
          if (!b.name) issues.push(`${lang}/${rel}: Product 缺 name`);
          if (!b.offers) issues.push(`${lang}/${rel}: Product 缺 offers`);
          // Offer 字段
          const o = b.offers || {};
          if (o.price == null || Number(o.price) < 0) issues.push(`${lang}/${rel}: Offer price 异常 (${o.price})`);
          else if (Number(o.price) === 0) freeCount++;
          if (o.priceCurrency !== "USD" && o.priceCurrency !== "EUR") issues.push(`${lang}/${rel}: priceCurrency 异常 (${o.priceCurrency})`);
          if (!o.availability) issues.push(`${lang}/${rel}: Offer 缺 availability`);
          if (!o.itemCondition) issues.push(`${lang}/${rel}: Offer 缺 itemCondition`);
          if (!o.seller || !o.seller.name) issues.push(`${lang}/${rel}: Offer 缺 seller`);
          // 品牌 = 厂商(实体一致性)
          if (!b.brand || !b.brand.name) issues.push(`${lang}/${rel}: Product 缺 brand`);
          // 价格/品牌与数据集冲突
          const idMatch = rel.match(/-(\d+)\.html$/);
          if (idMatch) {
            const p = byId.get(idMatch[1]);
            if (p) {
              const dsPrice = Number(Number(p.price).toFixed(2));
              if (Number(o.price) !== dsPrice) issues.push(`${lang}/${rel}: Offer price ${o.price} ≠ 数据集 ${dsPrice}(字段冲突)`);
              if (b.brand && b.brand.name !== p.vendorName) issues.push(`${lang}/${rel}: brand "${b.brand.name}" ≠ vendor "${p.vendorName}"(实体混乱)`);
              if (o.seller && o.seller.name !== p.vendorName) issues.push(`${lang}/${rel}: seller ≠ vendor(实体混乱)`);
              // 用途附加属性存在(适用场景)
              const ap = (b.additionalProperty || []).find((x) => x.name === "Intended use");
              if (!ap || !ap.value) issues.push(`${lang}/${rel}: 缺 Intended use 附加属性`);
            }
          }
          // 图片文件存在
          if (b.image && b.image.startsWith(SITE_URLS[lang])) {
            const imgPath = path.join(root, b.image.slice(SITE_URLS[lang].length + 1));
            if (!fs.existsSync(imgPath)) issues.push(`${lang}/${rel}: Product image 不存在: ${b.image}`);
          }
        }
        if (b["@type"] === "FAQPage") {
          stats.faq++;
          const ents = b.mainEntity || [];
          if (ents.length < 4) issues.push(`${lang}/${rel}: FAQPage 仅 ${ents.length} 问(<4)`);
          for (const qa of ents) {
            if (!qa.name || qa.name.length < 8) issues.push(`${lang}/${rel}: FAQ 问题过短`);
            if (!qa.acceptedAnswer || !qa.acceptedAnswer.text || qa.acceptedAnswer.text.length < 20) issues.push(`${lang}/${rel}: FAQ 答案缺失/过短: ${qa.name}`);
          }
        }
        if (b["@type"] === "BreadcrumbList") {
          const items = b.itemListElement || [];
          items.forEach((it, i) => {
            if (it.position !== i + 1) issues.push(`${lang}/${rel}: Breadcrumb position 断序`);
            if (!it.item) issues.push(`${lang}/${rel}: Breadcrumb 缺 item`);
          });
        }
        if (b["@type"] === "Organization") {
          if (!b.name || !b.url || !b.email) issues.push(`${lang}/${rel}: Organization 缺 name/url/email`);
          if (!b.address || !b.address.addressCountry) issues.push(`${lang}/${rel}: Organization 缺 address`);
          if (!Array.isArray(b.sameAs) || !b.sameAs.length) issues.push(`${lang}/${rel}: Organization 缺 sameAs(官媒)`);
        }
      }
    }
  }
}

console.log("=== Schema 覆盖统计 ===");
console.log(`页面: ${stats.pages} | Product: ${stats.product} | FAQPage: ${stats.faq} | Breadcrumb: ${stats.breadcrumb} | Organization: ${stats.organization} | CollectionPage: ${stats.collectionPage} | Article: ${stats.article} | WebSite: ${stats.website} | ItemList: ${stats.itemList}`);
if (issues.length) {
  console.log(`\n=== 问题 (${issues.length}) ===`);
  const uniq = [...new Set(issues)];
  uniq.slice(0, 20).forEach((x) => console.log("✗", x));
  if (uniq.length > 20) console.log(`... 共 ${uniq.length} 类`);
  const byType = {};
  for (const i of uniq) { const t = i.split(": ").slice(1).join(": "); byType[t] = (byType[t] || 0) + 1; }
  Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([t, n]) => console.log(`  [${n}×] ${t}`));
} else {
  console.log("\n✓ 全部页面 Schema 校验通过:无缺失字段、无冲突、无实体混乱");
}
