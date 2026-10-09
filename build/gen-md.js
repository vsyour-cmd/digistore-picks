#!/usr/bin/env node
/**
 * gen-md.js — 为每个产品生成完整 MD 档案 → content/products/{id}-{slug}.md
 * 内容 = marketplace 官方数据 + 销售页研究素材 + 推广链接
 * 用法: node build/gen-md.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dataset.json"), "utf8"));
const OUT = path.join(ROOT, "content", "products");
fs.mkdirSync(OUT, { recursive: true });

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const money = (n, cur) => (cur === "EUR" ? "€" : "$") + (n == null ? "—" : Number(n).toFixed(2));
const pct = (n) => (n == null ? "—" : Number(n).toFixed(2).replace(/\.?0+$/, "") + "%");
const datemark = (iso) => (iso ? iso.slice(0, 10) : "");
const li = (arr) => (arr && arr.length ? arr.map((x) => `- ${x}`).join("\n") : "- (none found)");

for (const p of DATA.products) {
  const r = p.research || null;
  const file = `${p.id}-${slug(p.label)}.md`;
  const lines = [];

  lines.push(`# ${p.label}`);
  lines.push("");
  lines.push(`> Product ID \`${p.id}\` · Digistore24 productId \`${p.productId}\` · [HTML profile page](../../reviews/${slug(p.label)}-${p.id}.html)`);
  lines.push(`> Marketplace data: ${datemark(DATA.scrapedAt)} · Sales-page research: ${datemark(DATA.researchedAt) || "—"} · Research quality: **${r ? r.quality + (r.method === "browser-render" ? " (browser-rendered)" : "") : r === null && p.research === undefined ? "not retrieved" : "unreachable"}**`);
  lines.push("");
  lines.push("## 1. Marketplace record (official Digistore24 data)");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Product type | ${p.type} |`);
  lines.push(`| Price | ${money(p.price, p.currency)} (${(p.billingTypes || []).join(", ") || "see sales page"}) |`);
  lines.push(`| Affiliate commission | ${pct(p.commission)} |`);
  lines.push(`| Earnings/sale* | ${money(p.earningsPerSale, p.currency)} |`);
  lines.push(`| Cart conversion* | ${pct(p.conversionRate)} |`);
  lines.push(`| Cancel rate* | ${pct(p.cancelRate)} |`);
  lines.push(`| Vendor | ${p.vendorName} |`);
  lines.push(`| Listed since | ${datemark(p.createdAt)} |`);
  lines.push(`| Auto-accept affiliates | ${p.autoAccept ? "yes" : "no (approval required)"} |`);
  lines.push(`| Categories | ${p.categories.join(", ") || "Uncategorized"} |`);
  lines.push("");
  lines.push(`*Vendor-side marketplace statistics; depend on traffic quality, not a forecast.`);
  if (p.description) {
    lines.push("");
    lines.push(`**Vendor's marketplace description:** ${p.description}`);
  }
  lines.push("");
  lines.push("## 2. Links");
  lines.push("");
  lines.push(`- **Promo link (affiliate):** ${p.promoLink}`);
  lines.push(`- Sales page: ${p.salesPageUrl || "(none listed)"}`);
  if (p.affiliateSupportPageUrl) lines.push(`- Vendor affiliate support: ${p.affiliateSupportPageUrl}`);
  lines.push(`- Canonical redirect: https://www.digistore24.com/redir/${p.productId}/${DATA.affiliateId}`);
  lines.push("");

  lines.push("## 3. Sales-page research (vendor claims, not verified by us)");
  lines.push("");
  if (r && !r.error) {
    if (r.title) lines.push(`- **Page title:** ${r.title}`);
    if (r.ogTitle && r.ogTitle !== r.title) lines.push(`- **OG title:** ${r.ogTitle}`);
    if (r.metaDescription) lines.push(`- **Meta description:** ${r.metaDescription}`);
    if (r.finalUrl && r.finalUrl !== p.salesPageUrl) lines.push(`- **Final URL after redirects:** ${r.finalUrl}`);
    if (r.h1 && r.h1.length) { lines.push(`- **Headline (H1):**`); r.h1.forEach((h) => lines.push(`  > ${h}`)); }
    if (r.h2 && r.h2.length) { lines.push(`- **Section headlines (H2):**`); r.h2.forEach((h) => lines.push(`  - ${h}`)); }
    else if (r.h3 && r.h3.length) { lines.push(`- **Section headlines (H3):**`); r.h3.forEach((h) => lines.push(`  - ${h}`)); }
    if (r.priceMentions && r.priceMentions.length) lines.push(`- **Price mentions on page:** ${r.priceMentions.join(", ")}`);
    if (r.guaranteeMention) lines.push(`- **Guarantee mention:** "${r.guaranteeMention}" (verify on the official page before relying on it)`);
    if (r.ctaTexts && r.ctaTexts.length) lines.push(`- **CTA button texts:** ${r.ctaTexts.map((t) => `"${t}"`).join(", ")}`);
    if (r.checkoutLinks && r.checkoutLinks.length) { lines.push(`- **Digistore24 checkout links found:**`); r.checkoutLinks.forEach((u) => lines.push(`  - ${u}`)); }
    if (r.excerpt && r.excerpt.length) { lines.push(`- **Opening copy (first paragraphs):**`); r.excerpt.forEach((t) => lines.push(`  > ${t}`)); }
    if (r.faqQuestions && r.faqQuestions.length) { lines.push(`- **Questions the sales page answers:**`); r.faqQuestions.forEach((q) => lines.push(`  - ${q}`)); }
    lines.push(`- **Page word count:** ${r.wordCount}`);
    if (r.ogImage) lines.push(`- **OG image:** ${r.ogImage}`);
  } else if (r && r.error) {
    lines.push(`> Research could not be completed: ${r.error}`);
    lines.push(">");
    lines.push("> Treat all claims about this product as unverified until the official sales page can be reached. An unreachable/expired sales page is itself a red flag for the offer's current state.");
  } else {
    lines.push("> Sales page not yet researched. This section will be filled by the next research run.");
  }
  lines.push("");
  lines.push("> ⚠️ Everything in section 3 is extracted from the vendor's own sales page and reflects the vendor's marketing claims. We do not verify outcomes, testimonials or income claims.");
  lines.push("");
  lines.push("## 4. Editorial notes");
  lines.push("");
  lines.push("(reserved for hands-on review notes — must be based on actual purchase and use; screenshots own)");
  lines.push("");
  fs.writeFileSync(path.join(OUT, file), lines.join("\n"));
}
console.log(`wrote ${DATA.products.length} MD files → content/products/`);
