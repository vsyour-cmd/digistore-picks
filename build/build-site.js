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
  <div>© ${new Date().getFullYear()} ${SITE_NAME} · Product data: Digistore24 marketplace (updated ${datemark(DATA.scrapedAt)}) · <a href="${rel}/about.html">About, disclosure &amp; contact</a> · <a href="https://vsyour-cmd.github.io/digistore-picks-de/" hreflang="de">Deutsche Website</a> · <a href="${rel}/changelog.html">What's new</a></div>
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
    <span>${esc(p.type)}</span>
    <span>Price <b>${money(p.price, p.currency)}</b></span>
    <span>Commission <b>${pct(p.commission)}</b></span>
  </div>
  <div class="meta">
    <span>Earnings/sale <b>${money(p.earningsPerSale, p.currency)}</b>*</span>
    <span>Cart conv. <b>${pct(p.conversionRate)}</b>*</span>
    <span>Vendor <b>${esc(p.vendorName)}</b></span>
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

{
  const cnt = {};
  for (const c of DATA.categories) { const b = slug(c.label); cnt[b] = (cnt[b] || 0) + 1; }
  for (const c of DATA.categories) { const b = slug(c.label); c.file = cnt[b] > 1 ? slug(c.section) + "-" + b : b; }
}

// ---------- TL;DR 摘要(GEO 可引用) ----------
function tldr(p) {
  const g = p.research && p.research.guaranteeMention ? ` The sales page advertises a "${esc(p.research.guaranteeMention)}" policy.` : "";
  const dead = p.research && p.research.error ? ` Its sales page is currently unreachable (${esc(p.research.error.slice(0, 60))}).` : "";
  const cats = p.categories.length ? ` in ${p.categories.slice(0, 2).map(esc).join(" and ")}` : "";
  return `<div class="tldr">
<b>At a glance</b> (marketplace data as of ${datemark(DATA.scrapedAt)}):
<ul>
<li>${esc(p.label)} is a ${esc(p.type.toLowerCase())}${cats} sold through the Digistore24 marketplace by vendor <b>${esc(p.vendorName)}</b>, listed since <b>${datemark(p.createdAt)}</b>.</li>
<li>List price <b>${money(p.price, p.currency)}</b>; Digistore24 reports a <b>${pct(p.commission)}</b> affiliate commission, <b>${pct(p.conversionRate)}</b> cart conversion and a <b>${pct(p.cancelRate)}</b> cancel rate for this offer.</li>
<li>Affiliate earnings per sale: <b>${money(p.earningsPerSale, p.currency)}</b> (vendor-side statistic, not a forecast).${g}${dead}</li>
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
      const tldrBlock = idx === 0 && isRealCat && items.length >= 8 ? `<div class="tldr"><b>At a glance</b> (marketplace data of ${datemark(DATA.scrapedAt)}): <ul><li><b>${items.length} offers</b> in ${esc(c.label)}, average price ${money(avg, "USD")}.</li><li>Commissions ${pct(minC)}–${pct(maxC)}; every figure below is vendor-reported marketplace data.</li><li>Picks by the numbers: <a href="../best-of/best-${c.file}.html">best ${esc(c.label)}</a> · method: <a href="../blog/digistore24-numbers-checklist.html">6-point check</a>.</li></ul></div>` : "";
      const methodLine = `<p class="sub">How we evaluate: <a href="../blog/digistore24-numbers-checklist.html">6-point numbers check</a> · <a href="../about.html">research standards</a>.</p>`;
      const evidenceLine = `<p class="sub">Evidence &amp; verification conditions: statistics from the official Digistore24 marketplace API (snapshot ${datemark(DATA.scrapedAt)}); always verify current prices on official pages.</p>`;
      const body = `
<h1>${esc(c.label)}</h1>
<p class="sub">${items.length} product${items.length === 1 ? "" : "s"} · Part of: ${esc(c.section)}${pageSub} · <a href="../index.html">all categories</a> · <a href="../reviews/index.html">all products A–Z</a></p>
${intro}
${bestOf}
<div class="grid">
${chunk.map((p) => productCard(p, "..")).join("\n")}
</div>
${pager(idx)}
${idx === 0 ? faqBlock : ""}
${tldrBlock}
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

${topCta}

${imgTag}

<h2 id="record">Marketplace record</h2>
<table class="specs">
<tr><th>Product type</th><td>${esc(p.type)}</td></tr>
<tr><th>Price</th><td>${money(p.price, p.currency)} (${esc((p.billingTypes || []).join(", ")) || "see sales page"})</td></tr>
<tr><th>Affiliate commission</th><td>${pct(p.commission)}</td></tr>
<tr><th>Refund window</th><td>Per the vendor's sales page — check the official page before buying</td></tr>
<tr><th>Vendor</th><td>${esc(p.vendorName)} (listed since ${datemark(p.createdAt)})</td></tr>
<tr><th>Marketplace stats*</th><td>Cart conversion ${pct(p.conversionRate)} · cancel rate ${pct(p.cancelRate)} · affiliate earnings/sale ${money(p.earningsPerSale, p.currency)}</td></tr>
</table>
<p class="sub">* Vendor-side marketplace statistics reported by Digistore24; they depend on traffic quality and are not a forecast.</p>
${p.description ? `<h2>Vendor's marketplace description</h2><p>${esc(p.description)}</p>` : ""}

${researchSection(p)}

${usageSection(p)}

${galleryBlock(p)}

${cautionSection(p)}

${evidenceBox(p)}

${buyerChecklist(p)}

${faqBlock}

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
<p>Every product links to a full profile with verbatim sales-page research. Always confirm price and guarantee on the official page before buying.</p>`;
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
<p class="sub">* Vendor-side marketplace statistics; they depend on traffic quality and are not a forecast of your results. Verify current prices and guarantees on each official sales page.</p>`;
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
<li><b>Public Digistore24 product page:</b> <a href="https://www.digistore24.com/product/${p.productId}" rel="nofollow noopener" target="_blank">digistore24.com/product/${p.productId}</a></li>
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
<li><b>Marketplace figures</b> (price, commission, conversion, cancel rate) — source: official Digistore24 marketplace API, affiliate view, snapshot <b>${datemark(DATA.scrapedAt)}</b>. Re-check: marketplace search for product ID ${p.productId}.</li>
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
    a: `We don't rate legitimacy — we publish verifiable data instead: vendor <b>${p.vendorName}</b> (listed on Digistore24 since ${datemark(p.createdAt)}), cart conversion ${pct(p.conversionRate)}, cancel rate ${pct(p.cancelRate)}, affiliate earnings/sale ${money(p.earningsPerSale, p.currency)} (all vendor-side marketplace statistics). Read our <a href="../blog/digistore24-numbers-checklist.html">6-point evaluation method</a> and judge with the numbers — or <a href="https://github.com/vsyour-cmd/digistore-picks/discussions?discussions_q=${q}" rel="noopener">join the discussion about ${esc(p.label)}</a>.`,
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
  const vendors = [...vmap.entries()]
    .filter(([, arr]) => arr.length >= 2)
    .map(([k, arr]) => ({ name: k, items: arr.sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)) }))
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, 100);
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

const altSlugs = computeAltSlugs();
homePage();
categoryPages();
profilePages(altSlugs);
const altCount = alternativesPages(altSlugs);
const bestCount = bestOfPages();
aboutPage();
trustPages();
monthlyNewPage();
changelogPage();
vendorHubs();
notFoundPage();
console.log(`Built: index, about, 404, categories (paginated), ${products.length} product profiles, ${altCount} alternatives pages, ${bestCount} best-of pages. Articles protected: ${articleIds.size}`);
