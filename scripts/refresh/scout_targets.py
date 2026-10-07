"""List every category/range with its price bounds and search term, for the weekly new-launch scan.
Usage: python3 scripts/refresh/scout_targets.py  -> JSON list of {category, range, lo, hi, q}"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cfg = json.load(open(os.path.join(ROOT, 'config.json'), encoding='utf-8'))
terms = json.load(open(os.path.join(os.path.dirname(__file__), 'search_terms.json'), encoding='utf-8'))
out = []
for c in cfg['categories']:
    if c.get('comingSoon') or c['name'] not in terms: continue
    for r in c['ranges']:
        t = r['title'].replace(',', ''); n = [int(x) for x in re.findall(r'₹(\d+)', t)]
        lo, hi = (0, n[0]) if t.startswith('under') else ((n[0], n[0] * 3) if t.startswith('above') else (n[0], n[1]))
        out.append(dict(category=c['name'], range=r['label'], lo=max(lo, 1), hi=hi, q=terms[c['name']]))
print(json.dumps(out, ensure_ascii=False))
