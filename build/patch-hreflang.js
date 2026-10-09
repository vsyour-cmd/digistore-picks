#!/usr/bin/env node
/** patch-hreflang.js — 首页/分类页注入真实等价的 hreflang(home↔home, category↔category by catId) */
const fs = require("fs");

function enPatch() {
  const f = "G:/Digistore24/site/build/build-site.js";
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("const HREF_HOME")) { console.log("EN already"); return; }
  const BT = "`";
  const helper = [
    "const HREF_HOME = '<link rel=\"alternate\" hreflang=\"de\" href=\"https://vsyour-cmd.github.io/digistore-picks-de/\"><link rel=\"alternate\" hreflang=\"en\" href=\"https://vsyour-cmd.github.io/digistore-picks/\">';",
    "function deCatHref(catId) {",
    "  if (!DE_DATA) return null;",
    "  const c2 = DE_DATA.categories.find((c) => String(c.catId) === String(catId));",
    "  if (!c2) return null;",
    "  const cnt = {};",
    "  for (const c of DE_DATA.categories) { const b = slug(c.label); cnt[b] = (cnt[b] || 0) + 1; }",
    "  const file2 = cnt[slug(c2.label)] > 1 ? slug(c2.section) + \"-\" + slug(c2.label) : slug(c2.label);",
    `  return '<link rel="alternate" hreflang="de" href="https://vsyour-cmd.github.io/digistore-picks-de/kategorie/' + file2 + '.html"><link rel="alternate" hreflang="en" href="https://vsyour-cmd.github.io/digistore-picks/kategorie/' + c.file + '.html>';`,
    "}",
    "",
  ].join("\n");
  s = s.replace("// ---------- 首页 ----------", helper + "// ---------- 首页 ----------");
  s = s.replace(
    `  fs.writeFileSync(outPath("index.html"), layout({\n    title:`,
    `  fs.writeFileSync(outPath("index.html"), layout({\n    hreflangLinks: HREF_HOME,\n    title:`
  );
  s = s.replace(
    "      body, rel: \"..\", path: `kategorie/${file}`, jsonLd,",
    "      body, rel: \"..\", path: `kategorie/${file}`, jsonLd, hreflangLinks: deCatHref(c.catId) || \"\","
  );
  fs.writeFileSync(f, s);
  console.log("EN wired:", s.includes("deCatHref(c.catId)"), s.includes("hreflangLinks: HREF_HOME"));
}

function dePatch() {
  const f = "G:/Digistore24/site-de/build/build-site.js";
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("const HREF_HOME")) { console.log("DE already"); return; }
  const helper = [
    "const HREF_HOME = '<link rel=\"alternate\" hreflang=\"en\" href=\"https://vsyour-cmd.github.io/digistore-picks/\"><link rel=\"alternate\" hreflang=\"de\" href=\"https://vsyour-cmd.github.io/digistore-picks-de/\">';",
    "function enCatHref(catId) {",
    "  if (!EN_DATA) return null;",
    "  const c2 = EN_DATA.categories.find((c) => String(c.catId) === String(catId));",
    "  if (!c2) return null;",
    "  const cnt = {};",
    "  for (const c of EN_DATA.categories) { const b = slug(c.label); cnt[b] = (cnt[b] || 0) + 1; }",
    "  const file2 = cnt[slug(c2.label)] > 1 ? slug(c2.section) + \"-\" + slug(c2.label) : slug(c2.label);",
    `  return '<link rel="alternate" hreflang="en" href="https://vsyour-cmd.github.io/digistore-picks/kategorie/' + file2 + '.html"><link rel="alternate" hreflang="de" href="https://vsyour-cmd.github.io/digistore-picks-de/kategorie/' + c.file + '.html>';`,
    "}",
    "",
  ].join("\n");
  s = s.replace("// ---------- Startseite ----------", helper + "// ---------- Startseite ----------");
  s = s.replace(
    `  fs.writeFileSync(outPath("index.html"), layout({\n    title:`,
    `  fs.writeFileSync(outPath("index.html"), layout({\n    hreflangLinks: HREF_HOME,\n    title:`
  );
  s = s.replace(
    "      body, rel: \"..\", path: `kategorie/${file}`, jsonLd,",
    "      body, rel: \"..\", path: `kategorie/${file}`, jsonLd, hreflangLinks: enCatHref(c.catId) || \"\","
  );
  fs.writeFileSync(f, s);
  console.log("DE wired:", s.includes("enCatHref(c.catId)"), s.includes("hreflangLinks: HREF_HOME"));
}

enPatch();
dePatch();
