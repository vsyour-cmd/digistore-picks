#!/usr/bin/env node
/** gen-og.js — 生成 1200×630 默认 OG 分享图(SVG→PNG,无外部依赖,sharp 渲染)
 * 用法: SITE_ROOT=... OG_TITLE="..." OG_SUB="..." node build/gen-og.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.join(__dirname, "..");
const TITLE = process.env.OG_TITLE || "DigistorePicks";
const SUB = process.env.OG_SUB || "Digistore24 products — prices, commissions & research";
const OUT = path.join(ROOT, "assets", "og-default.png");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
<rect width="1200" height="630" fill="#0f6b4f"/>
<rect x="60" y="60" width="1080" height="510" rx="24" fill="#ffffff" opacity="0.07"/>
<text x="90" y="250" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="800" fill="#ffffff">${esc(TITLE)}</text>
<text x="92" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#c9e8dd">${esc(SUB)}</text>
<rect x="92" y="390" width="220" height="10" rx="5" fill="#34b58a"/>
<text x="92" y="490" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#9fd4c3">Independent data · verified marketplace numbers · honest labeling</text>
</svg>`;

sharp(Buffer.from(svg)).png({ quality: 90 }).toFile(OUT).then((info) => {
  console.log(`OG image: ${OUT} (${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB)`);
}).catch((e) => { console.error(e.message); process.exit(1); });
