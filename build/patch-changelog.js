#!/usr/bin/env node
/** patch-changelog.js — 双站接入 What's new 每日更新日志页 */
const fs = require("fs");

function wire(file, siteName, isDe) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes("function changelogPage")) { console.log(file, "already"); return; }

  // 1) footer 链接(挂在跨站链接后)
  const linkLabel = isDe ? "Neuigkeiten" : "What's new";
  const footerAnchor = isDe
    ? 'English site: 1243 Digistore24 products</a></div>'
    : '4271 Digistore24-Produkte</a></div>';
  if (!s.includes(footerAnchor)) { console.error(file, "footer anchor missing"); process.exit(1); }
  s = s.replace(footerAnchor, footerAnchor.replace("</div>", ` · <a href="\${rel}/changelog.html">${linkLabel}</a></div>`));

  // 2) changelogPage 函数
  const escName = SITE_EXPR(isDe);
  const fn = isDe
    ? [
        "function changelogPage() {",
        '  const f = path.join(ROOT, "build", "changelog.json");',
        "  if (!fs.existsSync(f)) return;",
        '  const entries = JSON.parse(fs.readFileSync(f, "utf8")).entries || [];',
        "  const body = `${entries.map((e) => `<h2>${datemark(e.date)}</h2>\\n<p>${esc(e.summary)}</p>\\n<ul>${(e.changes || []).map((c) => `<li>${esc(c)}</li>`).join(\"\")}</ul>`).join(\"\\n\")}`;",
        `  fs.writeFileSync(outPath("changelog.html"), layout({ title: \`Neuigkeiten — ${siteName}\`, desc: \`Tägliches Änderungslog von ${siteName}: Datenaktualisierungen, neue Artikel und Verbesserungen.\`, body, path: "changelog.html", hreflangLinks: HREF_HOME }));`,
        "}",
        "",
      ].join("\n")
    : [
        "function changelogPage() {",
        '  const f = path.join(ROOT, "build", "changelog.json");',
        "  if (!fs.existsSync(f)) return;",
        '  const entries = JSON.parse(fs.readFileSync(f, "utf8")).entries || [];',
        "  const body = `${entries.map((e) => `<h2>${datemark(e.date)}</h2>\\n<p>${esc(e.summary)}</p>\\n<ul>${(e.changes || []).map((c) => `<li>${esc(c)}</li>`).join(\"\")}</ul>`).join(\"\\n\")}`;",
        `  fs.writeFileSync(outPath("changelog.html"), layout({ title: \`What's new — ${siteName}\`, desc: \`Daily changelog of ${siteName}: data refreshes, new reviews and improvements — \${DATA.total} Digistore24 products tracked.\`, body, path: "changelog.html", hreflangLinks: HREF_HOME }));`,
        "}",
        "",
      ].join("\n");

  const anchor = isDe ? "const altSlugs = computeAltSlugs();" : "const altSlugs = computeAltSlugs();";
  if (!s.includes(anchor)) { console.error(file, "alt anchor missing"); process.exit(1); }
  s = s.replace(anchor, fn + "\n" + anchor);

  // 3) 调用
  const callAnchor = isDe ? "  staticPages();" : "  aboutPage();";
  s = s.replace(callAnchor, callAnchor + "\n" + (isDe ? "  changelogPage();" : "  changelogPage();"));

  fs.writeFileSync(file, s);
  console.log(file, "wired:", s.includes("function changelogPage"), s.includes("changelog.html"));
}

function SITE_EXPR(isDe) {
  return isDe ? "${SITE_NAME}" : "${SITE_NAME}";
}

wire("G:/Digistore24/site/build/build-site.js", "${SITE_NAME}", false);
wire("G:/Digistore24/site-de/build/build-site.js", "${SITE_NAME}", true);
