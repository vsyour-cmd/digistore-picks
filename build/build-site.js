#!/usr/bin/env node;
/**
 * build-site.js — 从 data/dataset.json 生成静态站点
 * - index / about / 45 分类页
 * - 全部产品的档案页(reviews/),含 marketplace 数据 + 销售页研究素材
 * - 图片优先用本地 assets/products/(manifest),无则留空
 * 用法: node build/build-site.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dataset.json"), "utf8"));
const SITE_NAME = "DigistorePicks";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const money = (n, cur) => (cur === "EUR" ? "€" : "$") + (n == null ? "—" : Number(n).toFixed(2));
const pct = (n) => (n == null ? "—" : Number(n).toFixed(2).replace(/\.?0+$/, "") + "%");
const datemark = (iso) => (iso ? iso.slice(0, 10) : "");
const outPath = (...p) => path.join(ROOT, ...p);

// 本地图片 manifest 查找
const IMG_DIR = path.join(ROOT, "assets", "products");
function localImage(id) {
  const m = path.join(IMG_DIR, id + ".img.json");
  if (fs.existsSync(m)) {
    try { const j = JSON.parse(fs.readFileSync(m, "utf8")); if (j.local) return j.local; } catch {}
  }
  return null;
}

// 手写评测登记(build/articles.json [{productId}])不被覆盖
const articleIds = new Set(
  fs.existsSync(path.join(ROOT, "build", "articles.json"))
    ? JSON.parse(fs.readFileSync(path.join(ROOT, "build", "articles.json"), "utf8")).map((a) => String(a.productId))
    : []
);

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

function img(p, attrs = "") {
  const local = localImage(p.id);
  if (!local) return "";
  return `<img src="../${local}" ${attrs} loading="lazy" alt="${esc(p.label)}" onerror="this.style.display='none'">`;
}
function imgRel(p, rel, attrs = "") {
  const local = localImage(p.id);
  if (!local) return "";
  return `<img src="${rel}/${local}" ${attrs} loading="lazy" alt="${esc(p.label)}" onerror="this.style.display='none'">`;
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
  .map((p) => ({ ...p, slug: slug(p.label) + "-" + p.id }))
  .sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0));

// 分类 slug 去重(同名不同 section 加前缀)
{
  const cnt = {};
  for (const c of DATA.categories) { const b = slug(c.label); cnt[b] = (cnt[b] || 0) + 1; }
  for (const c of DATA.categories) { const b = slug(c.label); c.file = cnt[b] > 1 ? slug(c.section) + "-" + b : b; }
}

// ---------- 首页 ----------
function homePage() {
  const top = products.slice(0, 12);
  const cats = DATA.categories.slice().sort((a, b) => b.count - a.count);
  const body = `
<h1>Digistore24 products, sorted by the numbers</h1>
<p class="sub">An independent directory of ${DATA.total} English-language products in the Digistore24 marketplace — ${DATA.categories.length} categories, official pricing and commission data, sales-page research on every offer, no hype.</p>
<h2>Top products by affiliate earnings per sale</h2>
<p class="sub">Ranked by marketplace-reported earnings per sale. Official marketplace statistics, not our predictions.</p>
<div class="grid">
${top.map((p) => productCard(p)).join("\n")}
</div>
<h2>Browse all ${DATA.categories.length} categories</h2>
<div class="cat-index">
${cats.map((c) => `<a href="category/${c.file}.html"><span>${esc(c.label)}</span><span class="n">${c.count} products</span></a>`).join("\n")}
</div>
<p class="sub" style="margin-top:26px">Every product has a full profile with marketplace data and research from its sales page. Start anywhere — or read <a href="blog/index.html">the data guides</a>.</p>`;
  fs.writeFileSync(outPath("index.html"), layout({ title: `${SITE_NAME} — Digistore24 product directory & reviews`, desc: `Directory of ${DATA.total} Digistore24 products with official price, commission and conversion data plus sales-page research on every offer.`, body }));
}

// ---------- 分类页 ----------
function categoryPages() {
  const dir = outPath("category");
  fs.mkdirSync(dir, { recursive: true });
  for (const c of DATA.categories) {
    const items = products.filter((p) => (p.categoryIds || []).includes(String(c.catId)));
    const body = `
<h1>${esc(c.label)}</h1>
<p class="sub">${items.length} product${items.length === 1 ? "" : "s"} in this Digistore24 marketplace category · Part of: ${esc(c.section)} · <a href="../index.html">all categories</a></p>
<div class="grid">
${items.map((p) => productCard(p, "..")).join("\n")}
</div>
<p class="sub" style="margin-top:22px">* Marketplace statistics are reported by Digistore24 for the vendor's traffic and depend on traffic quality; they are not a forecast of your results.</p>`;
    fs.writeFileSync(path.join(dir, c.file + ".html"), layout({ title: `${c.label} — Digistore24 products (${items.length})`, desc: `${items.length} Digistore24 products in ${c.label}, with official price, commission, marketplace statistics and sales-page research.`, body, rel: ".." }));
  }
}

// ---------- 产品档案页(全部产品) ----------
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
  if (r.priceMentions && r.priceMentions.length) parts.push(`<p><b>Prices mentioned on the page:</b> ${r.priceMentions.map((x) => esc(x)).join(" · ")}</p>`);
  if (r.guaranteeMention) parts.push(`<p><b>Guarantee language found:</b> “${esc(r.guaranteeMention)}” — always confirm the current terms on the official page before relying on it.</p>`);
  if (r.ctaTexts && r.ctaTexts.length) parts.push(`<p><b>CTA buttons:</b> ${r.ctaTexts.map((t) => `“${esc(t)}”`).join(" · ")}</p>`);
  if (r.excerpt && r.excerpt.length) parts.push(`<h3>Opening copy</h3>${r.excerpt.map((t) => `<blockquote>${esc(t)}</blockquote>`).join("")}`);
  parts.push(`<p class="sub">Research method: ${r.method === "browser-render" ? "browser-rendered page" : "raw HTML fetch"} · ${r.wordCount} words on page · quality: ${r.quality} · researched ${datemark(DATA.researchedAt)}. <a href="https://github.com/vsyour-cmd/digistore-picks/blob/main/content/products/${p.id}-${slug(p.label)}.md" rel="noopener">Full research file (MD) ↗</a></p>`);
  return `<h2>From the vendor's sales page</h2>
<div class="notice"><b>These are the vendor's own marketing claims</b>, extracted verbatim from the official sales page. We do not verify outcomes, testimonials or income claims.</div>
${parts.join("\n")}`;
}

function profilePages() {
  const dir = outPath("reviews");
  fs.mkdirSync(dir, { recursive: true });
  for (const p of products) {
    const file = path.join(dir, p.slug + ".html");
    if (articleIds.has(String(p.id)) && fs.existsSync(file)) continue; // 手写评测不覆盖
    const cats = (p.categories || []).map((c) => esc(c)).join(", ");
    const imgTag = img(p, `style="max-width:340px;width:100%;border:1px solid var(--line);border-radius:8px"`);
    const body = `
<h1>${esc(p.label)}</h1>
<p class="sub">Product profile · Marketplace data ${datemark(DATA.scrapedAt)} · Sales-page research ${datemark(DATA.researchedAt) || "—"} · Categories: ${cats || "Uncategorized"}</p>

<div class="notice"><b>How this page was researched:</b> a <b>data profile</b> — official Digistore24 marketplace record plus verbatim extracts from the vendor's public sales page. Not a hands-on review. A hands-on review will follow only after we have purchased and used the product.</div>

${imgTag}

<h2>Marketplace record</h2>
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

<h2>Where to check it out</h2>
<p>Read the vendor's full sales page (current price, guarantee terms and bonuses are listed there):<br>
<a class="cta" href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">View official sales page</a></p>
<p style="font-size:.88rem;color:var(--ink-soft)">That link is an affiliate link — if you buy through it we earn a commission from the vendor at no extra cost to you.</p>`;
    fs.writeFileSync(file, layout({ title: `${p.label} — price, commission & sales-page research (${p.type})`, desc: `Digistore24 profile: ${p.label}. Official price, commission, marketplace stats and verbatim sales-page research.`, body, rel: ".." }));
  }

  // 评测索引:按分类列全量太长,索引页列 Top 100 + 说明
  const top = products.slice(0, 100);
  const written = articleIds.size
    ? `<h2>Hands-on reviews</h2><ul>${[...articleIds].map((id) => {
        const p = products.find((x) => String(x.id) === String(id));
        return p ? `<li><a href="${p.slug}.html">${esc(p.label)}</a> — hands-on</li>` : "";
      }).join("")}</ul>`
    : "";
  const body = `
<h1>Product profiles</h1>
<p class="sub">Every one of the ${DATA.total} products has a full profile: marketplace record + verbatim sales-page research. Below are the top 100 by earnings/sale; browse <a href="../index.html">by category</a> for the rest. Research method is labeled on every page; hand-written hands-on reviews are listed separately.</p>
${written}
<h2>Top 100 by earnings/sale</h2>
<ul style="line-height:2">
${top.map((p) => `<li><a href="${p.slug}.html">${esc(p.label)}</a> — ${money(p.earningsPerSale, p.currency)}/sale, ${pct(p.commission)} commission${p.research && p.research.error ? " · <b>sales page unreachable</b>" : ""}</li>`).join("\n")}
</ul>`;
  fs.writeFileSync(path.join(dir, "index.html"), layout({ title: `Product profiles — ${SITE_NAME}`, desc: `All ${DATA.total} Digistore24 product profiles with marketplace data and sales-page research.`, body, rel: ".." }));
}

// ---------- about ----------
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
  fs.writeFileSync(outPath("about.html"), layout({ title: `About — ${SITE_NAME}`, desc: "About DigistorePicks: research methods, affiliate disclosure, contact.", body }));
}

homePage();
categoryPages();
profilePages();
aboutPage();
console.log(`Built: index, about, ${DATA.categories.length} category pages, ${products.length} product profiles. Articles protected: ${articleIds.size}`);
