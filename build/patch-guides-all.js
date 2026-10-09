#!/usr/bin/env node
/** patch-guides-all.js — 指南扩展至全部分类(count≥5,双站) */
const fs = require("fs");
for (const f of ["G:/Digistore24/site/build/build-blog.js", "G:/Digistore24/site-de/build/build-blog.js"]) {
  let s = fs.readFileSync(f, "utf8");
  const isEn = f.includes("site/");
  // 两处 majors 数组 → 动态(本语言 count≥5 的分类,按产品数降序)
  const dynamic = isEn
    ? "const majors = DATA.categories.filter((c) => c.count >= 5).sort((a, b) => b.count - a.count).map((c) => c.label);"
    : "const majors = DATA.categories.filter((c) => c.count >= 5).sort((a, b) => b.count - a.count).map((c) => c.label);";
  // 数组可能跨多行?此处为单行——按行替换
  const lines = s.split("\n");
  let replaced = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("const majors = [")) {
      lines[i] = "  " + dynamic;
      replaced++;
    }
  }
  s = lines.join("\n");
  fs.writeFileSync(f, s);
  console.log(f, "majors replaced:", replaced);
}
