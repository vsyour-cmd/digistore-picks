// Link checker for the generated static site.
// Usage: node tools/linkcheck.mjs [--external]
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
const bySection = {};
let refsTotal = 0;

for (const f of htmls) {
  const norm = f.split(path.sep).join('/');
  const section = norm.includes('/') ? norm.split('/')[0] : '(root)';
  const h = fs.readFileSync(f, 'utf8');
  const broken = new Set();

  for (const m of h.matchAll(/(?:href|src)="([^"#]+)(#[^"]*)?"/g)) {
    const href = m[1];
    if (!href || /^(https?:|mailto:|data:|\/\/|\/)/.test(href)) continue;
    refsTotal++;
    const target = path.resolve(path.dirname(f), decodeURIComponent(href));
    if (!fs.existsSync(target)) broken.add(href);
  }

  if (broken.size) {
    const s = (bySection[section] ??= { pages: 0, refs: 0, hrefs: {} });
    s.pages++;
    s.refs += broken.size;
    for (const b of broken) s.hrefs[b] = (s.hrefs[b] || 0) + 1;
  }
}

console.log(`html: ${htmls.length} | internal refs checked: ${refsTotal}`);
for (const [s, v] of Object.entries(bySection)) {
  console.log(`\n[${s}] ${v.pages} pages, ${v.refs} broken refs`);
  for (const [h, n] of Object.entries(v.hrefs).sort((a, b) => b[1] - a[1]).slice(0, 10))
    console.log(`   ${n}x ${h}`);
}
const totals = Object.values(bySection).reduce((a, v) => a + v.refs, 0);
console.log(`\nTOTAL broken internal refs: ${totals}`);

if (process.argv.includes('--external')) {
  const externals = new Map();
  for (const f of htmls) {
    const h = fs.readFileSync(f, 'utf8');
    for (const m of h.matchAll(/href="(https?:\/\/[^"#]+)"/g)) {
      const u = m[1].replace(/&amp;/g, '&');
      if (!externals.has(u)) externals.set(u, []);
      if (externals.get(u).length < 1) externals.get(u).push(f);
    }
  }
  fs.writeFileSync('external-links.json', JSON.stringify([...externals.keys()], null, 1));
  console.log(`external unique URLs: ${externals.size} -> external-links.json`);
}
