#!/usr/bin/env node
/** fix-scorer-regex.js — 修复被 bash 吃掉反斜杠的评分器正则 */
const fs = require("fs");
const BS = String.fromCharCode(92);
for (const f of ["G:/Digistore24/site/build/audit-credibility.js", "G:/Digistore24/site-de/build/audit-credibility.js"]) {
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(
    "const type = /(^|/)index." + "html$/.test(file)",
    "const type = /(^|/)" + "index" + BS + ".html$/.test(file)"
  );
  s = s.replace(
    "if (type === \"category\" && /-p[0-9]+." + "html$/.test(file))",
    "if (type === \"category\" && /-p[0-9]+" + BS + ".html$/.test(file))"
  );
  fs.writeFileSync(f, s);
  console.log(f, "fixed");
}
