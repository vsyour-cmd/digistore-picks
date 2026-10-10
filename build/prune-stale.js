#!/usr/bin/env node
/** prune-stale.js — 清理过期生成文件。
 *  背景:build-site/gen-md 只写不删——产品下架、分类分页缩编、厂商掉出 Top40、
 *  alternatives 掉出 Top200 后,旧 HTML/MD 残留为"幽灵页"(不在 sitemap、无内链、数据过期)。
 *  判定规则:
 *  1) 生成目录内 mtime 早于本次构建锚点(index/changelog/404 最小 mtime − 60s 容差)的 HTML;
 *  2) content/products/ 中产品 ID 不在当前数据集的 MD。
 *  用法: node build/prune-stale.js [--dry]
 */
const fs = require("fs");
const path = require("path");
const dry = process.argv.includes("--dry");

const SITES = [
  { root: "G:/Digistore24/site", anchor: ["index.html", "changelog.html", "404.html"], dirs: ["reviews", "alternatives", "best-of", "vendors", "category"], md: "content/products", ds: "data/dataset.json" },
  { root: "G:/Digistore24/site-de", anchor: ["index.html", "changelog.html", "404.html"], dirs: ["produkte", "alternativen", "empfehlungen", "hersteller", "kategorie"], md: "content/products", ds: "data/dataset.json" },
];

// blog/ 与根目录手写文件不参与清理;MD 按数据集 ID 成员资格判定,更精确
let removed = 0;
for (const S of SITES) {
  const anchor = Math.min(...S.anchor.map((a) => fs.statSync(path.join(S.root, a)).mtimeMs)) - 60000;
  const stale = [];
  for (const d of S.dirs) {
    const p = path.join(S.root, d);
    if (!fs.existsSync(p)) continue;
    for (const f of fs.readdirSync(p)) {
      if (!f.endsWith(".html")) continue;
      const fp = path.join(p, f);
      if (fs.statSync(fp).mtimeMs < anchor) stale.push(fp);
    }
  }
  const ids = new Set(JSON.parse(fs.readFileSync(path.join(S.root, S.ds), "utf8")).products.map((x) => String(x.id)));
  const mdp = path.join(S.root, S.md);
  for (const f of fs.readdirSync(mdp)) {
    const m = f.match(/^(\d+)-/);
    if (m && !ids.has(m[1])) stale.push(path.join(mdp, f));
  }
  for (const fp of stale) {
    console.log((dry ? "[dry] " : "") + "prune: " + fp);
    if (!dry) fs.unlinkSync(fp);
  }
  removed += stale.length;
  console.log(`${path.basename(S.root)}: ${stale.length} stale files${dry ? " (dry-run)" : ""}`);
}
console.log(dry ? `dry-run: ${removed} files would be removed` : `removed ${removed} stale files`);
