#!/usr/bin/env node
/**
 * fetch-details.js — 深度产品详情:使用方法/注意事项段落 + 销售页内容图集
 * 数据规范:提取的段落一律标注 vendor claims;图片下载后 sharp 压 WebP
 * 用法: SITE_ROOT=... DATA_DIR=... PRODUCTS_FILE=... DETAILS_FILE=... node build/fetch-details.js [--top N]
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.join(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || "G:/Digistore24/data";
const PRODUCTS_FILE = process.env.PRODUCTS_FILE || "products-en.json";
const DETAILS_FILE = process.env.DETAILS_FILE || "details-en.json";
const SRC = path.join(DATA_DIR, PRODUCTS_FILE);
const OUT = path.join(DATA_DIR, DETAILS_FILE);
const IMG_DIR = path.join(ROOT, "assets", "products");
const LANG = process.env.DETAILS_LANG || "en";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CONC = 8;

const args = process.argv.slice(2);
const topIdx = args.indexOf("--top");
const TOP = topIdx >= 0 ? parseInt(args[topIdx + 1], 10) || 0 : 300;

const prods = JSON.parse(fs.readFileSync(SRC, "utf8")).products;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

const USAGE_RE = /\b(how to (use|take|apply|start)|usage|instruction|directions|dosage|step[- ]by[- ]step|getting started|anwendung|anleitung|dosierung|einnahme|schritt|so funktioniert|s practically|mode d'emploi)/i;
const CAUTION_RE = /\b(warning|caution|attention|please note|important|disclaimer|side effect|not (a )?substitute|consult|before using|keep out of reach|warnung|achtung|hinweis|wichtig|disclaimer|nicht ersatz|arzt|side effects|results may vary|no medical)/i;

function decode(s) {
  return s.replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;|&#0?34;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/g, " ").replace(/&#8217;|&rsquo;/g, "'").replace(/&#822[01];|&ldquo;|&rdquo;/g, '"')
    .replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim();
}

function extract(html, salesUrl) {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const blocks = noScript.split(/<\/(?:p|li|div|td|h[1-6])>/i)
    .map((s) => decode(s.replace(/<[^>]+>/g, " ")))
    .filter((t) => t.length > 60 && t.length < 500);
  const usage = [];
  const caution = [];
  for (const t of blocks) {
    if (usage.length < 3 && USAGE_RE.test(t)) usage.push(t);
    else if (caution.length < 3 && CAUTION_RE.test(t)) caution.push(t);
  }
  // 内容图:跳过 logo/icon/支付图标/头像;取前4张
  const imgs = [...noScript.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((u) => !/logo|icon|sprite|avatar|badge|flag|payment|visa|mastercard|paypal|ssl|secure|1x1|pixel|blank\.gif/i.test(u))
    .map((u) => {
      try { return new URL(u, salesUrl).href; } catch { return null; }
    })
    .filter(Boolean);
  return { usage, caution, gallery: [...new Set(imgs)].slice(0, 4) };
}

async function fetchHtml(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url.replace(/^http:/i, "https:"), {
      signal: ctl.signal, redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!/html/i.test(ct)) return null;
    const html = await res.text();
    return html.length > 500 ? html : null;
  } catch { return null; }
  finally { clearTimeout(t); }
}

async function downloadImage(url, destBase) {
  for (const ext of [".webp", ""]) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch(url, { signal: ctl.signal, headers: { "user-agent": UA, accept: "image/*" } });
      clearTimeout(t);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) continue;
      const out = destBase + ".webp";
      const webp = await sharp(buf).resize(600, 600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      const meta = await sharp(webp).metadata();
      fs.writeFileSync(path.join(IMG_DIR, out), webp);
      return { file: "assets/products/" + out, width: meta.width, height: meta.height };
    } catch {}
  }
  return null;
}

(async () => {
  const ranked = [...prods].sort((a, b) => (b.earningsPerSale || 0) - (a.earningsPerSale || 0));
  const targets = ranked.filter((p) => {
    if (TOP > 0 && ranked.indexOf(p) >= TOP) return false;
    if (!p.salesPageUrl || /\[[A-Z]+\]/.test(p.salesPageUrl)) return false;
    const r = prev[p.id];
    return !(r && r.fetchedAt && !r.refresh);
  }).slice(0, TOP);
  console.log(`details: ${targets.length} products (top by earnings)`);

  fs.mkdirSync(IMG_DIR, { recursive: true });
  let done = 0, withUsage = 0, withGallery = 0;
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const p = targets[i++];
      const html = await fetchHtml(p.salesPageUrl);
      const rec = { fetchedAt: new Date().toISOString() };
      if (!html) {
        rec.error = "unreachable or non-html";
      } else {
        const ex = extract(html, p.salesPageUrl);
        rec.usage = ex.usage;
        rec.caution = ex.caution;
        const gal = [];
        for (const [gi, url] of ex.gallery.entries()) {
          const saved = await downloadImage(url, `${p.id}-g${gi + 1}`);
          if (saved) gal.push(saved);
        }
        rec.gallery = gal;
        if (ex.usage.length) withUsage++;
        if (gal.length) withGallery++;
      }
      prev[p.id] = rec;
      done++;
      if (done % 50 === 0 || done === targets.length) {
        fs.writeFileSync(OUT, JSON.stringify(prev));
        console.log(`  ${done}/${targets.length} (usage ${withUsage}, gallery ${withGallery}) — saved`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(OUT, JSON.stringify(prev));
  console.log(`DONE: ${done} fetched, usage ${withUsage}, gallery ${withGallery} → ${OUT}`);
})();
