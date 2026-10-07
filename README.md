# Budget Buys

A static site that turns `data/products.csv` into a budget finder, category pages and one page per budget range. No framework, no database, no dependencies — just Node 18+.

## Build

```
npm run build        # → dist/  (upload this folder)
```

`npm run preview` makes `dist-preview/`, a self-contained copy with relative links (only used for previewing; don't deploy it).

## Add or change a pick

Edit `data/products.csv` (Excel or Google Sheets work — keep the header row and save as CSV), then rebuild. One row = one pick. The columns are the same ones the research skill outputs:

| Column | What it does on the site |
|---|---|
| `category` | Must match a category `name` in `config.json` (e.g. `Phones`) |
| `range` | Must match a range `label` in `config.json` (e.g. `₹10–15k`) |
| `priority` | Rank inside the range (1 = top) |
| `brand`, `model`, `variant` | Product name line |
| `role` | Pill above the name ("Best overall · ₹15k pick") |
| `usage_tags` | `|`-separated, from the category's `usage` keys — drives the "What matters most" filter |
| `value_badge` | Green badge, e.g. `Best value · ₹12,999` |
| `why_1`, `why_2`, `drawback`, `buy_if` | The ✓ / ✕ lines and the "Buy this if" box |
| `amazon_price`, `flipkart_price` | Shown on the buy buttons (leave blank if not sold there) |
| `amazon_url`, `flipkart_url` | Plain product links |
| `amazon_affiliate_url`, `flipkart_affiliate_url` | *Optional extra columns.* If filled, used instead of the plain links |
| `price_checked_at` | Date shown as "Prices checked …" |
| `brands_in_range` | "Brands worth buying" line in the guide |

Rows with a category or range not in `config.json` are skipped with a warning.

## Affiliate links

- **Amazon:** put your Associates tracking ID in `config.json` → `"amazonTag": "yourtag-21"`. Every Amazon link gets `?tag=…` added automatically.
- **Flipkart** (Cuelinks, EarnKaro or Flipkart Affiliate): add a `flipkart_affiliate_url` column and paste the converted link per product.

All store buttons open in a new tab with `rel="sponsored nofollow"`, as Google requires for paid links.

## Add a category

In `config.json`, remove `"comingSoon": true` from the category and fill its `ranges` (label, slug, title), `usage` (optional) and `guide` paragraphs. Then add its rows to the CSV.

## Deploy to Cloudflare Pages (free)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Upload assets**.
2. Name the project (the name becomes `<name>.pages.dev`), then drag in the `dist` folder.
3. Set `baseUrl` in `config.json` to the final address, rebuild, and upload again so the sitemap and canonical links are right.

To redeploy after editing products: rebuild and upload `dist` again (or connect a GitHub repo with build command `npm run build` and output folder `dist`).
