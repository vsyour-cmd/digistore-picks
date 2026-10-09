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
    try { const j = JSON.parse(fs.readFileSync(m, "utf8")); if (j.local) return j.local; } catch {}
  }
  return null;
}

const articleIds = new Set(
  fs.existsSync(path.join(ROOT, "build", "articles.json"))
    ? JSON.parse(fs.readFileSync(path.join(ROOT, "build", "articles.json"), "utf8")).map((a) => String(a.productId))
    : []
);

function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items
    .map((c, i) => (i === items.length - 1 ? `<span>${esc(c.label)}</span>` : `<a href="${c.href}">${esc(c.label)}</a>`))
    .join(' <span class="sep">›</span> ')}</nav>`;
}

function layout({ title, desc, body, rel = ".", path = "", ogType = "website", ogImage = null, jsonLd = [], crumb = null }) {
  const canonical = SITE_URL + "/" + path;
  const ogImg = ogImage
    ? (ogImage.startsWith("http") ? ogImage : SITE_URL + "/" + ogImage.replace(/^(\.\.\/)+/, ""))
    : null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${esc(ogImg)}">` : '<meta name="twitter:card" content="summary">'}
<link rel="stylesheet" href="${rel}/assets/style.css">
${jsonLd.map((j) => `<script type="application/ld+json">${jsonSafe(j)}</script>`).join("\n")}
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="${rel}/index.html">${SITE_NAME}<span>.com</span></a>
  <nav class="cats">
    <a href="${rel}/index.html">All categories</a>
    <a href="${rel}/reviews/index.html">All products</a>
    <a href="${rel}/blog/index.html">Blog</a>
    <a href="${rel}/about.html">About &amp; disclosure</a>
  </nav>
</div></header>
<main class="wrap">
${crumb ? crumbs(crumb) + "\n" : ""}${body}
</main>
<footer class="site"><div class="wrap">
  <div class="disclosure"><b>Affiliate disclosure:</b> ${SITE_NAME} contains affiliate links. If you buy through them we may earn a commission from the vendor at no extra cost to you. Marketplace statistics shown on this site (price, commission, conversion, earnings) are provided by the official Digistore24 marketplace and are not a forecast of your results.</div>
  <div>© ${new Date().getFullYear()} ${SITE_NAME} · Product data: Digistore24 marketplace (updated ${datemark(DATA.scrapedAt)}) · <a href="${rel}/about.html">About, disclosure &amp; contact</a></div>
</div></footer>
</body>
</html>`;
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

// ---------- 首页 ----------
function homePage() {
  const top = products.slice(0, 12);
  const cats = DATA.categories.slice().sort((a, b) => b.count - a.count);
  const uncategorized = products.filter((p) => !p.categories.length).length;
  const body = `
<h1>Digistore24 products, sorted by the numbers</h1>
<p class="sub">An independent directory of ${DATA.total} English-language products in the Digistore24 marketplace — ${DATA.categories.length} categories, official pricing and commission data, sales-page research on ${DATA.withResearch} offers. Marketplace data refreshed ${datemark(DATA.scrapedAt)}.</p>
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
    title: `${SITE_NAME} — all ${DATA.total} Digistore24 products: prices, commissions & research`,
    desc: `Directory of ${DATA.total} Digistore24 products with official price, commission and conversion data plus sales-page research on every offer. ${DATA.categories.length} categories, updated ${datemark(DATA.scrapedAt)}.`,
    body, path: "", jsonLd,
  }));
}

// ---------- 分类页 ----------
function categoryPages() {
  const dir = outPath("category");
  fs.mkdirSync(dir, { recursive: true });
  const writeCat = (c, items, extraIntro = "") => {
    const avg = items.length ? items.reduce((a, p) => a + (p.price || 0), 0) / items.length : 0;
    const minC = items.length ? Math.min(...items.map((p) => p.commission || 0)) : 0;
    const maxC = items.length ? Math.max(...items.map((p) => p.commission || 0)) : 0;
    const intro = `<p class="lead">${extraIntro}The <b>${esc(c.label)}</b> category on the Digistore24 marketplace lists <b>${items.length} English-language offers</b> (as of ${datemark(DATA.scrapedAt)}). Average list price: <b>${money(avg, "USD")}</b>; affiliate commissions run from <b>${pct(minC)}</b> to <b>${pct(maxC)}</b>. All statistics below are reported by Digistore24 for vendor-side traffic and depend on traffic quality.</p>`;
    const body = `
<h1>${esc(c.label)}</h1>
<p class="sub">${items.length} product${items.length === 1 ? "" : "s"} · Part of: ${esc(c.section)} · <a href="../index.html">all categories</a> · <a href="../reviews/index.html">all products A–Z</a></p>
${intro}
<div class="grid">
${items.map((p) => productCard(p, "..")).join("\n")}
</div>
<p class="sub" style="margin-top:22px">* Marketplace statistics are reported by Digistore24 for the vendor's traffic and depend on traffic quality; they are not a forecast of your results.</p>`;
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${c.label} — Digistore24 products`,
        description: `${items.length} Digistore24 products in ${c.label} with official price, commission and marketplace statistics.`,
        url: `${SITE_URL}/category/${c.file}.html`,
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL + "/" },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
          { "@type": "ListItem", position: 2, name: c.label, item: `${SITE_URL}/category/${c.file}.html` },
        ],
      },
    ];
    fs.writeFileSync(path.join(dir, c.file + ".html"), layout({
      title: `${c.label} — ${items.length} Digistore24 products: prices & commissions`,
      desc: `${items.length} Digistore24 products in ${c.label}: official prices, commissions (avg ${money(avg, "USD")}), conversion and cancel rates. Updated ${datemark(DATA.scrapedAt)}.`,
      body, rel: "..", path: `category/${c.file}.html`, jsonLd,
      crumb: [{ label: "Home", href: "../index.html" }, { label: c.label, href: `../category/${c.file}.html` }],
    }));
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
  return `<h2>From the vendor's sales page</h2>
<div class="notice"><b>These are the vendor's own marketing claims</b>, extracted verbatim from the official sales page${r.finalUrl && r.finalUrl !== p.salesPageUrl ? ` (final URL: ${esc(r.finalUrl)})` : ""}. We do not verify outcomes, testimonials or income claims.</div>
${parts.join("\n")}`;
}

function profilePages() {
  const dir = outPath("reviews");
  fs.mkdirSync(dir, { recursive: true });
  for (const p of products) {
    const file = path.join(dir, p.slug + ".html");
    if (articleIds.has(String(p.id)) && fs.existsSync(file)) continue;
    const cats = (p.categories || []).map((c) => esc(c)).join(", ");
    const imgTag = imgRel(p, "..", `style="max-width:340px;width:100%;border:1px solid var(--line);border-radius:8px"`);
    const localImg = localImage(p.id);

    // 相关产品:同主分类,按收益,排除自己
    const primaryCatId = (p.categoryIds || [])[0];
    let related = [];
    if (primaryCatId) related = products.filter((x) => x.id !== p.id && (x.categoryIds || []).includes(String(primaryCatId))).slice(0, 4);
    const relatedBlock = related.length
      ? `<h2>Related offers in ${esc(p.categories[0])}</h2>
<div class="grid">${related.map((x) => productCard(x, "..")).join("\n")}</div>`
      : "";

    const primaryCat = DATA.categories.find((c) => String(c.catId) === String(primaryCatId));
    const crumbItems = [{ label: "Home", href: "../index.html" }];
    if (primaryCat) crumbItems.push({ label: primaryCat.label, href: `../category/${primaryCat.file}.html` });
    crumbItems.push({ label: p.label, href: `../reviews/${p.slug}.html` });

    const body = `
<h1>${esc(p.label)}</h1>
<p class="sub">Product profile · Marketplace data ${datemark(DATA.scrapedAt)} · Sales-page research ${datemark(DATA.researchedAt) || "—"} · Categories: ${cats || "Uncategorized"}</p>

<div class="notice"><b>How this page was researched:</b> a <b>data profile</b> — official Digistore24 marketplace record plus verbatim extracts from the vendor's public sales page. Not a hands-on review. A hands-on review will follow only after we have purchased and used the product.</div>

${tldr(p)}

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

${relatedBlock}

<h2>Where to check it out</h2>
<p>Read the vendor's full sales page (current price, guarantee terms and bonuses are listed there):<br>
<a class="cta" href="${esc(p.promoLink)}" rel="nofollow sponsored noopener" target="_blank">View official sales page</a></p>
<p style="font-size:.88rem;color:var(--ink-soft)">That link is an affiliate link — if you buy through it we earn a commission from the vendor at no extra cost to you.</p>`;

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.label,
        description: (p.research && p.research.metaDescription) || p.description || `${p.label} — ${p.type} on the Digistore24 marketplace`,
        ...(localImg ? { image: SITE_URL + "/" + localImg } : {}),
        brand: { "@type": "Brand", name: p.vendorName },
        category: (p.categories || [])[0] || "Uncategorized",
        offers: {
          "@type": "Offer",
          price: Number(Number(p.price).toFixed(2)),
          priceCurrency: p.currency === "EUR" ? "EUR" : "USD",
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/reviews/${p.slug}.html`,
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
      title: `${p.label} — price, commission & sales-page research (${p.type})`,
      desc: `${p.label}: ${p.type} by ${p.vendorName} on Digistore24. Price ${money(p.price, p.currency)}, ${pct(p.commission)} commission, marketplace stats and verbatim sales-page research. Updated ${datemark(DATA.scrapedAt)}.`,
      body, rel: "..", path: `reviews/${p.slug}.html`, ogImage: localImg, jsonLd,
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

homePage();
categoryPages();
profilePages();
aboutPage();
console.log(`Built: index, about, ${DATA.categories.length}+1 category pages, ${products.length} product profiles (SEO/GEO: canonical, OG, JSON-LD, TL;DR, breadcrumbs). Articles protected: ${articleIds.size}`);
