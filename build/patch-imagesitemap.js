#!/usr/bin/env node
/** patch-imagesitemap.js — sitemap 加 image:image 扩展(有本地图的产品页) */
const fs = require("fs");
for (const [f, dirName, imgDir] of [
  ["G:/Digistore24/site/build/build-extras.js", "reviews", "G:/Digistore24/site/assets/products"],
  ["G:/Digistore24/site-de/build/build-extras.js", "produkte", "G:/Digistore24/site-de/assets/products"],
]) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("image:image")) { console.log(f, "already"); continue; }
  // 渲染段:支持 image 字段
  s = s.replace(
    `${"${"}urls.map((u) => `  <url>\n    <loc>${"${"}u.loc}</loc>\n    <lastmod>${"${"}u.lastmod}</lastmod>\n  </url>`).join("\n")}`,
    `${"${"}urls.map((u) => `  <url>\n    <loc>${"${"}u.loc}</loc>\n    <lastmod>${"${"}u.lastmod}</lastmod>${"${"}u.image ? `\n    <image:image>\n      <image:loc>${"${"}u.image}</image:loc>\n    </image:image>` : ""}\n  </url>`).join("\n")}`
  );
  // 产品页 add 时附带本地图
  const addImg = `
// 本地图 manifest → 绝对 URL(图片 sitemap)
const IMG_DIR = ${JSON.stringify(imgDir)};
function localImg(id) {
  const m = path.join(IMG_DIR, id + ".img.json");
  if (fs.existsSync(m)) {
    try { const j = JSON.parse(fs.readFileSync(m, "utf8")); if (j.local) return SITE_URL + "/" + j.local; } catch {}
  }
  return null;
}
`;
  s = s.replace("const urls = [];", "const urls = [];" + addImg);
  const oldAdd = fs.readFileSync(f, "utf8").match(new RegExp("for \\(const p of DATA\\.products\\) add\\(`" + dirName + "/"));
  s = s.replace(
    "for (const p of DATA.products) add(`" + dirName + "/${slug(p.label)}-${p.id}.html`, DATA_DATE);",
    "for (const p of DATA.products) {\n  const img = localImg(p.id);\n  add(`" + dirName + "/${slug(p.label)}-${p.id}.html`, DATA_DATE, img);\n}"
  );
  // add 签名支持 image
  s = s.replace(
    "const add = (u, date) => { if (seen.has(u)) return; seen.add(u); urls.push({ loc: SITE_URL + \"/\" + u, lastmod: date || TODAY }); };",
    "const add = (u, date, image) => { if (seen.has(u)) return; seen.add(u); urls.push({ loc: SITE_URL + \"/\" + u, lastmod: date || TODAY, image }); };"
  );
  fs.writeFileSync(f, s);
  console.log(f, "patched");
}
