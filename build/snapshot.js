#!/usr/bin/env node
// snapshot.js — 保存当日 dataset 快照到 history/(每日任务第4步调用)
const fs = require("fs");
const path = require("path");
const today = new Date().toISOString().slice(0, 10);
for (const [src, dst] of [
  ["G:/Digistore24/site/data/dataset.json", "G:/Digistore24/data/history/" + today + "-en.json"],
  ["G:/Digistore24/site-de/data/dataset.json", "G:/Digistore24/data-de/history/" + today + "-de.json"],
]) {
  if (fs.existsSync(src)) { fs.copyFileSync(src, dst); console.log("snapshot:", dst); }
}
