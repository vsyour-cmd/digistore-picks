#!/usr/bin/env node
/** patch-vendorhub-links.js — 产品页"Other offers by vendor"标题处加 Hub 页链接(双站) */
const fs = require("fs");

// EN
{
  const f = "G:/Digistore24/site/build/build-site.js";
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("vendor hub page")) {
    const old = '<h2 id="vendor">Other offers by ${esc(p.vendorName)}</h2>';
    const neu = old + "\n" + '<p class="sub">Full catalog: <a href="../vendors/${slug(p.vendorName)}.html">${esc(p.vendorName)} vendor hub</a> — all listings with marketplace data.</p>';
    s = s.replace(old, neu);
    fs.writeFileSync(f, s);
  }
  console.log("EN:", s.includes("vendor hub page"));
}

// DE
{
  const f = "G:/Digistore24/site-de/build/build-site.js";
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("Anbieter-Hub-Seite")) {
    const old = '<h2 id="vendor">Weitere Angebote von ${esc(p.vendorName)}</h2>';
    const neu = old + "\n" + '<p class="sub">Gesamtkatalog: <a href="../hersteller/${slug(p.vendorName)}.html">${esc(p.vendorName)} Anbieter-Hub-Seite</a> — alle Listings mit Marktplatz-Daten.</p>';
    s = s.replace(old, neu);
    fs.writeFileSync(f, s);
  }
  console.log("DE:", s.includes("Anbieter-Hub-Seite"));
}
