#!/usr/bin/env node
/**
 * fetch-images.js — 下载产品图到 site/assets/products/{id}.{ext}
 * 优先 marketplace 官方图(dataset.imageUrl),兜底销售页 og:image(research.ogImage)
 * 用法: node build/fetch-images.js [--missing]
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.join(__dirname, "..");
const DST = path.join(ROOT, "assets", "products");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const dataPath = process.env.DATASET_FILE || path.join(ROOT, "data", "dataset.json");
const DATA = JSON.parse(fs.readFileSync(dataPath, "utf8"));
fs.mkdirSync(DST, { recursive: true });

const MISSING_ONLY = process.argv.includes("--missing");
// --top N: 只处理收益前 N 的产品(控制仓库体积)
const topIdx = process.argv.indexOf("--top");
const TOP = topIdx >= 0 ? parseInt(process.argv[topIdx + 1], 10) || 0 : 0;
const extOf = (url, def = "jpg") => {
  const m = url.split("?")[0].match(/\.(png|jpe?g|gif|webp|svg)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : def;
};

function candidates(p) {
  const list = [];
  if (p.imageUrl) list.push(p.imageUrl);
  const og = p.research && p.research.ogImage;
  if (og && /^https?:/.test(og)) list.push(og);
  return list;
}

(async () => {
  let ok = 0, skip = 0, fail = 0;
  let queue = DATA.products;
  if (TOP > 0) queue = [...queue].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0)).slice(0, TOP);
  queue = queue.filter((p) => {
    if (MISSING_ONLY && fs.existsSync(path.join(DST, p.id + ".img.json"))) return false;
    return candidates(p).length > 0;
  });
  console.log(`downloading images for ${queue.length} products...`);
  let i = 0;
  async function worker() {
    while (i < queue.length) {
      const p = queue[i++];
      const localBase = path.join(DST, p.id);
      const manifest = path.join(DST, p.id + ".img.json");
      if (fs.existsSync(manifest)) { skip++; continue; }
      let saved = null;
      for (const url of candidates(p)) {
        try {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 15000);
          const res = await fetch(url, { signal: ctl.signal, headers: { "user-agent": UA, accept: "image/*" } });
          clearTimeout(t);
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 1000) continue;
          const ext = extOf(url, (res.headers.get("content-type") || "").includes("png") ? "png" : "jpg");
          const file = `${p.id}.${ext}`;
          fs.writeFileSync(path.join(DST, file), buf);
          saved = `assets/products/${file}`;
          break;
        } catch {}
      }
      fs.writeFileSync(manifest, JSON.stringify({ local: saved }));
      saved ? ok++ : fail++;
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`images: ok ${ok}, skip ${skip}, fail ${fail} → assets/products/`);
})();
