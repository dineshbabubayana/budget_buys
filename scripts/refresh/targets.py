"""List the Amazon ASINs and Flipkart paths to refresh, in chunks.
Usage: python3 scripts/refresh/targets.py [chunk_size]
Prints JSON: {"amazon": [[asin,...],...], "flipkart": [[path,...],...]}"""
import csv, json, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
size = int(sys.argv[1]) if len(sys.argv) > 1 else 40
rows = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'products.csv'), encoding='utf-8')))
amz, fk = [], []
for r in rows:
    m = re.search(r'/dp/([A-Z0-9]{10})', r['amazon_url'] or '')
    if m and m.group(1) not in amz: amz.append(m.group(1))
    m = re.search(r'flipkart\.com/(.+/p/itm\w+\?pid=\w+)', r['flipkart_url'] or '')
    if m and m.group(1) not in fk: fk.append(m.group(1))
ch = lambda xs: [xs[i:i + size] for i in range(0, len(xs), size)]
print(json.dumps({"amazon": ch(amz), "flipkart": ch(fk)}))
