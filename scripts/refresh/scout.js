// Weekly new-launch scan. Paste on the matching store tab, then call (start in background, read window.jobResult):
//   scoutAmazon([{category,range,lo,hi,q}, ...], knownAsins)        on amazon.in
//   scoutFlipkart([{category,range,lo,hi,q}, ...], knownPaths)      on flipkart.com
// Returns lines: category|range|store|id|price|rating|ratings|title for the MOST POPULAR listings in each
// range (popularity sort surfaces new launches once buyers rate them) that are not already on the site,
// with rating >= 4.2 and at least 100 ratings. Pass known ids, or filter later with scout_filter.py.
window.scoutAmazon = async (targets, known = [], pool = 4) => {
  const seen = new Set(known), out = [];
  const one = async (t) => {
    try {
      const h = await fetch(`/s?k=${encodeURIComponent(t.q)}&rh=p_36%3A${t.lo * 100}-${t.hi * 100}&s=exact-aware-popularity-rank`).then((r) => r.text());
      const d = new DOMParser().parseFromString(h, 'text/html');
      for (const e of d.querySelectorAll('div[data-asin][data-component-type="s-search-result"]')) {
        const a = e.dataset.asin; if (!a || seen.has(a) || e.textContent.includes('Sponsored')) continue;
        const rating = parseFloat(e.querySelector('.a-icon-alt')?.textContent || '0');
        const cntTxt = (e.querySelector('[aria-label$="ratings"], a[href*="customerReviews"] span')?.textContent || '').replace(/[(),\s]/g, '');
        const cnt = /K$/i.test(cntTxt) ? parseFloat(cntTxt) * 1000 : (/L$/i.test(cntTxt) ? parseFloat(cntTxt) * 100000 : parseFloat(cntTxt) || 0);
        if (rating < 4.2 || cnt < 100) continue;
        seen.add(a);
        const price = (e.querySelector('.a-price .a-offscreen')?.textContent || '').replace(/[^\d.]/g, '').split('.')[0];
        const title = (e.querySelector('h2')?.getAttribute('aria-label') || e.querySelector('h2')?.textContent || '').trim().replace(/\|/g, '/').slice(0, 90);
        out.push(`${t.category}|${t.range}|amazon|${a}|${price}|${rating}|${Math.round(cnt)}|${title}`);
      }
    } catch (e) { out.push(`${t.category}|${t.range}|amazon|ERROR||||`); }
  };
  let i = 0; await Promise.all(Array.from({ length: pool }, async () => { while (i < targets.length) await one(targets[i++]); }));
  return out.join('\n');
};
window.scoutFlipkart = async (targets, known = [], pool = 4) => {
  const seen = new Set(known.map((p) => (p.match(/pid=(\w+)/) || [])[1]).filter(Boolean)), out = [];
  const one = async (t) => {
    try {
      const h = await fetch(`/search?q=${encodeURIComponent(t.q)}&sort=popularity&p%5B%5D=facets.price_range.from%3D${t.lo}&p%5B%5D=facets.price_range.to%3D${t.hi}`).then((r) => r.text());
      const d = new DOMParser().parseFromString(h, 'text/html');
      for (const a of d.querySelectorAll('a[href*="/p/itm"]')) {
        const m = a.getAttribute('href').match(/^\/([^/]+)\/p\/(itm\w+)\?pid=(\w+)/); if (!m || seen.has(m[3])) continue;
        const box = a.closest('div[data-id]') || a; const txt = box.textContent.replace(/\s+/g, ' ');
        if (/Currently unavailable|Coming Soon/.test(txt)) continue;
        const r = txt.match(/(\d\.\d)\s*\(?([\d,]+)\)?\s*(?:Ratings|\))/) || txt.match(/(\d\.\d)([\d,]+) Ratings/);
        const rating = r ? parseFloat(r[1]) : 0, cnt = r ? +r[2].replace(/,/g, '') : 0;
        if (rating < 4.2 || cnt < 100) continue;
        seen.add(m[3]);
        const price = ((txt.match(/₹([\d,]+)/) || [])[1] || '').replace(/,/g, '');
        out.push(`${t.category}|${t.range}|flipkart|${m[1]}/p/${m[2]}?pid=${m[3]}|${price}|${rating}|${cnt}|${txt.slice(0, 90).replace(/\|/g, '/')}`);
      }
    } catch (e) { out.push(`${t.category}|${t.range}|flipkart|ERROR||||`); }
  };
  let i = 0; await Promise.all(Array.from({ length: pool }, async () => { while (i < targets.length) await one(targets[i++]); }));
  return out.join('\n');
};
