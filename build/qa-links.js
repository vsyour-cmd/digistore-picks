#!/usr/bin/env node
/** qa-links.js — 双站 QA:内部死链 + 中文字符泄漏 + 模板${}泄漏 + sitemap 覆盖(本地全量) */
const fs = require("fs");
const path = require("path");

function collect(root, dirs) {
  const files = [];
  for (const d of dirs) {
    const p = path.join(root, d);
    if (!fs.existsSync(p)) continue;
    for (const f of fs.readdirSync(p)) {
      if (f.endsWith(".html")) files.push(d === "." ? f : d + "/" + f);
    }
  }
  return files;
}

function qaSite(root, label, dirs) {
  const files = collect(root, dirs);
  const exists = new Set(files);
  const cjk = [];
  const dead = [];
  const titleLong = [];
  const structural = [];
  const leaks = [];
  let cjkChecked = 0;
  for (const file of files) {
    if (file === "404.html" || /^google[0-9a-f]+.html$/.test(file) || /^[0-9a-f]{32}.txt$/.test(file)) continue; // 豁免:404/验证文件
    const html = fs.readFileSync(path.join(root, file), "utf8");
    if (cjkChecked < 200) {
      const m = html.match(/[\u4e00-\u9fff]+/g);
      if (m) cjk.push(`${file}: ${m.slice(0, 3).join(",")}`);
      cjkChecked++;
    }
    // 标题长度门禁: >70 字符会被 SERP 截断
    const raw = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
    const t = raw.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/g, "x");
    if (t.length > 70) titleLong.push(`${file}: ${t.length}ch — ${t.slice(0, 50)}`);
    // 结构体检:描述/canonical/H1/alt/JSON-LD
    const hasDesc = /<meta name="description" content="[^"]{10,}/.test(html);
    const hasCanon = /rel="canonical"/.test(html);
    const h1Count = (html.match(/<h1[ >]/g) || []).length;
    const imgNoAlt = (html.match(new RegExp("<img(?![^>]*alt=)[^>]*>", "g")) || []).length;
    let ldFail = 0;
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch { ldFail++; }
    }
    if (!hasDesc) structural.push(file + ": meta description missing");
    if (!hasCanon) structural.push(file + ": canonical missing");
    if (h1Count !== 1) structural.push(file + ": h1 count = " + h1Count);
    if (imgNoAlt > 0) structural.push(file + ": " + imgNoAlt + " img without alt");
    if (ldFail > 0) structural.push(file + ": " + ldFail + " JSON-LD parse fail");
    // 模板泄漏门禁:构建产物不允许出现未插值的 ${...}
    const lm = html.match(/\$\{[^}]{1,80}\}/g);
    if (lm) leaks.push(`${file}: ${[...new Set(lm)].slice(0, 3).join(" | ")}`);
    const links = [...html.matchAll(/href="([^"]*\.html)(?:[?#][^"]*)?"/g)].map((m) => m[1]);
    const base = path.posix.dirname(file);
    for (let l of links) {
      if (/^https?:/.test(l) || l.startsWith("#") || l.startsWith("mailto:") || l.startsWith("//")) continue;
      const resolvedRaw = path.posix.normalize(path.posix.join(base === "." ? "" : base, l)).replace(/\\/g, "/");
      if (resolvedRaw.startsWith("../")) continue;
      if (exists.has(resolvedRaw)) continue;
      const tail = resolvedRaw.split("/").pop();
      if ([...exists].some((e) => e === tail || e.endsWith("/" + tail))) continue;
      dead.push(`${file} → ${l}`);
    }
  }
  return { files: files.length, cjk, dead, leaks, titleLong, structural };
}

function report(r, label) {
  console.log(`${label}: ${r.files} pages | CJK泄漏页面: ${r.cjk.length} | 死链: ${r.dead.length} | 模板泄漏: ${r.leaks.length} | 标题>70: ${r.titleLong.length}`);
  r.cjk.slice(0, 3).forEach((x) => console.log(`  ${label} CJK`, x));
  r.dead.slice(0, 5).forEach((x) => console.log(`  ${label} DEAD`, x));
  r.leaks.slice(0, 3).forEach((x) => console.log(`  ${label} LEAK`, x));
  r.titleLong.slice(0, 3).forEach((x) => console.log(`  ${label} TITLE>70`, x));
  r.structural.slice(0, 5).forEach((x) => console.log(`  ${label} STRUCT`, x));
}

const en = qaSite("G:/Digistore24/site", "EN", [".", "category", "reviews", "alternatives", "best-of", "blog", "vendors", "vendors", "vendors", "vendors", "vendors", "vendors"]);
const de = qaSite("G:/Digistore24/site-de", "DE", [".", "kategorie", "produkte", "alternativen", "empfehlungen", "blog", "hersteller", "hersteller", "hersteller", "hersteller", "hersteller", "hersteller"]);
report(en, "EN");
report(de, "DE");

// sitemap 覆盖检查
for (const [root, sm, dirs] of [
  ["G:/Digistore24/site", "sitemap.xml", [".", "category", "reviews", "alternatives", "best-of", "blog"]],
  ["G:/Digistore24/site-de", "sitemap.xml", [".", "kategorie", "produkte", "alternativen", "empfehlungen", "blog"]],
]) {
  const smContent = fs.readFileSync(path.join(root, sm), "utf8");
  const smUrls = new Set([...smContent.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https:\/\/vsyour-cmd\.github\.io\/digistore-picks(-de)?\//, "")));
  const files = collect(root, dirs);
  const notInSitemap = files.filter((f) => !smUrls.has(f) && !smUrls.has("") && f !== "404.html" && !/^google[0-9a-f]+.html$/.test(f) && !/^[0-9a-f]{32}\.txt$/.test(f));
  console.log(`${path.basename(root)}: sitemap ${smUrls.size} 条 | 应入未入: ${notInSitemap.length}`);
  notInSitemap.slice(0, 3).forEach((x) => console.log("  未入:", x));
}

// DE "correction" 残留检查
if (fs.existsSync("G:/Digistore24/site-de/blog/guide-gesundheit-fitness.html")) {
  const deIndex = fs.readFileSync("G:/Digistore24/site-de/blog/guide-gesundheit-fitness.html", "utf8");
  console.log("DE correction残留:", deIndex.includes("correction:") ? "有!" : "无");
}
