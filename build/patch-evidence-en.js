#!/usr/bin/env node
/** patch-evidence-en.js — EN: 证据盒/FAQ来源标注/首页TL;DR */
const fs = require("fs");
const f = "G:/Digistore24/site/build/build-site.js";
let s = fs.readFileSync(f, "utf8");

// 1) evidenceBox 函数
if (!s.includes("function evidenceBox")) {
  const fn = [
    "// 证据与验证条件:每类结论 → 来源 → 日期 → 读者自查路径",
    "function evidenceBox(p) {",
    "  const res = p.research && !p.research.error;",
    "  const srcPage = res ? (p.research.finalUrl || p.salesPageUrl) : p.salesPageUrl;",
    "  const method = res && p.research.method === \"browser-render\" ? \"browser-rendered\" : \"raw HTML\";",
    "  return `<div class=\"tldr\"><b>Evidence base & verification conditions</b>",
    "<ul>",
    "<li><b>Marketplace figures</b> (price, commission, conversion, cancel rate) — source: official Digistore24 marketplace API, affiliate view, snapshot <b>${datemark(DATA.scrapedAt)}</b>. Re-check: marketplace search for product ID ${p.productId}.</li>",
    "<li><b>Sales-page quotes & headline</b> — source: ${esc(srcPage || \"official sales page\")}, fetched <b>${datemark(DATA.researchedAt) || \"—\"}</b> (method: ${method}). Verify: open the official page.</li>",
    "<li><b>Guarantee / refund</b> — set by the vendor; confirm on the sales page at purchase time.</li>",
    "<li><b>Not verified by us:</b> product quality, outcomes, testimonials — no hands-on test has been performed for this listing.</li>",
    "</ul></div>`;",
    "}",
    "",
  ].join("\n");
  s = s.replace("function faqData(p, altData) {", fn + "\nfunction faqData(p, altData) {");
  s = s.replace("${cautionSection(p)}\n\n${faqBlock}", "${cautionSection(p)}\n\n${evidenceBox(p)}\n\n${faqBlock}");
}

// 2) FAQ 来源标注
if (!s.includes("Answers compiled from the marketplace snapshot")) {
  s = s.replace(
    'return `<h2 id="faq">Frequently asked questions about ${esc(p.label)}</h2>',
    'return `<h2 id="faq">Frequently asked questions about ${esc(p.label)}</h2>\n<p class="sub">Answers compiled from the marketplace snapshot (${datemark(DATA.scrapedAt)}) and vendor sales-page research (${datemark(DATA.researchedAt) || "—"}); vendor claims are labeled inline.</p>'
  );
}

// 3) 首页 TL;DR
if (!s.includes("At a glance</b> (data of")) {
  s = s.replace(
    "<h2>Top products by affiliate earnings per sale</h2>",
    `<div class="tldr"><b>At a glance</b> (data of ${"${datemark(DATA.scrapedAt)}"}):
<ul>
<li>${"${DATA.total}"} English-language Digistore24 offers tracked across ${"${DATA.categories.length}"} categories.</li>
<li>Every page labels its evidence: official marketplace stats vs vendor sales-page claims.</li>
<li>New here? Start with the top list below or the <a href="blog/digistore24-numbers-checklist.html">6-point evaluation method</a>.</li>
</ul></div>
<h2>Top products by affiliate earnings per sale</h2>`
  );
}

fs.writeFileSync(f, s);
console.log("EN:", {
  evidenceBox: s.includes("function evidenceBox"),
  evidenceCall: s.includes("${evidenceBox(p)}"),
  faqNote: s.includes("Answers compiled from the marketplace snapshot"),
  homeTldr: s.includes("At a glance</b> (data of"),
});
