#!/usr/bin/env node
/** patch-buyer-questions.js — 产品页"购买前风险清单"区块(双站)+ 对比页决策因子 + MD 3g */
const fs = require("fs");

// ---------- EN ----------
{
  const f = "G:/Digistore24/site/build/build-site.js";
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("function buyerChecklist")) {
    const fn = [
      "// 购买前风险清单(AI 模拟买家尽调问题;答案仅来自市场数据或标注的厂商宣称)",
      "const GQ_FILE = \"G:/Digistore24/data/gemini-questions-en.json\";",
      "const GQ = fs.existsSync(GQ_FILE) ? JSON.parse(fs.readFileSync(GQ_FILE, \"utf8\")) : { products: {} };",
      "function buyerChecklist(p) {",
      "  const g = GQ.products[String(p.id)];",
      "  if (!g || !g.groups) return \"\";",
      "  const renderItem = (item) => {",
      "    const l = item.toLowerCase();",
      "    let pointer = \"→ ask the vendor on the <a href=\\\"\" + esc(p.promoLink) + \"\\\" rel=\\\"nofollow sponsored noopener\\\" target=\\\"_blank\\\">official sales page</a>\";",
      "    if (/price|cost|\\$|billed|€/.test(l)) pointer = \"→ answer: <a href=\\\"#record\\\">marketplace record</a>\";",
      "    if (/guarantee|refund|money-back/.test(l)) pointer = \"→ answer: <a href=\\\"#research\\\">guarantee research</a> + confirm on official page\";",
      "    if (/legit|evidence|verif|case stud|track record|testimonial/.test(l)) pointer = \"→ answer: <a href=\\\"#research\\\">sales-page research</a> — vendor claims, not verified by us\";",
      "    if (/vendor|creator|coach|author|who/.test(l)) pointer = \"→ answer: <a href=\\\"#vendor\\\">vendor block</a> + <a href=\\\"#research\\\">research</a>\";",
      "    if (/alternative/.test(l)) pointer = \"→ answer: <a href=\\\"../alternatives/\" + p.slug + \".html\\\">alternatives page</a>\";",
      "    if (/deliver|download|access after|after paying|member area/.test(l)) pointer = \"→ answer: <a href=\\\"#faq\\\">delivery FAQ</a>\";",
      "    return `<li>${esc(item)} <span class=\"sub\">${pointer}</span></li>`;",
    "    };",
    "    const groups = g.groups.map((grp) => `<h3>${esc(grp.group)} — does it hold up?</h3><ul>${grp.questions.map(renderItem).join(\"\")}</ul>`).join(\"\");",
    "    return `<h2 id=\"buying-decisions\">Before you pay: what buyers of ${esc(p.label)} try to resolve first</h2>",
    "<div class=\"notice\"><b>AI-simulated buyer due-diligence questions</b> (not verified customer research). Where our data can answer, we link it; everything else must be clarified with the vendor before you pay.</div>",
    "${groups}`;",
    "  }",
    "",
  ].join("\n");
    s = s.replace("function faqData(p, altData) {", fn + "\nfunction faqData(p, altData) {");
    s = s.replace("${evidenceBox(p)}", "${evidenceBox(p)}\n\n${buyerChecklist(p)}");
    // pills
    s = s.replace(
      '  pills.push([`${p.label} FAQ`, "#faq"]);',
      '  pills.push([`${p.label} FAQ`, "#faq"]);\n  if (GQ.products[String(p.id)]) pills.push([`${p.label} buyer risk checklist`, "#buying-decisions"]);'
    );
    fs.writeFileSync(f, s);
    console.log("EN builder wired");
  }
}

// ---------- DE ----------
{
  const f = "G:/Digistore24/site-de/build/build-site.js";
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("function buyerChecklist")) {
    const fn = [
      "// Kauf-Risiko-Checkliste (KI-simulierte Käufer-Due-Diligence; Antworten nur aus Marktplatz-Daten oder gekennzeichneten Anbieteraussagen)",
      "const GQ_FILE = \"G:/Digistore24/data-de/gemini-questions-de.json\";",
      "const GQ = fs.existsSync(GQ_FILE) ? JSON.parse(fs.readFileSync(GQ_FILE, \"utf8\")) : { products: {} };",
      "function buyerChecklist(p) {",
      "  const g = GQ.products[String(p.id)];",
      "  if (!g || !g.groups) return \"\";",
      "  const renderItem = (item) => {",
      "    const l = item.toLowerCase();",
      "    let pointer = \"→ klären Sie mit dem Anbieter auf der <a href=\\\"\" + esc(p.promoLink) + \"\\\" rel=\\\"nofollow sponsored noopener\\\" target=\\\"_blank\\\">offiziellen Verkaufsseite</a>\";",
      "    if (/price|cost|€|preis|billed|€/.test(l)) pointer = \"→ Antwort: <a href=\\\"#record\\\">Marktplatz-Eintrag</a>\";",
      "    if (/garantie|geld.zurück|rückgabe|refund/.test(l)) pointer = \"→ Antwort: <a href=\\\"#research\\\">Garantie-Recherche</a> + auf der offiziellen Seite bestätigen\";",
      "    if (/seriös|evidence|verif|fallstudie|track record|testimonial/.test(l)) pointer = \"→ Antwort: <a href=\\\"#research\\\">Verkaufsseiten-Recherche</a> — Anbieteraussagen, nicht von uns geprüft\";",
      "    if (/anbieter|mentor|autor|autorin|wer steckt/.test(l)) pointer = \"→ Antwort: <a href=\\\"#vendor\\\">Anbieter-Block</a> + <a href=\\\"#research\\\">Recherche</a>\";",
      "    if (/alternativ/.test(l)) pointer = \"→ Antwort: <a href=\\\"../alternativen/\" + p.slug + \".html\\\">Alternativen-Seite</a>\";",
      "    if (/liefer|download|zugang nach|nach der zahlung|member area/.test(l)) pointer = \"→ Antwort: <a href=\\\"#faq\\\">Liefer-FAQ</a>\";",
      "    return `<li>${esc(item)} <span class=\"sub\">${pointer}</span></li>`;",
    "    };",
    "    const groups = g.groups.map((grp) => `<h3>${esc(grp.group)} — hält es stand?</h3><ul>${grp.questions.map(renderItem).join(\"\")}</ul>`).join(\"\");",
    "    return `<h2 id=\"buying-decisions\">Bevor Sie zahlen: was Käufer von ${esc(p.label)} zuerst klären</h2>",
    "<div class=\"notice\"><b>KI-simulierte Käufer-Due-Diligence-Fragen</b> (keine verifizierte Kundenforschung). Wo unsere Daten antworten, verlinken wir sie; alles andere muss vor der Zahlung mit dem Anbieter geklärt werden.</div>",
    "${groups}`;",
    "  }",
    "",
  ].join("\n");
    s = s.replace("function faqData(p, altData) {", fn + "\nfunction faqData(p, altData) {");
    s = s.replace("${evidenceBox(p)}", "${evidenceBox(p)}\n\n${buyerChecklist(p)}");
    s = s.replace(
      '  pills.push([`${p.label} FAQ`, "#faq"]);',
      '  pills.push([`${p.label} FAQ`, "#faq"]);\n  if (GQ.products[String(p.id)]) pills.push([`${p.label} Kauf-Risiko-Checkliste`, "#buying-decisions"]);'
    );
    fs.writeFileSync(f, s);
    console.log("DE builder wired");
  }
}

// ---------- MD 3g ----------
{
  for (const [root, gqFile, mdFile, label] of [
    ["G:/Digistore24/site", "G:/Digistore24/data/gemini-questions-en.json", "G:/Digistore24/site/build/gen-md.js", "EN"],
    ["G:/Digistore24/site-de", "G:/Digistore24/data-de/gemini-questions-de.json", "G:/Digistore24/site-de/build/gen-md.js", "DE"],
  ]) {
    let s = fs.readFileSync(mdFile, "utf8");
    if (s.includes("3g. Buyer risk checklist")) { console.log(label, "md already"); continue; }
    s = s.replace(
      "const OUT = path.join",
      "const GQ = fs.existsSync(" + JSON.stringify(gqFile) + ") ? JSON.parse(fs.readFileSync(" + JSON.stringify(gqFile) + ", \"utf8\")) : { products: {} };\nconst OUT = path.join"
    );
    const marker = "  lines.push(\"### 3f. FAQ";
    const inject = [
      "  const gq = GQ[p.id] || (GQ.products && GQ.products[p.id]);",
      "  if (gq && gq.groups) {",
      "    lines.push(\"### 3g. Buyer risk checklist (AI-simulated due-diligence questions, not verified customer research)\");",
      "    lines.push(\"\");",
      "    for (const grp of gq.groups) {",
      "      lines.push(\"**\" + grp.group + \"**\");",
      "      grp.questions.forEach((item) => lines.push(\"- [ ] \" + item));",
      "      lines.push(\"\");",
      "    }",
      "  }",
    ].join("\n");
    s = s.replace(marker, inject + "\n" + marker);
    fs.writeFileSync(mdFile, s);
    console.log(label, "md patched");
  }
}
