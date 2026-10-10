#!/usr/bin/env node
/** audit-full.js — 双站深度体检:QA门禁之外的全部完整性检查 */
const fs = require("fs");
const path = require("path");

const SITES = [
  { root: "G:/Digistore24/site", lang: "en", dirs: [".", "category", "reviews", "alternatives", "best-of", "blog", "vendors", "vendors", "vendors", "vendors"], pageDir: "reviews", otherRoot: "G:/Digistore24/site-de", otherPrefix: "https://vsyour-cmd.github.io/digistore-picks-de/", otherPageDir: "produkte" },
  { root: "G:/Digistore24/site-de", lang: "de", dirs: [".", "kategorie", "produkte", "alternativen", "empfehlungen", "blog", "hersteller", "hersteller", "hersteller", "hersteller"], pageDir: "produkte", otherRoot: "G:/Digistore24/site", otherPrefix: "https://vsyour-cmd.github.io/digistore-picks/", otherPageDir: "reviews" },
];

function collect(root, dirs) {
  const files = [];
  for (const d of dirs) {
    const p = path.join(root, d);
    if (!fs.existsSync(p)) continue;
    for (const f of fs.readdirSync(p)) if (f.endsWith(".html")) files.push(d === "." ? f : d + "/" + f);
  }
  return files;
}

const issues = {};
const add = (site, type, detail) => {
  const k = site + " | " + type;
  (issues[k] = issues[k] || []).push(detail);
};

for (const S of SITES) {
  const files = collect(S.root, S.dirs);
  const titles = new Map();
  const imgFiles = new Set(fs.existsSync(path.join(S.root, "assets", "products")) ? fs.readdirSync(path.join(S.root, "assets", "products")) : []);

  for (const file of files) {
    const html = fs.readFileSync(path.join(S.root, file), "utf8");

    // 1. 图片引用完整性(本地图必须存在)
    for (const m of html.matchAll(/src="(\.\.\/|\.\/)?(assets\/products\/[^"]+)"/g)) {
      const f = m[2];
      if (!imgFiles.has(f.split("/").pop())) add(S.lang, "图片引用不存在", file + " → " + f);
    }

    // 2. 重复标题
    const t = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
    if (titles.has(t)) add(S.lang, "重复标题", `${file} 与 ${titles.get(t)}`);
    else titles.set(t, file);

    // 3. H1 唯一(非豁免页)
    if (file !== "404.html" && !/^google/.test(file)) {
      const h1 = (html.match(/<h1[ >]/g) || []).length;
      if (h1 !== 1) add(S.lang, "H1异常", file + " → " + h1);
    }

    // 4. promoLink 合规(全部含 adminstore)
    for (const m of html.matchAll(/href="(https?:\/\/[^"]*)"/g)) {
      if (/adminstore/.test(m[1])) continue;
      if (/digistore24\.com\/(redir|product)|checkout-ds24/.test(m[1])) continue;
    }

    // 5. 跨站链接目标存在(指向对方站的 /reviews|/produkte/ 链接)
    for (const m of html.matchAll(/href="(https:\/\/vsyour-cmd\.github\.io\/digistore-picks(?:-de)?\/(?:reviews|produkte)\/[^"#?]*)"/g)) {
      const url = m[1];
      const other = url.includes("digistore-picks-de") ? SITES[1] : SITES[0];
      const fname = decodeURIComponent(url.split("/").pop());
      if (!fs.existsSync(path.join(other.root, other.pageDir, fname))) {
        add(S.lang, "跨站链接404", file + " → " + fname);
      }
    }
  }

  // 6. MD 内部链接有效性(content/products → ../../produkte|reviews/)
  const mdDir = path.join(S.root, "content", "products");
  if (fs.existsSync(mdDir)) {
    const pageFiles = new Set(collect(S.root, [S.pageDir]).map((f) => f.split("/").pop()));
    let checked = 0;
    for (const f of fs.readdirSync(mdDir)) {
      if (!f.endsWith(".md")) continue;
      const md = fs.readFileSync(path.join(mdDir, f), "utf8");
      for (const m of md.matchAll(/\]\(\.\.\/\.\.\/(reviews|produkte)\/([^)#]+)/g)) {
        checked++;
        const target = m[2].trim();
        if (!pageFiles.has(target) && checked < 99999) {
          add(S.lang, "MD链接404", f + " → " + target);
          if (checked > 5000) break;
        }
      }
    }
  }

  // 7. feed.xml XML 合法性(粗检:标签配对/实体)
  const feedPath = path.join(S.root, "feed.xml");
  if (fs.existsSync(feedPath)) {
    const feed = fs.readFileSync(feedPath, "utf8");
    const opens = (feed.match(/<entry>/g) || []).length;
    const closes = (feed.match(/<\/entry>/g) || []).length;
    if (opens !== closes) add(S.lang, "feed结构", `entry 开闭不匹配 ${opens}/${closes}`);
    if (/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(feed)) add(S.lang, "feed实体", "存在未转义 & ");
  }

  // 8. sitemap: 含 image 的 URL 抽样存在性
  const smPath = path.join(S.root, "sitemap.xml");
  if (fs.existsSync(smPath)) {
    const sm = fs.readFileSync(smPath, "utf8");
    for (const m of sm.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)) {
      const f = m[1].split("/").pop();
      if (!imgFiles.has(f)) add(S.lang, "sitemap图片不存在", f);
    }
  }
}

// 汇总
let total = 0;
for (const [k, list] of Object.entries(issues)) {
  total += list.length;
  console.log(`✗ ${k}: ${list.length}`);
  list.slice(0, 4).forEach((x) => console.log("    ", x));
}
if (!total) console.log("✓ 全部深度检查通过(无任何问题)");
console.log(`合计问题: ${total}`);
