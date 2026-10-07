# Nightly price refresh

Keeps prices, stock and buyer-complaint flags on budgetbuys.co.in current.
Runs from Claude's built-in browser on Dinesh's computer, because Amazon and
Flipkart block plain server requests.

## Steps

1. `git pull origin main`, then `python3 scripts/refresh/targets.py 80 > /tmp/targets.json`
   (lists every Amazon ASIN and Flipkart path in `data/products.csv`, 80 per chunk).
2. Amazon: open `https://www.amazon.in/` in the built-in browser. Paste the contents of
   `amazon.js` into javascript_tool once. For each chunk, start it in the background
   (javascript_tool stops after 45 s):
   `window.jobResult=null; refreshAmazon(CHUNK, 8).then(r=>window.jobResult=r); 'started'`
   then wait ~40 s and read `window.jobResult` (repeat until it is not null).
   Append the returned lines to `amazon.txt`.
3. Flipkart: open `https://www.flipkart.com/`, paste `flipkart.js`, same pattern with
   `refreshFlipkart(CHUNK, true, 8)` (true = also read the 1–2★ share). Append to `flipkart.txt`.
4. `python3 scripts/refresh/apply.py amazon.txt flipkart.txt report.md`
   - updates prices, blanks the price of a store that is out of stock (URL kept),
     sets `price_checked_at`, and writes a report of things that need attention.
5. `npm run build` — must print no "Skipping" lines.
6. Commit `data/products.csv` as "Price refresh YYYY-MM-DD" and push to main
   (Cloudflare deploys automatically).

## Result line format

`key|price|stock|rating|ratings|low` where stock is `in`, `out`, `unknown`,
`captcha` or `error`, and low is the % of 1–2★ ratings. Anything other than
`in`/`out` leaves that store's data untouched.

## Report flags

- OUT OF STOCK everywhere — the pick has no store to buy from.
- OUT OF RANGE — best price is now more than 5% outside the budget range.
- PRICE MOVE >15% — big jump or drop since the last check.
- HIGH 1-2★ — more than 15% of 50+ buyers rate it 1–2★.

## Sundays: new-launch scan

Finds good products that are not on the site yet (including new launches once
buyers have rated them).

1. `python3 scripts/refresh/scout_targets.py` → every category/range with price bounds and a search term
   (terms live in `search_terms.json`; add one when a new category is added).
2. Paste `scout.js` on the Amazon tab and run `scoutAmazon(TARGETS)`; then on the Flipkart tab run
   `scoutFlipkart(TARGETS)` (same background + `window.jobResult` pattern; ~20 ranges per call).
   Save all lines to `scout.txt`.
3. `python3 scripts/refresh/scout_filter.py scout.txt 3` → up to 3 candidates per range that are not
   already listed, best rating first (4.2★+ and 100+ ratings).
4. For each candidate, check it really belongs (right product type, right price range), open its
   1–2★ share (Amazon histogram / Flipkart reviews page), and read the newest 1–3★ reviews.
   Add it only if it beats an existing pick on value or fills a range with fewer than 3 picks,
   keep 3–6 picks per range, and write the row with the same columns and tone as the others.
