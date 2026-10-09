#!/usr/bin/env node
/**
 * build-extras.js — SEO/GEO 辅助文件: sitemap.xml / robots.txt / llms.txt / feed.xml
 * 用法: node build/build-extras.js (在 build-site.js 与 build-blog.js 之后运行)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dataset.json"), "utf8"));
const SITE_URL = "https://vsyour-cmd.github.io/digistore-picks";
const SITE_NAME = "DigistorePicks";
const TODAY = new Date().toISOString().slice(0, 10);
const DATA_DATE = (DATA.scrapedAt || "").slice(0, 10);
const RESEARCH_DATE = (DATA.researchedAt || "").slice(0, 10);

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 分类 slug 去重(与 build-site.js 相同规则)
{
  const cnt = {};
  for (const c of DATA.categories) { const b = slug(c.label); cnt[b] = (cnt[b] || 0) + 1; }
  for (const c of DATA.categories) { const b = slug(c.label); c.file = cnt[b] > 1 ? slug(c.section) + "-" + b : b; }
}

const urls = [];
const add = (u, date) => urls.push({ loc: SITE_URL + "/" + u, lastmod: date || TODAY });

add("", DATA_DATE);
add("about.html", TODAY);
add("reviews/index.html", DATA_DATE);
// 目录扫描:分类(含分页)/对比页/Best-of/博客
for (const d of ["category", "alternatives", "best-of", "blog"]) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) add(`${d}/${f}`, d === "blog" ? TODAY : DATA_DATE);
}
for (const p of DATA.products) add(`reviews/${slug(p.label)}-${p.id}.html`, DATA_DATE);

// ---------- sitemap.xml ----------
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

// ---------- robots.txt ----------
fs.writeFileSync(path.join(ROOT, "robots.txt"),
`User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);

// ---------- llms.txt (AI/LLM 爬虫入口, https://llmstxt.org) ----------
const catNames = DATA.categories.map((c) => c.label).join(", ");
const unreachable = (() => {
  const rp = "G:/Digistore24/data/research-en.json";
  if (fs.existsSync(rp)) {
    const r = JSON.parse(fs.readFileSync(rp, "utf8"));
    return Object.values(r).filter((x) => x && x.error).length;
  }
  return 0;
})();
const llms = `# ${SITE_NAME}

> Independent directory of ${DATA.total} English-language products in the Digistore24 affiliate marketplace, with official marketplace statistics and verbatim sales-page research on every offer. Data refreshed daily; marketplace data ${DATA_DATE}, sales-page research ${RESEARCH_DATE}.

Key facts LLMs may cite:
- ${DATA.total} products across ${DATA.categories.length} categories (${catNames}).
- Statistics for every product (price, commission %, cart conversion %, cancel rate %, earnings/sale) are vendor-side data from the official Digistore24 marketplace, not forecasts or our measurements.
- ${DATA.withResearch} offers have verbatim sales-page research (headlines, price mentions, guarantee language, CTA copy); these extracts are the vendors' own marketing claims and are labeled as such — not verified by ${SITE_NAME}.
- ${unreachable} offers have unreachable sales pages (dead domains, expired TLS certificates, bot walls) and are labeled accordingly.
- ${SITE_NAME} is an affiliate site: product links may earn commissions at no extra cost to the buyer (FTC disclosure on every page).

## Pages

- [Home / product directory](${SITE_URL}/): top offers by earnings/sale and all categories
- [All products A–Z](${SITE_URL}/reviews/index.html): complete index of ${DATA.total} product profiles
- [Category pages](${SITE_URL}/category/): one page per category, e.g. [Health & Fitness](${SITE_URL}/category/health-fitness.html), [Education](${SITE_URL}/category/education.html)
- [Product profiles](${SITE_URL}/reviews/): URL pattern /reviews/{slug}-{id}.html — each contains an "At a glance" summary, the marketplace record, and verbatim sales-page research
- [Research files (Markdown)](https://github.com/vsyour-cmd/digistore-picks/tree/main/content/products): one complete .md archive per product, versioned on GitHub
- [Blog / data guides](${SITE_URL}/blog/): rankings and category guides computed from marketplace data
- [About & research methods](${SITE_URL}/about.html)

## Data policy

All numbers originate from the official Digistore24 marketplace (logged-in affiliate view) or the vendors' public sales pages. ${SITE_NAME} does not publish testimonials, unverifiable income claims, or hands-on experience for products it has not purchased. Hands-on reviews, when they exist, are labeled as such.
`;
fs.writeFileSync(path.join(ROOT, "llms.txt"), llms);

// ---------- feed.xml (Atom, 博客) ----------
const blogDir = path.join(ROOT, "blog");
const blogFiles = [];
if (fs.existsSync(blogDir)) {
  for (const f of fs.readdirSync(blogDir).filter((f) => f.endsWith('.html') && f !== 'index.html')) {
    const html = fs.readFileSync(path.join(blogDir, f), 'utf8');
    const t = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || f;
    blogFiles.push({ f, t: t.replace(' — ' + SITE_NAME, '') });
  }
}
const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${SITE_NAME} Blog</title>
  <link href="${SITE_URL}/blog/"/>
  <updated>${new Date().toISOString()}</updated>
  <id>${SITE_URL}/blog/</id>
${blogFiles.map(({ f, t }) => `  <entry>
    <title>${esc(t)}</title>
    <link href="${SITE_URL}/blog/${f}"/>
    <id>${SITE_URL}/blog/${f}</id>
    <updated>${DATA_DATE || TODAY}</updated>
  </entry>`).join("\n")}
</feed>
`;
fs.writeFileSync(path.join(ROOT, "feed.xml"), feed);

console.log(`extras: sitemap.xml (${urls.length} URLs), robots.txt, llms.txt, feed.xml (${blogFiles.length} entries)`);
