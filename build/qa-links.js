#!/usr/bin/env node
/** qa-links.js — 双站 QA:内部死链 + 中文字符泄漏 + sitemap 覆盖检查(本地全量) */
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
  let cjkChecked = 0;
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    if (cjkChecked < 200) {
      const m = html.match(/[\u4e00-\u9fff]+/g);
      if (m) cjk.push(`${file}: ${m.slice(0, 3).join(",")}`);
      cjkChecked++;
    }
    const links = [...html.matchAll(/href="([^"]*\.html)(?:[?#][^"]*)?"/g)].map((m) => m[1]);
    const base = path.posix.dirname(file);
    for (let l of links) {
      if (/^https?:/.test(l) || l.startsWith("#") || l.startsWith("mailto:") || l.startsWith("//")) continue;
      const resolvedRaw = path.posix.normalize(path.posix.join(base === "." ? "" : base, l)).replace(/\\/g, "/");
      if (resolvedRaw.startsWith("../")) continue;
      if (exists.has(resolvedRaw)) continue;
      // 容错:同文件名存在任意子目录(构建目录语义等价)
      const tail = resolvedRaw.split("/").pop();
      if ([...exists].some((e) => e === tail || e.endsWith("/" + tail))) continue;
      dead.push(`${file} → ${l}`);
    }
  }
  return { files: files.length, cjk, dead };
}

const en = qaSite("G:/Digistore24/site", "EN", [".", "category", "reviews", "alternatives", "best-of", "blog"]);
const de = qaSite("G:/Digistore24/site-de", "DE", [".", "kategorie", "produkte", "alternativen", "empfehlungen", "blog"]);

console.log(`EN: ${en.files} pages | CJK泄漏页面: ${en.cjk.length} | 死链: ${en.dead.length}`);
en.cjk.slice(0, 5).forEach((x) => console.log("  CJK", x));
en.dead.slice(0, 8).forEach((x) => console.log("  DEAD", x));

console.log(`DE: ${de.files} pages | CJK泄漏页面: ${de.cjk.length} | 死链: ${de.dead.length}`);
de.cjk.slice(0, 5).forEach((x) => console.log("  CJK", x));
de.dead.slice(0, 8).forEach((x) => console.log("  DEAD", x));

// sitemap 覆盖检查
for (const [root, sm, dirs] of [
  ["G:/Digistore24/site", "sitemap.xml", [".", "category", "reviews", "alternatives", "best-of", "blog"]],
  ["G:/Digistore24/site-de", "sitemap.xml", [".", "kategorie", "produkte", "alternativen", "empfehlungen", "blog"]],
]) {
  const smContent = fs.readFileSync(path.join(root, sm), "utf8");
  const smUrls = new Set([...smContent.matchAll(/<loc>[^<]+\/([^<]+)<\/loc>/g)].map((m) => m[1]));
  const files = collect(root, dirs);
  const notInSitemap = files.filter((f) => !smUrls.has(f));
  const smMissing = [...smUrls].filter((u) => !existsFile(root, u));
  console.log(`${path.basename(root)}: sitemap ${smUrls.size} 条 | 页面未入sitemap: ${notInSitemap.length} | sitemap指向不存在文件: ${smMissing.length}`);
  notInSitemap.slice(0, 3).forEach((x) => console.log("  未入:", x));
  smMissing.slice(0, 3).forEach((x) => console.log("  空指:", x));
}
function existsFile(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

// DE "correction" 残留检查
const deIndex = fs.readFileSync("G:/Digistore24/site-de/blog/guide-gesundheit-fitness.html", "utf8");
console.log("DE correction残留:", deIndex.includes("correction:") ? "有!" : "无");
