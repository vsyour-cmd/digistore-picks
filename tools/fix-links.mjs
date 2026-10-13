// One-off repair for the broken internal links found by tools/linkcheck.mjs.
// Patches the BUILT html in place (github pages serves this repo root).
// Generator-side fixes are in build-site.js / build-blog.js so future
// rebuilds don't regress; this script fixes the current deployment.
// Usage: node tools/fix-links.mjs
import fs from 'node:fs';
import path from 'node:path';

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== '.git' && f !== 'node_modules') walk(p, out);
    } else out.push(p);
  }
  return out;
}

const htmls = walk('.').filter((f) => f.endsWith('.html'));
let touched = 0;
const edit = (f, fn) => {
  const before = fs.readFileSync(f, 'utf8');
  const after = fn(before);
  if (after !== before) { fs.writeFileSync(f, after, 'utf8'); touched++; }
};
const exists = (rel) => fs.existsSync(rel);

// ---- 1. faq/*.html: bare root links inside FAQ answers -> ../
// (answers were written for root-level pages; faq lives one level deep)
const faqFixes = [
  ['href="price-watch.html"', 'href="../price-watch.html"'],
  ['href="changelog.html"', 'href="../changelog.html"'],
  ['href="llms-full.txt"', 'href="../llms-full.txt"'],
  ['href="monthly-new.html"', 'href="../monthly-new.html"'],
  ['href="about.html"', 'href="../about.html"'],
];
for (const f of htmls.filter((f) => f.split(path.sep).join('/').startsWith('faq/'))) {
  edit(f, (h) => {
    let out = h;
    for (const [from, to] of faqFixes) out = out.split(from).join(to);
    // repair the malformed template: ringHtml was spliced inside the about <a>
    out = out.replace(
      /<a href="\.\.\/about\.html">(<p class="sub">More category FAQs:[\s\S]*?<\/p>)\s*research standards<\/a>/,
      '<a href="../about.html">research standards</a>. $1',
    );
    return out;
  });
}

// ---- 2. root price-watch.html + amazon-picks.html: body links carry ../
// but the pages live at the site root -> ../ escapes the site on GitHub Pages
for (const f of ['price-watch.html', 'amazon-picks.html'].filter(exists)) {
  edit(f, (h) => h.replace(/href="\.\.\//g, 'href="'));
}

// ---- 3. delisted product referenced by price-watch -> point at the index
if (exists('price-watch.html')) {
  edit('price-watch.html', (h) =>
    h.replace(/href="\.\.\/reviews\/transform-your-life-the-ultimate-self-mastery-system-53789\.html"/g, 'href="reviews/index.html"'),
  );
}

// ---- 4. blog article: root page referenced without ../
const blogFix = walk('blog').filter((f) => f.endsWith('.html'));
for (const f of blogFix) {
  edit(f, (h) => h.split('href="price-watch.html"').join('href="../price-watch.html"'));
}

// ---- 5. missing alternatives/index.html: generate a real directory page
if (!exists('alternatives/index.html')) {
  const files = walk('alternatives')
    .filter((f) => f.endsWith('.html') && !f.endsWith('index.html'))
    .map((f) => f.split(path.sep).join('/'))
    .sort();
  const items = files.map((f) => {
    const h = fs.readFileSync(f, 'utf8');
    const t = ((h.match(/<h1>([^<]*)<\/h1>/) || [])[1] || f).replace(/&amp;/g, '&').replace(/: alternatives.*$/i, '');
    return `<li><a href="${path.basename(f)}">${t}</a></li>`;
  });
  fs.writeFileSync(
    'alternatives/index.html',
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>All alternatives &amp; comparisons — DigistorePicks</title>
<meta name="description" content="Every alternatives &amp; comparison page on DigistorePicks: head-to-head options for the top Digistore24 marketplace products.">
<link rel="stylesheet" href="../assets/style.css">
</head>
<body>
<header class="site"><div class="wrap"><a href="../index.html"><b>DigistorePicks</b></a> — independent Digistore24 directory</header>
<main class="wrap">
<h1>All alternatives &amp; comparison pages</h1>
<p class="sub">${files.length} head-to-head comparison pages, one per top offer. Each lists same-category alternatives with vendor-side marketplace numbers.</p>
<ul>
${items.join('\n')}
</ul>
</main>
<footer class="site"><div class="wrap"><a href="../about.html">About, disclosure &amp; contact</a> · <a href="../changelog.html">What's new</a> · Data: Digistore24 marketplace, vendor-side</footer>
</body>
</html>
`,
    'utf8',
  );
  touched++;
  console.log('generated alternatives/index.html with', files.length, 'entries');
}

// ---- 6. links to faq pages that don't exist -> nearest existing faq page
const faqFiles = new Set(
  walk('faq').filter((f) => f.endsWith('.html')).map((f) => path.basename(f)),
);
const allFaq = [...faqFiles].sort();
const nearestFaq = (slug) => {
  const words = new Set(slug.replace(/\.html$/, '').split('-').filter((w) => w.length > 4));
  let best = null, bestScore = -1;
  for (const f of allFaq) {
    const fw = f.replace(/\.html$/, '').split('-');
    const score = fw.filter((w) => words.has(w)).length;
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return best || 'uncategorized.html';
};
for (const f of htmls) {
  const norm = f.split(path.sep).join('/');
  if (norm.startsWith('faq/')) continue; // faq pages don't link missing faqs
  edit(f, (h) =>
    h.replace(/href="\.\.\/faq\/([^"]+\.html)"/g, (m, name) =>
      faqFiles.has(name) ? m : `href="../faq/${nearestFaq(name)}"`,
    ),
  );
}

console.log('patched files:', touched);

// ---- 7. Digistore24 domain policy (CUSDM1): product links must use
// checkout-ds24.com; www.digistore24.com/product/* shows an error page to
// real users (verified in a real browser 2026-10-13).
{
  const files = walk('.').filter((f) => f.endsWith('.html'));
  let n = 0;
  for (const f of files) {
    const before = fs.readFileSync(f, 'utf8');
    const after = before
      .split('https://www.digistore24.com/product/')
      .join('https://www.checkout-ds24.com/product/')
      .replace(/>digistore24\.com\/product\//g, '>checkout-ds24.com/product/');
    if (after !== before) { fs.writeFileSync(f, after, 'utf8'); n++; }
  }
  console.log('domain swap: ' + n + ' files');
}
