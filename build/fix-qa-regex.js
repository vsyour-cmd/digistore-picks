#!/usr/bin/env node
/** fix-qa-regex.js — 修复 qa-links.js 中被 shell 转义损坏的正则 */
const fs = require("fs");
const BSL = String.fromCharCode(92); // 反斜杠
for (const f of ["G:/Digistore24/site/build/qa-links.js", "G:/Digistore24/site-de/build/qa-links.js"]) {
  let s = fs.readFileSync(f, "utf8");
  // 1. 行42: 移除 backspace 字符,改为 \b
  s = s.split(BSL + "Halt=").join(BSL + "balt=");
  // 2. 行44: 重建 JSON-LD matchAll 正则
  const bad = 'html.matchAll(/<script type="application/ld+json">([sS]*?)</script>/g)';
  const good = 'html.matchAll(/<script type="application\\/' + 'ld\\+' + 'json">([\\s\\S]*?)<\\/script>/g)';
  s = s.split(bad).join(good);
  fs.writeFileSync(f, s);
  console.log(f, "fixed");
}
