# DigistorePicks

Independent directory & review site for Digistore24 English-language marketplace products.

**Website: <https://vsyour-cmd.github.io/digistore-picks/>**

## Site map

| Page | URL |
|------|-----|
| Home (product directory) | <https://vsyour-cmd.github.io/digistore-picks/> |
| All product profiles (top 100 index) | <https://vsyour-cmd.github.io/digistore-picks/reviews/index.html> |
| Blog (data guides) | <https://vsyour-cmd.github.io/digistore-picks/blog/index.html> |
| About & disclosure | <https://vsyour-cmd.github.io/digistore-picks/about.html> |
| Category pages (45) | `https://vsyour-cmd.github.io/digistore-picks/category/{slug}.html` |
| Product profile (all 1243) | `https://vsyour-cmd.github.io/digistore-picks/reviews/{slug}-{id}.html` |
| Product research files (Markdown) | [`content/products/`](content/products/) |

## Repository structure

```
data/dataset.json      Combined dataset: marketplace data + sales-page research + promo links
build/                 Build pipeline (plain Node.js, no dependencies)
  build-dataset.js     Merge marketplace scrape + research → dataset.json
  fetch-research.js    Sales-page research crawler (checkpointed, retrying)
  fetch-images.js      Product image localizer (marketplace image first, og:image fallback)
  gen-md.js            Per-product Markdown archives → content/products/
  build-site.js        Static site generator (home, 45 categories, 1243 profiles)
  build-blog.js        Data-driven blog pages
content/products/      One complete Markdown archive per product (1243 files)
reviews/               Generated product profile pages (HTML)
category/              Generated category pages (HTML)
blog/                  Generated blog pages (HTML)
assets/products/       Localized product images (1000+)
docs/update-runbook.md Daily update runbook (Chinese)
```

## Build & update workflow

1. Scrape the marketplace (requires an active Digistore24 login session in the in-app browser) → `data/products-en.json`, `data/categories-en.json`
2. `node build/fetch-research.js` — research every product's sales page (titles, headlines, prices, guarantee language, CTAs)
3. `node build/fetch-images.js` — localize product images
4. `node build/build-dataset.js && node build/gen-md.js && node build/build-site.js && node build/build-blog.js`
5. Commit & push — GitHub Pages deploys from `main` automatically

## Affiliate link formats

- Digistore24 domains (`digistore24.com/product`, `checkout-ds24.com/product`): query parameter — `...?voucher=X&aff=adminstore`
- Vendor domains: dual format — `...?aff=adminstore#aff=adminstore`
- Broken URLs (placeholders/anchors): canonical redirect — `https://www.digistore24.com/redir/{productId}/adminstore`

## Editorial rules

- Every page is labeled by research method: **data profile** (marketplace + sales-page facts) or **hands-on review** (purchased and used).
- Sales-page extracts are always marked as vendor claims, not verified by us.
- No unverified numbers. Marketplace stats are labeled as vendor-side data, not forecasts.
- FTC affiliate disclosure on every page.
- Unreachable sales pages (dead domains, expired certificates) are reported as-is — that is information about the offer's state.
