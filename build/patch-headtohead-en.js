#!/usr/bin/env node
/** patch-headtohead-en.js — Top20 相邻两两 head-to-head 对比文(10篇,blog/vs-*.html) */
const fs = require("fs");
const f = "G:/Digistore24/site/build/build-blog.js";
let s = fs.readFileSync(f, "utf8");
if (s.includes("function headToHead")) { console.log("already"); process.exit(0); }

const fn = [
  "// ---------- Head-to-head: Top20 相邻两两对比 ----------",
  "function headToHead() {",
  "  const top = [...products].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)).slice(0, 20);",
  "  fs.mkdirSync(path.join(ROOT, \"blog\"), { recursive: true });",
  "  let built = 0;",
  "  for (let i = 0; i + 1 < top.length; i += 2) {",
  "    const A = top[i], B = top[i + 1];",
  "    const slugName = \"vs-\" + slug(A.label) + \"-vs-\" + slug(B.label) + \".html\";",
  "    const row = (p, self) => `<tr${self ? ' class=\"self\"' : \"\"}><td>${self ? `<b>${esc(p.label)}</b>` : `<a href=\"../reviews/${p.slug}.html\">${esc(p.label)}</a>`}</td><td>${esc(p.type)}</td><td><b>${money(p.price, p.currency)}</b></td><td>${pct(p.commission)}</td><td><b>${money(p.earningsPerSale, p.currency)}</b></td><td>${pct(p.conversionRate)}</td><td>${pct(p.cancelRate)}</td></tr>`;",
  "    const pick = (label, p) => `<li><b>${label}:</b> <a href=\"../reviews/${p.slug}.html\">${esc(p.label)}</a> — ${money(p.earningsPerSale, p.currency)}/sale, ${pct(p.commission)} comm, ${money(p.price, p.currency)}</li>`;",
  "    const cheaper = (A.price || 1e9) <= (B.price || 1e9) ? A : B;",
  "    const biggerEps = (A.earningsPerSale || 0) >= (B.earningsPerSale || 0) ? A : B;",
  "    const betterConv = (A.conversionRate || 0) >= (B.conversionRate || 0) ? A : B;",
  "    const lowerCancel = (A.cancelRate || 99) <= (B.cancelRate || 99) ? A : B;",
  "    const body = `<article class=\"review\">",
  "<h1>${esc(A.label)} vs ${esc(B.label)}: which one fits you?</h1>",
  "<p class=\"sub\">Head-to-head · official marketplace data of ${UPDATED} · Part of the <a href=\"top-20-hoechster-verdienst-digistore24-produkte.html\">top-earnings series</a></p>",
  "<div class=\"notice\"><b>How this comparison was built:</b> both offers sit next to each other in the top-earnings ranking. Every number below is vendor-reported marketplace data (snapshot ${UPDATED}) — a comparison of listings, not a hands-on test of either product.</div>",
  "<div class=\"tldr\"><b>At a glance:</b>",
  "<ul>",
  "<li><b>${esc(A.label)}</b>: ${money(A.price, A.currency)}, ${pct(A.commission)} commission, ${money(A.earningsPerSale, A.currency)}/sale.</li>",
  "<li><b>${esc(B.label)}</b>: ${money(B.price, B.currency)}, ${pct(B.commission)} commission, ${money(B.earningsPerSale, B.currency)}/sale.</li>",
  "<li>Cheaper: ${esc((A.price || 1e9) <= (B.price || 1e9) ? A.label : B.label)} · Higher earnings/sale: ${esc(biggerEps.label)} · Lower cancel rate: ${esc(lowerCancel.label)}.</li>",
  "</ul>",
  "</div>",
  "<h2>Side by side</h2>",
  "<table class=\"specs\">",
  "<tr><th>Product</th><th>Type</th><th>Price</th><th>Commission</th><th>Earn./sale</th><th>Cart conv.*</th><th>Cancel*</th></tr>",
  "${row(A, true)}",
  "${row(B)}",
  "</table>",
  "<p class=\"sub\">* Cart conversion and cancel rate are vendor-side marketplace statistics and depend on traffic quality — not a forecast of your results.</p>",
  "<h2>The numbers, one by one</h2>",
  "<ul>",
  "${pick(\"Cheaper entry\", cheaper)}",
  "${pick(\"Higher earnings/sale\", biggerEps)}",
  "${pick(\"Lower cancel rate\", lowerCancel)}",
  "${pick(\"Better cart conversion\", betterConv)}",
  "</ul>",
  "<h2>Fit beats numbers</h2>",
  "<p>Both are high-ticket listings — the right choice depends on your audience and promotion style, not on a single metric. Read both full profiles (linked above), check each vendor's sales page for current guarantees, and note that cancel rates reflect the vendor's overall traffic, not yours.</p>",
  "<p>Deep-dive alternatives: <a href=\"../alternatives/${A.slug}.html\">alternatives to ${esc(A.label)}</a> · <a href=\"../alternatives/${B.slug}.html\">alternatives to ${esc(B.label)}</a></p>",
  "</article>`;",
  "    fs.writeFileSync(path.join(ROOT, \"blog\", slugName), layout({ title: `${esc(A.label)} vs ${esc(B.label)} — which fits you? — ${SITE_NAME}`, desc: `${A.label} (${money(A.price, A.currency)}) vs ${B.label} (${money(B.price, B.currency)}): price, commission, conversion and cancel rate compared on official marketplace data.`, body, rel: \"..\", file: slugName }));",
  "    built++;",
  "  }",
  "  console.log(\"head-to-head:\", built, \"articles\");",
  "}",
  "",
].join("\n");

// 注入调用 + blogIndex vs 区块
s = s.replace("categoryGuides();", "categoryGuides();\nheadToHead();");
if (!s.includes("Head-to-head comparisons")) {
  s = s.replace(
    "<h2>Guides &amp; Ranglisten</h2>".replace("&amp;", "&"),
    "<h2>Head-to-head comparisons</h2>\n<ul style=\"line-height:2.1;max-width:760px\">\n" + "${top.slice(0, 20).filter((_, i) => i % 2 === 0).map((A, k) => { const B = top[k * 2 + 1]; if (!B) return \"\"; const sf = \"vs-\" + slug(A.label) + \"-vs-\" + slug(B.label) + \".html\"; return `<li><a href=\"${sf}\"><b>${esc(A.label)} vs ${esc(B.label)}</b></a><br><span class=\"sub\">Top-$(k * 2 + 1) vs Top-$(k * 2 + 2) by earnings/sale.</span></li>`; }).filter(Boolean).join(\"\\n\")}\n</ul>\n<h2>Guides &amp; Ranglisten</h2>".replace("$(k * 2 + 1)", "${k * 2 + 1}").replace("$(k * 2 + 2)", "${k * 2 + 2}")
  );
}
fs.writeFileSync(f, s);
console.log("headToHead wired:", s.includes("function headToHead"), "| index section:", s.includes("Head-to-head comparisons"));
