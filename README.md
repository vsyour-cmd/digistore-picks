# DigistorePicks

Independent directory & review site for Digistore24 English-language marketplace products.

- **Data**: `data/dataset.json` — scraped from the official Digistore24 affiliate marketplace API (logged-in affiliate view). Contains price, commission, cart conversion, cancel rate, earnings/sale, vendor, categories and affiliate promo links.
- **Build**: `node build/build-site.js [--profiles N]` regenerates `index.html`, 45 category pages, N product data-profile pages, review index and about page.
- **Reviews**: hand-written pages live in `reviews/` and are registered in `build/articles.json` so the build script won't overwrite them.

## Update workflow

1. Re-scrape the marketplace (requires an active Digistore24 login session in the in-app browser) → refresh `data/dataset.json`
2. `node build/build-site.js`
3. Commit & push — GitHub Pages deploys from `main`.

## Editorial rules

- Every page is labeled by research method: **data profile** (marketplace + sales-page facts) or **hands-on review** (purchased and used).
- No unverified numbers. Marketplace stats are labeled as vendor-side data, not forecasts.
- FTC affiliate disclosure on every page.
