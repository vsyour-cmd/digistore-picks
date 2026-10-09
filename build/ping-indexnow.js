#!/usr/bin/env node
/**
 * ping-indexnow.js — 把本次更新变动的页面实时推送给 Bing/IndexNow
 * key 文件: 站点根目录 {key}.txt(GitHub Pages 项目站无法放域名根,用 keyLocation 声明)
 * 用法: node build/ping-indexnow.js [--all]
 *   默认: 提交最近一次 git 提交中变动的 .html + 首页/博客索引
 *   --all: 提交首页+全部分类页+博客+产品索引(~60条,首次/全量用)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://vsyour-cmd.github.io/digistore-picks";
const HOST = "vsyour-cmd.github.io";
const ENDPOINT = "https://api.indexnow.org/indexnow";

const keyFile = fs.readdirSync(ROOT).find((f) => /^[0-9a-f]{32}\.txt$/i.test(f));
if (!keyFile) { console.error("no IndexNow key file in site root"); process.exit(1); }
const KEY = keyFile.replace(/\.txt$/i, "");
const KEY_LOCATION = `${SITE_URL}/${keyFile}`;

let paths = [];
if (process.argv.includes("--all")) {
  paths = ["index.html", "about.html", "reviews/index.html", "blog/index.html"];
  const catDir = path.join(ROOT, "category");
  for (const f of fs.readdirSync(catDir)) if (f.endsWith(".html")) paths.push(`category/${f}`);
  const blogDir = path.join(ROOT, "blog");
  for (const f of fs.readdirSync(blogDir)) if (f.endsWith(".html")) paths.push(`blog/${f}`);
} else {
  // 最近一次提交变动的页面 + 固定入口
  try {
    const diff = execSync("git diff --name-only HEAD~1 HEAD", { cwd: ROOT, encoding: "utf8" });
    paths = diff.split("\n").filter((f) => f.endsWith(".html"));
  } catch {}
  paths = [...new Set([...paths, "index.html", "blog/index.html", "reviews/index.html"])];
}
paths = [...new Set(paths)].slice(0, 100);
if (!paths.length) { console.log("nothing to ping"); process.exit(0); }

const body = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList: paths.map((p) => `${SITE_URL}/${p}`),
};

(async () => {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    console.log(`IndexNow: ${res.status} ${res.status === 200 || res.status === 202 ? "OK" : "CHECK"} (${paths.length} URLs, keyLocation=${KEY_LOCATION})`);
    if (res.status !== 200 && res.status !== 202) console.log(await res.text().slice(0, 300));
  } catch (e) {
    console.error("IndexNow ping failed:", e.message);
    process.exit(1);
  }
})();
