#!/usr/bin/env node
/** audit-promo-links.js — 推广链接健康抽查:对双站全部 promoLink 验活。
 *  GET + 跟随重定向 + 15s 超时 + 并发 8 + URL 去重 + 网络错误重试 1 次。
 *  分类:ok(2xx/3xx 最终响应) / broken(4xx/5xx) / error(网络错误/超时)。
 *  输出:data/_promo-links-{en,de}.json(逐链接结果)+ 控制台摘要。
 *  用法: node build/audit-promo-links.js [--site en|de] [--limit N]
 */
const fs = require("fs");
const { execFile } = require("child_process");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const CONC = 16, TIMEOUT = 15, RETRY = 1;

// 用 curl 而非 node fetch:digistore24.com 的边缘节点会重置 Node/undici 的 TLS 连接(ECONNRESET),curl(schannel)正常
function curlOnce(url) {
  return new Promise((resolve) => {
    execFile("curl.exe", [
      "-sS", "-o", "NUL", "-L", "--max-time", String(TIMEOUT),
      "-A", UA,
      "-H", "accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "-H", "accept-language: en-US,en;q=0.9,de;q=0.8",
      "-w", "%{http_code}\t%{url_effective}",
      url,
    ], { timeout: (TIMEOUT + 5) * 1000, windowsHide: true }, (err, stdout) => {
      const out = String(stdout || "").trim();
      const parts = out.split("\t");
      const status = parseInt(parts[0], 10) || 0;
      const finalUrl = parts[1] || "";
      if (status > 0) return resolve({ status, finalUrl });
      resolve({ status: 0, error: (err ? String(err.message) : "no response").replace(/\s+/g, " ").slice(0, 100) });
    });
  });
}

async function check(url) {
  for (let attempt = 0; attempt <= RETRY; attempt++) {
    const r = await curlOnce(url);
    if (r.status > 0) return r;
    if (attempt === RETRY) return r;
    await new Promise((res) => setTimeout(res, 2000));
  }
}

async function pool(items, worker, conc) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
      if (idx > 0 && idx % 100 === 0) console.log(`  ${idx}/${items.length} checked`);
    }
  }
  await Promise.all(Array.from({ length: conc }, run));
  return results;
}

const SITES = [
  { lang: "en", ds: "G:/Digistore24/site/data/dataset.json", out: "G:/Digistore24/data/_promo-links-en.json" },
  { lang: "de", ds: "G:/Digistore24/site-de/data/dataset.json", out: "G:/Digistore24/data/_promo-links-de.json" },
];

(async () => {
  const argv = process.argv.slice(2);
  const only = argv.includes("--site") ? argv[argv.indexOf("--site") + 1] : null;
  const limit = argv.includes("--limit") ? parseInt(argv[argv.indexOf("--limit") + 1], 10) : null;
  for (const S of SITES) {
    if (only && S.lang !== only) continue;
    const data = JSON.parse(fs.readFileSync(S.ds, "utf8"));
    let products = data.products.filter((p) => p.promoLink);
    if (limit) products = products.slice(0, limit);
    // URL 去重:同一链接服务多个产品时只请求一次
    const byUrl = new Map();
    for (const p of products) {
      if (!byUrl.has(p.promoLink)) byUrl.set(p.promoLink, { url: p.promoLink, ids: [] });
      byUrl.get(p.promoLink).ids.push(p.id);
    }
    const urls = [...byUrl.values()];
    console.log(`[${S.lang}] ${products.length} products -> ${urls.length} unique promo links`);
    const t0 = Date.now();
    const results = await pool(urls, async (item) => {
      const r = await check(item.url);
      return { ...item, ...r, ok: r.status >= 200 && r.status < 400 };
    }, CONC);
    const ok = results.filter((r) => r.ok);
    const broken = results.filter((r) => !r.ok && r.status > 0);
    const errors = results.filter((r) => !r.ok && r.status === 0);
    const affected = results.filter((r) => !r.ok).reduce((a, r) => a + r.ids.length, 0);
    console.log(`[${S.lang}] ok ${ok.length} | broken ${broken.length} | network-error ${errors.length} | affected products ${affected} | ${Math.round((Date.now() - t0) / 1000)}s`);
    for (const b of [...broken, ...errors].slice(0, 25)) console.log(`  ✗ ${b.status || "ERR"} ${b.url.slice(0, 100)} ${b.error ? ":: " + b.error : ""}`);
    fs.writeFileSync(S.out, JSON.stringify({ checkedAt: new Date().toISOString(), products: products.length, uniqueUrls: urls.length, ok: ok.length, broken: broken.length, errors: errors.length, results }, null, 1));
  }
  console.log("DONE");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
