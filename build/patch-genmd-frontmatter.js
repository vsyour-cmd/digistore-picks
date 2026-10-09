#!/usr/bin/env node
/** patch-genmd-frontmatter.js — 在 MD 档案顶部加 YAML frontmatter(机器可读,AI 收录友好) */
const fs = require("fs");
for (const [file, meta] of [
  ["G:/Digistore24/site/build/gen-md.js", { data: "G:/Digistore24/site/data/dataset.json" }],
  ["G:/Digistore24/site-de/build/gen-md.js", { data: "G:/Digistore24/site-de/data/dataset.json" }],
]) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes("product_id:")) { console.log(file, "already patched"); continue; }
  const anchor = "  lines.push(`# ${p.label}`);";
  if (!s.includes(anchor)) { console.error(file, "anchor not found"); process.exit(1); }
  const inject = [
    "  const yq = (v) => JSON.stringify(v == null ? \"\" : String(v));",
    "  const ynum = (v) => (v == null ? 0 : Math.round(Number(v) * 100) / 100);",
    "  lines.push(\"---\");",
    "  lines.push(`product_id: ${yq(p.id)}`);",
    "  lines.push(`digistore24_product_id: ${p.productId}`);",
    "  lines.push(`title: ${yq(p.label)}`);",
    "  lines.push(`vendor: ${yq(p.vendorName)}`);",
    "  lines.push(`product_type: ${yq(p.type)}`);",
    "  lines.push(`price: ${ynum(p.price)}`);",
    "  lines.push(`currency: ${yq(p.currency || \"USD\")}`);",
    "  lines.push(`affiliate_commission_pct: ${p.commission == null ? 0 : p.commission}`);",
    "  lines.push(`earnings_per_sale: ${ynum(p.earningsPerSale)}`);",
    "  lines.push(`cart_conversion_pct: ${p.conversionRate == null ? 0 : p.conversionRate}`);",
    "  lines.push(`cancel_rate_pct: ${p.cancelRate == null ? 0 : p.cancelRate}`);",
    "  lines.push(`categories: ${JSON.stringify(p.categories || [])}`);",
    "  lines.push(`listed_since: ${yq((p.createdAt || \"\").slice(0, 10))}`);",
    "  lines.push(`marketplace_data_date: ${yq((DATA.scrapedAt || \"\").slice(0, 10))}`);",
    "  lines.push(`research_date: ${yq(((DATA.researchedAt || \"\") + \"\").slice(0, 10))}`);",
    "  lines.push(`research_quality: ${yq(p.research ? p.research.quality : (p.research === null ? \"unreachable\" : \"none\"))}`);",
    "  lines.push(`promo_link: ${yq(p.promoLink)}`);",
    "  lines.push(`sales_page: ${yq(p.salesPageUrl || \"\")}`);",
    "  lines.push(`language: ${yq(DATA.language || \"en\")}`);",
    "  lines.push(\"---\");",
    anchor,
  ].join("\n");
  s = s.replace(anchor, inject);
  fs.writeFileSync(file, s);
  console.log(file, "patched");
}
