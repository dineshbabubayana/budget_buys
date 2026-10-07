"""Apply a price/stock refresh to data/products.csv and write a report.
Usage: python3 scripts/refresh/apply.py <amazon_results.txt> <flipkart_results.txt> <report.md>
Result lines come from amazon.js / flipkart.js: key|price|stock|rating|ratings|low
Rules:
  - in stock with a price  -> update that store's price
  - out of stock           -> blank that store's price (URL kept so it can come back)
  - error/captcha/unknown  -> leave the row untouched for that store
  - price_checked_at is set to now (IST) when at least one store was refreshed
The report flags: out of stock on every listed store, price now outside the range,
price moved more than 15%, and 1-2 star share above 15% (with 50+ ratings)."""
import csv, io, json, os, re, sys
from datetime import datetime, timedelta, timezone
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CSV = os.path.join(ROOT, 'data', 'products.csv')
cfg = json.load(open(os.path.join(ROOT, 'config.json'), encoding='utf-8'))

def load(p):
    d = {}
    if p and os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            parts = line.rstrip('\n').split('|')
            if len(parts) >= 6 and parts[0]:
                d[parts[0]] = dict(price=parts[1], stock=parts[2], rating=parts[3], ratings=parts[4], low=parts[5])
    return d

A, F = load(sys.argv[1]), load(sys.argv[2])
report_path = sys.argv[3]
now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
stamp = now.strftime('%Y-%m-%d %H:%M IST')

def bounds(cat, label):
    for c in cfg['categories']:
        if c['name'].lower() == cat.lower():
            for r in c.get('ranges', []):
                if r['label'] == label:
                    t = r['title'].replace(',', '')
                    nums = [int(x) for x in re.findall(r'₹(\d+)', t)]
                    if t.startswith('under'): return 0, nums[0]
                    if t.startswith('above'): return nums[0], 10**9
                    if len(nums) == 2: return nums[0], nums[1]
    return None

raw = open(CSV, encoding='utf-8', newline='').read()
rows = list(csv.DictReader(io.StringIO(raw)))
cols = list(rows[0].keys())
flags, changes, touched = [], 0, 0
for r in rows:
    name = f"{r['category']} · {r['range']} · #{r['priority']} {r['brand']} {r['model']}"
    stores = []
    m = re.search(r'/dp/([A-Z0-9]{10})', r['amazon_url'] or '')
    if m: stores.append(('amazon_price', A.get(m.group(1)), 'Amazon'))
    m = re.search(r'flipkart\.com/(.+/p/itm\w+\?pid=\w+)', r['flipkart_url'] or '')
    if m: stores.append(('flipkart_price', F.get(m.group(1)), 'Flipkart'))
    refreshed, outs, lows = 0, 0, []
    for col, res, store in stores:
        if not res or res['stock'] not in ('in', 'out'): continue
        refreshed += 1
        old = r[col]
        new = res['price'] if res['stock'] == 'in' and res['price'] else ''
        if res['stock'] == 'out': outs += 1
        if old and new and abs(int(new) - int(float(old))) / float(old) > 0.15:
            flags.append(f"- PRICE MOVE >15%: {name} — {store} ₹{old} → ₹{new}")
        if new != old: changes += 1
        r[col] = new
        try:
            if res['low'] and float(res['low']) > 15 and int(res['ratings'] or 0) >= 50:
                lows.append(f"{store} {res['low']}% of {res['ratings']}")
        except ValueError: pass
    if refreshed:
        touched += 1
        r['price_checked_at'] = stamp
    if stores and outs == len(stores):
        flags.append(f"- OUT OF STOCK everywhere: {name}")
    prices = [int(float(r[c])) for c in ('amazon_price', 'flipkart_price') if r[c]]
    b = bounds(r['category'], r['range'])
    if prices and b and not (b[0] * 0.95 <= min(prices) <= b[1] * 1.05):
        flags.append(f"- OUT OF RANGE: {name} — best price ₹{min(prices)} vs {r['range']}")
    if lows:
        flags.append(f"- HIGH 1-2★: {name} — {'; '.join(lows)}")

buf = io.StringIO()
w = csv.DictWriter(buf, fieldnames=cols, lineterminator='\r\n')
w.writeheader(); w.writerows(rows)
open(CSV, 'w', encoding='utf-8', newline='').write(buf.getvalue())
errs = [k for k, v in {**A, **F}.items() if v['stock'] not in ('in', 'out')]
rep = [f"# Budget Buys refresh — {stamp}", "",
       f"- Products refreshed: {touched} of {len(rows)}",
       f"- Price fields changed: {changes}",
       f"- Listings that could not be read: {len(errs)}", "",
       "## Needs attention", *(flags or ["- Nothing flagged"])]
if errs: rep += ["", "## Unreadable listings", *[f"- {e}" for e in errs]]
open(report_path, 'w', encoding='utf-8').write('\n'.join(rep) + '\n')
print('\n'.join(rep))
