// Paste into the built-in browser's javascript_tool on an amazon.in tab, then call:
//   await refreshAmazon(['B0...','B0...'])
// Returns one line per ASIN: asin|price|stock|rating|ratings|low
//   stock = in | out | unknown ; low = % of 1-2 star ratings ('' if no histogram)
window.refreshAmazon = async (asins, pool = 5) => {
  const one = async (a) => {
    try {
      const h = await fetch('/dp/' + a, { credentials: 'include' }).then((r) => r.text());
      const d = new DOMParser().parseFromString(h, 'text/html');
      const whole = [...d.querySelectorAll('#corePriceDisplay_desktop_feature_div .priceToPay .a-price-whole, #corePriceDisplay_desktop_feature_div .a-price-whole, #apex_desktop .priceToPay .a-price-whole, #apex_desktop .a-price-whole')]
        .map((x) => x.textContent.replace(/[^\d]/g, '')).find(Boolean) || '';
      const av = (d.querySelector('#availability')?.textContent || '').replace(/\s+/g, ' ').trim();
      const stock = /currently unavailable|out of stock/i.test(av) ? 'out' : (whole ? 'in' : 'unknown');
      const rating = (d.querySelector('#acrPopover')?.getAttribute('title') || '').slice(0, 3);
      const cnt = (d.querySelector('#acrCustomerReviewText')?.textContent || '').replace(/[^\d]/g, '');
      const m = (d.querySelector('#histogramTable')?.textContent || '').match(/(\d+)%\s*(\d+)%\s*(\d+)%\s*(\d+)%\s*(\d+)%/);
      const low = m ? String(+m[4] + +m[5]) : '';
      if (d.querySelector('form[action*="validateCaptcha"]') || !d.querySelector('#productTitle')) return `${a}||captcha|||`;
      return `${a}|${stock === 'out' ? '' : whole}|${stock}|${rating}|${cnt}|${low}`;
    } catch (e) { return `${a}||error|||`; }
  };
  const out = []; let i = 0;
  const workers = Array.from({ length: pool }, async () => { while (i < asins.length) { const a = asins[i++]; out.push(await one(a)); } });
  await Promise.all(workers);
  return out.join('\n');
};
