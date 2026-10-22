#!/usr/bin/env node
/**
 * build-site.js — 从 data/dataset.json 生成静态站点(SEO/GEO 优化版)
 * - canonical / Open Graph / Twitter card / JSON-LD(Product, Breadcrumb, CollectionPage, WebSite)
 * - 每个产品页带可引用 TL;DR 摘要 + 相关产品内链
 * - 全量 A-Z 索引 + Uncategorized 页(无孤儿页)
 * 用法: node build/build-site.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dataset.json"), "utf8"));
const SITE_NAME = "DigistorePicks";
const SITE_URL = "https://vsyour-cmd.github.io/digistore-picks";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/\$\{/g, "$ { ")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const money = (n, cur) => (cur === "EUR" ? "€" : "$") + (n == null ? "—" : Number(n).toFixed(2));
const pct = (n) => (n == null ? "—" : Number(n).toFixed(2).replace(/\.?0+$/, "") + "%");
const datemark = (iso) => (iso ? iso.slice(0, 10) : "");
const outPath = (...p) => path.join(ROOT, ...p);
const jsonSafe = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

const IMG_DIR = path.join(ROOT, "assets", "products");
function localImage(id) {
  const m = path.join(IMG_DIR, id + ".img.json");
  if (fs.existsSync(m)) {
    try {
      const j = JSON.parse(fs.readFileSync(m, "utf8"));
      if (j.local) return { path: j.local, w: j.width || null, h: j.height || null };
    } catch {}
  }
  return null;
}

const articleIds = new Set(
  fs.existsSync(path.join(ROOT, "build", "articles.json"))
    ? JSON.parse(fs.readFileSync(path.join(ROOT, "build", "articles.json"), "utf8")).map((a) => String(a.productId))
    : []
);

// 搜索引擎站点验证标记(GSC/Bing):把 <meta ...> 整行放进 build/verify-meta.txt 即可注入全站
const VERIFY_META = (() => {
  const f = path.join(ROOT, "build", "verify-meta.txt");
  try { return fs.readFileSync(f, "utf8").trim(); } catch { return ""; }
})();

// 深度详情(使用方法/注意事项/图集,来自销售页再抓取)
const DETAILS_FILE = process.env.DETAILS_FILE || "G:/Digistore24/data/details-en.json";
const DETAILS = fs.existsSync(DETAILS_FILE) ? JSON.parse(fs.readFileSync(DETAILS_FILE, "utf8")) : {};
const productDetails = (id) => DETAILS[id] || null;

// 跨语言关联:德语站数据集(同厂商产品互相引流)
const DE_DATASET_FILE = "G:/Digistore24/site-de/data/dataset.json";

const DE_DATA = fs.existsSync(DE_DATASET_FILE) ? JSON.parse(fs.readFileSync(DE_DATASET_FILE, "utf8")) : null;
const deVendorMap = (() => {
  if (!DE_DATA) return new Map();
  const m = new Map();
  for (const p of DE_DATA.products) {
    const k = (p.vendorName || "").toLowerCase();
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(p);
  }
  for (const [, arr] of m) arr.sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0));
  return m;
})();

// 类型化通用使用说明(标注为通用信息,非产品特定)
const TYPE_USAGE_EN = {
  "E-books": "E-books on Digistore24 are delivered as a digital download (usually PDF/EPUB): right after checkout you get a download link or member-area access, and can read on any device.",
  "Downloads": "Download products are delivered digitally: immediately after checkout you receive download links (or member-area access) — no physical shipping.",
  "Member area and video courses": "Video courses live in a members' area: after checkout you receive login credentials by email and can stream the lessons at your own pace, on any device with a browser.",
  "Supplements - health": "Dietary supplements are shipped physically; usage/dosage instructions are on the product label and the official sales page. Follow the label exactly.",
  "Supplements - for slimming": "Weight-management supplements are shipped physically; follow the dosage on the product label and the official sales page.",
  "Software": "Software is delivered digitally — either as an instant download or via license keys / member-area access sent after checkout.",
  "Book (printed)": "Printed books are shipped physically; delivery time depends on your region and is shown at checkout.",
  "Deliverable": "Physical products are shipped to your address; shipping costs and times are shown at checkout.",
  "Audio book (download)": "Audio books are delivered as digital downloads (MP3) right after checkout — playable on any device.",
  "Online coaching": "Online coaching is delivered via scheduled video calls and/or a member area; the coach contacts you after purchase to schedule sessions.",
  "Webinar": "Webinars are live online sessions: after registration you receive a link by email for the scheduled date.",
  "Remote service provided electronically": "Remote services are delivered electronically — the provider contacts you after purchase to arrange the service.",
};

const GOATCOUNTER = '<script data-goatcounter="https://vsyour.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>';

// 发布者 Organization 实体(全站每页注入,AI/Google 实体识别)
const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "adminstore",
  url: SITE_URL + "/",
  email: "admin@2bkf.com",
  description: "Independent publisher of DigistorePicks, a directory of Digistore24 marketplace products with verifiable marketplace data and labeled sales-page research.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Room 70, Unit 10B, 7/F, Tower B, New Mandarin Plaza, 14 Science Museum Road, Tsim Sha Tsui",
    addressLocality: "Kowloon",
    addressRegion: "Kowloon",
    postalCode: "999077",
    addressCountry: "HK",
  },
  sameAs: [
    "https://github.com/vsyour-cmd/digistore-picks",
    "https://vsyour-cmd.github.io/digistore-picks-de/",
  ],
};

function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items
    .map((c, i) => (i === items.length - 1 ? `<span>${esc(c.label)}</span>` : `<a href="${c.href}">${esc(c.label)}</a>`))
    .join(' <span class="sep">›</span> ')}</nav>`;
}

// SERP 保护:标题 ≤68 字符(词边界截断),描述 ≤158 字符
const capTitle = (s, max = 68) => {
  s = String(s == null ? "" : s).trim().replace(/\s+/g, " ");
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 30 ? cut.slice(0, sp) : cut).replace(/[\s—–-]+$/g, "").replace(/[\s—–-]+$/, "") + "…";
};
const capDesc = (s, max = 158) => {
  s = String(s == null ? "" : s).trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 80 ? cut.slice(0, sp) : cut).replace(/[\s,;]+$/g, "").replace(/[\s,;]+$/, "") + "…";
};

function layout({ title, desc, body, rel = ".", path = "", ogType = "website", ogImage = null, jsonLd = [], crumb = null, hreflangLinks = "" }) {
  const allLd = [ORG_LD, ...jsonLd];
  const canonical = SITE_URL + "/" + path;
  const ogImg = ogImage
    ? (ogImage.startsWith("http") ? ogImage : SITE_URL + "/" + ogImage.replace(/^(\.\.\/)+/, ""))
    : SITE_URL + "/assets/og-default.png";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(capTitle(title))}</title>
<meta name="description" content="${esc(capDesc(desc))}">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(capTitle(title))}">
<meta property="og:description" content="${esc(capDesc(desc))}">
<meta property="og:url" content="${canonical}">
${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${esc(ogImg)}">` : '<meta name="twitter:card" content="summary">'}
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="alternate" type="application/atom+xml" title="Blog feed" href="${rel}/feed.xml">
<link rel="stylesheet" href="${rel}/assets/style.css">
${hreflangLinks}${VERIFY_META}
${allLd.map((j) => `<script type="application/ld+json">${jsonSafe(j)}</script>`).join("\n")}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
  <a class="brand" href="${rel}/index.html">${SITE_NAME}<span>.com</span></a>
  <nav class="cats">
    <a href="${rel}/index.html">All categories</a>
    <a href="${rel}/reviews/index.html">All products</a>
    <a href="${rel}/blog/index.html">Blog</a>
    <a href="${rel}/about.html">About &amp; disclosure</a>
  </nav>
</div></header>
<main id="main" class="wrap">
${crumb ? crumbs(crumb) + "\n" : ""}${body}
</main>
<footer class="site"><div class="wrap">
  <div class="disclosure"><b>Affiliate disclosure:</b> ${SITE_NAME} contains affiliate links. If you buy through them we may earn a commission from the vendor at no extra cost to you. Marketplace statistics shown on this site (price, commission, conversion, earnings) are provided by the official Digistore24 marketplace and are not a forecast of your results.</div>
  <div class="buyerlinks"><b>Buyer help:</b> <a href="${rel}/digistore24-refunds.html">How Digistore24 refunds work</a> · <a href="${rel}/is-digistore24-safe.html">Is Digistore24 safe?</a> · <a href="${rel}/buy-with-confidence.html">Before you buy: checklist</a></div>
  <div>© ${new Date().getFullYear()} ${SITE_NAME} · Product data: Digistore24 marketplace (updated ${datemark(DATA.scrapedAt)}) · <a href="${rel}/about.html">About, disclosure &amp; contact</a> · <a href="https://vsyour-cmd.github.io/digistore-picks-de/" hreflang="de">Deutsche Website</a> · <a href="${rel}/changelog.html">What's new</a> · <a href="${rel}/price-watch.html">Price tracker</a> · <a href="${rel}/amazon-picks.html">Amazon picks</a></div>
</div></footer>
${GOATCOUNTER}
</body>
</html>`;
}

function imgRel(p, rel, attrs = "") {
  const im = localImage(p.id);
  if (!im) return "";
  const dims = im.w && im.h ? `width="${im.w}" height="${im.h}"` : "";
  return `<a href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank" aria-label="${esc(p.label)} — official sales page (affiliate link)"><img src="${rel}/${im.path}" ${dims} ${attrs} loading="lazy" alt="${esc(p.label)}" onerror="this.style.display='none'"></a>`;
}

function productCard(p, rel = ".") {
  return `<div class="card">
  ${imgRel(p, rel, `style="width:100%;height:130px;object-fit:contain"`)}
  <div class="title"><a href="${rel}/reviews/${p.slug}.html">${esc(p.label)}</a></div>
  <div class="meta">
    <span>Vendor <b>${esc(p.vendorName)}</b></span>
    <span>Listed <b>${datemark(p.createdAt)}</b></span>
  </div>
  ${p.description ? `<p class="desc">${esc(p.description).slice(0, 160)}</p>` : ""}
  <div class="links">
    <a class="badge" href="${rel}/reviews/${p.slug}.html">View profile</a>
    <a href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">Official sales page ↗</a>
  </div>
</div>`;
}

const products = DATA.products
  .map((p) => ({ ...p, label: p.label || `Digistore24 product ${p.id}`, slug: slug(p.label || `product-${p.id}`) + "-" + p.id }))
  .sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0));
const byId = new Map(products.map((p) => [String(p.id), p]));

// 厂商 Hub 单一数据源:Top100 厂商(≥2 产品)在此选定一次,HUB_SLUGS 与 vendorHubs() 共用,
// 防止两处独立计算因 products 顺序被中间函数改变而在并列边界选出不同厂商(曾产生死链)
const TOP_VENDORS = (() => {
  const m = new Map();
  for (const p of products) m.set(p.vendorName, (m.get(p.vendorName) || 0) + 1);
  return new Map([...m.entries()].filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 100));
})();
const HUB_SLUGS = new Set([...TOP_VENDORS.keys()].map((k) => slug(k)));

// 改进项 deepdive-pilot-en:收益 Top10 产品的深度顾问页(reviews/{slug}/guide.html)
const GUIDE_POOL = [...products].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)).slice(0, 10);
const GUIDE_IDS = new Set(GUIDE_POOL.map((p) => String(p.id)));

{
  const cnt = {};
  for (const c of DATA.categories) { const b = slug(c.label); cnt[b] = (cnt[b] || 0) + 1; }
  for (const c of DATA.categories) { const b = slug(c.label); c.file = cnt[b] > 1 ? slug(c.section) + "-" + b : b; }
}

// categories that actually get a faq page (>=3 products) — guards faq links site-wide
// (含合成的 uncategorized:见 faqHubPages 的 uncat 条目)
const FAQ_ELIGIBLE = new Set(DATA.categories.filter((c) => (DATA.products || []).filter((p) => (p.categoryIds || []).includes(String(c.catId))).length >= 3).map((c) => c.file));
FAQ_ELIGIBLE.add("uncategorized");

// ---------- TL;DR 摘要(GEO 可引用) ----------
function tldr(p) {
  const g = p.research && p.research.guaranteeMention ? ` The sales page advertises a "${esc(p.research.guaranteeMention)}" policy.` : "";
  const dead = p.research && p.research.error ? ` Its sales page is currently unreachable (${esc(p.research.error.slice(0, 60))}).` : "";
  const cats = p.categories.length ? ` in ${p.categories.slice(0, 2).map(esc).join(" and ")}` : "";
  return `<div class="tldr">
<b>At a glance</b> (marketplace data as of ${datemark(DATA.scrapedAt)}):
<ul>
<li>${esc(p.label)} is a ${esc(p.type.toLowerCase())}${cats} sold through the Digistore24 marketplace by vendor <b>${esc(p.vendorName)}</b>, listed since <b>${datemark(p.createdAt)}</b>.</li>
<li>List price <b>${money(p.price, p.currency)}</b>${(p.billingTypes || []).length ? " (" + esc(p.billingTypes.join(", ").toLowerCase()) + ")" : ""} — checkout, delivery and refunds are handled by Digistore24 itself, not the vendor.</li>
<li>Buyer protection: ${g ? "the sales page advertises a money-back guarantee — confirm the exact window at checkout" : "no standardized guarantee wording detected — locate the refund terms on the official page before paying"}.${dead}</li>
</ul>
</div>`;
}

const HREF_HOME = '<link rel="alternate" hreflang="de" href="https://vsyour-cmd.github.io/digistore-picks-de/"><link rel="alternate" hreflang="en" href="https://vsyour-cmd.github.io/digistore-picks/">';
function deCatHref(catId) {
  if (!DE_DATA) return null;
  const c2 = DE_DATA.categories.find((c) => String(c.catId) === String(catId));
  const c1 = DATA.categories.find((c) => String(c.catId) === String(catId));
  if (!c2 || !c1) return null;
  const mk = (cats) => {
    const cnt = {};
    for (const c of cats) { const b = slug(c.label); cnt[b] = (cnt[b] || 0) + 1; }
    return (c) => (cnt[slug(c.label)] > 1 ? slug(c.section) + "-" + slug(c.label) : slug(c.label));
  };
  const deFile = mk(DE_DATA.categories)(c2);
  const enFile = mk(DATA.categories)(c1);
  return '<link rel="alternate" hreflang="de" href="https://vsyour-cmd.github.io/digistore-picks-de/kategorie/' + deFile + '.html"><link rel="alternate" hreflang="en" href="https://vsyour-cmd.github.io/digistore-picks/category/' + enFile + '.html">';
}
// ---------- 首页 ----------
function homePage() {
  const top = products.slice(0, 12);
  const cats = DATA.categories.slice().sort((a, b) => b.count - a.count);
  const uncategorized = products.filter((p) => !p.categories.length).length;
  const body = `
<h1>Digistore24 products, sorted by the numbers</h1>
<p class="sub">An independent directory of ${DATA.total} English-language products in the Digistore24 marketplace — ${DATA.categories.length} categories, official pricing and commission data, sales-page research on ${DATA.withResearch} offers. Marketplace data refreshed ${datemark(DATA.scrapedAt)}.</p>
<div class="tldr"><b>At a glance</b> (data of ${datemark(DATA.scrapedAt)}):
<ul>
<li>${DATA.total} English-language Digistore24 offers tracked across ${DATA.categories.length} categories.</li>
<li>Every page labels its evidence: official marketplace stats vs vendor sales-page claims.</li>
<li>New here? Start with the top list below, the <a href="monthly-new.html">newest offers</a>, or the <a href="blog/digistore24-numbers-checklist.html">6-point evaluation method</a>.</li>
</ul></div>
<h2>Top products by affiliate earnings per sale</h2>
<p class="sub">Ranked by marketplace-reported earnings per sale. Official marketplace statistics, not our predictions.</p>
<div class="grid">
${top.map((p) => productCard(p)).join("\n")}
</div>
<h2>Browse all ${DATA.categories.length} categories</h2>
<div class="cat-index">
${cats.map((c) => `<a href="category/${c.file}.html"><span>${esc(c.label)}</span><span class="n">${c.count} products</span></a>`).join("\n")}
${uncategorized ? `\n<a href="category/uncategorized.html"><span>Uncategorized</span><span class="n">${uncategorized} products</span></a>` : ""}
</div>
<p class="sub" style="margin-top:26px">Every product has a full profile with marketplace data and research from its sales page. Browse <a href="reviews/index.html">all ${DATA.total} products A–Z</a>, or read <a href="blog/index.html">the data guides</a>.</p>`;
  const jsonLd = [{
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL + "/",
    description: `Independent directory of ${DATA.total} Digistore24 marketplace products with official price, commission and conversion data plus sales-page research.`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL + "/about.html" },
  }];
  fs.writeFileSync(outPath("index.html"), layout({
    hreflangLinks: HREF_HOME,
    title: `${SITE_NAME} — all ${DATA.total} Digistore24 products: prices, commissions & research`,
    desc: `Directory of ${DATA.total} Digistore24 products with official price, commission and conversion data plus sales-page research on every offer. ${DATA.categories.length} categories, updated ${datemark(DATA.scrapedAt)}.`,
    body, path: "", jsonLd,
  }));
}

// ---------- 分类页 ----------
function categoryPages() {
  const dir = outPath("category");
  fs.mkdirSync(dir, { recursive: true });
  const CHUNK = 60;
  const writeCat = (c, items, extraIntro = "") => {
    const pages = [];
    for (let i = 0; i < items.length; i += CHUNK) pages.push(items.slice(i, i + CHUNK));
    if (!pages.length) pages.push([]);
    const avg = items.length ? items.reduce((a, p) => a + (p.price || 0), 0) / items.length : 0;
    const minC = items.length ? Math.min(...items.map((p) => p.commission || 0)) : 0;
    const maxC = items.length ? Math.max(...items.map((p) => p.commission || 0)) : 0;
    const pager = (idx) => {
      if (pages.length === 1) return "";
      const link = (i) =>
        i === idx
          ? `<b>${i + 1}</b>`
          : `<a href="${i === 0 ? c.file + ".html" : c.file + "-p" + (i + 1) + ".html"}">${i + 1}</a>`;
      return `<p class="pager">Pages: ${Array.from({ length: pages.length }, (_, i) => link(i)).join(" · ")}</p>`;
    };
    // 改进项 category-compare-table:分类级 Top10 收益对比表,所有分页共用(补 credibility 的 comparison-table 缺项)
    const top10 = [...items].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)).slice(0, 10);
    const topTable = top10.length ? `<h2>Top ${esc(c.label)} offers by earnings/sale — side by side</h2>
<table class="specs">
<tr><th>Product</th><th>Type</th><th>Price</th><th>Commission</th><th>Earn./sale</th><th>Cart conv.*</th><th>Cancel*</th></tr>
${top10.map((p) => `<tr><td><a href="../reviews/${p.slug}.html">${esc(p.label)}</a>${GUIDE_IDS.has(String(p.id)) ? ` · <a href="../reviews/${p.slug}/guide.html" title="Full buying guide">guide</a>` : ""}</td><td>${esc(p.type)}</td><td><b>${money(p.price, p.currency)}</b></td><td>${pct(p.commission)}</td><td><b>${money(p.earningsPerSale, p.currency)}</b></td><td>${pct(p.conversionRate)}</td><td>${pct(p.cancelRate)}</td></tr>`).join("\n")}
</table>
<p class="sub">* Cart conversion and cancel rate are vendor-side marketplace statistics and depend on traffic quality — not a forecast. Category-wide top 10 as of ${datemark(DATA.scrapedAt)}; identical on every page of this category.</p>` : "";
    pages.forEach((chunk, idx) => {
      const file = idx === 0 ? c.file + ".html" : `${c.file}-p${idx + 1}.html`;
      const pageSub = pages.length > 1 ? ` · Page ${idx + 1} of ${pages.length}` : "";
      const intro = `<p class="lead">${extraIntro}The <b>${esc(c.label)}</b> category on the Digistore24 marketplace lists <b>${items.length} English-language offers</b> (as of ${datemark(DATA.scrapedAt)}). Average list price: <b>${money(avg, "USD")}</b>; affiliate commissions run from <b>${pct(minC)}</b> to <b>${pct(maxC)}</b>. All statistics below are reported by Digistore24 for vendor-side traffic and depend on traffic quality.</p>`;
      const isRealCat = DATA.categories.some((x) => x.file === c.file);
      const catQas = categoryFaq(c, items);
      const faqBlock = `<h2 id="faq">FAQ: ${esc(c.label)} on Digistore24</h2>
${catQas.map(({ q, a }) => `<h3>${esc(q)}</h3>\n<p>${a}</p>`).join("\n")}`;
      const faqLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: catQas.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a.replace(/<[^>]+>/g, "") },
        })),
      };
      const bestOf = idx === 0 && isRealCat && items.length >= 8 ? `<p class="sub">Short on time? See <a href="../best-of/best-${c.file}.html">our best picks in ${esc(c.label)}</a> — computed from the same data.</p>` : "";
      const tldrBlock = `<div class="tldr"><b>At a glance</b> (marketplace data of ${datemark(DATA.scrapedAt)}): <ul><li><b>${items.length} offers</b> in ${esc(c.label)}, average price ${money(avg, "USD")}.</li><li>Commissions ${pct(minC)}–${pct(maxC)}; every figure below is vendor-reported marketplace data.</li><li>${isRealCat && items.length >= 8 ? `Picks by the numbers: <a href="../best-of/best-${c.file}.html">best ${esc(c.label)}</a> · ` : ""}${FAQ_ELIGIBLE.has(c.file) ? `<a href="../faq/${c.file}.html">50 buyer questions</a> · ` : ""}method: <a href="../blog/digistore24-numbers-checklist.html">6-point check</a>.</li></ul></div>`;
      const methodLine = `<p class="sub">How we evaluate: <a href="../blog/digistore24-numbers-checklist.html">6-point numbers check</a> · <a href="../about.html">research standards</a>.</p>`;
      const evidenceLine = `<p class="sub">Evidence &amp; verification conditions: statistics from the official Digistore24 marketplace API (snapshot ${datemark(DATA.scrapedAt)}); always verify current prices on official pages.</p>`;
      const body = `
<h1>${esc(c.label)}</h1>
<p class="sub">${items.length} product${items.length === 1 ? "" : "s"} · Part of: ${esc(c.section)}${pageSub} · <a href="../index.html">all categories</a> · <a href="../reviews/index.html">all products A–Z</a></p>
${intro}
${tldrBlock}
${bestOf}
<div class="grid">
${chunk.map((p) => productCard(p, "..")).join("\n")}
</div>
${pager(idx)}
${topTable}
${idx === 0 ? faqBlock : ""}
${methodLine}
${evidenceLine}
<p class="sub" style="margin-top:22px">* Marketplace statistics are reported by Digistore24 for the vendor's traffic and depend on traffic quality; they are not a forecast of your results.</p>`;
      const jsonLd = [
        ...(idx === 0 ? [faqLd] : []),
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${c.label} — Digistore24 products`,
          description: `${items.length} Digistore24 products in ${c.label} with official price, commission and marketplace statistics.`,
          url: `${SITE_URL}/category/${file}`,
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL + "/" },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
            { "@type": "ListItem", position: 2, name: c.label, item: `${SITE_URL}/category/${file}` },
          ],
        },
      ];
      fs.writeFileSync(path.join(dir, file), layout({
        title: idx === 0
          ? `${c.label} — ${items.length} Digistore24 products: prices & commissions`
          : `${c.label} (${idx + 1}/${pages.length}) — ${items.length} Digistore24 products`,
        desc: `${items.length} Digistore24 products in ${c.label}: official prices, commissions (avg ${money(avg, "USD")}), conversion and cancel rates. Updated ${datemark(DATA.scrapedAt)}.`,
        body, rel: "..", path: `category/${file}`, jsonLd, hreflangLinks: deCatHref(c.catId) || "",
        crumb: [{ label: "Home", href: "../index.html" }, { label: c.label, href: `../category/${file}` }],
      }));
    });
  };
  for (const c of DATA.categories) {
    const items = products.filter((p) => (p.categoryIds || []).includes(String(c.catId)));
    writeCat(c, items);
  }
  const uncats = products.filter((p) => !p.categories.length);
  if (uncats.length) {
    writeCat({ label: "Uncategorized", section: "Digistore24 marketplace", file: "uncategorized" }, uncats,
      "These offers carry no marketplace category. ");
  }
}

// ---------- 产品档案页 ----------
function researchSection(p) {
  const r = p.research;
  if (!r || r.error) {
    const msg = r && r.error ? esc(r.error) : "not yet researched";
    return `<h2>From the vendor's sales page</h2>
<div class="notice">Sales-page research unavailable: <b>${msg}</b>. An unreachable sales page is itself worth knowing — treat every claim about this offer as unverified until you can open the official page yourself.</div>`;
  }
  const parts = [];
  if (r.title) parts.push(`<p><b>Page title:</b> ${esc(r.title)}</p>`);
  if (r.metaDescription) parts.push(`<p><b>Meta description:</b> ${esc(r.metaDescription)}</p>`);
  if (r.h1 && r.h1.length) parts.push(`<h3>Headline</h3><blockquote>${r.h1.map((h) => esc(h)).join("<br>")}</blockquote>`);
  if (r.h2 && r.h2.length) parts.push(`<h3>Section headlines</h3><ul>${r.h2.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`);
  else if (r.h3 && r.h3.length) parts.push(`<h3>Section headlines</h3><ul>${r.h3.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`);
  if (r.excerpt && r.excerpt.length) parts.push(`<h3>Opening copy</h3>${r.excerpt.map((t) => `<blockquote>${esc(t)}</blockquote>`).join("")}`);
  if (r.faqQuestions && r.faqQuestions.length) parts.push(`<h3>Questions the sales page answers</h3><ul>${r.faqQuestions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>`);
  if (r.priceMentions && r.priceMentions.length) parts.push(`<p><b>Prices mentioned on the page:</b> ${r.priceMentions.map((x) => esc(x)).join(" · ")}</p>`);
  if (r.guaranteeMention) parts.push(`<p><b>Guarantee language found:</b> “${esc(r.guaranteeMention)}” — always confirm the current terms on the official page before relying on it.</p>`);
  if (r.ctaTexts && r.ctaTexts.length) parts.push(`<p><b>CTA buttons:</b> ${r.ctaTexts.map((t) => `“${esc(t)}”`).join(" · ")}</p>`);
  parts.push(`<p class="sub">Research method: ${r.method === "browser-render" ? "browser-rendered page" : "raw HTML fetch"} · ${r.wordCount} words on page · quality: ${r.quality} · researched ${datemark(DATA.researchedAt)}. <a href="https://github.com/vsyour-cmd/digistore-picks/blob/main/content/products/${p.id}-${slug(p.label)}.md" rel="noopener">Full research file (MD) ↗</a></p>`);
  return `<h2 id="research">From the vendor's sales page</h2>
<div class="notice"><b>These are the vendor's own marketing claims</b>, extracted verbatim from the official sales page${r.finalUrl && r.finalUrl !== p.salesPageUrl ? ` (final URL: ${esc(r.finalUrl)})` : ""}. We do not verify outcomes, testimonials or income claims.</div>
${parts.join("\n")}`;
}

function profilePages(altSlugs) {
  const dir = outPath("reviews");
  fs.mkdirSync(dir, { recursive: true });
  for (const p of products) {
    const file = path.join(dir, p.slug + ".html");
    if (articleIds.has(String(p.id)) && fs.existsSync(file)) continue;
    const cats = (p.categories || []).map((c) => esc(c)).join(", ");
    const imgTag = imgRel(p, "..", `style="max-width:340px;height:auto;border:1px solid var(--line);border-radius:8px"`);
    const localImg = localImage(p.id);

    // 相关产品:同主分类,按收益,排除自己
    const primaryCatId = (p.categoryIds || [])[0];
    let related = [];
    if (primaryCatId) related = products.filter((x) => x.id !== p.id && (x.categoryIds || []).includes(String(primaryCatId))).slice(0, 4);
    const relatedBlock = related.length
      ? `<h2>Related offers in ${esc(p.categories[0])}</h2>
<div class="grid">${related.map((x) => productCard(x, "..")).join("\n")}</div>`
      : "";

    // 同厂商其他产品
    const vendorSiblings = products.filter((x) => x.id !== p.id && x.vendorName === p.vendorName).slice(0, 4);
    p.vendorSiblings = vendorSiblings;
    const vendorBlock = vendorSiblings.length
      ? `<h2 id="vendor">Other offers by ${esc(p.vendorName)}</h2>
${HUB_SLUGS.has(slug(p.vendorName)) ? `<p class="sub">Full catalog: <a href="../vendors/${slug(p.vendorName)}.html">${esc(p.vendorName)} vendor hub</a> — all listings with marketplace data.</p>` : ""}
<div class="grid">${vendorSiblings.map((x) => productCard(x, "..")).join("\n")}</div>`
      : "";

    const altLink = altSlugs && altSlugs.has(p.slug)
      ? `<p class="sub">Comparing options? See <a href="../alternatives/${p.slug}.html">${esc(p.label)} vs its closest alternatives</a> — side-by-side marketplace numbers.</p>`
      : "";
    const altData = altSlugs && altSlugs.has(p.slug)
      ? products.filter((x) => x.id !== p.id && (x.categoryIds || []).includes(String((p.categoryIds || [])[0]))).slice(0, 4)
      : [];
    const compareBlock = altData.length >= 3
      ? `<h2>How ${esc(p.label)} compares (marketplace numbers)</h2>
${compareTable(p, altData)}
<p class="sub">* Vendor-side marketplace statistics; depend on traffic quality, not a forecast. Full context: <a href="../alternatives/${p.slug}.html">alternatives page for ${esc(p.label)}</a>.</p>
<h2>Decision factors buyers care about</h2>
<ul>
<li><b>Function:</b> compare cart conversion and vendor track record — the table above shows both.</li>
<li><b>Compatibility:</b> check type and requirements (delivery format, prerequisites) on each profile.</li>
<li><b>Maintenance:</b> cancel rate is the refund-regret signal; access terms live on the official pages.</li>
<li><b>After-sales:</b> guarantee language and support — verify on official pages before paying.</li>
</ul>
<p class="sub">These four dimensions map to the pre-purchase risk checklist on each product profile.</p>`
      : "";

    // 关联增强:同厂商跨站 / 其他分类 / 相似价位
    const deList = (deVendorMap.get((p.vendorName || "").toLowerCase()) || []).slice(0, 3);
    const crossBlock = deList.length
      ? `<h2>Same vendor on our German site</h2>
<ul style="line-height:1.9">
${deList.map((x) => `<li><a href="https://vsyour-cmd.github.io/digistore-picks-de/produkte/${slug(x.label)}-${x.id}.html" hreflang="de">${esc(x.label)}</a> — ${money(x.price, x.currency)}${x.categories && x.categories.length ? ` <span class="sub">(${esc(x.categories[0])})</span>` : ""}</li>`).join("\n")}
</ul>
<p class="sub">Same vendor, German-language marketplace listings.</p>`
      : "";
    const relatedIds = new Set(related.map((r) => r.id));
    const priceNear = primaryCatId
      ? products.filter((x) => x.id !== p.id && !relatedIds.has(x.id) && (x.categoryIds || []).includes(String(primaryCatId)) && x.price && p.price && Math.abs(x.price - p.price) / Math.max(p.price, 1) <= 0.35).slice(0, 4)
      : [];
    const priceNearBlock = priceNear.length
      ? `<h2>Similar price range in ${esc(p.categories[0] || "this category")}</h2>
<div class="grid">${priceNear.map((x) => productCard(x, "..")).join("\n")}</div>`
      : "";
    const otherCats = (p.categoryIds || []).slice(1).map((id) => DATA.categories.find((c) => String(c.catId) === String(id))).filter(Boolean).slice(0, 2);
    const otherCatsBlock = otherCats.length
      ? `<h2>${esc(p.label)} is also listed in</h2>
<p>${otherCats.map((c) => `<a href="../category/${c.file}.html">${esc(c.label)}</a> (${c.count} products)`).join(" · ")}</p>`
      : "";
    const methodBox = `<h2 id="method">How we evaluate products like ${esc(p.label)}</h2>
<p class="sub">Six checks, all on official marketplace numbers — earnings/sale ÷ cancel-rate skepticism × funnel fit. <a href="../blog/digistore24-numbers-checklist.html">Read the full evaluation method</a> · <a href="../about.html">our research standards &amp; labeling</a>.</p>`;
    const faqQas = faqData(p, altData);
    const faqBlock = faqSection(p, faqQas);
    const faqLd = faqJsonLd(p, faqQas);
    const faqHubCat = DATA.categories.find((c) => String(c.catId) === String(primaryCatId));
    const faqHubHtml = faqHubCat && FAQ_ELIGIBLE.has(faqHubCat.file) ? `<p class="sub"><a href="../faq/${faqHubCat.file}.html">All 50 buyer questions about ${esc(faqHubCat.label)}</a> — the full category FAQ.</p>` : "";
    const communityHtml = communityBlock(p);
    const amazonHtml = amazonBlock(p);

    const primaryCat = DATA.categories.find((c) => String(c.catId) === String(primaryCatId));
    const crumbItems = [{ label: "Home", href: "../index.html" }];
    if (primaryCat) crumbItems.push({ label: primaryCat.label, href: `../category/${primaryCat.file}.html` });
    crumbItems.push({ label: p.label, href: `../reviews/${p.slug}.html` });

    const topCta = `<div class="cta-row">
<p><b>Interested in ${esc(p.label)}?</b> The current price, bonuses and guarantee terms live on the vendor's official page:</p>
<p><a class="cta" href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">Check the official sales page</a><br>
<span class="cta-note">Affiliate link — we may earn a commission at no extra cost to you.</span></p>
</div>`;

    const stickyCta = `<div class="sticky-cta"><div class="sc-info"><span class="sc-price">${money(p.price, p.currency)}</span><span class="sc-note">via Digistore24 · affiliate link</span></div><a class="cta" href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">View sales page</a></div>`;

    const body = `
<h1>${esc(p.label)}</h1>
<p class="sub">Product profile · Marketplace data ${datemark(DATA.scrapedAt)} · Sales-page research ${datemark(DATA.researchedAt) || "—"} · Categories: ${cats || "Uncategorized"}</p>

<div class="notice"><b>How this page was researched:</b> a <b>data profile</b> — official Digistore24 marketplace record plus verbatim extracts from the vendor's public sales page. Not a hands-on review. A hands-on review will follow only after we have purchased and used the product.</div>

${tldr(p)}

${GUIDE_IDS.has(String(p.id)) ? `<div class="notice"><b>Going deeper:</b> this offer has a full <a href="${p.slug}/guide.html">${esc(p.label)} buying guide</a> — every marketplace number interpreted, pricing details, refund-risk assessment and who it fits, all data-checked.</div>` : ""}

${topCta}

${imgTag}

<h2 id="record">Marketplace record</h2>
<table class="specs">
<tr><th>Product type</th><td>${esc(p.type)}</td></tr>
<tr><th>Price</th><td>${money(p.price, p.currency)} (${esc((p.billingTypes || []).join(", ")) || "see sales page"})</td></tr>
<tr><th>Refund window</th><td>Per the vendor's sales page — check the official page before buying</td></tr>
<tr><th>Vendor</th><td>${esc(p.vendorName)} (listed since ${datemark(p.createdAt)})</td></tr>
</table>
${p.description ? `<h2>Vendor's marketplace description</h2><p>${esc(p.description)}</p>` : ""}

${researchSection(p)}

${usageSection(p)}

${galleryBlock(p)}

${cautionSection(p)}

${longTailContent(p)}

${evidenceBox(p)}

${buyerChecklist(p)}

${faqBlock}

${faqHubHtml}

${communityHtml}

${amazonHtml}

${relatedBlock}

${vendorBlock}

${crossBlock}

${altLink}

${compareBlock}

${otherCatsBlock}

${priceNearBlock}

${relatedSearches(p, altSlugs)}

<h2>Where to check it out</h2>
<p>Read the vendor's full sales page (current price, guarantee terms and bonuses are listed there):<br>
<a class="cta" href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">View official sales page</a></p>
<p style="font-size:.88rem;color:var(--ink-soft)">That link is an affiliate link — if you buy through it we earn a commission from the vendor at no extra cost to you.</p>

${sourcesBlock(p)}

${methodBox}

${interactionBlock(p)}

${stickyCta}`;

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.label,
        description: (p.research && p.research.metaDescription) || p.description || `${p.label} — ${p.type} on the Digistore24 marketplace`,
        ...(localImg ? { image: SITE_URL + "/" + localImg.path } : {}),
        sku: "DS24-" + p.productId,
        brand: { "@type": "Brand", name: p.vendorName },
        category: (p.categories || [])[0] || "Uncategorized",
        additionalProperty: [{
          "@type": "PropertyValue",
          name: "Intended use",
          value: (TYPE_USAGE_EN[p.type] || `Delivered digitally via Digistore24 after checkout; see the vendor's sales page for exact usage.`).split(";")[0].trim(),
        }],
        offers: {
          "@type": "Offer",
          price: Number(Number(p.price).toFixed(2)),
          priceCurrency: p.currency === "EUR" ? "EUR" : "USD",
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          url: `${SITE_URL}/reviews/${p.slug}.html`,
          seller: { "@type": "Organization", name: p.vendorName },
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbItems.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.label,
          item: SITE_URL + "/" + c.href.replace(/^(\.\.\/)+/, ""),
        })),
      },
    ];
    fs.writeFileSync(file, layout({
      title: `${p.label} — price, commission & research`,
      desc: `${p.label}: ${p.type} by ${p.vendorName} on Digistore24. Price ${money(p.price, p.currency)}, ${pct(p.commission)} commission, marketplace stats and verbatim sales-page research. Updated ${datemark(DATA.scrapedAt)}.`,
      body, rel: "..", path: `reviews/${p.slug}.html`, ogImage: localImg ? localImg.path : null, jsonLd: [...jsonLd, faqLd],
      crumb: crumbItems,
    }));
  }

  // 索引:Top100 + 全量 A-Z(无孤儿页)
  const top = products.slice(0, 100);
  const az = [...products].sort((a, b) => a.label.localeCompare(b.label));
  const written = articleIds.size
    ? `<h2>Hands-on reviews</h2><ul>${[...articleIds].map((id) => {
        const p = byId.get(id);
        return p ? `<li><a href="${p.slug}.html">${esc(p.label)}</a> — hands-on</li>` : "";
      }).join("")}</ul>`
    : "";
  const body = `
<h1>All ${DATA.total} DigistorePicks products</h1>
<p class="sub">Every product in the Digistore24 English-language marketplace, each with a full profile: marketplace record + verbatim sales-page research. Top 100 by earnings/sale below, then the complete A–Z list. Research method is labeled on every page.</p>
${written}
<h2>Top 100 by earnings/sale</h2>
<ul style="line-height:2">
${top.map((p) => `<li><a href="${p.slug}.html">${esc(p.label)}</a> — ${money(p.earningsPerSale, p.currency)}/sale, ${pct(p.commission)} commission${p.research && p.research.error ? " · <b>sales page unreachable</b>" : ""}</li>`).join("\n")}
</ul>
<h2>Complete list (A–Z, ${az.length} products)</h2>
<ul class="az" style="line-height:1.9;columns:2;column-gap:34px">
${az.map((p) => `<li><a href="${p.slug}.html">${esc(p.label)}</a></li>`).join("\n")}
</ul>`;
  fs.writeFileSync(path.join(dir, "index.html"), layout({
    title: `All ${DATA.total} Digistore24 products (A–Z) — ${SITE_NAME}`,
    desc: `Complete A–Z index of ${DATA.total} Digistore24 product profiles with prices, commissions and sales-page research.`,
    body, rel: "..", path: "reviews/index.html",
    crumb: [{ label: "Home", href: "../index.html" }, { label: "All products", href: "../reviews/index.html" }],
  }));
}

// ---------- about ----------
// ---------- Alternatives 对比页(收益 Top 60,同分类最近邻) ----------
function computeAltSlugs() {
  const set = new Set();
  for (const p of products.slice(0, 200)) {
    const primaryCatId = (p.categoryIds || [])[0];
    if (!primaryCatId) continue;
    const alts = products.filter((x) => x.id !== p.id && (x.categoryIds || []).includes(String(primaryCatId))).slice(0, 4);
    if (alts.length >= 3) set.add(p.slug);
  }
  return set;
}

function alternativesPages(altSlugs) {
  const dir = outPath("alternatives");
  fs.mkdirSync(dir, { recursive: true });
  let built = 0;
  for (const p of products) {
    if (!altSlugs.has(p.slug)) continue;
    const primaryCatId = (p.categoryIds || [])[0];
    const alts = products.filter((x) => x.id !== p.id && (x.categoryIds || []).includes(String(primaryCatId))).slice(0, 4);
    if (alts.length < 3) continue;
    const row = (x) => `<tr>
<td><a href="../reviews/${x.slug}.html">${esc(x.label)}</a></td>
<td>${esc(x.type)}</td>
<td><b>${money(x.price, x.currency)}</b></td>
<td>${pct(x.commission)}</td>
<td>${pct(x.conversionRate)}</td>
<td>${pct(x.cancelRate)}</td>
<td><b>${money(x.earningsPerSale, x.currency)}</b></td>
</tr>`;
    const body = `
<h1>${esc(p.label)}: alternatives &amp; comparison</h1>
<p class="sub">${DATA.categories.find((c) => String(c.catId) === String(primaryCatId)) ? esc(DATA.categories.find((c) => String(c.catId) === String(primaryCatId)).label) : ""} · Marketplace data ${datemark(DATA.scrapedAt)} · <a href="../reviews/${p.slug}.html">full ${esc(p.label)} profile</a></p>
<div class="tldr"><b>At a glance:</b> the closest Digistore24 offers to <b>${esc(p.label)}</b> (${esc(p.type)}, ${money(p.price, p.currency)}, ${money(p.earningsPerSale, p.currency)} earnings/sale), compared by official marketplace statistics. "Closest" means same category, ranked by earnings per sale — an objective measure, not a recommendation.</div>
<table class="specs">
<tr><th>Product</th><th>Type</th><th>Price</th><th>Commission</th><th>Cart conv.*</th><th>Cancel*</th><th>Earn./sale</th></tr>
<tr class="self"><td><b>${esc(p.label)}</b> (this page)</td><td>${esc(p.type)}</td><td><b>${money(p.price, p.currency)}</b></td><td>${pct(p.commission)}</td><td>${pct(p.conversionRate)}</td><td>${pct(p.cancelRate)}</td><td><b>${money(p.earningsPerSale, p.currency)}</b></td></tr>
${alts.map(row).join("\n")}
</table>
<p class="sub">* Vendor-side marketplace statistics reported by Digistore24; they depend on traffic quality and are not a forecast. Price/commission change often — the numbers above are a snapshot, the official pages are the source of truth.</p>
<h2>How to choose between them (by the numbers)</h2>
<ul>
<li><b>Highest earnings/sale:</b> ${esc([p, ...alts].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0))[0].label)} (${money(Math.max(...[p, ...alts].map((x) => x.earningsPerSale || 0)), "USD")}).</li>
<li><b>Best cart conversion:</b> ${esc([p, ...alts].sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0))[0].label)} (${pct(Math.max(...[p, ...alts].map((x) => x.conversionRate || 0)))}).</li>
<li><b>Lowest cancel rate:</b> ${esc([p, ...alts].sort((a, b) => (a.cancelRate || 99) - (b.cancelRate || 99))[0].label)} (${pct(Math.min(...[p, ...alts].map((x) => x.cancelRate || 99)))}) — fewer refund regrets.</li>
<li><b>Lowest price:</b> ${esc([p, ...alts].sort((a, b) => (a.price || 1e9) - (b.price || 1e9))[0].label)} (${money(Math.min(...[p, ...alts].map((x) => x.price || 1e9)), p.currency)}).</li>
</ul>
<p>Every product links to a full profile with verbatim sales-page research. Always confirm price and guarantee on the official page before buying.</p>
<p class="sub">How we evaluate: <a href="../blog/digistore24-numbers-checklist.html">6-point numbers check</a> · <a href="../about.html">research standards</a>. Evidence &amp; verification conditions: all statistics from the official Digistore24 marketplace API (snapshot ${datemark(DATA.scrapedAt)}); comparisons are computed from that snapshot and re-computed on every daily rebuild.</p>
<p><a href="index.html">← All alternatives &amp; comparisons</a> — browse the full comparison directory.</p>`;
    const jsonLd = [{
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${p.label} alternatives on Digistore24`,
      itemListElement: [p, ...alts].map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/reviews/${x.slug}.html`,
        name: x.label,
      })),
    }];
    fs.writeFileSync(path.join(dir, p.slug + ".html"), layout({
      title: `Alternatives to ${p.label}: 4 closest offers compared`,
      desc: `${p.label} (${money(p.price, p.currency)}) vs its closest alternatives in ${p.categories[0] || "the marketplace"}: price, commission, conversion and cancel rate side by side. Official marketplace data.`,
      body, rel: "..", path: `alternatives/${p.slug}.html`, jsonLd,
      crumb: [{ label: "Home", href: "../index.html" }, { label: p.label, href: `../reviews/${p.slug}.html` }, { label: "Alternatives", href: `../alternatives/${p.slug}.html` }],
    }));
    built++;
  }
  return built;
}

// ---------- Best-of 聚合页(≥8 产品的分类) ----------
function bestOfPages() {
  const dir = outPath("best-of");
  fs.mkdirSync(dir, { recursive: true });
  let built = 0;
  for (const c of DATA.categories) {
    if (c.count < 8) continue;
    const items = products.filter((p) => (p.categoryIds || []).includes(String(c.catId)));
    if (items.length < 8) continue;
    const byEps = [...items].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0));
    const bestOverall = byEps[0];
    const bestConv = [...items].sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0))[0];
    const budget = [...items].sort((a, b) => (a.price || 1e9) - (b.price || 1e9)).find((p) => (p.earningsPerSale || 0) > 0);
    const pick = (label, p, why) => `<div class="card">
  <div class="title">${label}: <a href="../reviews/${p.slug}.html">${esc(p.label)}</a></div>
  <div class="meta"><span>Price <b>${money(p.price, p.currency)}</b></span><span>Commission <b>${pct(p.commission)}</b></span><span>Earn./sale <b>${money(p.earningsPerSale, p.currency)}</b></span></div>
  <p class="desc">${why}</p>
</div>`;
    const avg = items.reduce((a, p) => a + (p.price || 0), 0) / items.length;
    const body = `
<h1>Best ${esc(c.label)} products on Digistore24 (${new Date().getFullYear()} edition, by the numbers)</h1>
<p class="sub">Data-driven picks · ${items.length} offers analyzed · Marketplace data ${datemark(DATA.scrapedAt)} · <a href="../category/${c.file}.html">browse the full category</a></p>
<div class="tldr"><b>Key takeaways:</b>
<ul>
<li>The ${esc(c.label)} shelf lists <b>${items.length} English-language offers</b> with an average price of <b>${money(avg, "USD")}</b>.</li>
<li>Highest earnings/sale right now: <b>${esc(bestOverall.label)}</b> at <b>${money(bestOverall.earningsPerSale, bestOverall.currency)}</b> (${pct(bestOverall.commission)} commission).</li>
<li>Best cart conversion: <b>${esc(bestConv.label)}</b> at <b>${pct(bestConv.conversionRate)}</b>. All figures are vendor-side marketplace data, not forecasts.</li>
</ul>
</div>
<div class="notice"><b>How these picks were made:</b> computed mechanically from official Digistore24 marketplace statistics — no sponsorship, no hands-on testing. "Best" here means best on one measured dimension; it is not a quality endorsement.</div>
<h2>The picks</h2>
<div class="grid">
${pick("🏆 Best overall (earnings/sale)", bestOverall, `Pays affiliates the most per sale in this category (${money(bestOverall.earningsPerSale, bestOverall.currency)}), listed since ${datemark(bestOverall.createdAt)}.`)}
${pick("⚡ Best conversion", bestConv, `Highest cart conversion in the category (${pct(bestConv.conversionRate)}) — the offer's funnel closes best, at least for the vendor's own traffic.`)}
${budget && budget.id !== bestOverall.id && budget.id !== bestConv.id ? pick("💡 Budget pick", budget, `Lowest entry price (${money(budget.price, budget.currency)}) among offers with meaningful earnings/sale (${money(budget.earningsPerSale, budget.currency)}).`) : ""}
</div>
<h2>Top 10 in ${esc(c.label)} by earnings/sale</h2>
<table class="specs">
<tr><th>#</th><th>Product</th><th>Type</th><th>Price</th><th>Commission</th><th>Earn./sale</th><th>Cart conv.*</th></tr>
${byEps.slice(0, 10).map((p, i) => `<tr><td>${i + 1}</td><td><a href="../reviews/${p.slug}.html">${esc(p.label)}</a></td><td>${esc(p.type)}</td><td>${money(p.price, p.currency)}</td><td>${pct(p.commission)}</td><td><b>${money(p.earningsPerSale, p.currency)}</b></td><td>${pct(p.conversionRate)}</td></tr>`).join("\n")}
</table>
<p class="sub">* Vendor-side marketplace statistics; they depend on traffic quality and are not a forecast of your results. Verify current prices and guarantees on each official sales page.</p>
<p class="sub">How we evaluate: <a href="../blog/digistore24-numbers-checklist.html">6-point numbers check</a> · <a href="../about.html">research standards</a>. Evidence &amp; verification conditions: rankings computed from the official Digistore24 marketplace API (snapshot ${datemark(DATA.scrapedAt)}); "best" means best on one measured dimension, re-computed on every daily rebuild.</p>`;
    const jsonLd = [{
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Best ${c.label} products on Digistore24`,
      description: `Top ${esc(c.label)} offers on the Digistore24 marketplace, ranked by official earnings-per-sale statistics.`,
      itemListElement: byEps.slice(0, 10).map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/reviews/${x.slug}.html`,
        name: x.label,
      })),
    }];
    fs.writeFileSync(path.join(dir, `best-${c.file}.html`), layout({
      title: `Best ${c.label} products on Digistore24 (${items.length} analyzed)`,
      desc: `Best ${c.label} offers on Digistore24, picked by official marketplace numbers: earnings/sale, conversion, price. ${items.length} offers analyzed, updated ${datemark(DATA.scrapedAt)}.`,
      body, rel: "..", path: `best-of/best-${c.file}.html`, jsonLd,
      crumb: [{ label: "Home", href: "../index.html" }, { label: c.label, href: `../category/${c.file}.html` }, { label: "Best picks", href: `../best-of/best-${c.file}.html` }],
    }));
    built++;
  }
  return built;
}

// ---------- 自定义 404(绝对路径,GitHub Pages 自动启用) ----------
function notFoundPage() {
  const cats = DATA.categories.slice().sort((a, b) => b.count - a.count).slice(0, 8);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found — ${SITE_NAME}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/digistore-picks/assets/style.css">
</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="/digistore-picks/">${SITE_NAME}<span>.com</span></a></div></header>
<main class="wrap">
<h1>Page not found</h1>
<p class="sub">The page you asked for doesn't exist (or was renamed when the marketplace data refreshed). Everything is one click away:</p>
<p><a class="cta" href="/digistore-picks/">Browse the full directory</a></p>
<p>Or search Google for it:<br>
<form onsubmit="location.href='https://www.google.com/search?q=site:vsyour-cmd.github.io/digistore-picks+'+encodeURIComponent(this.q.value);return false">
<input type="text" name="q" placeholder="e.g. AMS Method" style="padding:10px 14px;border:1px solid var(--line);border-radius:8px;min-width:260px">
<button type="submit" style="padding:10px 16px;border:0;border-radius:8px;background:var(--accent);color:#fff;font-weight:600;cursor:pointer">Search</button>
</form></p>
<h2>Popular categories</h2>
<div class="cat-index">
${cats.map((c) => `<a href="/digistore-picks/category/${c.file}.html"><span>${esc(c.label)}</span><span class="n">${c.count} products</span></a>`).join("\n")}
</div>
</main>
<footer class="site"><div class="wrap"><div>© ${new Date().getFullYear()} ${SITE_NAME} · <a href="/digistore-picks/about.html">About &amp; disclosure</a></div></div></footer>
${GOATCOUNTER}
</body>
</html>`;
  fs.writeFileSync(outPath("404.html"), html);
}

// ---------- 使用方法 / 注意事项 / 图集 / 对比表 ----------
function usageSection(p) {
  const d = productDetails(p.id);
  if (d && d.usage && d.usage.length) {
    return `<h2>Usage — as described by the vendor</h2>
<div class="notice"><b>Vendor claims</b>, extracted verbatim from the official sales page — not usage instructions verified by us.</div>
${d.usage.map((t) => `<blockquote>${esc(t)}</blockquote>`).join("")}`;
  }
  const generic = TYPE_USAGE_EN[p.type];
  if (generic) {
    return `<h2>How products like this are delivered</h2>
<p class="sub"><b>General note about this product type</b> (not vendor-specific instructions): ${esc(generic)} For the exact usage of ${esc(p.label)}, the official sales page and included materials are the authoritative source.</p>`;
  }
  return "";
}

function cautionSection(p) {
  const items = [];
  const cat = DATA.categories.find((c) => String(c.catId) === String((p.categoryIds || [])[0]));
  const catItems = cat ? products.filter((x) => (x.categoryIds || []).includes(String(cat.catId))) : [];
  const catCancelMedian = catItems.length
    ? [...catItems].map((x) => x.cancelRate || 0).sort((a, b) => a - b)[Math.floor(catItems.length / 2)]
    : null;
  if ((p.cancelRate || 0) >= 10 && catCancelMedian != null && p.cancelRate >= catCancelMedian) {
    items.push(`<b>High cancel rate:</b> ${pct(p.cancelRate)} of buyers cancel this subscription (category median: ${pct(catCancelMedian)}). Read the cancellation terms on the sales page before subscribing.`);
  }
  if ((p.price || 0) >= 197) {
    items.push(`<b>High-ticket price:</b> ${money(p.price, p.currency)} is a significant purchase — check whether a payment plan exists and compare the cheaper alternatives in this category first.`);
  }
  if (p.research && p.research.error) {
    items.push(`<b>Sales page currently unreachable</b> (${esc(p.research.error.slice(0, 60))}) — verify the offer is still active before buying or promoting.`);
  }
  if (p.research && !p.research.error && !p.research.guaranteeMention) {
    items.push(`<b>No guarantee language found in our research</b> of the sales page — confirm the refund window on the official page before you buy.`);
  }
  if (/supplement/i.test(p.type)) {
    items.push(`<b>General note:</b> dietary supplements are not a substitute for a balanced diet and healthy lifestyle; if in doubt, consult a doctor — especially if you are pregnant, on medication, or have a medical condition. This is general information, not medical advice.`);
  }
  const d = productDetails(p.id);
  if (d && d.caution && d.caution.length) {
    return `<h2>Good to know</h2>
<ul>
${items.map((x) => `<li>${x}</li>`).join("\n")}
${d.caution.map((t) => `<li><i>Vendor's sales page notes</i> (verbatim, not verified by us): “${esc(t)}”</li>`).join("\n")}
</ul>`;
  }
  if (!items.length) return "";
  return `<h2>Good to know</h2>
<ul>
${items.map((x) => `<li>${x}</li>`).join("\n")}
</ul>`;
}

function galleryBlock(p) {
  const d = productDetails(p.id);
  if (!d || !d.gallery || !d.gallery.length) return "";
  return `<h2>More images (from the vendor's sales page)</h2>
<div class="gallery">
${d.gallery.map((g) => `<a href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank"><img src="../${g.file}" width="${g.width}" height="${g.height}" loading="lazy" alt="${esc(p.label)}" onerror="this.style.display='none'"></a>`).join("\n")}
</div>
<p class="sub">Images are taken from the vendor's official sales page and belong to the vendor; they show the product as marketed.</p>`;
}

function compareTable(p, alts) {
  const row = (x, self = false) => `<tr${self ? ' class="self"' : ""}>
<td>${self ? `<b>${esc(x.label)}</b>` : `<a href="../reviews/${x.slug}.html">${esc(x.label)}</a>`}</td>
<td>${esc(x.type)}</td>
<td><b>${money(x.price, x.currency)}</b></td>
<td>${pct(x.commission)}</td>
<td>${pct(x.conversionRate)}</td>
<td>${pct(x.cancelRate)}</td>
<td><b>${money(x.earningsPerSale, x.currency)}</b></td>
</tr>`;
  return `<table class="specs">
<tr><th>Product</th><th>Type</th><th>Price</th><th>Commission</th><th>Cart conv.*</th><th>Cancel*</th><th>Earn./sale</th></tr>
${row(p, true)}
${alts.map((x) => row(x)).join("\n")}
</table>`;
}

// 关键词标签(内链锚文本)+ 来源区 + 评测方法 + 用户互动
function relatedSearches(p, altSlugs) {
  const pills = [];
  if (altSlugs && altSlugs.has(p.slug)) pills.push([`${p.label} alternatives`, `../alternatives/${p.slug}.html`]);
  pills.push([`${p.label} price & data`, "#record"]);
  pills.push([`${p.label} review & research`, "#research"]);
  if (p.vendorSiblings && p.vendorSiblings.length) pills.push([`All ${p.vendorName} offers`, "#vendor"]);
  const cat = DATA.categories.find((c) => String(c.catId) === String((p.categoryIds || [])[0]));
  if (cat) {
    pills.push([`${cat.label} on Digistore24`, `../category/${cat.file}.html`]);
    if (cat.count >= 8) pills.push([`Best ${cat.label} products`, `../best-of/best-${cat.file}.html`]);
  }
  pills.push([`${p.label} FAQ`, "#faq"]);
  if (GQ.products[String(p.id)]) pills.push([`${p.label} buyer risk checklist`, "#buying-decisions"]);
  pills.push([`How we evaluate products`, `../blog/digistore24-numbers-checklist.html`]);
  return `<h2>Related searches</h2>
<div class="pills">
${pills.map(([t, href]) => `<a href="${href}">${esc(t)}</a>`).join("\n")}
</div>`;
}

function sourcesBlock(p) {
  return `<h2>Sources &amp; further information</h2>
<ul style="line-height:1.9">
<li><b>Official sales page</b> (current price, guarantee, bonuses): <a href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">${esc((p.salesPageUrl || "").replace(/^https?:\/\//, "").slice(0, 60))}</a> (affiliate link)</li>
<li><b>Public Digistore24 product page:</b> <a href="https://www.checkout-ds24.com/product/${p.productId}/" rel="nofollow noopener" target="_blank">checkout-ds24.com/product/${p.productId}</a></li>
<li><b>Full research file (Markdown, versioned):</b> <a href="https://github.com/vsyour-cmd/digistore-picks/blob/main/content/products/${p.id}-${slug(p.label)}.md" rel="noopener">content/products/${p.id}-${slug(p.label)}.md</a></li>
${p.affiliateSupportPageUrl ? `<li><b>Vendor's affiliate support page:</b> <a href="${esc(p.affiliateSupportPageUrl)}" rel="nofollow noopener" target="_blank">${esc(p.affiliateSupportPageUrl.replace(/^https?:\/\//, "").slice(0, 60))}</a></li>` : ""}
<li><b>Marketplace category:</b> ${(p.categories || [])[0] ? `<a href="../category/${(DATA.categories.find((c) => c.label === p.categories[0]) || {}).file || ""}.html">${esc(p.categories[0])}</a>` : "Uncategorized"}</li>
</ul>`;
}

function interactionBlock(p) {
  const q = encodeURIComponent(p.label);
  const mail = encodeURIComponent("Correction: " + p.label);
  return `<h2>Questions, or own experience with ${esc(p.label)}?</h2>
<p>We publish hands-on reviews only after buying a product ourselves — but your experience helps other readers:
<a href="https://github.com/vsyour-cmd/digistore-picks/discussions?discussions_q=${q}" rel="noopener" target="_blank">start or join the discussion about ${esc(p.label)} on GitHub</a>.
Found a wrong number? <a href="mailto:admin@2bkf.com?subject=${mail}">Report a correction</a> — every page shows its data dates, and corrections are applied to the whole site.</p>`;
}

// FAQ:答案全部来自官方市场数据(计算)或厂商销售页宣称(标注),不编造;答案内嵌真实内链
// 证据与验证条件:每类结论 → 来源 → 日期 → 读者自查路径
function evidenceBox(p) {
  const res = p.research && !p.research.error;
  const srcPage = res ? (p.research.finalUrl || p.salesPageUrl) : p.salesPageUrl;
  const method = res && p.research.method === "browser-render" ? "browser-rendered" : "raw HTML";
  return `<div class="tldr"><b>Evidence base & verification conditions</b>
<ul>
<li><b>Listed price & billing</b> — source: official Digistore24 marketplace API, snapshot <b>${datemark(DATA.scrapedAt)}</b>. The checkout page is always the binding source for the current price.</li>
<li><b>Sales-page quotes & headline</b> — source: ${esc(srcPage || "official sales page")}, fetched <b>${datemark(DATA.researchedAt) || "—"}</b> (method: ${method}). Verify: open the official page.</li>
<li><b>Guarantee / refund</b> — set by the vendor; confirm on the sales page at purchase time.</li>
<li><b>Not verified by us:</b> product quality, outcomes, testimonials — no hands-on test has been performed for this listing.</li>
</ul></div>`;
}

// 购买前风险清单(AI 模拟买家尽调问题;答案仅来自市场数据或标注的厂商宣称)
const GQ_FILE = "G:/Digistore24/data/gemini-questions-en.json";
const GQ = fs.existsSync(GQ_FILE) ? JSON.parse(fs.readFileSync(GQ_FILE, "utf8")) : { products: {} };
function buyerChecklist(p) {
  const g = GQ.products[String(p.id)];
  if (!g || !g.groups) return "";
  const renderItem = (item) => {
    const l = item.toLowerCase();
    let pointer = "→ ask the vendor on the <a href=\"" + esc(p.promoLink) + "\" rel=\"nofollow sponsored noopener\" target=\"_blank\">official sales page</a>";
    if (/price|cost|\$|billed|€/.test(l)) pointer = "→ answer: <a href=\"#record\">marketplace record</a>";
    if (/guarantee|refund|money-back/.test(l)) pointer = "→ answer: <a href=\"#research\">guarantee research</a> + confirm on official page";
    if (/legit|evidence|verif|case stud|track record|testimonial/.test(l)) pointer = "→ answer: <a href=\"#research\">sales-page research</a> — vendor claims, not verified by us";
    if (/vendor|creator|coach|author|who/.test(l)) pointer = "→ answer: <a href=\"#vendor\">vendor block</a> + <a href=\"#research\">research</a>";
    if (/alternative/.test(l)) pointer = "→ answer: <a href=\"../alternatives/" + p.slug + ".html\">alternatives page</a>";
    if (/deliver|download|access after|after paying|member area/.test(l)) pointer = "→ answer: <a href=\"#faq\">delivery FAQ</a>";
    return `<li>${esc(item)} <span class="sub">${pointer}</span></li>`;
    };
    const groups = g.groups.map((grp) => `<h3>${esc(grp.group)} — does it hold up?</h3><ul>${grp.questions.map(renderItem).join("")}</ul>`).join("");
    return `<h2 id="buying-decisions">Before you pay: what buyers of ${esc(p.label)} try to resolve first</h2>
<div class="notice"><b>AI-simulated buyer due-diligence questions</b> (not verified customer research). Where our data can answer, we link it; everything else must be clarified with the vendor before you pay.</div>
${groups}`;
  }

function faqData(p, altData) {
  const gm = p.research && !p.research.error && p.research.guaranteeMention;
  const q = encodeURIComponent(p.label);
  const cat = DATA.categories.find((c) => String(c.catId) === String((p.categoryIds || [])[0]));
  const qas = [];
  qas.push({
    q: `What is ${p.label}?`,
    a: `${p.label} is a ${p.type.toLowerCase()} sold through the Digistore24 marketplace by vendor <a href="#vendor">${p.vendorName}</a>, listed since <b>${datemark(p.createdAt)}</b>.${(p.categories || []).length ? ` It is filed under ${p.categories.slice(0, 2).map((c) => {
      const co = DATA.categories.find((x) => x.label === c);
      return co ? `<a href="../category/${co.file}.html">${c}</a>` : c;
    }).join(" and ")}.` : ""} Digistore24 handles checkout, delivery and refunds for this product.`,
  });
  qas.push({
    q: `How much does ${p.label} cost?`,
    a: `The Digistore24 marketplace lists it at <b>${money(p.price, p.currency)}</b> (${(p.billingTypes || []).join(", ").toLowerCase() || "see sales page"}). Prices are set by the vendor and can change — the <a href="#record">marketplace record above</a> shows the snapshot; the official sales page shows the current price.`,
  });
  qas.push({
    q: `Is there a money-back guarantee for ${p.label}?`,
    a: gm
      ? `The vendor's sales page advertises: “${p.research.guaranteeMention}”. The guarantee window is set by the vendor — confirm the current terms on the official page before buying. Digistore24 handles the refund process.`
      : `Our sales-page research did not find explicit guarantee language. Many Digistore24 products carry a 60-day money-back guarantee, but this is set per product by the vendor — confirm on the official sales page before buying.`,
  });
  qas.push({
    q: `Is ${p.label} legit?`,
    a: `We don't rate legitimacy — we publish verifiable data instead: vendor <b>${p.vendorName}</b> (listed on Digistore24 since ${datemark(p.createdAt)}), listed on the marketplace since <b>${datemark(p.createdAt)}</b>, with its complete sales-page research archived on this page (vendor claims labeled as such). Read our <a href="../blog/digistore24-numbers-checklist.html">6-point evaluation method</a> and judge with the facts — or <a href="https://github.com/vsyour-cmd/digistore-picks/discussions?discussions_q=${q}" rel="noopener">join the discussion about ${esc(p.label)}</a>.`,
  });
  if (altData && altData.length >= 3) {
    qas.push({
      q: `Are there alternatives to ${p.label}?`,
      a: `Yes — the closest same-category offers are ${altData.slice(0, 3).map((x) => `<a href="../reviews/${x.slug}.html">${x.label}</a>`).join(", ")}. See the <a href="#compare">comparison table above</a> or the <a href="../alternatives/${p.slug}.html">full alternatives page</a> for side-by-side marketplace numbers.`,
    });
  }
  qas.push({
    q: `Where can I buy ${p.label} safely?`,
    a: `Only through the <a href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">official sales page</a> linked on this site (checkout and refunds run via Digistore24). Verify the price and guarantee there before ordering. That link is an affiliate link — buying through it supports this site at no extra cost to you.`,
  });
  qas.push({
    q: `How do I get ${p.label} after paying?`,
    a: `Checkout runs on Digistore24: after payment you receive <b>${(p.billingTypes || []).join(" or ").toLowerCase().includes("subscription") ? "access credentials and your subscription dashboard" : TYPE_USAGE_EN[p.type] ? "your access or download by email and in your Digistore24 customer account" : "delivery or access details by email and in your Digistore24 customer account"}</b>. Delivery details for this product type: ${esc((TYPE_USAGE_EN[p.type] || "see the vendor's sales page").replace(/\.$/, ""))}. If anything fails, Digistore24 buyer support can recover your order.`,
  });
  return qas;
}

function faqSection(p, qas) {
  return `<h2 id="faq">Frequently asked questions about ${esc(p.label)}</h2>
<p class="sub">Answers compiled from the marketplace snapshot (${datemark(DATA.scrapedAt)}) and vendor sales-page research (${datemark(DATA.researchedAt) || "—"}); vendor claims are labeled inline.</p>
${qas.map(({ q, a }) => `<h3>${esc(q)}</h3>\n<p>${a}</p>`).join("\n")}`;
}

function faqJsonLd(p, qas) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qas.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a.replace(/<a [^>]*>/g, "").replace(/<\/a>/g, "").replace(/<[^>]+>/g, "") },
    })),
  };
}

// 分类页 FAQ(计算自该分类全量数据)
function categoryFaq(c, items) {
  const avg = items.length ? items.reduce((a, p) => a + (p.price || 0), 0) / items.length : 0;
  const best = [...items].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0))[0];
  const bestConv = [...items].sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0))[0];
  const qas = [
    {
      q: `How many ${c.label} products are on Digistore24?`,
      a: `<b>${items.length} English-language offers</b> (as of ${datemark(DATA.scrapedAt)}), with an average list price of ${money(avg, "USD")}. This page lists them all with official marketplace statistics.`,
    },
    {
      q: `Which ${c.label} product pays affiliates the most?`,
      a: `<a href="../reviews/${best.slug}.html">${best.label}</a> currently leads with <b>${money(best.earningsPerSale, best.currency)}</b> earnings per sale at ${pct(best.commission)} commission (vendor-side marketplace data, not a forecast).`,
    },
    {
      q: `Which ${c.label} offer converts best?`,
      a: `<a href="../reviews/${bestConv.slug}.html">${bestConv.label}</a> has the highest reported cart conversion in this category (${pct(bestConv.conversionRate)}). Conversion depends on traffic quality — treat it as the vendor's funnel performance, not a promise.`,
    },
    {
      q: `How do I choose a ${c.label} product?`,
      a: `Use the marketplace's own numbers: earnings/sale ÷ cancel-rate skepticism × funnel fit. Our <a href="../blog/digistore24-numbers-checklist.html">6-point evaluation method</a> walks through it, and every profile on this site shows all six data points.`,
    },
  ];
  return qas;
}

// ---------- 分类 FAQ 库(改进项:每分类 50 个买家常见问题,全部数据驱动、可验证) ----------
const AMAZON_TAG = "adminstore05-20";
const AMAZON_PICKS = (() => { try { return JSON.parse(fs.readFileSync("G:/Digistore24/data/amazon-picks.json", "utf8")); } catch { return {}; } })();
// 分类 → Reddit 社区(真实存在的 sub,链接指向社区主页/搜索,不断链)
const SUBREDDIT_MAP = [
  { re: /supplement|health|fitness|weight|diet|nutrition/i, subs: ["Supplements", "nutrition"] },
  { re: /business|marketing|e-?commerce|entrepreneur|sales|management|office|project/i, subs: ["Entrepreneur", "smallbusiness"] },
  { re: /investment|trading|finance|crypto|money|economy|politics/i, subs: ["personalfinance", "investing"] },
  { re: /crypto/i, subs: ["CryptoCurrency"] },
  { re: /spiritua|esoteric|religion/i, subs: ["spirituality"] },
  { re: /language/i, subs: ["languagelearning"] },
  { re: /software|computer|internet|technology/i, subs: ["software", "SideProject"] },
  { re: /home|garden|craft|hobby/i, subs: ["DIY"] },
  { re: /pet|animal/i, subs: ["pets"] },
  { re: /dating|relationship|family|children/i, subs: ["relationships"] },
  { re: /sport|football|soccer/i, subs: ["Fitness"] },
  { re: /photography|film|video/i, subs: ["photography"] },
  { re: /travel|culture/i, subs: ["travel"] },
  { re: /education|profession|job|career/i, subs: ["careerguidance"] },
  { re: /game|fun/i, subs: ["gaming"] },
  { re: /music|dancing/i, subs: ["WeAreTheMusicMakers"] },
  { re: /green|environment/i, subs: ["sustainability"] },
  { re: /fashion|beauty|skin/i, subs: ["beauty"] },
  { re: /hotel|gastronomy|food|drink|cooking/i, subs: ["cooking"] },
];
const subsFor = (p) => {
  const lbl = (p.categories || []).join(" ") + " " + (p.type || "");
  const hit = SUBREDDIT_MAP.find((m) => m.re.test(lbl));
  return hit ? hit.subs : [];
};
// 亚马逊分类关键词(用于 tag 搜索链接;具体 ASIN 推荐走 data/amazon-picks.json)
const AMAZON_KW = [
  { re: /supplement|health|fitness|weight|diet/i, kw: "supplements" },
  { re: /software|computer/i, kw: "productivity software" },
  { re: /marketing|business|sales/i, kw: "marketing books" },
  { re: /investment|trading|finance|crypto/i, kw: "investing books" },
  { re: /language/i, kw: "language learning" },
  { re: /home|garden/i, kw: "home garden tools" },
  { re: /pet|animal/i, kw: "pet supplies" },
  { re: /photography|film|video/i, kw: "camera accessories" },
  { re: /music|dancing/i, kw: "music equipment" },
  { re: /cooking|food|drink/i, kw: "kitchen gadgets" },
  { re: /sport/i, kw: "sports equipment" },
  { re: /beauty|skin|fashion/i, kw: "skincare" },
  { re: /travel/i, kw: "travel accessories" },
  { re: /spiritua|esoteric/i, kw: "meditation books" },
];
const amazonKwFor = (p) => {
  const lbl = (p.categories || []).join(" ");
  const hit = AMAZON_KW.find((m) => m.re.test(lbl));
  return hit ? hit.kw : ((p.categories || [])[0] || "digital products") + " book";
};
// 已整理的社区问题(research-notes/reddit-questions-en.md,6 个重点产品 × 20 问)
const CURATED_QA = (() => {
  const f = "G:/Digistore24/research-notes/reddit-questions-en.md";
  const map = { 1: "58899", 2: "57396", 3: "56740", 4: "47080", 5: "33696", 6: "48578" };
  try {
    const md = fs.readFileSync(f, "utf8");
    const out = {};
    for (const s of md.split(/^## /m).slice(1)) {
      const pid = map[parseInt(s, 10)];
      if (!pid) continue;
      const qs = [...s.matchAll(/^\|\s*\d+\s*\|\s*"?(.+?)"?\s*\|/gm)].map((m) => m[1]).filter((q) => q.length > 8);
      if (qs.length) out[pid] = qs;
    }
    return out;
  } catch { return {}; }
})();

function communityBlock(p) {
  const subs = subsFor(p);
  const links = subs.slice(0, 3).map((s) => `<li><a href="https://www.reddit.com/r/${s}/" rel="noopener" target="_blank">r/${s}</a> — community discussions that often touch ${esc((p.categories || [])[0] || "this product category").toLowerCase()}.</li>`);
  links.push(`<li><a href="https://www.reddit.com/search/?q=${encodeURIComponent(p.label)}&sort=relevance&t=year" rel="noopener" target="_blank">Search Reddit for "${esc(p.label)}"</a> — real-time results, we don't control them.</li>`);
  links.push(`<li><a href="https://www.reddit.com/search/?q=${encodeURIComponent(p.label + " review")}&sort=top&t=year" rel="noopener" target="_blank">Top "review" mentions this year</a> — sort by top, filter by recency yourself.</li>`);
  const curated = CURATED_QA[String(p.id)];
  const curatedHtml = curated ? `<p class="sub">Curated buyer questions we track for this offer (community research, ${curated.length} on file):</p><ul>${curated.slice(0, 6).map((q) => `<li>${esc(q)}</li>`).join("")}</ul><p class="sub">These are questions, not answers — the answered FAQ is above; the discussion happens on Reddit.</p>` : "";
  return `<h2 id="community">Discuss ${esc(p.label)} on Reddit</h2>
<p class="sub">Community threads are where real buyers compare notes. We link to communities, not to specific posts — threads move, subreddits stay:</p>
<ul style="line-height:1.9">${links.join("\n")}</ul>
${curatedHtml}`;
}

function amazonBlock(p) {
  const tag = (AMAZON_PICKS && AMAZON_PICKS.tag) || AMAZON_TAG;
  const catFile = (() => { const co = DATA.categories.find((c) => String(c.catId) === String((p.categoryIds || [])[0])); return co ? co.file : ""; })();
  const picks = ((AMAZON_PICKS.products || {})[String(p.id)] || (AMAZON_PICKS.categories || {})[catFile] || []).slice(0, 3);
  const items = picks.map((c) => `<li><a href="${c.url || `https://www.amazon.com/dp/${c.asin}?tag=${tag}`}" rel="nofollow sponsored noopener" target="_blank">${esc(c.title || c.asin)}</a>${c.note ? ` — ${esc(c.note)}` : ""}</li>`);
  const kw = amazonKwFor(p);
  if (!items.length) {
    items.push(`<li><a href="https://www.amazon.com/s?k=${encodeURIComponent(kw)}&tag=${tag}" rel="nofollow sponsored noopener" target="_blank">Shop ${esc(kw)} on Amazon</a> — top results, Amazon's ranking.</li>`);
    items.push(`<li><a href="https://www.amazon.com/s?k=${encodeURIComponent(kw + " bestseller")}&tag=${tag}" rel="nofollow sponsored noopener" target="_blank">Bestsellers in ${esc(kw)}</a> — live Amazon list, we don't curate it.</li>`);
  }
  return `<h2 id="amazon">Related shopping on Amazon</h2>
<p>Physical products and gear commonly bought alongside ${esc(p.label)}:</p>
<ul style="line-height:1.9">${items.join("\n")}</ul>
<p class="sub"><b>Sponsored:</b> as an Amazon Associate, ${SITE_NAME} earns from qualifying purchases (tag <code>${esc(tag)}</code>). Amazon sets its own prices and commissions (typically low single digits — far below Digistore24 vendors' 30–75%). We list Amazon as a convenience for physical goods; it is not an alternative to the digital product above.</p>`;
}

function faqBank(cat, items) {
  const n = items.length;
  const sorted = [...items].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0));
  const prices = items.map((p) => p.price).filter((x) => x != null).sort((a, b) => a - b);
  const med = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
  const minP = prices[0], maxP = prices[prices.length - 1];
  const withG = items.filter((p) => p.research && !p.research.error && p.research.guaranteeMention);
  const gPct = n ? Math.round((withG.length / n) * 100) : 0;
  const cancels = items.map((p) => p.cancelRate).filter((x) => x != null).sort((a, b) => a - b);
  const medC = cancels.length ? cancels[Math.floor(cancels.length / 2)] : null;
  const vendors = new Set(items.map((p) => p.vendorName)).size;
  const subs = items.filter((p) => (p.billingTypes || []).some((b) => /subscri/i.test(b))).length;
  const withStats = items.filter((p) => p.conversionRate != null).length;
  const unreachable = items.filter((p) => p.research && p.research.error).length;
  const byDate = [...items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const newest = byDate[byDate.length - 1], oldestL = byDate[0];
  const top = sorted[0];
  const topConv = [...items].sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0))[0];
  const lowC = sorted.slice(0, 10).sort((a, b) => (a.cancelRate || 99) - (b.cancelRate || 99))[0];
  const cheapest = [...items].sort((a, b) => (a.price || 1e9) - (b.price || 1e9))[0];
  const topTypes = Object.entries(items.reduce((m, p) => { const t = p.type || "other"; m[t] = (m[t] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const L = (p) => `<a href="../reviews/${p.slug}.html">${esc(p.label)}</a>`;
  const out = [];
  const add = (g, q, a) => out.push({ g, q, a });
  // A. 价格与费用
  add("Costs & pricing", `How many ${cat.label} products are on Digistore24?`, `<b>${n} English-language offers</b> from ${vendors} different vendors (as of ${datemark(DATA.scrapedAt)}). The <a href="../category/${cat.file}.html">category page</a> lists every one with official marketplace statistics.`);
  add("Costs & pricing", `What does a typical ${cat.label} product cost?`, `The median list price in this category is <b>${money(med, "USD")}</b>, with a range from ${money(minP, "USD")} to ${money(maxP, "USD")}. Median is more honest than average here — a few very high-ticket offers pull the average up.`);
  add("Costs & pricing", `Why do ${cat.label} prices vary so much?`, `Spread runs from ${money(minP, "USD")} to ${money(maxP, "USD")}. The list price is often just the entry point: many funnels upsell additional modules or coaching after checkout. Judge offers by the refund terms and cancel rate, not by the sticker.`);
  add("Costs & pricing", `Are there hidden costs with ${cat.label} products?`, `The Digistore24 checkout shows the binding price before you pay; sales tax/VAT may be added depending on your country. ${subs} of the ${n} listings in this category are subscriptions — those bill repeatedly until cancelled. Everything else on this site is a one-time price as listed.`);
  add("Costs & pricing", `What's the cheapest ${cat.label} product?`, `${L(cheapest)} at <b>${money(cheapest.price, cheapest.currency)}</b>. Cheap is not the same as good value — check its cancel rate and the sales page before buying.`);
  add("Costs & pricing", `Do prices include VAT or sales tax?`, `No — the listed price is the vendor's net price. Digistore24 adds the tax your country requires at checkout, where you always see the final amount before paying.`);
  add("Costs & pricing", `One-time payment or subscription?`, `This category has ${subs} subscription listings out of ${n} total; the rest are one-time purchases. The billing type is shown on every product profile on this site and again at checkout.`);
  add("Costs & pricing", `Do ${cat.label} prices change often?`, `Vendor-side prices do move. Our <a href="../price-watch.html">price tracker</a> diffs daily snapshots of the whole marketplace, so changes ≥1% show up there automatically.`);
  add("Costs & pricing", `Is a more expensive ${cat.label} product better?`, `Price measures positioning, not quality. The marketplace publishes a cancel rate — the share of buyers who reverse their purchase — and expensive listings are not systematically lower. Use the <a href="../blog/digistore24-numbers-checklist.html">6-point check</a> instead of the price tag.`);
  add("Costs & pricing", `Can I pay in installments?`, `Some vendors offer installment plans (shown as separate billing types on the sales page). Digistore24 processes whatever the vendor configured — the checkout page shows your options before you commit.`);
  // B. 退款与保障
  add("Refunds & guarantees", `Do ${cat.label} products come with a money-back guarantee?`, `${gPct}% of the sales pages we researched in this category state explicit guarantee language (vendor claims — not our verification). Digistore24 processes refunds per the vendor's terms; the checkout page is the binding source.`);
  add("Refunds & guarantees", `How do Digistore24 refunds work?`, `You request the refund through Digistore24 (support portal or the link in your order email), Digistore24 forwards it to the vendor's terms, and the payment is reversed through the platform. Full mechanics: <a href="../digistore24-refunds.html">how Digistore24 refunds work</a>.`);
  add("Refunds & guarantees", `How long is the refund window for ${cat.label}?`, `It is set per product by the vendor — many Digistore24 listings carry 60 days, some 14 or 30. The window is shown at checkout; treat that page, not the sales page, as binding.`);
  add("Refunds & guarantees", `What is a "cancel rate" and why should I care?`, `It's the share of a product's completed purchases that end in cancellation or refund. This category's median is ${medC != null ? "<b>" + pct(medC) + "</b>" : "not published"} (vendor-side, across the vendor's traffic). It is the single best proxy for "how often do buyers regret this".`);
  add("Costs & pricing", `Which ${cat.label} products have the lowest cancel rates?`, `Among the top earners, ${L(lowC)} currently reports the lowest cancel rate (${pct(lowC.cancelRate)}). Compare the whole table on the <a href="../category/${cat.file}.html">category page</a>.`);
  add("Refunds & guarantees", `What if the vendor's sales page is already offline?`, `${unreachable} listing${unreachable === 1 ? "" : "s"} in this category currently have unreachable sales pages (dead domains, bot walls). Their profiles say so. Don't buy what you can't review — the refund process needs a working vendor behind it.`);
  add("Refunds & guarantees", `How do refunds work for subscriptions?`, `You can cancel future billing through Digistore24 at any time; past periods are refunded per the vendor's guarantee window. The cancellation control lives in your Digistore24 customer account.`);
  add("Refunds & guarantees", `Chargeback or refund — which is better?`, `Use the Digistore24 refund process first: it's faster, it doesn't cost the vendor a chargeback fee dispute, and it keeps your record clean with your bank. Chargebacks are the fallback when the refund process genuinely fails.`);
  add("Refunds & guarantees", `What if a vendor ignores a refund request?`, `Digistore24's buyer support mediates — the platform processed your payment and has leverage over the vendor. Contact them via the support link in your order confirmation email with your order number.`);
  add("Refunds & guarantees", `Is there any buyer protection beyond the guarantee?`, `Your strongest protections: paying through Digistore24 (never direct transfer), screenshotting the guarantee terms at checkout, and deciding inside the window. More background: <a href="../is-digistore24-safe.html">is Digistore24 safe?</a>`);
  // C. 信任与安全
  add("Trust & safety", `Is it safe to buy ${cat.label} products on Digistore24?`, `Digistore24 is a established payment platform — checkout, delivery and refunds run through it, so your card details go to Digistore24, not the vendor. The product quality itself is a vendor question: judge each listing with the marketplace data on this site. See <a href="../is-digistore24-safe.html">the full safety breakdown</a>.`);
  add("Trust & safety", `Who sells ${cat.label} products on Digistore24?`, `${vendors} different vendors currently list in this category. Every product profile names its vendor and lists their other catalog entries (where a <a href="../vendors/index.html">vendor hub</a> exists).`);
  add("Trust & safety", `How do I spot a scammy ${cat.label} listing?`, `Our checklist: unreachable or recycled sales page, no guarantee wording, urgency countdowns paired with a high cancel rate, and vendor identities that change names weekly. None of these is proof of a scam — together they lower your odds. The <a href="../blog/digistore24-numbers-checklist.html">6-point check</a> operationalizes this.`);
  add("Trust & safety", `Are the sales-page claims verified by anyone?`, `No. Everything we quote from sales pages is labeled <b>vendor claims, not verified by us</b>. Marketplace statistics (price, commission, conversion, cancel rate) come from the official Digistore24 record — those are vendor-reported too, but they're the numbers the platform itself keeps.`);
  add("Trust & safety", `Which payment methods does Digistore24 accept?`, `Common methods include major credit/debit cards, PayPal and several country-specific options — the checkout page shows exactly what's available for your country. If a vendor pushes you off-platform to pay, walk away.`);
  add("Trust & safety", `Who runs this site and why should I trust it?`, `${SITE_NAME} is an independent directory. We publish vendor-side marketplace statistics with their limitations, label sales-page quotes as vendor claims, show our data sources, and log every change in a public <a href="../changelog.html">changelog</a>. We earn affiliate commissions — disclosed on every page — but the data itself is not for sale.`);
  add("Trust & safety", `Have you bought the ${cat.label} products listed here?`, `No. Our profiles are <b>data profiles</b> (marketplace record + verbatim sales-page extracts), not hands-on reviews. When we ever publish a hands-on review, the page says so at the top. Honesty about what we haven't done is the point.`);
  add("Trust & safety", `Why do some ${cat.label} profiles lack conversion or cancel-rate stats?`, `${withStats} of ${n} listings in this category publish cart-conversion data; vendors decide which stats Digistore24 shows. Missing stats are displayed as "—" — absence is information too.`);
  add("Trust & safety", `How current is the data on this site?`, `Marketplace snapshot: <b>${datemark(DATA.scrapedAt)}</b>; sales-page research: ${datemark(DATA.researchedAt) || "—"}. Everything rebuilds daily, and the <a href="../changelog.html">changelog</a> logs what changed.`);
  add("Trust & safety", `Can I download the raw data?`, `Yes — <a href="../llms-full.txt">llms-full.txt</a> carries the top-500 dataset in one file, per-product research lives in our public GitHub repository, and every page shows its data snapshot date.`);
  // D. 分类选购指南
  add("Buying guidance", `What should I check before buying any ${cat.label} product?`, `Six numbers, in order: price vs. category median (${money(med, "USD")} here), cancel rate vs. median (${medC != null ? pct(medC) : "n/a"} here), guarantee window at checkout, vendor history, sales-page reachability, and your own refund-window discipline. Full method: <a href="../blog/digistore24-numbers-checklist.html">the numbers check</a>.`);
  add("Buying guidance", `Which ${cat.label} product pays affiliates the most?`, `${L(top)} leads with <b>${money(top.earningsPerSale, top.currency)}</b> earnings per sale at ${pct(top.commission)} commission (vendor-side data). High payouts usually mean high-ticket funnels — read the cancel rate before promoting.`);
  add("Buying guidance", `Which ${cat.label} offer converts best?`, `${L(topConv)} reports the highest cart conversion in this category (${pct(topConv.conversionRate)}). Conversion measures the checkout funnel, not your future results.`);
  add("Buying guidance", `What's the newest ${cat.label} listing?`, `${L(newest)}, listed ${datemark(newest.createdAt)}. Very new listings have no track record — their cancel rates are meaningless until traffic accumulates. Track new arrivals on <a href="../monthly-new.html">the monthly page</a>.`);
  add("Buying guidance", `Which ${cat.label} listing has been around longest?`, `${L(oldestL)}, on the marketplace since ${datemark(oldestL.createdAt)}. Longevity is not quality — but a decade-old listing with a low cancel rate has survived real buyers.`);
  add("Buying guidance", `What types of ${cat.label} products dominate?`, `${topTypes.map(([t, c]) => `${esc(t)} (${c})`).join(" and ")} lead this category. The type is shown on every profile — it affects delivery (immediate download vs. membership access) and refund behavior.`);
  add("Buying guidance", `Are high-ticket ${cat.label} offers worth it?`, `They can be — if you'd still buy at twice the price and you commit to evaluating inside the refund window. At ${money(maxP, "USD")} for the most expensive listing here, the guarantee terms matter more than the sales page.`);
  add("Buying guidance", `Do vendors offer discounts or bundles?`, `Frequently — sales pages advertise voucher codes, bundles and crossed-out list prices (our research records these mentions per product). The checkout price is what counts; voucher codes that don't work there don't exist.`);
  add("Buying guidance", `I want alternatives to a specific ${cat.label} product — where?`, `Top offers have dedicated comparison pages (<a href="../alternatives/index.html">alternatives index</a>), and every product profile links related same-category offers. The full A–Z list: <a href="../reviews/index.html">all ${DATA.total} products</a>.`);
  add("Buying guidance", `Is there a ${cat.label} product you'd personally recommend?`, `We don't endorse products — no one can vouch for a product they haven't used, and we haven't used these. What we can do: show every marketplace number side by side (<a href="../category/${cat.file}.html">category table</a>) so your decision rests on data, not on the loudest sales page.`);
  // E. 数据、方法与联盟
  add("Data & method", `How does ${SITE_NAME} evaluate ${cat.label} products?`, `Mechanically, from official marketplace statistics — no sponsorship, no hands-on testing unless labeled. <a href="../blog/digistore24-numbers-checklist.html">The 6-point numbers check</a> is the method behind every page, including this category.`);
  add("Data & method", `What does "earnings per sale" mean?`, `The average affiliate payout per completed sale of this product (commission × price, adjusted by refunds). It's a vendor-side marketplace statistic. For buyers it signals how aggressively the offer is being promoted.`);
  add("Data & method", `What does "cart conversion" mean?`, `The share of people who reach the order form and complete the purchase. It measures the vendor's checkout funnel for their traffic — it is not a forecast of your experience.`);
  add("Data & method", `Does your affiliate commission change my price?`, `No. If you buy through a link on this site, the vendor pays the commission out of their margin; the checkout price is identical. Disclosure: <a href="../about.html">about page</a>, and on every page footer.`);
  add("Data & method", `How often does this FAQ update?`, `The numbers inside the answers refresh with the daily rebuild (marketplace snapshot ${datemark(DATA.scrapedAt)}). Questions themselves are reviewed as the category evolves — additions and corrections land via the <a href="../changelog.html">changelog</a>.`);
  add("Data & method", `Where do the statistics come from?`, `The official Digistore24 marketplace, as shown to registered affiliates: price, commission, cart conversion, cancel rate, earnings per sale, listing dates. All vendor-side, all caveated, snapshot ${datemark(DATA.scrapedAt)}.`);
  add("Data & method", `How do I promote ${cat.label} products as an affiliate?`, `Register as a Digistore24 affiliate (free), pick offers with the earnings/sale ÷ cancel-rate math, and use the marketplace's tracking links. This category's commissions run ${Math.round(Math.min(...items.map((p) => p.commission || 0)))}%–${Math.round(Math.max(...items.map((p) => p.commission || 0)))}% per sale.`);
  add("Data & method", `What does an affiliate link change for me as a buyer?`, `Nothing at checkout — same price, same terms. It attributes the sale to the publisher. Judge the product the same way either way.`);
  add("Data & method", `Why show marketplace statistics instead of reviews?`, `Reviews can't be verified and age badly. The marketplace record is standardized across all ${n} listings in this category, which makes like-for-like comparison possible — that's the core idea of this site.`);
  add("Data & method", `I have a problem with a purchase — where do I start?`, `Digistore24 buyer support via the link in your order email, with your order number. Then the vendor's own support for product issues. The refund mechanics: <a href="../digistore24-refunds.html">refunds explained</a>.`);
  return out;
}

// FAQ 枢纽跨语言配对(改进项 faq-hreflang-crosslink):按 catId 找 DE 对应页
function faqDeCounterpart(catId) {
  if (!DE_DATA) return null;
  const c2 = DE_DATA.categories.find((c) => String(c.catId) === String(catId));
  if (!c2) return null;
  const mk = (cats) => { const cnt = {}; for (const c of cats) { const b = slug(c.label); cnt[b] = (cnt[b] || 0) + 1; } return (c) => (cnt[slug(c.label)] > 1 ? slug(c.section) + "-" + slug(c.label) : slug(c.label)); };
  const url = "https://vsyour-cmd.github.io/digistore-picks-de/faq/" + mk(DE_DATA.categories)(c2) + ".html";
  // 对侧文件可能不存在(小分类不足3品无FAQ页):跨目录实测,防 hreflang 死链
  if (!fs.existsSync("G:/Digistore24/site-de/faq/" + mk(DE_DATA.categories)(c2) + ".html")) return null;
  return url;
}

function faqHubPages() {
  const dir = outPath("faq");
  fs.mkdirSync(dir, { recursive: true });
  let built = 0;
  const eligible = DATA.categories.filter((c) => products.filter((p) => (p.categoryIds || []).includes(String(c.catId))).length >= 3);
  // 未归类产品(平台未给分类)也生成专属 FAQ 枢纽——分类页 tldr 会链接它
  { const un = products.filter((p) => !(p.categoryIds || []).length).length;
    if (un >= 3) eligible.push({ catId: "uncat", label: "Uncategorized", section: "Digistore24", file: "uncategorized", count: un }); }
  for (let ci = 0; ci < eligible.length; ci++) {
    const c = eligible[ci];
    const items = products.filter((p) => (p.categoryIds || []).includes(String(c.catId)) || (c.catId === "uncat" && !(p.categoryIds || []).length));
    const qas = faqBank(c, items);
    const groups = [...new Set(qas.map((x) => x.g))];
    const best = [...items].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0))[0];
    const med = (() => { const p = items.map((x) => x.price).filter((x) => x != null).sort((a, b) => a - b); return p.length ? p[Math.floor(p.length / 2)] : 0; })();
    const deFaqUrl = faqDeCounterpart(c.catId);
  const xrefHtml = deFaqUrl ? `<p class="sub">Diese FAQ gibt es auch auf <a hreflang="de" href="${deFaqUrl}">Deutsch</a>.</p>` : "";
  const faqHref = deFaqUrl ? `<link rel="alternate" hreflang="de" href="${deFaqUrl}"><link rel="alternate" hreflang="en" href="${SITE_URL}/faq/${c.file}.html">` : "";
  const ringHtml = `<p class="sub">More category FAQs: ${[1, 2, 3].map((k) => eligible[(ci + k) % eligible.length]).map((x) => `<a href="../faq/${x.file}.html">${esc(x.label)}</a>`).join(" · ")}</p>`;
  const body = `
<h1>${esc(c.label)} on Digistore24: 50 buyer questions, answered</h1>
<p class="sub">Category FAQ · Marketplace data ${datemark(DATA.scrapedAt)} · ${items.length} offers analyzed · Every figure below is vendor-side marketplace data or labeled vendor claims</p>
<div class="tldr"><b>At a glance:</b> <ul>
<li><b>${items.length} offers</b>, median price <b>${money(med, "USD")}</b>, leader: <a href="../reviews/${best.slug}.html">${esc(best.label)}</a> (${money(best.earningsPerSale, best.currency)}/sale).</li>
<li>The 50 questions below are grouped: costs, refunds, trust, buying guidance, and how our data works.</li>
<li>Every product page on this site links back here; the numbers refresh daily.</li>
</ul></div>
<table class="specs">
<tr><th>Snapshot</th><th>Value</th></tr>
<tr><td>Offers / vendors</td><td>${items.length} / ${new Set(items.map((p) => p.vendorName)).size}</td></tr>
<tr><td>Median / range of list price</td><td>${money(med, "USD")} / ${money(Math.min(...items.map((p) => p.price || 0)), "USD")}–${money(Math.max(...items.map((p) => p.price || 0)), "USD")}</td></tr>
<tr><td>Median cancel rate</td><td>${(() => { const x = items.map((p) => p.cancelRate).filter((v) => v != null).sort((a, b) => a - b); return x.length ? pct(x[Math.floor(x.length / 2)]) : "not published"; })()}</td></tr>
<tr><td>Research basis</td><td>Official Digistore24 marketplace API (snapshot ${datemark(DATA.scrapedAt)}); sales-page research ${datemark(DATA.researchedAt) || "—"}</td></tr>
</table>
${groups.map((g) => `<h2>${esc(g)}</h2>
${qas.filter((x) => x.g === g).map((x) => `<h3>${esc(x.q)}</h3>\n<p>${x.a}</p>`).join("\n")}`).join("\n")}
<p class="sub">How we evaluate: <a href="../blog/digistore24-numbers-checklist.html">6-point numbers check</a> · <a href="../about.html">research standards</a>. ${ringHtml} Evidence &amp; verification conditions: statistics from the official Digistore24 marketplace API (snapshot ${datemark(DATA.scrapedAt)}); guarantee and claim language quoted from vendors' public sales pages is labeled vendor claims and is not our verification.</p>`;
  
  const jsonLd = [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: qas.slice(0, 10).map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a.replace(/<[^>]+>/g, "") } })),
    }];
    fs.writeFileSync(path.join(dir, c.file + ".html"), layout({
      title: `${c.label} on Digistore24: 50 buyer questions answered`,
      desc: `50 real buyer questions about ${c.label} on Digistore24 — pricing, refunds, cancel rates, vendor trust — answered with official marketplace data. Updated ${datemark(DATA.scrapedAt)}.`,
      body, rel: "..", path: `faq/${c.file}.html`, jsonLd, hreflangLinks: faqHref,
      crumb: [{ label: "Home", href: "../index.html" }, { label: c.label, href: `../category/${c.file}.html` }, { label: "FAQ", href: `../faq/${c.file}.html` }],
    }));
    built++;
  }
  console.log(`faq hubs: ${built} pages (50 Q&As each)`);
}

function aboutPage() {
  const body = `
<h1>About ${SITE_NAME}</h1>
<p class="sub">Independent directory of Digistore24 marketplace products</p>
<h2>What we do</h2>
<p>${SITE_NAME} organizes the English-language offers in the <a href="https://www.digistore24.com" rel="noopener">Digistore24</a> affiliate marketplace (${DATA.total} products across ${DATA.categories.length} categories as of ${datemark(DATA.scrapedAt)}) and publishes the numbers that matter before you buy or promote: price, commission, cart conversion, cancel rate, earnings per sale, vendor, listing age — plus verbatim research from each vendor's sales page (headlines, pricing claims, guarantee language, CTA copy).</p>
<h2>How we research</h2>
<p>Every page is labeled with its research method:</p>
<ul>
<li><b>Data profile</b> — facts from the official marketplace listing, plus verbatim extracts from the vendor's public sales page, clearly marked as vendor claims. No hands-on claims.</li>
<li><b>Hands-on review</b> — we purchased the product with our own money and used it. Screenshots are our own.</li>
</ul>
<p>We do not publish testimonials we cannot verify, and we do not quote earnings claims that are not on the vendor's official page. When a sales page is unreachable (dead domain, expired certificate), we say so — that's information too.</p>
<h2>Affiliate disclosure (FTC)</h2>
<p>This site contains affiliate links. If you click one and buy a product, we may earn a commission from the vendor — this does not increase your price.</p>
<h2>Contact</h2>
<p>Questions or corrections? Open an issue on our <a href="https://github.com/vsyour-cmd/digistore-picks" rel="noopener">GitHub repository</a>. Every product's full research file is versioned there under <code>content/products/</code>.</p>
<h2>Data source &amp; updates</h2>
<p>Product data comes from the official Digistore24 marketplace API for logged-in affiliates; sales-page research is refreshed regularly and each page shows its dates. Marketplace statistics belong to Digistore24/the vendor and are shown for reference only.</p>`;
  fs.writeFileSync(outPath("about.html"), layout({
    title: `About — ${SITE_NAME}`,
    desc: "About DigistorePicks: research methods, affiliate disclosure, contact.",
    body, path: "about.html",
    crumb: [{ label: "Home", href: "index.html" }, { label: "About", href: "about.html" }],
  }));
}

// ---------- 本月新上架(数据驱动月度盘点) ----------
function monthlyNewPage() {
  const cutoff = Date.now() - 31 * 24 * 3600 * 1000;
  const fresh = products
    .filter((p) => p.createdAt && new Date(p.createdAt).getTime() >= cutoff)
    .sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0));
  const dateLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const rows = fresh.slice(0, 50).map((p, i) => `<tr>
<td>${i + 1}</td>
<td><a href="reviews/${p.slug}.html">${esc(p.label)}</a></td>
<td>${esc(p.type)}</td>
<td>${money(p.price, p.currency)}</td>
<td>${pct(p.commission)}</td>
<td><b>${money(p.earningsPerSale, p.currency)}</b></td>
<td>${datemark(p.createdAt)}</td>
</tr>`);
  const body = `<h1>New on Digistore24 — ${dateLabel}</h1>
<p class="sub">${fresh.length} offers listed in the last 31 days · ranked by earnings/sale · marketplace data ${datemark(DATA.scrapedAt)}</p>
<div class="tldr"><b>Key takeaways:</b>
<ul>
<li><b>${fresh.length} new offers</b> appeared in the last 31 days (average price ${money(fresh.length ? fresh.reduce((a, p) => a + (p.price || 0), 0) / fresh.length : 0, "USD")}).</li>
<li>Highest earnings/sale among new listings: <b>${esc(fresh[0] ? fresh[0].label : "—")}</b>${fresh[0] ? ` at <b>${money(fresh[0].earningsPerSale, fresh[0].currency)}</b> (${pct(fresh[0].commission)} commission)` : ""}.</li>
<li>New listings are unproven — check the vendor's history and cancel rate on each profile before promoting.</li>
</ul>
</div>
${fresh.length ? `<table class="specs">
<tr><th>#</th><th>Product</th><th>Type</th><th>Price</th><th>Commission</th><th>Earn./sale</th><th>Listed</th></tr>
${rows.join("\n")}
</table>
<p class="sub">* Vendor-side marketplace statistics; not a forecast. Full profiles linked from every row.</p>` : "<p>No new listings in the last 31 days.</p>"}`;
  fs.writeFileSync(outPath("monthly-new.html"), layout({
    title: `New Digistore24 offers — ${dateLabel} (${fresh.length} listed)`,
    desc: `All ${fresh.length} Digistore24 offers listed in the last 31 days, ranked by official earnings-per-sale. Updated ${datemark(DATA.scrapedAt)}.`,
    body, path: "monthly-new.html",
  }));
}

// ---------- 厂商 Hub 页(实体聚合,≥2 产品的厂商) ----------
function vendorHubs() {
  const vmap = new Map();
  for (const p of products) {
    const k = p.vendorName;
    if (!vmap.has(k)) vmap.set(k, []);
    vmap.get(k).push(p);
  }
  // Top100 厂商与 HUB_SLUGS 同源(TOP_VENDORS,模块级选定)——并列边界取舍永久一致
  const vendors = [...TOP_VENDORS.entries()]
    .map(([k]) => ({ name: k, items: (vmap.get(k) || []).sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)) }));
  const dir = outPath("vendors");
  fs.mkdirSync(dir, { recursive: true });
  for (const v of vendors) {
    const vslug = slug(v.name);
    const n = v.items.length;
    const totalEps = v.items.reduce((a, p) => a + (p.earningsPerSale || 0), 0);
    const earliest = datemark(v.items.map((x) => x.createdAt).sort()[0]);
    const rows = v.items.map((p) => `<tr><td><a href="../reviews/${p.slug}.html">${esc(p.label)}</a></td><td>${esc(p.type)}</td><td>${money(p.price, p.currency)}</td><td>${pct(p.commission)}</td><td><b>${money(p.earningsPerSale, p.currency)}</b></td><td>${pct(p.cancelRate)}</td><td>${datemark(p.createdAt)}</td></tr>`).join("\n");
    const topCat = (v.items[0].categories || [])[0];
    const catObj = topCat ? DATA.categories.find((c) => c.label === topCat) : null;
    const body = `<h1>${esc(v.name)} — ${n} products on Digistore24</h1>
<p class="sub">Vendor hub · Marketplace data ${datemark(DATA.scrapedAt)} · Active since ${earliest}</p>
<div class="tldr"><b>At a glance:</b> <ul><li><b>${n} listings</b> under this vendor, combined earnings/sale across listings: <b>${money(totalEps, v.items[0].currency)}</b> (sum, vendor-reported).</li><li>Top listing: <a href="../reviews/${v.items[0].slug}.html">${esc(v.items[0].label)}</a>.</li><li>All figures are vendor-side marketplace statistics — a large catalog is not a quality guarantee.</li></ul></div>
<h2>All products by ${esc(v.name)}</h2>
<table class="specs"><tr><th>Product</th><th>Type</th><th>Price</th><th>Commission</th><th>Earn./sale</th><th>Cancel*</th><th>Listed</th></tr>
${rows}
</table>
<p class="sub">* Vendor-side marketplace statistics reported by Digistore24; they depend on traffic quality and are not a forecast. Verify prices and guarantees on official pages.</p>
<h2>Where to go next</h2>
${catObj ? `<p>Primary category: <a href="../category/${catObj.file}.html">${esc(catObj.label)}</a> (${catObj.count} products) · Method: <a href="../blog/digistore24-numbers-checklist.html">6-point check</a>.</p>` : ""}
<p><a href="index.html">← Vendor directory</a> — all top vendors with their full listings.</p>`;
    const jsonLd = [{
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${v.name} — all products on Digistore24`,
      itemListElement: v.items.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/reviews/${x.slug}.html`, name: x.label })),
    }];
    fs.writeFileSync(path.join(dir, vslug + ".html"), layout({ title: `${v.name} — ${n} products, prices & marketplace data`, desc: `All ${n} Digistore24 products by vendor ${v.name}: prices, commissions, conversion and cancel rates. Official marketplace data, updated ${datemark(DATA.scrapedAt)}.`, body, rel: "..", path: `vendors/${vslug}.html`, jsonLd, crumb: [{ label: "Home", href: "../index.html" }, { label: v.name, href: `../vendors/${vslug}.html` }] }));
  }
  // hub 页是生成物:清理不在当前集合里的过期 hub(厂商改名/掉出 Top100)
  const wantedHubs = new Set(vendors.map((v) => slug(v.name) + ".html"));
  let prunedHubs = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".html") && f !== "index.html" && !wantedHubs.has(f)) { fs.unlinkSync(path.join(dir, f)); prunedHubs++; }
  }
  const list = vendors.map((v) => `<li><a href="${slug(v.name)}.html">${esc(v.name)}</a> — ${v.items.length} products</li>`).join("");
  const idxBody = `<h1>Vendors on Digistore24 (top ${vendors.length} by catalog size)</h1><p class="sub">Vendor hubs with all their listings and marketplace data. Updated ${datemark(DATA.scrapedAt)}.</p><ul style="line-height:2">${list}</ul>`;
  fs.writeFileSync(path.join(dir, "index.html"), layout({ title: `Vendor directory — ${SITE_NAME}`, desc: `Top Digistore24 vendors with their products and official marketplace statistics.`, body: idxBody, rel: "..", path: "vendors/index.html" }));
  console.log("vendor hubs:", vendors.length + (prunedHubs ? ", " + prunedHubs + " stale pruned" : ""));
}

function trustPages() {
  // 信任枢纽页:站级买家信息(退款/安全/核查清单)。事实仅来自官方页面+本站研究扫描,逐项标注来源与日期。
  const disclaimer = `<p class="sub"><b>Affiliate disclosure:</b> ${SITE_NAME} contains affiliate links; if you buy through them we may earn a commission from the vendor at no extra cost to you. ${SITE_NAME} is an independent directory — not Digistore24, and not affiliated with Digistore24 beyond the affiliate program.</p>`;

  const refundsBody = `
<h1>How Digistore24 refunds work</h1>
<p class="sub">Who is responsible for refunds, how the process works, and how to check a product's guarantee <em>before</em> you pay.</p>
<div class="tldr"><b>Key points</b>
<ul>
<li>Digistore24 sells products <b>as a reseller in its own name</b> and handles customer support, complaint management and return management — so refund requests route through Digistore24, not the individual vendor (official vendor statement, retrieved 2026-10-10).</li>
<li>Guarantee length is set <b>per offer</b>, not site-wide. In our research scan of 1,265 sales pages, 1,230 (97%) mention a guarantee or refund policy; where a day count is stated, <b>60 days is the most common</b> (165 offers, then 30/90/7 days).</li>
<li>Official refund channels: the link in your order confirmation email, or the Digistore24 help center.</li>
<li>We are an independent affiliate directory — we don't process payments or refunds.</li>
</ul></div>
<h2>Who handles your money — and your refund</h2>
<p>According to Digistore24's official vendor information, the platform sells products "as a reseller in its own name" and takes care of accounting, invoicing, tax management, customer support, complaint handling and return management. For buyers this means the payment contract sits with Digistore24, and refunds are processed through Digistore24 rather than through each individual vendor.</p>
<p>Digistore24's official buyer information describes two ways to submit a refund request: through the link in your <b>order confirmation email</b> ("Do you have an urgent question about the product…"), or through the Digistore24 help center at <a href="https://help.digistore24.com" rel="noopener">help.digistore24.com</a>. Have your order details ready (email address, invoice or transaction ID).</p>
<h2>How long is the guarantee? It depends on the offer</h2>
<p>There is no site-wide guarantee period — <b>each vendor sets the refund terms for their own offer</b>. To give a realistic picture, we scanned the sales pages of <b>1,265 Digistore24 offers</b> in our research database (retrieved 2026-10-10):</p>
<table class="specs">
<tr><th>What the vendor sales pages show</th><th>Offers</th></tr>
<tr><td>Mention a guarantee, money-back or refund policy</td><td>1,230 of 1,265 (97%)</td></tr>
<tr><td>State an explicit day count</td><td>300 (24%)</td></tr>
</table>
<p>Where a day count is stated, the most common periods:</p>
<table class="specs">
<tr><th>Stated guarantee period (vendor claims)</th><th>Offers</th></tr>
<tr><td>60 days</td><td>165</td></tr>
<tr><td>30 days</td><td>53</td></tr>
<tr><td>90 days</td><td>21</td></tr>
<tr><td>7 days</td><td>16</td></tr>
<tr><td>Other (14, 21, 180, 365 days…)</td><td>45</td></tr>
</table>
<p class="sub"><b>Vendor claims, not verified by us.</b> Extracted from the vendors' own sales pages as retrieved on 2026-10-10; terms can change without notice. Always confirm the guarantee on the checkout page — that version counts.</p>
<h2>Check the guarantee before you buy (2 minutes)</h2>
<ol>
<li>Open the product profile on this site — every profile links the official sales page and shows the <b>billing type</b> (single payment, installment or subscription).</li>
<li>Read the guarantee wording on the vendor's sales page.</li>
<li>At checkout, confirm the same guarantee is shown.</li>
<li>For subscriptions, check how to cancel <em>recurring billing</em> separately from the money-back period.</li>
<li>Screenshot the checkout terms before paying.</li>
</ol>
<h2>If something goes wrong</h2>
<p>Submit the refund request through Digistore24's official channels (order confirmation email link or the help center). If a refund is refused contrary to the stated guarantee, your checkout screenshots are your documentation — escalate through Digistore24 support, which manages returns and complaints as the reseller of record.</p>
<p>Our part: every profile is labeled with its research method, and when a vendor's sales page is unreachable we say so instead of hiding it. See also <a href="is-digistore24-safe.html">what we can and cannot verify about the platform</a> and the <a href="buy-with-confidence.html">before-you-buy checklist</a>.</p>
<h2>Sources &amp; method</h2>
<ul>
<li>Digistore24 official homepage (digistore24.com/en) — reseller model, support and return-management statement; retrieved 2026-10-10.</li>
<li>Digistore24 official buyer information — refund request channels (order confirmation email link / help center); retrieved 2026-10-10.</li>
<li>${SITE_NAME} sales-page research scan — 1,265 researched offers, guarantee wording extracted verbatim; retrieved 2026-10-10. Vendor claims, not verified by us.</li>
</ul>
${disclaimer}`;
  fs.writeFileSync(outPath("digistore24-refunds.html"), layout({
    title: "Digistore24 refunds: how the process works, and how to check first",
    desc: `Who handles Digistore24 refunds, how to request one, and what our scan of 1,265 vendor sales pages shows about guarantee periods (60 days is most common). Updated ${datemark(DATA.scrapedAt)}.`,
    body: refundsBody, path: "digistore24-refunds.html", hreflangLinks: HREF_HOME,
  }));

  const safeBody = `
<h1>Is Digistore24 legit and safe? What we can and cannot verify</h1>
<p class="sub">An independent look at the platform itself — who is behind it, what it does, and what that means for buyers.</p>
<div class="tldr"><b>Key points</b>
<ul>
<li>Digistore24 is a German-founded platform that sells digital products <b>as a reseller in its own name</b> — accounting, invoicing, tax, customer support, complaints and returns are handled by the platform (official statement, retrieved 2026-10-10).</li>
<li>The platform publishes live support statistics on its own homepage (87% customer satisfaction and 22,701 solved tickets in the last 30 days as displayed 2026-10-10 — vendor-published figures).</li>
<li>Platform ≠ product quality: any vendor can list an offer. Judge each product on its own numbers — that is what this directory is for.</li>
</ul></div>
<h2>What Digistore24 is (official facts)</h2>
<ul>
<li><b>Reseller of record:</b> products are sold in Digistore24's own name; the platform handles accounting, invoicing, tax management, customer support, complaint handling and return management (official homepage, retrieved 2026-10-10).</li>
<li><b>Founder &amp; CEO:</b> Sven Platte (official homepage).</li>
<li><b>Infrastructure (vendor claims):</b> TÜV-certified IT infrastructure, a 30-person German in-house developer team, AWS hosting.</li>
<li><b>Payments (vendor claims):</b> credit card, invoice, PayPal, Klarna incl. pay-later; installments and subscriptions supported.</li>
<li><b>Scale (vendor-side claims):</b> €3 billion revenue through affiliates and vendors, 100+ million products sold, 10,000+ active affiliates, 8,000+ offers across 44+ niches.</li>
<li><b>Published support stats:</b> 87% customer satisfaction (last 30 days), 22,701 solved tickets (last 30 days), 100.0% platform uptime (last 90 days) — as displayed on the official homepage on 2026-10-10; vendor-published and changing over time.</li>
</ul>
<h2>What this means for you as a buyer</h2>
<p>Payments run through the platform as reseller, and refund requests route through Digistore24 (<a href="digistore24-refunds.html">see our refunds guide</a>). But the platform is a marketplace: <b>offer quality varies because each vendor decides what to sell and how</b>. A safe checkout does not make every offer good — that is why per-offer due diligence matters.</p>
<h2>What we verify per offer — and how</h2>
<ul>
<li><b>Official marketplace stats:</b> price, commission, cart conversion, cancel rate, earnings per sale — labeled as vendor-side marketplace data, never as forecasts.</li>
<li><b>Sales-page research:</b> verbatim extracts from the vendor's own page, marked "vendor claims, not verified by us"; 97% of researched offers carry guarantee language.</li>
<li><b>Sales-page reachability:</b> dead domains and expired certificates are reported as-is — that is information about an offer's current state, not a footnote to hide.</li>
<li><b>Method labeling:</b> every page states "data profile" or "hands-on review".</li>
<li><b>No paid placement:</b> we do not accept payment for listing position or ratings. We earn affiliate commissions when you buy through links — at no extra cost to you.</li>
</ul>
<h2>Red flags we publish instead of hiding</h2>
<p>Unreachable or JS-only sales pages, missing published performance stats, high cancel-rate outliers — each product profile shows what the marketplace and the vendor's page actually say, including the gaps. Use the <a href="buy-with-confidence.html">before-you-buy checklist</a> as your routine.</p>
<h2>Sources &amp; method</h2>
<ul>
<li>Digistore24 official homepage (digistore24.com/en) — company, reseller model, support statistics; retrieved 2026-10-10.</li>
<li>${SITE_NAME} marketplace snapshot of ${DATA.total} offers and sales-page research (${DATA.withResearch} researched); retrieved 2026-10-10.</li>
</ul>
${disclaimer}`;
  fs.writeFileSync(outPath("is-digistore24-safe.html"), layout({
    title: "Is Digistore24 legit and safe? What we can and cannot verify",
    desc: `Independent assessment of Digistore24: reseller model, company facts, published support stats — and what buyers should still verify per offer. Updated ${datemark(DATA.scrapedAt)}.`,
    body: safeBody, path: "is-digistore24-safe.html", hreflangLinks: HREF_HOME,
  }));

  const checklistBody = `
<h1>Before you buy on Digistore24: a 5-minute checklist</h1>
<p class="sub">Six checks that take five minutes and prevent most purchase regrets. Works for any offer on the platform.</p>
<div class="tldr"><b>The checklist</b>
<ol>
<li><b>Read the vendor's own sales page</b> — every profile on this site links it. If a page is unreachable, our profile says so.</li>
<li><b>Confirm the guarantee at checkout</b> — 97% of researched offers mention a guarantee; where a day count is stated, 60 days is most common (vendor claims). The checkout page is the version that counts.</li>
<li><b>Know your billing type</b> — single payment, installment or subscription is shown on every profile. Subscriptions need a separate cancellation from the money-back period.</li>
<li><b>Note the vendor and support channels</b> — profiles list the vendor name; refunds route through Digistore24 (see the refunds guide).</li>
<li><b>Screenshot the checkout terms</b> before paying — that is your documentation.</li>
<li><b>Use the platform's official refund path</b> if anything goes wrong — order confirmation email link or the Digistore24 help center.</li>
</ol></div>
<h2>How to read our product profiles</h2>
<p>Every profile shows the official marketplace numbers (price, commission, cart conversion, cancel rate, earnings per sale — vendor-side data, not forecasts), verbatim extracts from the vendor's sales page marked "vendor claims, not verified by us", and a research-method label: <b>data profile</b> (facts from the listing and the public sales page) or <b>hands-on review</b> (we bought and used it). When a sales page is unreachable, the profile says so — that is part of the picture, not a flaw to hide.</p>
<h2>Three numbers worth a second look</h2>
<ul>
<li><b>Cancel rate</b> — how often buyers cancel or refund, as reported by the marketplace for that offer. High values deserve extra skepticism about the sales page's promises.</li>
<li><b>Cart conversion</b> — depends on the vendor's traffic quality; treat it as funnel performance, not a promise about your experience.</li>
<li><b>Billing types</b> — a "single payment" offer behaves very differently from a subscription after the refund window.</li>
</ul>
<h2>Sources &amp; method</h2>
<ul>
<li>Official marketplace data: Digistore24 marketplace, retrieved ${datemark(DATA.scrapedAt)}.</li>
<li>Guarantee-period scan: ${DATA.withResearch} researched sales pages, retrieved 2026-10-10 — vendor claims, not verified by us.</li>
<li>Refund channels: Digistore24 official buyer information, retrieved 2026-10-10.</li>
</ul>
${disclaimer}`;
  fs.writeFileSync(outPath("buy-with-confidence.html"), layout({
    title: "Before you buy on Digistore24: a 5-minute buyer's checklist",
    desc: `Six checks before you pay on Digistore24: guarantee at checkout, billing type, vendor and support channels — with data from ${DATA.withResearch} researched sales pages.`,
    body: checklistBody, path: "buy-with-confidence.html", hreflangLinks: HREF_HOME,
  }));
  console.log("trust pages: 3");
}

function changelogPage() {
  const f = path.join(ROOT, "build", "changelog.json");
  if (!fs.existsSync(f)) return;
  const entries = JSON.parse(fs.readFileSync(f, "utf8")).entries || [];
  const body = `<h1>What's new on ${SITE_NAME}</h1>
<p class="sub">Every improvement, logged daily. Marketplace data refreshes automatically each morning; the numbers across the site update with it.</p>
${entries.map((e) => `<h2>${datemark(e.date)}</h2>
<p>${esc(e.summary)}</p>
<ul>${(e.changes || []).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`).join("\n")}`;
  fs.writeFileSync(outPath("changelog.html"), layout({ title: `What's new — ${SITE_NAME}`, desc: `Daily changelog of ${SITE_NAME}: data refreshes, new reviews and improvements — ${DATA.total} Digistore24 products tracked.`, body, path: "changelog.html", hreflangLinks: HREF_HOME }));
}

// ---------- 深度顾问页(改进项 deepdive-pilot-en:收益 Top10 → reviews/{slug}/guide.html,1500+ 词) ----------
// 内容全部来自官方市场数据与销售页原文摘录(标注 vendor claims),不做任何虚构体验
function deepDiveGuides(altSlugs) {
  const rel = "../..";
  const median = (arr) => { const a = [...arr].filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
  const catStats = new Map();
  for (const p of products) {
    const k = String((p.categoryIds || [])[0] || "");
    if (!k) continue;
    if (!catStats.has(k)) catStats.set(k, { prices: [], cancels: [], convs: [] });
    const s = catStats.get(k);
    s.prices.push(p.price); s.cancels.push(p.cancelRate); s.convs.push(p.conversionRate);
  }
  const wordCount = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").split(/\s+/).filter(Boolean).length;
  const dir = outPath("reviews");
  let built = 0;
  const wcLog = [];
  for (const p of GUIDE_POOL) {
    const r = p.research || {};
    const d = productDetails(p.id) || {};
    const catObj = DATA.categories.find((c) => String(c.catId) === String((p.categoryIds || [])[0]));
    const st = catStats.get(String((p.categoryIds || [])[0]) || "");
    const medPrice = st ? median(st.prices) : null;
    const medCancel = st ? median(st.cancels) : null;
    const medConv = st ? median(st.convs) : null;
    const priceVs = medPrice ? (p.price >= medPrice ? "above" : "below") : "n/a";
    const cancelVs = medCancel != null && p.cancelRate != null ? (p.cancelRate > medCancel ? "above" : "at or below") : "n/a";
    const convVs = medConv != null && p.conversionRate != null ? (p.conversionRate > medConv ? "above" : "at or below") : "n/a";
    const related = products.filter((x) => x.id !== p.id && (x.categoryIds || []).includes(String((p.categoryIds || [])[0]))).slice(0, 4);
    const hasAlt = altSlugs && altSlugs.has(p.slug);
    const vendorHub = HUB_SLUGS.has(slug(p.vendorName)) ? `<li><a href="${rel}/vendors/${slug(p.vendorName)}.html">${esc(p.vendorName)} vendor hub</a> — all listings by this vendor with marketplace data.</li>` : "";

    const body = `
<h1>${esc(p.label)}: the complete buying guide</h1>
<p class="sub">Deep-dive guide · Marketplace data ${datemark(DATA.scrapedAt)} · Sales-page research ${datemark(DATA.researchedAt) || "—"} · ${esc(catObj ? catObj.label : "Uncategorized")}</p>

<div class="notice"><b>How this guide was researched:</b> every figure below comes from the official Digistore24 marketplace record or from verbatim extracts of the vendor's public sales page (labeled <i>vendor claims</i>). This is a data profile, not a hands-on review — we have not purchased ${esc(p.label)}, and we say so everywhere it matters.</div>

<div class="tldr"><b>At a glance:</b> <ul>
<li><b>Price:</b> ${money(p.price, p.currency)} (${esc((p.billingTypes || []).join(", ")) || "billing per sales page"}).</li>
<li><b>Refund signal:</b> cancel rate ${pct(p.cancelRate)} — ${cancelVs} the category median.</li>
<li><b>Buyer flow:</b> cart conversion ${pct(p.conversionRate)} (${convVs} category median).</li>
<li><b>Guarantee:</b> ${r.guaranteeMention ? esc(r.guaranteeMention) + " advertised on the sales page — verify on the official page at checkout." : "no standardized guarantee wording detected — ask before buying."}</li>
</ul></div>

<h2 id="verdict">Quick verdict from the marketplace record</h2>
<p>On the official Digistore24 marketplace, ${esc(p.label)} lists at ${money(p.price, p.currency)}, which is ${priceVs} the ${esc(catObj ? catObj.label : "category")} median${medPrice != null ? " of " + money(medPrice, p.currency) : ""}. Its cancel rate of ${pct(p.cancelRate)} is ${cancelVs} the category median${medCancel != null ? " of " + pct(medCancel) : ""} — in plain terms, that share of customers who complete checkout later reverses or refunds their purchase. Cart conversion sits ${convVs} the category median${medConv != null ? " of " + pct(medConv) : ""}, meaning the share of people who reach the order form and actually buy.</p>
<p>None of these numbers tells you whether the product works for you — no marketplace statistic can. What they do tell you is how this offer behaves commercially: how it is priced relative to its category, how often buyers change their minds, and how persuasive the vendor's funnel is. This guide walks through each number, then through everything the vendor's own sales page says, so you can decide with the full record in front of you.</p>

<h2 id="numbers">Every marketplace number, interpreted</h2>
<table class="specs">
<tr><th>Metric</th><th>This offer</th><th>Category median</th><th>What it measures</th></tr>
<tr><td>Price</td><td><b>${money(p.price, p.currency)}</b></td><td>${money(medPrice, p.currency)}</td><td>Vendor-set list price at checkout</td></tr>
<tr><td>Cart conversion</td><td><b>${pct(p.conversionRate)}</b></td><td>${pct(medConv)}</td><td>Share of order-form visitors who buy</td></tr>
<tr><td>Cancel rate</td><td><b>${pct(p.cancelRate)}</b></td><td>${pct(medCancel)}</td><td>Share of purchases refunded or canceled</td></tr>
<tr><td>Commission</td><td><b>${pct(p.commission)}</b></td><td>—</td><td>Affiliate share per sale (does not change your price)</td></tr>
<tr><td>Earnings/sale</td><td><b>${money(p.earningsPerSale, p.currency)}</b></td><td>—</td><td>Average affiliate payout per completed sale</td></tr>
</table>
<p><b>Price.</b> The list price is set by the vendor inside Digistore24 and is what you pay at checkout, before any funnel upsells. At ${money(p.price, p.currency)} — ${priceVs} the category median — this is priced as a ${p.price >= 100 ? "high-ticket" : p.price >= 30 ? "mid-ticket" : "low-ticket"} offer. High-ticket listings tend to invest heavily in sales-page persuasion; that is not a flaw by itself, but it is a reason to read the refund terms before, not after, buying.</p>
<p><b>Cart conversion.</b> ${pct(p.conversionRate)} of people who reach the order form complete a purchase. Conversion measures funnel persuasion at the checkout step — it says nothing about satisfaction after the purchase. A high conversion with a high cancel rate is the classic signature of an aggressive funnel: easy to say yes to, easy to regret.</p>
<p><b>Cancel rate.</b> ${pct(p.cancelRate)} of completed purchases end in cancellation or refund, ${cancelVs} the category median. Digistore24 reports this per product across the vendor's entire traffic. For a subscription, check whether the cancel figure includes failed renewals; the practical protection is the refund window in the next section.</p>
<p><b>Commission and earnings per sale.</b> These two rows matter to affiliates, not buyers: affiliates earn ${pct(p.commission)} commission, averaging ${money(p.earningsPerSale, p.currency)} per completed sale. As a buyer you pay the same price either way — but an affiliate-promoted offer pays its promoters well, which is exactly why you should judge it on the cancel rate and guarantee rather than on how many reviews recommend it.</p>

<h2 id="pricing">Price context: what you will actually pay</h2>
<p>The marketplace record lists ${money(p.price, p.currency)}${(p.billingTypes || []).length ? ` billed as ${esc((p.billingTypes || []).join(", "))}` : ""}. Digistore24 is the payment processor: the charge on your statement comes from Digistore24, and refund requests within the vendor's guarantee window are handled through Digistore24's buyer support.</p>
${r.priceMentions && r.priceMentions.length ? `<p>The vendor's own sales page mentions these price figures: ${r.priceMentions.map((x) => "<b>" + esc(x) + "</b>").join(", ")}. Sales pages often advertise discounts, installment plans or bundle prices that differ from the marketplace list price — the amount shown at the Digistore24 checkout is the binding one, so treat any discrepancy as a question to resolve before paying, not after.</p>` : `<p>We did not extract additional price figures from the sales page text, which is common when pricing is shown only in images or inside the checkout funnel. The marketplace list price above is the vendor-set baseline; confirm the final amount at checkout.</p>`}

<h2 id="refund">Refund protection and cancel-rate risk</h2>
${r.guaranteeMention ? `<p>The sales page advertises: <b>"${esc(r.guaranteeMention)}"</b>. That wording is the vendor's own claim — the binding terms are those shown on the Digistore24 checkout page and in your order confirmation email. Screenshots of guarantee badges are not the policy; the checkout page is.</p>` : `<p>We could not extract a standardized money-back wording from the sales page text. That does not mean there is no guarantee — Digistore24 products generally carry some refund rights — but it means you should locate the exact window (14, 30, 60 days…) on the official page before buying, and keep your order confirmation.</p>`}
<p>Combined with the cancel rate of ${pct(p.cancelRate)}, the practical guidance: buy with the expectation that you will evaluate the product quickly and decisively inside the refund window. If a vendor's funnel creates urgency ("price rises at midnight"), the refund window is your real deadline, not the sales page's.</p>
<p>For the mechanics of requesting money back, see <a href="${rel}/digistore24-refunds.html">how Digistore24 refunds work</a>, and for general platform trust questions, <a href="${rel}/is-digistore24-safe.html">is Digistore24 safe?</a> — both are based on official Digistore24 documentation, not anecdotes.</p>

<h2 id="salespage">What the vendor's sales page emphasizes</h2>
${r.metaDescription ? `<p>The page's own meta description reads: <i>"${esc(r.metaDescription)}"</i>${r.ogTitle && r.ogTitle !== r.title ? `, under the share title "${esc(r.ogTitle)}"` : ""}.</p>` : r.title ? `<p>The page's title is: <i>"${esc(r.title)}"</i>.</p>` : ""}
${r.h2 && r.h2.length ? `<p>Its section structure — the headings the vendor chose for the persuasion flow — is:</p><ul>${r.h2.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
${r.ctaTexts && r.ctaTexts.length ? `<p>The call-to-action buttons on the page say: ${r.ctaTexts.map((x) => "<b>" + esc(x) + "</b>").join(" · ")}. Button wording tells you what conversion psychology the funnel leans on — urgency, exclusivity or straightforward ordering.</p>` : ""}
<p class="sub">Headings and button labels above are quoted from the vendor's sales page (${datemark(DATA.researchedAt)}); sales pages change often, so treat this as a snapshot, not a live copy.</p>

${r.excerpt && r.excerpt.length ? `<h2 id="claims">In the vendor's own words</h2>
<p>These passages are reproduced verbatim from the vendor's sales page. They are <b>vendor claims, not verified by ${SITE_NAME}</b> — no marketplace statistic or third-party source on this site confirms them:</p>
${r.excerpt.map((x) => `<blockquote><p>${esc(x)}</p></blockquote>`).join("\n")}
<p class="sub">Verbatim extracts, punctuation and emphasis as published by the vendor.</p>` : ""}

${d.usage && d.usage.length ? `<h2 id="usage">Usage instructions stated by the vendor</h2>
<p>The sales page contains these usage/instruction passages (vendor claims, quoted verbatim):</p>
<ul>${d.usage.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
${d.caution && d.caution.length ? `<h2 id="caution">Cautions stated by the vendor</h2>
<ul>${d.caution.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}

<h2 id="fit">Who ${esc(p.label)} fits — and who should skip it</h2>
<p><b>Likely fit:</b> ${p.price >= 100 ? `buyers already committed to this outcome who have budgeted ${money(p.price, p.currency)} and will genuinely use the program inside the refund window — at this price, an unused purchase is an expensive souvenir` : p.price >= 30 ? `buyers testing this category with a mid-range budget, where ${money(p.price, p.currency)} is a meaningful but not overwhelming commitment` : `buyers who want a low-cost entry into this category — at ${money(p.price, p.currency)}, the financial risk is mostly your time`}. The vendor reports ${pct(p.conversionRate)} of checkout visitors complete the purchase, so the funnel clearly converts its target audience${r.quality === "rich" ? "; the sales page itself is content-rich, which makes pre-purchase verification easier" : "; the sales page is on the thinner side, which makes pre-purchase verification more important"}.</p>
<p><b>Think twice if:</b> you are buying because a promotion created urgency rather than because you identified the need yourself; you are unwilling to test the product immediately and request a refund inside the window if it underdelivers; or the cancel rate of ${pct(p.cancelRate)} suggests refund friction you are not prepared to handle${p.cancelRate && p.cancelRate > 10 ? " — this offer's cancel rate is high enough that a meaningful share of buyers changed their minds" : ""}. No marketplace number can tell you whether the product works — that is exactly why the refund window, not the sales page, should anchor your decision.</p>

<h2 id="checklist">Before you buy: the verification checklist</h2>
<ol>
<li><b>Match the price</b> at the Digistore24 checkout against the figures in this guide — discrepancies mean the funnel changed, not that we did.</li>
<li><b>Locate the refund window</b> on the checkout page itself and note the deadline in your calendar on purchase day.</li>
<li><b>Read the cancel rate</b> (${pct(p.cancelRate)} here) as "how often do buyers regret this", alongside the guarantee terms.</li>
<li><b>Distinguish claims from evidence</b>: everything quoted under "vendor claims" above is the vendor speaking, verified by nobody.</li>
<li><b>Check the vendor</b>: ${vendorHub ? `the ${esc(p.vendorName)} vendor hub lists everything this seller currently markets` : `search the vendor name "${esc(p.vendorName)}" in our directory to see their other listings`} — a vendor's catalog breadth is context, not quality.</li>
<li><b>Pay through Digistore24</b>, never by direct transfer — the platform's buyer protection only covers transactions it processes.</li>
</ol>
<p class="sub">The full method: <a href="${rel}/blog/digistore24-numbers-checklist.html">our 6-point numbers check</a> · platform background in <a href="${rel}/buy-with-confidence.html">before you buy: checklist</a>.</p>

<h2 id="alternatives">Alternatives and comparisons</h2>
${hasAlt ? `<p>We maintain a side-by-side comparison of ${esc(p.label)} against its closest same-category alternatives: <a href="${rel}/alternatives/${p.slug}.html">${esc(p.label)} — alternatives and head-to-head numbers</a>.</p>` : ""}
${related.length ? `<p>Other offers in ${esc(catObj ? catObj.label : "this category")} worth comparing before you decide:</p>
<div class="grid">${related.map((x) => productCard(x, rel)).join("\n")}</div>` : ""}
${vendorHub ? `<ul>${vendorHub}</ul>` : ""}

<h2 id="method">How this guide was compiled</h2>
<p>Two independent sources, both public: (1) the official Digistore24 marketplace record for product #${p.id} — price, commission, cart conversion, cancel rate and earnings per sale are vendor-side statistics as reported to registered affiliates, snapshot ${datemark(DATA.scrapedAt)}; (2) the vendor's public sales page, fetched and archived on ${datemark(DATA.researchedAt)}, from which headings, price mentions, guarantee wording, call-to-action labels and verbatim passages were extracted and are quoted with attribution.</p>
<p>We did not buy or use ${esc(p.label)}. When we publish a hands-on review of this product, this page will say so at the top. Everything on ${SITE_NAME} follows the same labeling rules — see <a href="${rel}/about.html">our research standards</a> — and the whole directory refreshes daily; corrections and build history are public in the <a href="${rel}/changelog.html">changelog</a>.</p>
<p class="sub">Data snapshot ${datemark(DATA.scrapedAt)} · Prices and terms can change at any time — the official checkout page is always the binding source.</p>`;
    const wc = wordCount(body);
    wcLog.push(wc);
    const crumb = [{ label: "Home", href: rel + "/index.html" }, ...(catObj ? [{ label: catObj.label, href: rel + "/category/" + catObj.file + ".html" }] : []), { label: p.label, href: "../" + p.slug + ".html" }, { label: "Buying guide", href: "guide.html" }];
    const mdLinkHtml = `<p class="sub">Machine-readable research file: <a href="https://github.com/vsyour-cmd/digistore-picks/blob/main/content/products/${p.id}-${slug(p.label)}.md" rel="noopener">content/products/${p.id}-${slug(p.label)}.md (MD)</a></p>`;
    fs.mkdirSync(path.join(dir, p.slug), { recursive: true });
    fs.writeFileSync(path.join(dir, p.slug, "guide.html"), layout({
      title: `${p.label} buying guide: price, refund risk & fit`,
      desc: `Data-driven buying guide for ${p.label}: ${money(p.price, p.currency)}, cancel rate ${pct(p.cancelRate)}, guarantee "${r.guaranteeMention || "see sales page"}", who it fits. Updated ${datemark(DATA.scrapedAt)}.`,
      body: body + mdLinkHtml, rel, path: `reviews/${p.slug}/guide.html`,
      jsonLd: [{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: `${p.label} — buying guide`,
        description: `Marketplace-record and sales-page buying guide for ${p.label}: pricing, refund risk and fit, all sources labeled.`,
        datePublished: (DATA.scrapedAt || "").slice(0, 10) || undefined,
        dateModified: (DATA.scrapedAt || "").slice(0, 10) || undefined,
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        about: { "@type": "Product", name: p.label, productID: String(p.id), offers: { "@type": "Offer", price: p.price, priceCurrency: p.currency, url: SITE_URL + "/reviews/" + p.slug + ".html" } },
      }],
      crumb,
    }));
    built++;
  }
  wcLog.sort((a, b) => a - b);
  console.log(`deep-dive guides: ${built} pages (words: min ${wcLog[0]}, median ${wcLog[Math.floor(wcLog.length / 2)]})`);
  return built;
}

// ---------- 价格监控页(改进项 price-watch-page:history 快照 vs 当前 dataset 的变动) ----------
// 快照不足 7 天时仍发布:如实展示累计变动并标注 7 天视图何时可用,数据到齐后自动升级
function priceWatchPage() {
  const histDir = "G:/Digistore24/data/history";
  const suffix = "-en.json";
  const snaps = fs.existsSync(histDir) ? fs.readdirSync(histDir).filter((f) => f.endsWith(suffix)).map((f) => f.slice(0, 10)).sort() : [];
  if (!snaps.length || !snaps[0]) { console.log("price-watch: no history snapshots, skipped"); return; }
  const oldest = JSON.parse(fs.readFileSync(path.join(histDir, snaps[0] + suffix), "utf8"));
  const oldestMap = new Map((oldest.products || []).map((p) => [String(p.id), p]));
  const pctChg = (a, b) => (a ? Math.round(((b - a) / a) * 1000) / 10 : null);
  const priceUp = [], priceDown = [], statChanges = [], newListings = [], delisted = [];
  for (const p of products) {
    const o = oldestMap.get(String(p.id));
    if (!o) { newListings.push(p); continue; }
    const pc = o.price ? pctChg(o.price, p.price) : null;
    if (pc != null && Math.abs(p.price - o.price) >= 0.5 && Math.abs(pc) >= 1) (pc > 0 ? priceUp : priceDown).push({ p, o, pc });
    const dc = o.cancelRate != null && p.cancelRate != null ? p.cancelRate - o.cancelRate : null;
    const dv = o.conversionRate != null && p.conversionRate != null ? p.conversionRate - o.conversionRate : null;
    const de = o.earningsPerSale ? ((p.earningsPerSale - o.earningsPerSale) / o.earningsPerSale) * 100 : null;
    if ((dc != null && Math.abs(dc) >= 0.5) || (dv != null && Math.abs(dv) >= 0.5) || (de != null && Math.abs(de) >= 5)) statChanges.push({ p, o, dc, dv, de });
  }
  for (const [id, o] of oldestMap) if (!byId.has(id)) delisted.push(o);
  const byAbsPc = (a, b) => Math.abs(b.pc) - Math.abs(a.pc);
  priceUp.sort(byAbsPc); priceDown.sort(byAbsPc);
  statChanges.sort((a, b) => Math.abs(b.de || 0) - Math.abs(a.de || 0));
  newListings.sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0));
  const windowDays = Math.round((Date.now() - Date.parse(snaps[0])) / 86400000);
  const sevenDayFrom = new Date(Date.parse(snaps[0]) + 7 * 86400000).toISOString().slice(0, 10);
  const cap = (arr, n) => ({ rows: arr.slice(0, n), more: Math.max(arr.length - n, 0) });
  const pUp = cap(priceUp, 20), pDown = cap(priceDown, 20), st = cap(statChanges, 20), nl = cap(newListings, 20), dl = cap(delisted, 20);
  const row = (p, cells) => `<tr><td><a href="reviews/${p.slug}.html">${esc(p.label)}</a></td>${cells}</tr>`;
  const body = `
<h1>Price tracker: what changed on the Digistore24 marketplace</h1>
<p class="sub">Marketplace data ${datemark(DATA.scrapedAt)} · History window: ${snaps[0]} → ${snaps[snaps.length - 1]} (${windowDays} day${windowDays === 1 ? "" : "s"} of snapshots) · Comparing snapshot ${snaps[0]} against today's record</p>
<div class="tldr"><b>At a glance:</b> <ul>
<li><b>${DATA.total} products tracked</b>; since ${snaps[0]}: <b>${priceUp.length} price increases</b>, <b>${priceDown.length} price decreases</b>, <b>${statChanges.length} material stat changes</b> (cancel/conversion/earnings).</li>
<li><b>${newListings.length} new listings</b> appeared, <b>${delisted.length} offers</b> left the marketplace record.</li>
<li>All figures vendor-side marketplace statistics — changes reflect the vendors' own repricing, not our forecasts.</li>
</ul></div>
${windowDays < 7 ? `<div class="notice"><b>History is accumulating.</b> Daily snapshots started ${snaps[0]}; the rolling 7-day change view becomes meaningful from <b>${sevenDayFrom}</b>. Below are the cumulative changes since ${snaps[0]} — updated automatically with every daily rebuild.</div>` : ""}
${priceUp.length || priceDown.length ? `<h2 id="prices">Price changes since ${snaps[0]}</h2>
${priceUp.length ? `<h3>Raised (${priceUp.length})</h3>
<table class="specs"><tr><th>Product</th><th>Old</th><th>New</th><th>Change</th></tr>
${pUp.rows.map(({ p, o, pc }) => row(p, `<td>${money(o.price, p.currency)}</td><td><b>${money(p.price, p.currency)}</b></td><td>+${pc}%</td>`)).join("\n")}
</table>${pUp.more ? `<p class="sub">…and ${pUp.more} more increases.</p>` : ""}` : ""}
${priceDown.length ? `<h3>Lowered (${priceDown.length})</h3>
<table class="specs"><tr><th>Product</th><th>Old</th><th>New</th><th>Change</th></tr>
${pDown.rows.map(({ p, o, pc }) => row(p, `<td>${money(o.price, p.currency)}</td><td><b>${money(p.price, p.currency)}</b></td><td>${pc}%</td>`)).join("\n")}
</table>${pDown.more ? `<p class="sub">…and ${pDown.more} more decreases.</p>` : ""}` : ""}
<p class="sub">Prices are vendor-set; the checkout page is always the binding one. A price change can also mean a re-launch, changed bundle contents or a currency adjustment — check the product's profile history before reading anything into it.</p>` : `<h2 id="prices">Price changes since ${snaps[0]}</h2><p>No vendor changed a list price by ≥1% since ${snaps[0]}.</p>`}
${statChanges.length ? `<h2 id="stats">Material stat changes (cancel rate, conversion, earnings/sale)</h2>
<table class="specs"><tr><th>Product</th><th>Cancel</th><th>Cart conv.</th><th>Earn./sale</th></tr>
${st.rows.map(({ p, o, dc, dv, de }) => row(p, `<td>${o.cancelRate != null && dc != null ? pct(o.cancelRate) + " → " + pct(p.cancelRate) + " (" + (dc > 0 ? "+" : "") + dc.toFixed(1) + "pp)" : "—"}</td><td>${o.conversionRate != null && dv != null ? pct(o.conversionRate) + " → " + pct(p.conversionRate) : "—"}</td><td>${o.earningsPerSale ? money(o.earningsPerSale, p.currency) + " → <b>" + money(p.earningsPerSale, p.currency) + "</b> (" + (de > 0 ? "+" : "") + de.toFixed(1) + "%)" : "—"}</td>`)).join("\n")}
</table>${st.more ? `<p class="sub">…and ${st.more} more.</p>` : ""}
<p class="sub">Shown: changes ≥0.5pp (cancel/conversion) or ≥5% (earnings/sale). These statistics depend on the vendor's traffic quality — a moving number is not a trend, two points make no line.</p>` : ""}
${newListings.length ? `<h2 id="new">New listings since ${snaps[0]} (${newListings.length})</h2>
<table class="specs"><tr><th>Product</th><th>Price</th><th>Earn./sale</th><th>Listed</th></tr>
${nl.rows.map((p) => row(p, `<td>${money(p.price, p.currency)}</td><td>${money(p.earningsPerSale, p.currency)}</td><td>${datemark(p.createdAt)}</td>`)).join("\n")}
</table>${nl.more ? `<p class="sub">…and ${nl.more} more — see <a href="monthly-new.html">the monthly new-arrivals page</a>.</p>` : ""}` : ""}
${delisted.length ? `<h2 id="gone">No longer in the marketplace record (${delisted.length})</h2>
<p>Present in the ${snaps[0]} snapshot, absent today: ${dl.rows.map((o) => "<b>" + esc(o.label) + "</b>").join(" · ")}${dl.more ? ` …and ${dl.more} more.` : "."} Their profiles stay up with a notice until <a href="about.html">our staleness policy</a> prunes them; do not buy through stale pages.</p>` : ""}
<p class="sub">Method: <a href="blog/digistore24-numbers-checklist.html">6-point numbers check</a> · <a href="about.html">research standards</a>. Evidence &amp; verification conditions: full-dataset snapshots taken daily from the official Digistore24 marketplace API (files dated ${snaps.join(", ")}); changes computed mechanically between snapshots, no manual curation.</p>`;
  fs.writeFileSync(outPath("price-watch.html"), layout({
    title: "Price tracker: Digistore24 marketplace changes",
    desc: `What changed on the Digistore24 marketplace: price increases and decreases, cancel-rate and conversion moves, new and delisted offers since ${snaps[0]}. Vendor-side data, updated daily.`,
    body, path: "price-watch.html", hreflangLinks: HREF_HOME,
  }));
  console.log(`price-watch: ${priceUp.length} up / ${priceDown.length} down / ${statChanges.length} stat / ${newListings.length} new / ${delisted.length} gone (window ${snaps[0]} → now, ${windowDays}d)`);
}

// ---------- Amazon 精选页(编辑精选 + 分类搜索,tag 计佣) ----------
function amazonPicksPage() {
  const tag = (AMAZON_PICKS && AMAZON_PICKS.tag) || AMAZON_TAG;
  const picks = (AMAZON_PICKS && AMAZON_PICKS.storefront) || [];
  const catLinks = DATA.categories.filter((c) => c.count >= 10).map((c) => {
    const kw = amazonKwFor({ categories: [c.label] });
    return `<li><a href="https://www.amazon.com/s?k=${encodeURIComponent(kw)}&tag=${tag}" rel="nofollow sponsored noopener" target="_blank">${esc(kw)}</a> — live Amazon results, matched to our <a href="category/${c.file}.html">${esc(c.label)}</a> category (${c.count} offers).</li>`;
  }).join("\n");
  const body = `
<h1>Our Amazon picks</h1>
<p class="sub">Editor picks &amp; category shortcuts · Amazon.com · Associate tag <code>${esc(tag)}</code> · Updated ${datemark(DATA.scrapedAt)}</p>
<div class="tldr"><b>At a glance:</b> <ul>
<li>Hand-picked Amazon listings below, plus search shortcuts matched to the ${DATA.categories.length} categories in our directory.</li>
<li>As an Amazon Associate we earn from qualifying purchases — the price you pay is identical.</li>
<li>Digital products stay on Digistore24; this page covers physical goods and streaming that pair with them.</li>
</ul></div>
${picks.length ? `<h2>Editor picks</h2>
<ul style="line-height:1.9">${picks.map((c) => `<li><a href="${esc(c.url)}" rel="nofollow sponsored noopener" target="_blank">${esc(c.title)}</a>${c.note ? ` — ${esc(c.note)}` : ""}</li>`).join("\n")}</ul>
<p class="sub">Titles kept descriptive until verified against the live listing; Amazon sets its own prices, availability and commissions.</p>` : ""}
<h2>Category shortcuts</h2>
<p>Live Amazon searches, one per major category — Amazon ranks the results, we match the keywords:</p>
<ul style="line-height:1.9">${catLinks}</ul>
<p class="sub"><b>Sponsored:</b> as an Amazon Associate, ${SITE_NAME} earns from qualifying purchases. Amazon's commissions (typically low single digits) are far below Digistore24 vendors' 30–75% — we list Amazon for physical-goods convenience, not as a substitute for the digital products in our <a href="index.html">directory</a>. Method &amp; standards: <a href="about.html">about page</a>.</p>`;
  fs.writeFileSync(outPath("amazon-picks.html"), layout({
    title: "Our Amazon picks: gear & streaming for Digistore24 buyers",
    desc: `Editor-picked Amazon products and category search shortcuts that pair with the digital offers in our Digistore24 directory. Associate disclosure included. Updated ${datemark(DATA.scrapedAt)}.`,
    body, path: "amazon-picks.html", hreflangLinks: HREF_HOME,
  }));
  console.log(`amazon-picks: ${picks.length} storefront picks, ${DATA.categories.filter((c) => c.count >= 10).length} category shortcuts`);
}

// ---------- 买家导向长尾内容区(改进项:landing 优化) ----------
// 全部由产品真实数据/厂商原文支撑;不引入联盟侧统计,保持销售落地页语境
function longTailContent(p) {
  const r = (p.research && !p.research.error) ? p.research : null;
  const cat = DATA.categories.find((c) => String(c.catId) === String((p.categoryIds || [])[0]));
  const catLabel = cat ? esc(cat.label) : "digital products";
  const mdFile = p.id + "-" + slug(p.label || ("product-" + p.id)) + ".md";
  const billing = (p.billingTypes || []).join(", ").toLowerCase() || "see the sales page";
  const delivery = TYPE_USAGE_EN[p.type] ? esc(TYPE_USAGE_EN[p.type]).replace(/\.$/, "") : "delivery details arrive by email and in your Digistore24 customer account";
  const secs = [];
  secs.push(`<h2>What is ${esc(p.label)}?</h2>
<p>${esc(p.label)} is a ${esc(p.type.toLowerCase())} in the ${catLabel} category of the Digistore24 marketplace, published by vendor <b>${esc(p.vendorName)}</b> and on sale since <b>${datemark(p.createdAt)}</b>.${p.description ? " The vendor describes it as follows: &quot;<i>" + esc(p.description.slice(0, 260)) + "</i>&quot; (vendor's marketplace description, lightly truncated)." : ""}</p>`);
  secs.push(`<h2>${esc(p.label)} pricing: what you will pay</h2>
<p>The marketplace lists ${esc(p.label)} at <b>${money(p.price, p.currency)}</b> (${esc(billing)}). Digistore24 adds any tax your country requires at checkout, where you see the final amount before paying.${r && r.priceMentions && r.priceMentions.length ? " The sales page itself mentions: " + r.priceMentions.slice(0, 4).map((x) => "<b>" + esc(x) + "</b>").join(", ") + " (vendor claims — the checkout total is the binding one)." : ""} There is no separate marketplace-side fee; vendors may offer their own upsells after checkout.</p>`);
  secs.push(`<h2>${esc(p.label)} refund policy and money-back guarantee</h2>
<p>${r && r.guaranteeMention ? "The sales page advertises: <b>&quot;" + esc(r.guaranteeMention) + "&quot;</b> (vendor claim). " : "We did not find standardized guarantee wording on the sales page. "}Refunds for Digistore24 purchases are processed through the platform: request via the support link in your order email, within the vendor's guarantee window shown at checkout. Practical advice: decide inside the window — if the product underdelivers, refund it rather than letting it ride.</p>
<p>Details and mechanics: <a href="../digistore24-refunds.html">how Digistore24 refunds work</a>.</p>`);
  secs.push(`<h2>Who is ${esc(p.label)} for?</h2>
<p>Based on its ${catLabel} classification${(p.billingTypes || []).length ? " and " + esc(billing) + " pricing" : ""}, ${esc(p.label)} targets buyers looking for ${catLabel.toLowerCase()} solutions${p.price >= 100 ? " who have budgeted for a premium, high-ticket purchase" : p.price >= 30 ? " at a mid-range price point" : " at an entry-level price"}. The honest test is not the category but your own situation: will you realistically use it within the refund window? If yes, the price is an investment; if not, it is clutter — regardless of quality.</p>`);
  secs.push(`<h2>Is ${esc(p.label)} legit? What to verify before buying</h2>
<p>We do not rate legitimacy — nobody can, without using the product. What you can verify, all on this page: the vendor's marketplace history (listed since ${datemark(p.createdAt)}), the verbatim sales-page extracts below (labeled <i>vendor claims</i> — their marketing, not our endorsement), the guarantee terms at checkout, and the delivery method. Red flags to check on any offer: pressure countdowns paired with vague refund terms, testimonials without dates, and vendor sites that hide pricing until checkout.</p>`);
  secs.push(`<h2>How do you access ${esc(p.label)} after buying?</h2>
<p>Checkout runs on Digistore24. After payment: ${delivery}. Keep your order email — it is your key to the ${esc(p.type.toLowerCase())}, your refund requests and Digistore24 buyer support.</p>`);
  secs.push(`<h2>${esc(p.label)} reviews: how to research it properly</h2>
<p>Third-party "reviews" of marketplace products are mostly affiliate content — including pages like this one, which earns a commission on purchases. Treat every review (ours included) as a starting point, then verify against primary sources: the vendor's own sales page, the Digistore24 refund policy, and — for ${catLabel.toLowerCase()} — independent communities outside the affiliate ecosystem. On this page the sales-page extracts below are quoted verbatim, so you can judge the vendor's claims without clicking away.</p>`);
  secs.push(`<h2>How to buy ${esc(p.label)} safely</h2>
<ol>
<li>Open the <a href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">official sales page</a> and read the full offer.</li>
<li>Confirm the final price and the refund window on the Digistore24 checkout page — that page is binding, not any review.</li>
<li>Pay inside the Digistore24 checkout (never by bank transfer or off-platform links).</li>
<li>Save the order confirmation email; note the refund deadline in your calendar.</li>
<li>Evaluate promptly. Digistore24 buyer support can help if the vendor is unresponsive.</li>
</ol>`);
  secs.push(`<p class="sub">Full research archive for this product (Markdown: complete marketplace record + verbatim sales-page extracts): <a href="../content/products/${mdFile}">${esc(p.label)} — data archive (.md)</a>.</p>`);
  return secs.join("\n");
}


const altSlugs = computeAltSlugs();
homePage();
categoryPages();
profilePages(altSlugs);
const altCount = alternativesPages(altSlugs);
const bestCount = bestOfPages();
aboutPage();
trustPages();
monthlyNewPage();
priceWatchPage();
faqHubPages();
amazonPicksPage();
changelogPage();
vendorHubs();
const guideCount = deepDiveGuides(altSlugs);
notFoundPage();
console.log(`Built: index, about, 404, categories (paginated), ${products.length} product profiles, ${altCount} alternatives pages, ${bestCount} best-of pages, ${guideCount} deep-dive guides. Articles protected: ${articleIds.size}`);
