#!/usr/bin/env node
/**
 * build-blog.js — 生成数据驱动的编辑文章(blog/)
 * 文章内容全部来自 dataset.json 的官方市场数据,随每次构建自动刷新。
 * 用法: node build/build-blog.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dataset.json"), "utf8"));
const SITE_NAME = "DigistorePicks";
const SITE_URL = "https://vsyour-cmd.github.io/digistore-picks";
const UPDATED = DATA.scrapedAt.slice(0, 10);
const jsonSafe = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const money = (n, cur) => (cur === "EUR" ? "€" : "$") + (n == null ? "—" : Number(n).toFixed(2));
const pct = (n) => (n == null ? "—" : Number(n).toFixed(2).replace(/\.?0+$/, "") + "%");
const catSlugMap = {};
{
  const cnt = {};
  for (const c of DATA.categories) { const b = slug(c.label); cnt[b] = (cnt[b] || 0) + 1; }
  for (const c of DATA.categories) { const b = slug(c.label); c.file = cnt[b] > 1 ? slug(c.section) + "-" + b : b; }
}

const products = DATA.products.map((p) => ({ ...p, slug: slug(p.label) + "-" + p.id }));

const GOATCOUNTER = '<script data-goatcounter="https://vsyour.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>';

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

const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "adminstore",
  url: SITE_URL + "/",
  email: "admin@2bkf.com",
  address: { "@type": "PostalAddress", streetAddress: "Room 70, Unit 10B, 7/F, Tower B, New Mandarin Plaza, 14 Science Museum Road, Tsim Sha Tsui", addressLocality: "Kowloon", addressCountry: "HK" },
  sameAs: ["https://github.com/vsyour-cmd/digistore-picks"],
};

function layout({ title, desc, body, rel = "..", file = "", jsonLd = [] }) {
  const canonical = SITE_URL + "/blog/" + file;
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title.replace(` — ${SITE_NAME}`, ""),
    description: desc,
    datePublished: UPDATED,
    dateModified: UPDATED,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL + "/about.html" },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL + "/" },
    mainEntityOfPage: canonical,
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(capTitle(title))}</title>
<meta name="description" content="${esc(capDesc(desc))}">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(capTitle(title))}">
<meta property="og:description" content="${esc(capDesc(desc))}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="${rel}/assets/style.css">
<script type="application/ld+json">${jsonSafe(article)}</script>
<script type="application/ld+json">${jsonSafe(ORG_LD)}</script>
${jsonLd.map((j) => `<script type="application/ld+json">${jsonSafe(j)}</script>`).join("\n")}
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="${rel}/index.html">${SITE_NAME}<span>.com</span></a>
  <nav class="cats">
    <a href="${rel}/index.html">All categories</a>
    <a href="${rel}/reviews/index.html">All products</a>
    <a href="index.html">Blog</a>
    <a href="${rel}/about.html">About &amp; disclosure</a>
  </nav>
</div></header>
<main class="wrap">
<nav class="crumbs"><a href="../index.html">Home</a> <span class="sep">›</span> <a href="index.html">Blog</a> <span class="sep">›</span> <span>${esc(title.replace(` — ${SITE_NAME}`, "").slice(0, 60))}</span></nav>
${body}
</main>
<footer class="site"><div class="wrap">
  <div class="disclosure"><b>Affiliate disclosure:</b> ${SITE_NAME} contains affiliate links. If you buy through them we may earn a commission from the vendor at no extra cost to you. Rankings on this page are computed from official Digistore24 marketplace statistics and are not a forecast of your results or an endorsement of outcomes.</div>
  <div>© ${new Date().getFullYear()} ${SITE_NAME} · Product data: Digistore24 marketplace (updated ${UPDATED}) · <a href="${rel}/about.html">About, disclosure &amp; contact</a> · <a href="${rel}/monthly-new.html">New this month</a></div>
</div></footer>
${GOATCOUNTER}
</body>
</html>`;
}

function tableRows(list) {
  return list
    .map(
      (p, i) => `<tr>
<td>${i + 1}</td>
<td><a href="${relToReviews(p)}/reviews/${p.slug}.html">${esc(p.label)}</a></td>
<td>${esc(p.type)}</td>
<td><b>${money(p.price, p.currency)}</b></td>
<td>${pct(p.commission)}</td>
<td><b>${money(p.earningsPerSale, p.currency)}</b></td>
<td>${pct(p.conversionRate)}</td>
</tr>`
    )
    .join("\n");
}
function relToReviews() { return ".."; }

// ---------- 文章1: Top 20 by earnings ----------
function top20() {
  const list = [...products].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)).slice(0, 20);
  const body = `
<article class="review">
<h1>The 20 highest-earning Digistore24 products (by the numbers)</h1>
<p class="sub">By ${SITE_NAME} editorial · Data refreshed ${UPDATED} · 5 min read</p>

<div class="notice"><b>How this list was built:</b> we ranked all ${DATA.total} English-language offers in the Digistore24 marketplace by <b>earnings per sale</b> — the commission a vendor pays per average order, as reported by the official marketplace. No opinions, no sponsored placements. Earnings figures describe the vendor's overall traffic, not a promise of yours.</div>

<div class="tldr"><b>Key takeaways</b> (data as of ${UPDATED}):
<ul>
<li>Highest earnings/sale on the marketplace right now: <b>${esc(list[0].label)}</b> at <b>${money(list[0].earningsPerSale, list[0].currency)}</b> per sale (${pct(list[0].commission)} commission on ${money(list[0].price, list[0].currency)}).</li>
<li>Top 3 by earnings/sale: ${list.slice(0, 3).map((p, i) => `<b>${i + 1}. ${esc(p.label)}</b> (${money(p.earningsPerSale, p.currency)})`).join(", ")}.</li>
<li>Median cart conversion across the top 20: <b>${pct([...list].sort((a, b) => (a.conversionRate || 0) - (b.conversionRate || 0))[Math.floor(list.length / 2)].conversionRate)}</b> — these are vendor-side numbers, not forecasts.</li>
</ul>
</div>

<p>Digistore24's affiliate marketplace lists ${DATA.total} English-language products across ${DATA.categories.length} categories, from e-books and video courses to supplements and software. If you're an affiliate choosing what to promote — or a buyer cross-checking an offer — the fastest honest filter is the marketplace's own numbers: price, commission rate, cart conversion and cancel rate.</p>

<p>Here are the current top 20 by earnings per sale.</p>

<h2>Top 20 by earnings/sale</h2>
<table class="specs">
<tr><th>#</th><th>Product</th><th>Type</th><th>Price</th><th>Comm.</th><th>Earn./sale</th><th>Cart conv.*</th></tr>
${tableRows(list)}
</table>
<p class="sub">* Cart conversion = share of order-form visitors who buy, reported by Digistore24 across the vendor's traffic. It depends heavily on traffic quality and is not a forecast.</p>

<h2>How to read these numbers</h2>
<p><b>High earnings/sale ≠ easy money.</b> A product with $100 earnings per sale and a 2% cart conversion can earn you less than a $30-earnings product converting at 10% — what matters is your traffic's fit. Before promoting:</p>
<ul>
<li><b>Check the cancel rate.</b> High commission plus high cancel rate often means aggressive marketing and refund-heavy buyers. Every product page on this site lists it.</li>
<li><b>Read the vendor's sales page yourself.</b> Price, guarantee window and bonuses change; the official page is the only source that counts.</li>
<li><b>Fit beats figures.</b> The top of this list is dominated by high-ticket coaching and supplement offers. They earn big because vendors spend big on funnels — competing for that traffic is hard. Mid-list products in a niche you actually know often convert better for affiliates starting out.</li>
</ul>

<h2>Where to verify everything</h2>
<p class="sub">Evaluate any offer with our <a href="digistore24-numbers-checklist.html">6-point numbers check</a> — the method behind every page on this site.</p>
<p>Each product name above links to our data profile with its full marketplace record. You can also verify any figure directly in the <a href="https://www.digistore24.com" rel="noopener nofollow">Digistore24 marketplace</a> — the same numbers we publish are shown to any registered affiliate.</p>
<p><a class="cta" href="../index.html">Browse all ${DATA.categories.length} categories</a></p>
</article>`;
  fs.writeFileSync(path.join(ROOT, "blog", "top-20-highest-earning-digistore24-products.html"), layout({ title: "The 20 highest-earning Digistore24 products (data-driven) — " + SITE_NAME, desc: "All " + DATA.total + " English Digistore24 products ranked by official earnings-per-sale data. Updated " + UPDATED + ".", body, rel: "..", file: "top-20-highest-earning-digistore24-products.html" }));
}

// ---------- 文章2: 大分类指南 ----------
function categoryGuides() {
  const majors = DATA.categories.filter((c) => c.count >= 5).sort((a, b) => b.count - a.count).map((c) => c.label);
  for (const label of majors) {
    const cat = DATA.categories.find((c) => c.label === label);
    if (!cat) continue;
    const items = products.filter((p) => (p.categoryIds || []).includes(String(cat.catId)));
    if (!items.length) continue;
    const top = [...items].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)).slice(0, 15);
    const avgPrice = items.reduce((a, p) => a + (p.price || 0), 0) / items.length;
    const types = {};
    for (const p of items) types[p.type] = (types[p.type] || 0) + 1;
    const topTypes = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${esc(t)} (${n})`).join(", ");
    const body = `
<article class="review">
<h1>${esc(label)} on Digistore24: the data guide</h1>
<p class="sub">By ${SITE_NAME} editorial · Data refreshed ${UPDATED} · ${items.length} offers analyzed</p>

<div class="notice"><b>Research method:</b> this guide is computed from the official Digistore24 marketplace record of every English-language offer in this category — prices, commissions, conversion and cancel rates as reported to affiliates. No hands-on product claims.</div>

<div class="tldr"><b>Key takeaways</b> (data as of ${UPDATED}):
<ul>
<li>${esc(label)} holds <b>${items.length} English-language offers</b> on the Digistore24 marketplace; average list price <b>${money(avgPrice, "USD")}</b>.</li>
<li>Top offer by earnings/sale: <b>${esc(top[0].label)}</b> — <b>${money(top[0].earningsPerSale, top[0].currency)}</b> per sale at ${pct(top[0].commission)} commission.</li>
<li>Commissions in this category range from <b>${pct(Math.min(...items.map((p) => p.commission || 0)))}</b> to <b>${pct(Math.max(...items.map((p) => p.commission || 0)))}</b> (vendor-side data).</li>
</ul>
</div>

<p>The <b>${esc(label.toLowerCase())}</b> shelf of the Digistore24 marketplace currently holds <b>${items.length} English-language offers</b> (part of ${esc(cat.section)}). Average list price: <b>${money(avgPrice, "USD")}</b>. The most common product types: ${topTypes}.</p>

<h2>The 15 biggest offers by earnings/sale</h2>
<table class="specs">
<tr><th>#</th><th>Product</th><th>Type</th><th>Price</th><th>Comm.</th><th>Earn./sale</th><th>Cart conv.*</th></tr>
${tableRows(top)}
</table>
<p class="sub">* Cart conversion is vendor-side marketplace data and depends on traffic quality — not a forecast of your results.</p>

<h2>What the numbers say about this category</h2>
<ul>
<li><b>Commission spread:</b> offers in ${esc(label)} run from ${pct(Math.min(...items.map(p => p.commission || 0)))} to ${pct(Math.max(...items.map(p => p.commission || 0)))} commission.</li>
<li><b>Price spread:</b> ${money(Math.min(...items.map(p => p.price || 0)), "USD")} to ${money(Math.max(...items.map(p => p.price || 0)), "USD")} list price.</li>
<li><b>Freshness:</b> the newest offer in this category was listed ${new Date(Math.max(...items.map(p => new Date(p.createdAt).getTime()))).toISOString().slice(0, 10)}.</li>
</ul>

<p>Every product links to a full data profile with cancel rate, vendor and listing age. Want the whole category? <a href="../category/${cat.file}.html">Browse all ${items.length} ${esc(label.toLowerCase())} offers</a>. Evaluate any offer with our <a href="digistore24-numbers-checklist.html">6-point numbers check</a> — the method behind this guide.</p>
${DE_GUIDE_SLUGS[label] ? `<p class="sub">Dieser Guide ist auch auf <a href="https://vsyour-cmd.github.io/digistore-picks-de/blog/guide-${DE_GUIDE_SLUGS[label]}.html" hreflang="de">Deutsch verfügbar</a>.</p>` : ""}
</article>`;
    fs.writeFileSync(path.join(ROOT, "blog", `guide-${slug(label)}.html`), layout({ title: `${label} on Digistore24: ${items.length} offers analyzed — ${SITE_NAME}`, desc: `Data guide to ${items.length} ${label} products on Digistore24: prices, commissions, conversion. Updated ${UPDATED}.`, body, rel: "..", file: `guide-${slug(label)}.html` }));
  }
}

// ---------- 文章3: 买家/推广者核查清单(方法论,静态) ----------
const DE_GUIDE_SLUGS = {
  "Health & Fitness": "gesundheit-fitness",
  "Personal Development": "pers-nlichkeitsentwicklung",
  "Business & Investment": "business-investment",
  "Education": "bildung",
  "Online Marketing & E-Business": "online-marketing-e-business",
  "Computer & Internet": "computer-internet",
  "Family & Children": "familie-kinder",
  "Dating, Relationships & Romance": "flirt-beziehungen-romantik",
  "Software": "software",
  "Social Media": "social-media",
};
function checklist() {
  const body = `
<article class="review">
<h1>Before you buy (or promote) a Digistore24 product: a 6-point numbers check</h1>
<p class="sub">By ${SITE_NAME} editorial · Updated ${UPDATED}</p>

<p>Every week new offers appear in the Digistore24 marketplace — this week the shelf holds <b>${DATA.total} English-language products</b>. Most look convincing on their sales page. The marketplace's own numbers, which every registered affiliate can see, give you a faster and more honest filter. Here's the check we run before any offer gets a profile page on this site.</p>

<h2>1. Price × commission = who's paying you</h2>
<p>Commission rates range from single digits to ${pct(Math.max(...DATA.products.map(p => p.commission || 0)))} on this marketplace. But the headline rate is meaningless without price: 75% of a $9 e-book earns you less than 35% of a $199 course. Always compute the actual dollar amount per sale (we publish it as <b>Earn./sale</b> on every profile).</p>

<h2>2. Cart conversion — the honesty metric</h2>
<p>Cart conversion is the share of people who reach the order form and buy, across all the vendor's traffic. Very low conversion on high traffic can signal an offer that over-promises on its sales page. Very high conversion with a high cancel rate can signal pressure tactics. Neither is proof — but together they tell you how the vendor's funnel behaves.</p>

<h2>3. Cancel rate — the refund shadow</h2>
<p>Every profile on this site lists the marketplace-reported cancel rate. A high cancel rate means buyers regret the purchase — for an affiliate, that's chargeback risk and clawed-back commissions; for a buyer, it's a community of people who asked for their money back.</p>

<h2>4. Vendor track record and listing age</h2>
<p>A listing created last month with spectacular numbers is unproven; a listing from 2021 with steady numbers has survived real buyers. We show the listing creation date on every profile.</p>

<h2>5. Guarantee terms — read them on the official page</h2>
<p>Many Digistore24 offers carry a 60-day money-back guarantee, but the window is set per product by the vendor. The only reliable source is the official sales page at the moment you buy. Our product buttons always link there — never to a cached or summarized copy.</p>

<h2>6. Who's telling you about it</h2>
<p>Anyone can quote the marketplace numbers above — including us. What they can't fake is hands-on use. That's why every page on ${SITE_NAME} carries a research label: a <b>data profile</b> (marketplace + sales-page facts only) or a <b>hands-on review</b> (we bought it, screenshots are ours). If a review site doesn't tell you which one you're reading, treat it as marketing.</p>

<p class="sub">This page is our 6-point evaluation method — the standard every profile on DigistorePicks is held to.</p>
<h2>The one-line version</h2>
<p><b>Earnings/sale ÷ cancel-rate skepticism × funnel fit — checked against the official page before any claim.</b> That's how every page here is built.</p>
<p><a class="cta" href="../index.html">Start with the full product directory</a></p>
</article>`;
  fs.writeFileSync(path.join(ROOT, "blog", "digistore24-numbers-checklist.html"), layout({ title: "Before you buy or promote a Digistore24 product: the 6-point check — " + SITE_NAME, desc: "How to evaluate Digistore24 offers using official marketplace numbers: earnings, conversion, cancel rate, vendor age, guarantee.", body, rel: "..", file: "digistore24-numbers-checklist.html" }));
}

// ---------- Head-to-head: Top60 同品类相邻配对(≤25 篇) ----------
function headToHead() {
  const POOL = 60, MAX_ARTICLES = 25;
  const top = [...products].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)).slice(0, POOL);
  fs.mkdirSync(path.join(ROOT, "blog"), { recursive: true });
  // 同品类才值得对比:补充剂对补充剂、课程对课程;跨品类的"对比"没有搜索价值
  const byCat = new Map();
  for (const p of top) {
    const cat = (p.categories && p.categories[0]) || "Uncategorized";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(p);
  }
  let pairs = [];
  for (const [, arr] of byCat) {
    for (let i = 0; i + 1 < arr.length; i += 2) pairs.push([arr[i], arr[i + 1]]);
  }
  pairs.sort((a, b) => Math.max(b[0].earningsPerSale || 0, b[1].earningsPerSale || 0) - Math.max(a[0].earningsPerSale || 0, a[1].earningsPerSale || 0));
  pairs = pairs.slice(0, MAX_ARTICLES);
  const wanted = new Set(pairs.map(([A, B]) => "vs-" + slug(A.label) + "-vs-" + slug(B.label) + ".html"));
  // vs-* 是生成物:清理不在当前集合里的过期对比文(手写文章走 reviews/ + articles.json,不受影响)
  let pruned = 0;
  for (const f of fs.readdirSync(path.join(ROOT, "blog"))) {
    if (f.startsWith("vs-") && f.endsWith(".html") && !wanted.has(f)) { fs.unlinkSync(path.join(ROOT, "blog", f)); pruned++; }
  }
  let built = 0;
  // 短标签:预截断到 22 字符,避免双长标签标题经 capTitle 截断后与产品页同名(audit-full 重复标题门禁)
  const t22 = (s) => { s = String(s || "").trim().replace(/\s+/g, " "); if (s.length <= 22) return s; const c = s.slice(0, 22); const sp = c.lastIndexOf(" "); return (sp > 12 ? c.slice(0, sp) : c).replace(/[\s,;:.-]+$/g, "") + "…"; };
  for (const [A, B] of pairs) {
    const slugName = "vs-" + slug(A.label) + "-vs-" + slug(B.label) + ".html";
    const row = (p, self) => `<tr${self ? ' class="self"' : ""}><td>${self ? `<b>${esc(p.label)}</b>` : `<a href="../reviews/${p.slug}.html">${esc(p.label)}</a>`}</td><td>${esc(p.type)}</td><td><b>${money(p.price, p.currency)}</b></td><td>${pct(p.commission)}</td><td><b>${money(p.earningsPerSale, p.currency)}</b></td><td>${pct(p.conversionRate)}</td><td>${pct(p.cancelRate)}</td></tr>`;
    const pick = (label, p) => `<li><b>${label}:</b> <a href="../reviews/${p.slug}.html">${esc(p.label)}</a> — ${money(p.earningsPerSale, p.currency)}/sale, ${pct(p.commission)} comm, ${money(p.price, p.currency)}</li>`;
    const cheaper = (A.price || 1e9) <= (B.price || 1e9) ? A : B;
    const biggerEps = (A.earningsPerSale || 0) >= (B.earningsPerSale || 0) ? A : B;
    const betterConv = (A.conversionRate || 0) >= (B.conversionRate || 0) ? A : B;
    const lowerCancel = (A.cancelRate || 99) <= (B.cancelRate || 99) ? A : B;
    const body = `<article class="review">
<h1>${esc(A.label)} vs ${esc(B.label)}: which one fits you?</h1>
<p class="sub">Head-to-head · official marketplace data of ${UPDATED} · Part of the <a href="top-20-highest-earning-digistore24-products.html">top-earnings series</a></p>
<div class="notice"><b>How this comparison was built:</b> both offers are same-category listings among the platform's top earners — a like-for-like pairing. Every number below is vendor-reported marketplace data (snapshot ${UPDATED}) — a comparison of listings, not a hands-on test of either product.</div>
<div class="tldr"><b>At a glance:</b>
<ul>
<li><b>${esc(A.label)}</b>: ${money(A.price, A.currency)}, ${pct(A.commission)} commission, ${money(A.earningsPerSale, A.currency)}/sale.</li>
<li><b>${esc(B.label)}</b>: ${money(B.price, B.currency)}, ${pct(B.commission)} commission, ${money(B.earningsPerSale, B.currency)}/sale.</li>
<li>Cheaper: ${esc((A.price || 1e9) <= (B.price || 1e9) ? A.label : B.label)} · Higher earnings/sale: ${esc(biggerEps.label)} · Lower cancel rate: ${esc(lowerCancel.label)}.</li>
</ul>
</div>
<h2>Side by side</h2>
<table class="specs">
<tr><th>Product</th><th>Type</th><th>Price</th><th>Commission</th><th>Earn./sale</th><th>Cart conv.*</th><th>Cancel*</th></tr>
${row(A, true)}
${row(B)}
</table>
<p class="sub">* Cart conversion and cancel rate are vendor-side marketplace statistics and depend on traffic quality — not a forecast of your results.</p>
<h2>The numbers, one by one</h2>
<ul>
${pick("Cheaper entry", cheaper)}
${pick("Higher earnings/sale", biggerEps)}
${pick("Lower cancel rate", lowerCancel)}
${pick("Better cart conversion", betterConv)}
</ul>
<h2>Fit beats numbers</h2>
<p>Both are high-ticket listings — the right choice depends on your audience and promotion style, not on a single metric. Read both full profiles (linked above), check each vendor's sales page for current guarantees, and note that cancel rates reflect the vendor's overall traffic, not yours.</p>
<p>Deep-dive alternatives: <a href="../alternatives/${A.slug}.html">alternatives to ${esc(A.label)}</a> · <a href="../alternatives/${B.slug}.html">alternatives to ${esc(B.label)}</a></p>
</article>`;
    fs.writeFileSync(path.join(ROOT, "blog", slugName), layout({ title: `${t22(A.label)} vs ${t22(B.label)}: which fits you?`, desc: `${A.label} (${money(A.price, A.currency)}) vs ${B.label} (${money(B.price, B.currency)}): price, commission, conversion and cancel rate compared on official marketplace data.`, body, rel: "..", file: slugName }));
    built++;
  }
  console.log("head-to-head:", built, "articles" + (pruned ? ", " + pruned + " stale pruned" : ""));
}

// ---------- blog index ----------
function blogIndex() {
  const files = [
    ["top-20-highest-earning-digistore24-products.html", "The 20 highest-earning Digistore24 products (by the numbers)", `All ${DATA.total} English offers ranked by official earnings-per-sale. Auto-refreshed.`],
    ["digistore24-numbers-checklist.html", "Before you buy (or promote): a 6-point numbers check", "The method behind every profile on this site — usable on any offer you're evaluating."],
  ];
  const majors = DATA.categories.filter((c) => c.count >= 5).sort((a, b) => b.count - a.count).map((c) => c.label);
  for (const label of majors) {
    const cat = DATA.categories.find((c) => c.label === label);
    if (!cat) continue;
    const n = products.filter((p) => (p.categoryIds || []).includes(String(cat.catId))).length;
    if (n) files.push([`guide-${slug(label)}.html`, `${label} on Digistore24: the data guide`, `${n} offers analyzed: price/commission spreads, top offers, freshness.`]);
  }
  const body = `
<h1>Blog</h1>
<p class="sub">Data-driven guides to the Digistore24 marketplace. Every figure comes from the official marketplace record; every page shows its refresh date.</p>
<h2>Best-of picks (computed from marketplace data)</h2>
<ul style="line-height:2.1;max-width:760px">
${DATA.categories.filter((c) => c.count >= 8).sort((a, b) => b.count - a.count).slice(0, 10).map((c) => `<li><a href="../best-of/best-${c.file}.html"><b>Best ${esc(c.label)} products on Digistore24</b></a><br><span class="sub">${c.count} offers analyzed, picks computed from official statistics.</span></li>`).join("\n")}
</ul>
<h2>Guides &amp; rankings</h2>
<ul style="line-height:2.1;max-width:760px">
${files.map(([f, t, d]) => `<li><a href="${f}"><b>${esc(t)}</b></a><br><span class="sub">${esc(d)}</span></li>`).join("\n")}
</ul>
<h2>Head-to-head comparisons</h2>
<ul style="line-height:2.1;max-width:760px">
${fs.readdirSync(path.join(ROOT, "blog")).filter((vf) => vf.startsWith("vs-") && vf.endsWith(".html")).map((vf) => {
  const vh = fs.readFileSync(path.join(ROOT, "blog", vf), "utf8");
  const vt = (vh.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || vf;
  return `<li><a href="${vf}"><b>${esc(vt)}</b></a></li>`;
}).join("\n")}
</ul>`;
  fs.writeFileSync(path.join(ROOT, "blog", "index.html"), layout({ title: `Blog — ${SITE_NAME}`, desc: "Data-driven guides to Digistore24 products and marketplace statistics.", body, rel: "..", file: "index.html" }));
}

fs.mkdirSync(path.join(ROOT, "blog"), { recursive: true });
top20();
categoryGuides();
headToHead();
checklist();
blogIndex();
console.log("blog built: " + fs.readdirSync(path.join(ROOT, "blog")).length + " pages");
