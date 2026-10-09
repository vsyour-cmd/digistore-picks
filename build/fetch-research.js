#!/usr/bin/env node
/**
 * fetch-research.js — 抓取每个产品销售页的推广素材
 * 输入: G:/Digistore24/data/products-en.json (salesPageUrl/promoLink)
 * 输出: G:/Digistore24/data/research-en.json  {id: {...}}
 *       G:/Digistore24/data/research-meta.json {researchedAt, ok, fail}
 * 用法: node build/fetch-research.js [--limit N] [--refresh] [--ids 1,2,3]
 *   --refresh  重新抓全部(默认跳过已有且未失败的)
 */
const fs = require("fs");
const path = require("path");

const SRC = "G:/Digistore24/data/products-en.json";
const OUT = "G:/Digistore24/data/research-en.json";
const META = "G:/Digistore24/data/research-meta.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const LIMIT = val("--limit") ? parseInt(val("--limit"), 10) : Infinity;
const REFRESH = flag("--refresh");
const ONLY = val("--ids") ? val("--ids").split(",") : null;

const prods = JSON.parse(fs.readFileSync(SRC, "utf8")).products;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
if (!REFRESH && !ONLY) {
  for (const [id, r] of Object.entries(prev)) if (r && !r.error) prev[id] = r; // 保留成功项
}

const decode = (s) => s
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;|&#0?34;|&#x2[22];/gi, '"').replace(/&#0?39;|&apos;|&#x2[27];/gi, "'")
  .replace(/&nbsp;/g, " ").replace(/&#8217;|&rsquo;/g, "'").replace(/&#821[01];|&ndash;|&mdash;/g, "-")
  .replace(/&#822[01];|&ldquo;|&rdquo;/g, '"').replace(/&#\d+;/g, "")
  .replace(/\s+/g, " ").trim();

function extract(html) {
  const pick = (re, n = 1) => { const m = html.match(re); return m ? decode(m[n]).slice(0, 400) : null; };
  const metaContent = (name) => {
    const res = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, "i"),
    ];
    for (const re of res) { const m = html.match(re); if (m) return decode(m[1]); }
    return null;
  };
  const heads = (tag, n) =>
    [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))]
      .map((m) => decode(m[1])).filter((t) => t.length > 2 && t.length < 300).slice(0, n);

  const bodyText = decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const prices = [...new Set(
    (html.match(/[$€£]\s?\d[\d.,]{0,8}/g) || []).map((s) => s.replace(/\s+/g, "")).filter((s) => /\d{2}/.test(s))
  )].slice(0, 12);
  const guarantee = pick(/(\d{1,3})[\s-]*(?:day|tage|dag)[\sa-z-]{0,30}(?:money|guarantee|refund|rückgabe|risk)/i)
    || pick(/(?:money[\s-]*back|guarantee|refund)[\sa-z-]{0,30}(\d{1,3})[\s-]*(?:day|tage|dag)/i, 1);
  const checkoutLinks = [...new Set(
    (html.match(/https?:\/\/[^\s"'<>]+/g) || [])
      .filter((u) => /digistore24\.com\/(checkout|redir|product)/i.test(u))
  )].map((u) => u.replace(/[)\].,]+$/, "")).slice(0, 5);
  const ctas = [...html.matchAll(/<(?:a|button)[^>]*>([\s\S]{2,120}?)<\/(?:a|button)>/gi)]
    .map((m) => decode(m[1]))
    .filter((t) => /^(buy|order|get|start|claim|yes|add to cart|try|join|learn more|discover|watch|show|download|access|unlock|continue|click)/i.test(t) && t.length < 60);
  const excerpts = [...html.matchAll(/<p[^>]*>([\s\S]{40,600}?)<\/p>/gi)]
    .map((m) => decode(m[1])).filter((t) => t.length > 80 && !/^(terms|privacy|copyright|©|all rights)/i.test(t));

  return {
    title: pick(/<title[^>]*>([\s\S]{3,300}?)<\/title>/i),
    metaDescription: metaContent("description"),
    ogTitle: metaContent("og:title"),
    ogImage: metaContent("og:image"),
    h1: heads("h1", 3),
    h2: heads("h2", 10),
    priceMentions: prices,
    guaranteeMention: guarantee,
    checkoutLinks,
    ctaTexts: [...new Set(ctas)].slice(0, 6),
    excerpt: excerpts.slice(0, 3),
    wordCount,
    quality: wordCount > 400 && (heads("h1", 1).length || prices.length) ? "rich" : wordCount > 120 ? "medium" : "thin",
  };
}

async function fetchOne(p) {
  const url = p.salesPageUrl || "";
  if (!url || !/^https?:/i.test(url)) return { error: "no sales page url" };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url.replace(/^http:/i, "https:"), {
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) return { error: `HTTP ${res.status}`, quality: "thin" };
    if (!/html/i.test(ct)) return { error: `non-html: ${ct.slice(0, 40)}`, quality: "thin" };
    const html = await res.text();
    if (html.length < 400) return { error: "empty page", quality: "thin" };
    return { finalUrl: res.url, ...extract(html) };
  } catch (e) {
    return { error: String(e.name === "AbortError" ? "timeout" : e.message).slice(0, 80) };
  } finally { clearTimeout(t); }
}

(async () => {
  const targets = prods.filter((p) => {
    if (ONLY) return ONLY.includes(String(p.id));
    if (REFRESH) return true;
    return !prev[p.id] || prev[p.id].error;
  }).slice(0, LIMIT);

  console.log(`researching ${targets.length} of ${prods.length} products...`);
  const out = { ...prev };
  let done = 0, ok = 0, fail = 0, lastSave = 0;
  const CONC = 8;
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const p = targets[i++];
      const r = await fetchOne(p);
      out[p.id] = r;
      r.error ? fail++ : ok++;
      done++;
      if (done - lastSave >= 40 || done === targets.length) {
        fs.writeFileSync(OUT, JSON.stringify(out));
        fs.writeFileSync(META, JSON.stringify({ researchedAt: new Date().toISOString(), ok: Object.values(out).filter((x) => x && !x.error).length, fail: Object.values(out).filter((x) => x && x.error).length }));
        lastSave = done;
        console.log(`  ${done}/${targets.length} (ok ${ok}, fail ${fail}) — checkpoint saved`);
      }
      await new Promise((r2) => setTimeout(r2, 80));
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(OUT, JSON.stringify(out));
  fs.writeFileSync(META, JSON.stringify({ researchedAt: new Date().toISOString(), ok: Object.values(out).filter((x) => x && !x.error).length, fail: Object.values(out).filter((x) => x && x.error).length }));
  const total = Object.keys(out).length;
  console.log(`DONE: ${total} researched, ok ${ok} / fail ${fail} (this run)`);
})();
