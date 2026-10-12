#!/usr/bin/env node
/**
 * optimize-images.js — 压缩产品图: 最长边 600px、转 WebP(q80),manifest 记录最终尺寸
 * 跳过 .gif(保留动画);幂等(已处理的自动跳过)
 * 用法: node build/optimize-images.js [--force]
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DIR = path.join(__dirname, "..", "assets", "products");
const FORCE = process.argv.includes("--force");
const MAX = 600;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function writeWithRetry(p, buf, tries = 3) {
  for (let a = 1; ; a++) {
    try { fs.writeFileSync(p, buf); return; }
    catch (e) { if (a >= tries) throw e; await sleep(250 * a); }
  }
}

(async () => {
  const manifests = fs.readdirSync(DIR).filter((f) => f.endsWith(".img.json"));
  let done = 0, skip = 0, noimg = 0, fail = 0, savedBytes = 0;
  for (const mf of manifests) {
    const mPath = path.join(DIR, mf);
    let man;
    try { man = JSON.parse(fs.readFileSync(mPath, "utf8")); } catch { continue; }
    if (!man.local) { noimg++; continue; }
    if (!FORCE && man.width && man.local.endsWith(".webp")) { skip++; continue; }

    const file = path.basename(man.local);
    const src = path.join(DIR, file);
    if (!fs.existsSync(src)) { man.local = null; fs.writeFileSync(mPath, JSON.stringify(man)); noimg++; continue; }

    if (file.endsWith(".gif")) {
      // 保留动画 gif,仅记录尺寸
      try {
        const meta = await sharp(src).metadata();
        man.width = meta.width; man.height = meta.height;
        fs.writeFileSync(mPath, JSON.stringify(man));
        skip++;
      } catch { fail++; }
      continue;
    }

    try {
      const outName = file.replace(/\.(png|jpe?g|webp|svg)$/i, "") + ".webp";
      const outPath = path.join(DIR, outName);
      // libvips 对按路径传入的源文件持有内存映射,直到 GC 释放;源文件已是 .webp 时
      // outPath === src,覆写会撞上 Windows ERROR_USER_MAPPED_FILE(fs 报 UNKNOWN:
      // unknown error, open)。必须先读入内存,让 sharp 从 Buffer 解码。
      const srcBuf = fs.readFileSync(src);
      const buf = await sharp(srcBuf)
        .resize(MAX, MAX, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const meta = await sharp(buf).metadata();
      await writeWithRetry(outPath, buf); // 新下载的文件可能被杀软短暂锁定
      savedBytes += srcBuf.length - buf.length;
      if (outName !== file) { try { fs.unlinkSync(src); } catch {} } // 旧文件可能被锁,留给清理阶段
      man.local = "assets/products/" + outName;
      man.width = meta.width; man.height = meta.height;
      fs.writeFileSync(mPath, JSON.stringify(man));
      done++;
    } catch (e) {
      console.error("  fail", file, e.message.slice(0, 60));
      fail++;
    }
  }
  // 清理阶段:删除不再被任何 manifest 引用的旧图(被锁的下次再试)
  const referenced = new Set();
  for (const mf of fs.readdirSync(DIR).filter((f) => f.endsWith(".img.json"))) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(DIR, mf), "utf8"));
      if (m.local) referenced.add(path.basename(m.local));
    } catch {}
  }
  let cleaned = 0, locked = 0;
  for (const f of fs.readdirSync(DIR)) {
    if (f.endsWith(".img.json") || f.endsWith(".webp") || f.endsWith(".gif")) continue;
    if (referenced.has(f)) continue;
    try { fs.unlinkSync(path.join(DIR, f)); cleaned++; } catch { locked++; }
  }
  console.log(`cleanup: ${cleaned} old files removed, ${locked} locked (retry next run)`);
  console.log(`images optimized: ${done} converted, ${skip} skipped, ${noimg} no-image, ${fail} failed; saved ${(savedBytes / 1048576).toFixed(1)} MB this run`);
})();
