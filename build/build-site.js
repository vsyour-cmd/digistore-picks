#!/usr/bin/env node
/**
 * build-site.js — 从 data/dataset.json 生成静态站点
 * 用法: node build/build-site.js [--profiles N]
 *   --profiles N  为收益前 N 的产品生成事实档案页(默认 30)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dataset.json"), "utf8"));
const SITE_NAME = "DigistorePicks";
const BASE = ""; // GitHub Pages 根路径部署

const args = process.argv.slice(2);
const profilesIdx = args.indexOf("--profiles");
const PROFILE_N = profilesIdx >= 0 ? parseInt(args[profilesIdx + 1], 10) || 30 : 30;

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const money = (n, cur) => (cur === "EUR" ? "€" : "$") + (n == null ? "—" : Number(n).toFixed(2));
const pct = (n) => (n == null ? "—" : Number(n).toFixed(2).replace(/\.?0+$/, "") + "%");
const datemark = (iso) => (iso ? iso.slice(0, 10) : "");
const outPath = (...p) => path.join(ROOT, ...p);

function layout({ title, desc, body, rel = "." }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="stylesheet" href="${rel}/assets/style.css">
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="${rel}/index.html">${SITE_NAME}<span>.com</span></a>
  <nav class="cats">
    <a href="${rel}/index.html">All categories</a>
    <a href="${rel}/blog/index.html">Blog</a>
    <a href="${rel}/about.html">About &amp; disclosure</a>
  </nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="site"><div class="wrap">
  <div class="disclosure"><b>Affiliate disclosure:</b> ${SITE_NAME} contains affiliate links. If you buy through them we may earn a commission from the vendor at no extra cost to you. Marketplace statistics shown on this site (price, commission, conversion, earnings) are provided by the official Digistore24 marketplace and are not a forecast of your results.</div>
  <div>© ${new Date().getFullYear()} ${SITE_NAME} · Product data: Digistore24 marketplace (updated ${datemark(DATA.scrapedAt)}) · <a href="${rel}/about.html">About, disclosure &amp; contact</a></div>
</div></footer>
</body>
</html>`;
}

function productCard(p, rel = ".") {
  const img = p.imageUrl
    ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.label)}" loading="lazy" onerror="this.style.display='none'">`
    : "";
  return `<div class="card">
  ${img}
  <div class="title"><a href="${rel}/reviews/${esc(p.slug || slug(p.label) + "-" + p.id)}.html">${esc(p.label)}</a></div>
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
    <a class="badge" href="${rel}/reviews/${esc(p.slug || slug(p.label) + "-" + p.id)}.html">View profile</a>
    <a href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">Official sales page ↗</a>
  </div>
</div>`;
}

// ---------- 排序与精选 ----------
const byEarnings = [...DATA.products].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0));
const withSlug = byEarnings.map((p) => ({ ...p, slug: slug(p.label) + "-" + p.id }));

// 深度评测 = reviews/ 下已有手写页的产品(articles 目录清单)
const articleIds = new Set(
  fs.existsSync(path.join(ROOT, "build", "articles.json"))
    ? JSON.parse(fs.readFileSync(path.join(ROOT, "build", "articles.json"), "utf8")).map((a) => String(a.productId))
    : []
);

// ---------- 首页 ----------
function homePage() {
  const top = withSlug.slice(0, 12);
  const cats = DATA.categories.slice().sort((a, b) => b.count - a.count);
  const body = `
<h1>Digistore24 products, sorted by the numbers</h1>
<p class="sub">An independent directory of ${DATA.total} English-language products in the Digistore24 marketplace — ${DATA.categories.length} categories, official pricing and commission data, no hype.</p>
<h2>Top products by affiliate earnings per sale</h2>
<p class="sub">Ranked by marketplace-reported earnings per sale (vendor-offered commission × average order value). These are official marketplace statistics, not our predictions.</p>
<div class="grid">
${top.map((p) => productCard(p)).join("\n")}
</div>
<h2>Browse all ${DATA.categories.length} categories</h2>
<div class="cat-index">
${cats
  .map(
    (c) =>
      `<a href="category/${c.slug}.html"><span>${esc(c.label)}</span><span class="n">${c.count} products</span></a>`
  )
  .join("\n")}
</div>
<p class="sub" style="margin-top:26px">Looking for honest, hands-on reviews? See our <a href="reviews/index.html">review index</a> — every review is labeled by how it was researched.</p>`;
  fs.writeFileSync(outPath("index.html"), layout({ title: `${SITE_NAME} — Digistore24 product directory & reviews`, desc: `Directory of ${DATA.total} Digistore24 products with official price, commission and conversion data. Independent reviews.`, body }));
}

// ---------- 分类页 ----------
function categoryPages() {
  const dir = outPath("category");
  fs.mkdirSync(dir, { recursive: true });
  // 同名分类(不同 section)slug 冲突:重名的追加 section 前缀
  const slugCount = {};
  for (const c of DATA.categories) {
    const base = slug(c.label);
    slugCount[base] = (slugCount[base] || 0) + 1;
  }
  for (const c of DATA.categories) {
    const base = slug(c.label);
    c.slug = slugCount[base] > 1 ? slug(c.section) + "-" + base : base;
  }
  for (const c of DATA.categories) {
    const items = withSlug.filter((p) => (p.categoryIds || []).includes(String(c.catId)));
    const body = `
<h1>${esc(c.label)}</h1>
<p class="sub">${items.length} product${items.length === 1 ? "" : "s"} in this Digistore24 marketplace category · Part of: ${esc(c.section)} · <a href="../index.html">all categories</a></p>
<div class="grid">
${items.map((p) => productCard(p, "..")).join("\n")}
</div>
<p class="sub" style="margin-top:22px">* Marketplace statistics (commission, conversion, earnings/sale) are reported by Digistore24 for the vendor's traffic and depend on traffic quality; they are not a forecast of your results.</p>`;
    fs.writeFileSync(path.join(dir, c.slug + ".html"), layout({ title: `${c.label} — Digistore24 products (${items.length})`, desc: `${items.length} Digistore24 products in ${c.label}, with official price, commission and marketplace statistics.`, body, rel: ".." }));
  }
}

// ---------- 产品事实档案页(非手写评测) ----------
function profilePages() {
  const dir = outPath("reviews");
  fs.mkdirSync(dir, { recursive: true });
  const chosen = withSlug.slice(0, PROFILE_N);
  for (const p of chosen) {
    if (articleIds.has(String(p.id))) continue; // 手写评测已存在则跳过
    const cats = (p.categories || []).map((c) => esc(c)).join(", ");
    const body = `
<h1>${esc(p.label)}</h1>
<p class="sub">Product profile · Marketplace data updated ${datemark(DATA.scrapedAt)} · Categories: ${cats || "Uncategorized"}</p>

<div class="notice"><b>How this page was researched:</b> this is a <b>data profile</b> compiled from the official Digistore24 marketplace listing and the vendor's public sales page — not a hands-on review. We publish it so you can check the numbers before you buy. A hands-on review will follow only after we have actually purchased and used the product.</div>

${p.imageUrl ? `<p><img src="${esc(p.imageUrl)}" alt="${esc(p.label)}" style="max-width:340px;width:100%;border:1px solid var(--line);border-radius:8px"></p>` : ""}

<h2>What it is</h2>
<p>${esc(p.type)} from vendor <b>${esc(p.vendorName)}</b>, listed on the Digistore24 marketplace since <b>${datemark(p.createdAt)}</b>.
${p.description ? `Vendor's own description: “${esc(p.description)}”` : ""}</p>

<h2>Key facts</h2>
<table class="specs">
<tr><th>Product type</th><td>${esc(p.type)}</td></tr>
<tr><th>Price</th><td>${money(p.price, p.currency)} (${esc((p.billingTypes || []).join(", ")) || "see sales page"})</td></tr>
<tr><th>Affiliate commission</th><td>${pct(p.commission)}</td></tr>
<tr><th>Refund window</th><td>Per the vendor's sales page (Digistore24 products commonly offer 60 days — check the official page before buying)</td></tr>
<tr><th>Vendor</th><td>${esc(p.vendorName)} (Digistore24 vendor, listing created ${datemark(p.createdAt)})</td></tr>
<tr><th>Marketplace stats*</th><td>Cart conversion ${pct(p.conversionRate)} · cancel rate ${pct(p.cancelRate)} · affiliate earnings/sale ${money(p.earningsPerSale, p.currency)}</td></tr>
</table>

<p class="sub">* Marketplace statistics are reported by Digistore24 based on the vendor's overall traffic and depend heavily on traffic quality. They are not a forecast of your results or ours.</p>

<h2>Where to check it out</h2>
<p>Read the vendor's full sales page (current price, guarantee terms and bonuses are listed there):<br>
<a class="cta" href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">View official sales page</a></p>
<p style="font-size:.88rem;color:var(--ink-soft)">That link is an affiliate link — if you buy through it we earn a commission from the vendor at no extra cost to you.</p>`;
    fs.writeFileSync(path.join(dir, p.slug + ".html"), layout({ title: `${p.label} — price, commission & facts (${p.type})`, desc: `Digistore24 product profile: ${p.label}. Official price, commission and marketplace statistics, plus links to the official sales page.`, body, rel: ".." }));
  }

  // 评测索引页
  const written = articleIds.size
    ? `<h2>Hands-on reviews</h2><ul>${[...articleIds].map((id) => {
        const p = withSlug.find((x) => String(x.id) === String(id));
        return p ? `<li><a href="${p.slug}.html">${esc(p.label)}</a> — hands-on</li>` : "";
      }).join("")}</ul>`
    : "";
  const profileList = chosen.map((p) => `<li><a href="${p.slug}.html">${esc(p.label)}</a> — data profile (${money(p.earningsPerSale, p.currency)} earnings/sale, ${pct(p.commission)} commission)</li>`).join("\n");
  const body = `
<h1>Review index</h1>
<p class="sub">Every page here is labeled by how it was researched: a <b>data profile</b> (official marketplace + sales-page facts) or a <b>hands-on review</b> (we bought and used the product).</p>
${written}
<h2>Data profiles (top ${chosen.length} by earnings/sale)</h2>
<ul style="line-height:2">
${profileList}
</ul>`;
  fs.writeFileSync(path.join(dir, "index.html"), layout({ title: `Review index — ${SITE_NAME}`, desc: "Index of Digistore24 product profiles and hands-on reviews.", body, rel: ".." }));
}

// ---------- about ----------
function aboutPage() {
  const body = `
<h1>About ${SITE_NAME}</h1>
<p class="sub">Independent directory of Digistore24 marketplace products</p>
<h2>What we do</h2>
<p>${SITE_NAME} organizes the English-language offers in the <a href="https://www.digistore24.com" rel="noopener">Digistore24</a> affiliate marketplace (${DATA.total} products across ${DATA.categories.length} categories as of ${datemark(DATA.scrapedAt)}) and publishes the numbers that matter before you buy or promote: price, commission, cart conversion, cancel rate, earnings per sale, vendor and listing age.</p>
<h2>How we research</h2>
<p>Every page is labeled with its research method:</p>
<ul>
<li><b>Data profile</b> — facts from the official marketplace listing and the vendor's public sales page. No hands-on claims.</li>
<li><b>Hands-on review</b> — we purchased the product with our own money and used it. Screenshots are our own.</li>
</ul>
<p>We do not publish testimonials we cannot verify, and we do not quote earnings claims that are not on the vendor's official page.</p>
<h2>Affiliate disclosure (FTC)</h2>
<p>This site contains affiliate links. If you click one and buy a product, we may earn a commission from the vendor — this does not increase your price. Pages that are primarily data profiles exist so you can verify every number on the official marketplace yourself.</p>
<h2>Contact</h2>
<p>Questions, corrections, or a vendor who wants their numbers checked? Open an issue on our <a href="https://github.com/vsyour-cmd/digistore-picks" rel="noopener">GitHub repository</a>.</p>
<h2>Data source &amp; updates</h2>
<p>Product data comes from the official Digistore24 marketplace API for logged-in affiliates and is re-checked regularly; each page shows its update date. Marketplace statistics belong to Digistore24/the vendor and are shown for reference only.</p>`;
  fs.writeFileSync(outPath("about.html"), layout({ title: `About — ${SITE_NAME}`, desc: "About DigistorePicks: research methods, affiliate disclosure, contact.", body }));
}

homePage();
categoryPages();
profilePages();
aboutPage();
console.log(
  `Built: index.html, about.html, ${DATA.categories.length} category pages, ${Math.min(PROFILE_N, withSlug.length)} profile pages (+ review index). Articles: ${articleIds.size}`
);
