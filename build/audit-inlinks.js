#!/usr/bin/env node
/** audit-inlinks.js — 内链审计:统计每页被站内链接引用次数,找孤儿/低内链页 */
const fs = require("fs");
const path = require("path");

const SITES = [
  { lang: "en", root: "G:/Digistore24/site", dirs: [".", "category", "reviews", "alternatives", "best-of", "blog", "vendors", "vendors", "vendors", "vendors", "vendors", "vendors"] },
  { lang: "de", root: "G:/Digistore24/site-de", dirs: [".", "kategorie", "produkte", "alternativen", "empfehlungen", "blog", "hersteller", "hersteller", "hersteller", "hersteller", "hersteller", "hersteller"] },
];

for (const S of SITES) {
  const files = [];
  for (const d of S.dirs) {
    const p = path.join(S.root, d);
    if (!fs.existsSync(p)) continue;
    for (const f of fs.readdirSync(p)) if (f.endsWith(".html")) files.push(d === "." ? f : d + "/" + f);
  }
  const inl = new Map(files.map((f) => [f, 0]));
  for (const f of files) {
    const html = fs.readFileSync(path.join(S.root, f), "utf8");
    const base = path.posix.dirname(f);
    for (const m of html.matchAll(/href="([^"#?]*\.html)(?:[?#][^"]*)?"/g)) {
      let l = m[1];
      if (/^https?:|^mailto:|^#/.test(l)) continue;
      const r = path.posix.normalize(path.posix.join(base === "." ? "" : base, l)).replace(/\\/g, "/");
      if (r.startsWith("../") || !inl.has(r)) continue;
      inl.set(r, (inl.get(r) || 0) + 1);
    }
  }
  // 豁免:合法少内链页(法务/验证/changelog类入sitemap即可)
  const orphans = [...inl.entries()]
    .filter(([f, n]) => n < 3 && !/^(impressum|datenschutz|about|404|google)/.test(f.split("/").pop()))
    .sort((a, b) => a[1] - b[1]);
  const dist = { "0": 0, "1-2": 0, "3-9": 0, "10+": 0 };
  for (const [, n] of inl) {
    if (n === 0) dist["0"]++; else if (n <= 2) dist["1-2"]++; else if (n <= 9) dist["3-9"]++; else dist["10+"]++;
  }
  console.log(`=== ${S.lang.toUpperCase()} (${files.length} 页) ===`);
  console.log(`  内链分布: 0条=${dist["0"]} | 1-2条=${dist["1-2"]} | 3-9条=${dist["3-9"]} | 10+条=${dist["10+"]}`);
  console.log(`  孤儿/低内链(<3且非豁免): ${orphans.length}`);
  orphans.slice(0, 8).forEach(([f, n]) => console.log(`   [${n}] ${f}`));
  const zero = orphans.filter(([f, n]) => n === 0);
  if (zero.length) {
    const out = zero.map(([f]) => f);
    fs.writeFileSync(`G:/Digistore24/data/_orphan-${S.lang}.json`, JSON.stringify(out, null, 1));
    console.log(`  0内链清单 → data/_orphan-${S.lang}.json`);
  }
}
