"""Drop scan candidates already on the site and keep the best few per range.
Usage: python3 scripts/refresh/scout_filter.py <scout_results.txt> [per_range=3]
Input lines: category|range|store|id|price|rating|ratings|title (from scout.js).
Prints candidates not in data/products.csv, ranked by rating then ratings count."""
import csv, os, re, sys
from collections import defaultdict
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
rows = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'products.csv'), encoding='utf-8')))
known = set()
for r in rows:
    m = re.search(r'/dp/([A-Z0-9]{10})', r['amazon_url'] or '');  known.add(m.group(1)) if m else None
    m = re.search(r'pid=(\w+)', r['flipkart_url'] or '');          known.add(m.group(1)) if m else None
per = int(sys.argv[2]) if len(sys.argv) > 2 else 3
groups = defaultdict(list)
for line in open(sys.argv[1], encoding='utf-8'):
    p = line.rstrip('\n').split('|')
    if len(p) < 8 or p[3] in ('', 'ERROR'): continue
    key = p[3] if p[2] == 'amazon' else (re.search(r'pid=(\w+)', p[3]) or [None, p[3]])[1]
    if key in known: continue
    try: groups[(p[0], p[1])].append((float(p[5]), int(p[6]), p))
    except ValueError: continue
for (cat, rng), items in groups.items():
    items.sort(key=lambda x: (-x[0], -x[1]))
    print(f"## {cat} · {rng}")
    for rating, cnt, p in items[:per]:
        print(f"- {p[2]} {p[3]} ₹{p[4]} {rating}★ ({cnt} ratings) — {p[7]}")
