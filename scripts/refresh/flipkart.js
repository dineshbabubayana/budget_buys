// Paste into the built-in browser's javascript_tool on a flipkart.com tab, then call:
//   await refreshFlipkart(['slug/p/itm...?pid=...', ...], true)
// Returns one line per path: path|price|stock|rating|ratings|low
//   low (1-2 star %) is read from the reviews page only when withReviews is true.
window.refreshFlipkart = async (paths, withReviews = false, pool = 5) => {
  const reviews = async (path) => {
    try {
      const [slug, rest] = path.split('/p/');
      const h = await fetch(`/${slug}/product-reviews/${rest}&sortOrder=NEGATIVE_FIRST`).then((r) => r.text());
      const t = new DOMParser().parseFromString(h, 'text/html').body.textContent.replace(/\s+/g, ' ');
      const m = t.match(/([\d,]+) ratings and [\d,]+ reviews1★([\d,]+)2★([\d,]+)3★/);
      if (!m) return '';
      const n = (x) => +x.replace(/,/g, '');
      return ((n(m[2]) + n(m[3])) / n(m[1]) * 100).toFixed(1);
    } catch (e) { return ''; }
  };
  const one = async (path) => {
    try {
      const h = await fetch('/' + path).then((r) => r.text());
      let price = '', stock = 'unknown', rating = '', cnt = '';
      for (const m of h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
        try {
          const j = JSON.parse(m[1]);
          for (const x of (Array.isArray(j) ? j : [j])) {
            if (x.offers && !price) {
              const o = Array.isArray(x.offers) ? x.offers[0] : x.offers;
              price = String(Math.round(o.price || o.lowPrice || 0) || '');
              stock = /InStock/i.test(o.availability || '') ? 'in' : (/OutOfStock|SoldOut|Discontinued/i.test(o.availability || '') ? 'out' : stock);
            }
            if (x.aggregateRating && !rating) { rating = String(x.aggregateRating.ratingValue || ''); cnt = String(x.aggregateRating.ratingCount || ''); }
          }
        } catch (e) {}
      }
      if (/Currently unavailable|Sold Out|Coming Soon/.test(h.slice(0, 400000)) && stock !== 'in') stock = 'out';
      const low = withReviews ? await reviews(path) : '';
      return `${path}|${stock === 'out' ? '' : price}|${stock}|${rating}|${cnt}|${low}`;
    } catch (e) { return `${path}||error|||`; }
  };
  const out = []; let i = 0;
  const workers = Array.from({ length: pool }, async () => { while (i < paths.length) { const p = paths[i++]; out.push(await one(p)); } });
  await Promise.all(workers);
  return out.join('\n');
};
