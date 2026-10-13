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
const seen = new Set();
const add = (u, date, image) => { if (seen.has(u)) return; seen.add(u); urls.push({ loc: SITE_URL + "/" + u, lastmod: date || TODAY, image }); };

// 图片 sitemap:产品页附本地图(manifest)
const IMG_DIR = path.join(ROOT, "assets", "products");
function localImg(id) {
  const m = path.join(IMG_DIR, id + ".img.json");
  if (fs.existsSync(m)) {
    try { const j = JSON.parse(fs.readFileSync(m, "utf8")); if (j.local) return SITE_URL + "/" + j.local; } catch {}
  }
  return null;
}

add("", DATA_DATE);
add("about.html", TODAY);
add("monthly-new.html", TODAY);
add("price-watch.html", TODAY);
add("amazon-picks.html", TODAY);
add("changelog.html", TODAY);
add("digistore24-refunds.html", TODAY);
add("is-digistore24-safe.html", TODAY);
add("buy-with-confidence.html", TODAY);
add("reviews/index.html", DATA_DATE);
// 目录扫描:分类(含分页)/对比页/Best-of/博客
for (const d of ["category", "alternatives", "best-of", "blog", "vendors"]) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) add(`${d}/${f}`, d === "blog" ? TODAY : DATA_DATE);
}
for (const p of DATA.products) {
  const img = localImg(p.id);
  add(`reviews/${slug(p.label)}-${p.id}.html`, DATA_DATE, img);
}
// 分类 FAQ 枢纽页(50 问/分类)
for (const c of DATA.categories) add(`faq/${c.file}.html`, TODAY);
// deep-dive 顾问页(收益 Top10,与 build-site.js 的 GUIDE_POOL 同一筛选)
for (const p of [...DATA.products].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)).slice(0, 10)) {
  add(`reviews/${slug(p.label || "Digistore24 product " + p.id)}-${p.id}/guide.html`, TODAY);
}

// ---------- sitemap.xml ----------
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>${u.image ? `\n    <image:image>\n      <image:loc>${u.image}</image:loc>\n    </image:image>` : ""}\n  </url>`).join("\n")}
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

// ---------- llms-full.txt(关键数据一文件版,AI 批量检索) ----------
const top500 = [...DATA.products].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)).slice(0, 500);
const curSym = (c) => (c === "EUR" ? "€" : "$");
const fullLines = top500.map((p) => {
  const slugP = String(p.label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return "- " + p.label + " | " + p.type + " | " + curSym(p.currency) + Number(p.price || 0).toFixed(2) + " | commission " + Number(p.commission || 0).toFixed(0) + "% | earnings/sale " + curSym(p.currency) + Number(p.earningsPerSale || 0).toFixed(2) + " | conversion " + Number(p.conversionRate || 0).toFixed(1) + "% | cancel " + Number(p.cancelRate || 0).toFixed(1) + "% | " + SITE_URL + "/reviews/" + slugP + "-" + p.id + ".html";
});
// 改进项 llms-expand:分类与厂商索引段(与站内页面同一 URL 规则)
const catIndex = DATA.categories.map((c) => "- " + c.label + " (" + c.count + " products) | " + SITE_URL + "/category/" + c.file + ".html").join("\n");
const vendorCount = {};
// 与 build-site.js vendorHubs() 同序:先按收益降序再计数,并列 Top100 边界的取舍才一致
for (const p of [...DATA.products].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0))) vendorCount[p.vendorName] = (vendorCount[p.vendorName] || 0) + 1;
const vendorIndex = Object.entries(vendorCount).filter(([, n]) => n >= 2)
  .sort((a, b) => b[1] - a[1]).slice(0, 100)
  .map(([v, n]) => "- " + v + " (" + n + " products) | " + SITE_URL + "/vendors/" + slug(v) + ".html").join("\n");
const llmsFull = "# " + SITE_NAME + " — full dataset (top 500 by earnings/sale)\n\n> Compact reference for LLM retrieval. All figures are vendor-side Digistore24 marketplace statistics as of " + DATA_DATE + ", not forecasts. Product pages: " + SITE_URL + "/reviews/\n\n" + fullLines.join("\n") + "\n\n## Categories (" + DATA.categories.length + ")\n\n" + catIndex + "\n\n## Top vendors (100, by listing count)\n\n" + vendorIndex + "\n";
fs.writeFileSync(path.join(ROOT, "llms-full.txt"), llmsFull);
console.log("llms-full.txt:", fullLines.length, "products,", DATA.categories.length, "categories, 100 vendors");

// ---------- feed.xml (Atom, 博客) ----------
const blogDir = path.join(ROOT, "blog");
const blogFiles = [];
if (fs.existsSync(blogDir)) {
  for (const f of fs.readdirSync(blogDir).filter((f) => f.endsWith('.html') && f !== 'index.html')) {
    const html = fs.readFileSync(path.join(blogDir, f), 'utf8');
    const t = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || f;
    const art = (html.match(/<article class="review">([\s\S]*?)<\/article>/) || [])[1] || '';
    const upd = (html.match(/<meta property="article:modified_time" content="([^"]+)"/) || [])[1] || DATA_DATE || TODAY;
    blogFiles.push({ f, t: t.replace(' — ' + SITE_NAME, ''), content: art, updated: upd });
  }
}
const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${SITE_NAME} Blog</title>
  <link href="${SITE_URL}/blog/"/>
  <updated>${new Date().toISOString()}</updated>
  <id>${SITE_URL}/blog/</id>
${blogFiles.map(({ f, t, content, updated }) => `  <entry>
    <title>${esc(t)}</title>
    <link href="${SITE_URL}/blog/${f}"/>
    <id>${SITE_URL}/blog/${f}</id>
    <updated>${updated || DATA_DATE || TODAY}</updated>${content ? `
    <content type="html">${esc(content).slice(0, 20000)}</content>` : ""}
  </entry>`).join("\n")}
</feed>
`;
fs.writeFileSync(path.join(ROOT, "feed.xml"), feed);

console.log(`extras: sitemap.xml (${urls.length} URLs), robots.txt, llms.txt, feed.xml (${blogFiles.length} entries)`);

// ---------- alternatives/index.html(目录页:修复 faq 页对 alternatives 索引的断链) ----------
{
  const adir = path.join(ROOT, "alternatives");
  const files = fs.existsSync(adir)
    ? fs.readdirSync(adir).filter((f) => f.endsWith(".html") && f !== "index.html").sort()
    : [];
  if (files.length) {
    const items = files.map((f) => {
      const h = fs.readFileSync(path.join(adir, f), "utf8");
      const t = ((h.match(/<h1>([^<]*)<\/h1>/) || [])[1] || f)
        .replace(/&amp;/g, "&").replace(/: alternatives.*$/i, "");
      return '<li><a href="' + f + '">' + t + "</a></li>";
    });
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>All alternatives &amp; comparisons — ${SITE_NAME}</title>
<meta name="description" content="Every alternatives &amp; comparison page on ${SITE_NAME}: head-to-head options for the top Digistore24 marketplace products.">
<link rel="stylesheet" href="../assets/style.css">
</head>
<body>
<header class="site"><div class="wrap"><a href="../index.html"><b>${SITE_NAME}</b></a> — independent Digistore24 directory</header>
<main class="wrap">
<h1>All alternatives &amp; comparison pages</h1>
<p class="sub">${files.length} head-to-head comparison pages, one per top offer.</p>
<ul>
${items.join(String.fromCharCode(10))}
</ul>
</main>
<footer class="site"><div class="wrap"><a href="../about.html">About, disclosure &amp; contact</a> · <a href="../changelog.html">What's new</a> · Data: Digistore24 marketplace, vendor-side</footer>
</body>
</html>
`;
    fs.writeFileSync(path.join(adir, "index.html"), html, "utf8");
    console.log("alternatives/index.html:", files.length, "entries");
  }
}
