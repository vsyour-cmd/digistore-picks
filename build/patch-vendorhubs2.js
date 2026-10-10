#!/usr/bin/env node
/** patch-vendorhubs2.js — 从 .fn 模板文件注入 vendorHubs 函数(无转义问题) */
const fs = require("fs");

// 1) EN: 注入函数 + 调用 + footer/sitemap/home 入口
{
  const f = "G:/Digistore24/site/build/build-site.js";
  let s = fs.readFileSync(f, "utf8");
  // 清掉上次损坏的注入(从 patch 标记到 changelogPage 之间如果有半截 vendorHubs)
  if (s.includes("function vendorHubs")) {
    console.log("EN already has vendorHubs — checking call only");
  } else {
    const fnCode = fs.readFileSync("G:/Digistore24/site/build/vendorhubs-en.fn", "utf8");
    s = s.replace("function changelogPage() {", fnCode + "\nfunction changelogPage() {");
  }
  if (!s.includes("vendorHubs();")) {
    s = s.replace("changelogPage();", "changelogPage();\nvendorHubs();");
  }
  // footer 加厂商目录链接
  if (!s.includes("Vendor directory")) {
    s = s.replace(
      '· <a href="${rel}/changelog.html">What\'s new</a></div>',
      '· <a href="${rel}/changelog.html">What\'s new</a> · <a href="${rel}/vendors/index.html">Vendors</a></div>'
    );
  }
  // home tldr 加厂商目录
  if (!s.includes("vendors/index.html")) {
    s = s.replace(
      '<li>New here? Start with the top list below, the <a href="monthly-new.html">newest offers</a>, or the <a href="blog/digistore24-numbers-checklist.html">6-point evaluation method</a>.</li>',
      '<li>New here? Start with the top list below, the <a href="monthly-new.html">newest offers</a>, the <a href="vendors/index.html">vendor directory</a>, or the <a href="blog/digistore24-numbers-checklist.html">6-point evaluation method</a>.</li>'
    );
  }
  fs.writeFileSync(f, s);
  console.log("EN wired:", s.includes("function vendorHubs"), s.includes("vendorHubs();"), s.includes("Vendor directory"));
}

// 2) DE
{
  const f = "G:/Digistore24/site-de/build/build-site.js";
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("function vendorHubs")) { console.log("DE already"); }
  else {
    const fnCode = fs.readFileSync("G:/Digistore24/site/build/vendorhubs-de.fn", "utf8");
    s = s.replace("function changelogPage() {", fnCode + "\nfunction changelogPage() {");
  }
  if (!s.includes("vendorHubs();")) {
    s = s.replace("changelogPage();", "changelogPage();\nvendorHubs();");
  }
  if (!s.includes("Anbieter-Verzeichnis")) {
    s = s.replace(
      '· <a href="${rel}/changelog.html">Neuigkeiten</a></div>',
      '· <a href="${rel}/changelog.html">Neuigkeiten</a> · <a href="${rel}/hersteller/index.html">Anbieter</a></div>'
    );
  }
  if (!s.includes("hersteller/index.html") && !s.includes('href="hersteller/index.html"')) {
    s = s.replace(
      '<li>Einstieg: Top-Liste unten, die <a href="monthly-new.html">neuesten Angebote</a>, oder die <a href="blog/digistore24-zahlen-checkliste.html">6-Punkte-Bewertungsmethode</a>.</li>',
      '<li>Einstieg: Top-Liste unten, die <a href="monthly-new.html">neuesten Angebote</a>, das <a href="hersteller/index.html">Anbieter-Verzeichnis</a> oder die <a href="blog/digistore24-zahlen-checkliste.html">6-Punkte-Bewertungsmethode</a>.</li>'
    );
  }
  fs.writeFileSync(f, s);
  console.log("DE wired:", s.includes("function vendorHubs"), s.includes("vendorHubs();"), s.includes("Anbieter-Verzeichnis"));
}
