// Budget Buys static site generator. No dependencies: `node build.mjs` → dist/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
// --preview: self-contained copy with relative links and inlined CSS/JS (for previewing as an artifact)
const PREVIEW = process.argv.includes('--preview');
const OUT = path.join(ROOT, PREVIEW ? 'dist-preview' : 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const CSS = fs.readFileSync(path.join(ROOT, 'src', 'styles.css'), 'utf8') +
  '\n.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\n';
const JS = fs.readFileSync(path.join(ROOT, 'src', 'finder.js'), 'utf8');

/* ---------- helpers ---------- */
function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((c) => c !== '')) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupee = (n) => '₹' + Number(n).toLocaleString('en-IN');
const num = (s) => { const n = Number(String(s).replace(/[^\d.]/g, '')); return n > 0 ? n : null; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function niceDate(s) {
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}
function withAmazonTag(url) {
  if (!url || !config.amazonTag || /[?&]tag=/.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'tag=' + encodeURIComponent(config.amazonTag);
}
function toPreview(rel, html) {
  const depth = rel.split('/').length - 1;
  const up = depth ? '../'.repeat(depth) : './';
  html = html.replace(/(href|src)="\/(?!\/)([^"#]*)(#[^"]*)?"/g, (m, attr, p, hash) => {
    if (p.startsWith('assets/')) return m;
    const target = p === '' || p.endsWith('/') ? p + 'index.html' : p;
    return `${attr}="${up}${target}${hash || ''}"`;
  });
  html = html.replace('<link rel="stylesheet" href="/assets/styles.css">', `<style>${CSS}</style>`)
    .replace('<script src="/assets/finder.js" defer></script>', `<script>${JS.replace(/<\/script/g, '<\\/script')}</script>`)
    .replace('<body>', `<body data-base="${up}" data-index="index.html">`);
  if (rel === 'index.html') {
    html = html.replace(/^<!doctype html>\s*<html[^>]*>\s*<head>/, '').replace('</head>', '')
      .replace(/<body[^>]*>/, (m) => `<div ${m.slice(6, -1)}>`).replace(/<\/body>\s*<\/html>\s*$/, '</div>');
  }
  return html;
}
function write(rel, content) {
  if (PREVIEW && rel.endsWith('.html')) content = toPreview(rel, content);
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
const icon = (d, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;

/* ---------- data ---------- */
const cats = config.categories;
const catByName = Object.fromEntries(cats.map((c) => [c.name.toLowerCase(), c]));
const raw = parseCSV(fs.readFileSync(path.join(ROOT, 'data', 'products.csv'), 'utf8'));
const products = [];
for (const r of raw) {
  const cat = catByName[(r.category || '').toLowerCase()];
  if (!cat) { console.warn('Skipping row with unknown category:', r.category, r.model); continue; }
  const range = cat.ranges.find((x) => x.label === r.range || x.slug === r.range);
  if (!range) { console.warn('Skipping row with unknown range:', r.range, r.model); continue; }
  products.push({
    cat: cat.slug, range: range.slug, p: Number(r.priority) || 99,
    brand: r.brand, model: r.model, variant: r.variant, role: r.role,
    usage: (r.usage_tags || '').split('|').map((s) => s.trim()).filter(Boolean),
    badge: r.value_badge, why1: r.why_1, why2: r.why_2, drawback: r.drawback, buyIf: r.buy_if,
    ap: num(r.amazon_price), fp: num(r.flipkart_price),
    amz: withAmazonTag(r.amazon_affiliate_url || r.amazon_url),
    fk: r.flipkart_affiliate_url || r.flipkart_url,
    checked: niceDate(r.price_checked_at), brands: r.brands_in_range
  });
}
products.sort((a, b) => a.p - b.p);
const picksFor = (c, r) => products.filter((p) => p.cat === c && p.range === r);
const latest = products.map((p) => p.checked).filter(Boolean)[0] || '';

/* ---------- layout ---------- */
const FAVICON = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#C2410C"/><text x="32" y="45" font-family="Arial,sans-serif" font-size="38" font-weight="700" fill="#fff" text-anchor="middle">₹</text></svg>');

function layout({ title, desc, pathname, body, activeCat, jsonld }) {
  const canonical = config.baseUrl.replace(/\/$/, '') + pathname;
  const nav = cats.filter((c) => !c.comingSoon).map((c) =>
    `<a href="/${c.slug}/"${c.slug === activeCat ? ' aria-current="page"' : ''}>${esc(c.name)}</a>`).join('') +
    `<span class="soon">More categories soon</span>`;
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta name="theme-color" content="#14171F">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${config.saleBanner ? `<div class="banner"><strong>${esc(config.saleBanner.split('·')[0].trim())}</strong>${config.saleBanner.includes('·') ? ' · ' + esc(config.saleBanner.split('·').slice(1).join('·').trim()) : ''}</div>` : ''}
<header class="site-head"><div class="wrap">
<a class="logo" href="/"><span class="logo-mark" aria-hidden="true">₹</span><span class="logo-name">${esc(config.siteName)}</span></a>
<nav class="nav" aria-label="Categories">${nav}</nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-foot"><div class="wrap">
<div><strong>Disclosure:</strong> ${esc(config.siteName)} earns a small commission when you buy through our Amazon and Flipkart links, at no extra cost to you. It never changes which products we pick or how we rank them.</div>
<div class="foot-links"><a href="/about/">How we pick</a><a href="/disclosure/">Affiliate disclosure</a><a href="/privacy/">Privacy</a>${config.contactEmail ? `<a href="mailto:${esc(config.contactEmail)}">Contact</a>` : ''}</div>
<div>© ${new Date().getFullYear()} ${esc(config.siteName)} · Prices and stock change often, especially during sales. The store page always shows the final price.</div>
</div></footer>
<script src="/assets/finder.js" defer></script>
</body>
</html>`;
}

const storeBtn = (store, url, price, cls) => url
  ? `<a class="btn ${cls}" href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener">${store === 'Amazon' ? 'Buy on Amazon' : 'Buy on Flipkart'}${price ? ` <span>${rupee(price)}</span>` : ''}</a>`
  : `<span class="btn off">Not on ${store} right now</span>`;
const smallBtn = (store, url, price, cls) => url
  ? `<a class="btn ${cls}" href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener">${store}${price ? ` <span>${rupee(price)}</span>` : ''}</a>`
  : `<span class="btn off">Not on ${store}</span>`;
const bestPrice = (p) => [p.ap, p.fp].filter(Boolean).sort((a, b) => a - b)[0];
const lower = (n) => (/^[A-Z]{2,}s?$/.test(n) ? n : n.toLowerCase());
const pageTitle = (c, r) => `Best ${lower(c.name)} ${r.title}`;

/* ---------- home ---------- */
function home() {
  const live = cats.filter((c) => !c.comingSoon);
  const tiles = cats.map((c) => c.comingSoon
    ? `<button type="button" class="tile" disabled>${icon(c.icon, 22)}${esc(c.name)}<small>Coming soon</small></button>`
    : `<button type="button" class="tile" data-cat="${c.slug}" aria-pressed="false">${icon(c.icon, 22)}${esc(c.name)}</button>`).join('');
  const finderData = {
    categories: cats.map((c) => ({
      slug: c.slug, name: c.name, comingSoon: !!c.comingSoon, usage: c.usage || null,
      defaultRange: c.slug === 'phones' ? '10-15k' : undefined,
      ranges: c.ranges.map((r) => ({ slug: r.slug, label: r.label, title: r.title }))
    })),
    products: products.map((p) => ({
      cat: p.cat, range: p.range, p: p.p, brand: p.brand, model: p.model, variant: p.variant, role: p.role,
      usage: p.usage, badge: p.badge, why: p.why1, amz: p.amz, fk: p.fk, ap: p.ap, fp: p.fp
    }))
  };
  const soon = cats.filter((c) => c.comingSoon);
  const soonCard = soon.length ? `<div class="cat-card soon"><h3>Coming soon</h3><ul>${soon.map((c) =>
    `<li style="display:flex;align-items:center;gap:10px;padding:8px 0;color:var(--muted)"><span style="color:var(--faint)">${icon(c.icon, 20)}</span>${esc(c.name)}</li>`).join('')}</ul></div>` : '';
  const catCards = live.map((c) =>
    `<div class="cat-card"><div class="cat-icon">${icon(c.icon)}</div><h3><a href="/${c.slug}/" style="text-decoration:none">${esc(c.name)}</a></h3><ul>${
      c.ranges.filter((r) => picksFor(c.slug, r.slug).length).map((r) => `<li><a href="/${c.slug}/${r.slug}/">${esc(r.label)} <span aria-hidden="true">→</span></a></li>`).join('')}</ul></div>`).join('') + soonCard;
  const tops = live.flatMap((c) => c.ranges.map((r) => [c, r, picksFor(c.slug, r.slug)[0]])).filter((x) => x[2]);
  const topCards = tops.map(([c, r, p]) => `<article class="pcard">
<span class="role">Top pick · ${esc(c.name)} ${esc(r.label)}</span>
<h3 class="rname">${esc(p.brand)} ${esc(p.model)} <span>${esc(p.variant)}</span></h3>
<p class="rwhy" style="margin:0">${esc(p.why1)}</p>
${bestPrice(p) ? `<div class="price">${rupee(bestPrice(p))} <small>best price we saw · ${esc(p.checked)}</small></div>` : ''}
<div class="buy">${smallBtn('Amazon', p.amz, p.ap, 'btn-amz')}${smallBtn('Flipkart', p.fk, p.fp, 'btn-fk')}</div>
<a class="more-link" style="margin-top:0" href="/${c.slug}/${r.slug}/">All ${esc(lower(c.name))} ${esc(r.title)} →</a>
</article>`).join('');
  const nProducts = products.length;
  const body = `
<section class="hero"><div class="wrap">
<div class="hero-copy">
<span class="eyebrow">Honest picks, by budget</span>
<h1>Tell us your budget.<br>We'll tell you what to buy.</h1>
<p class="lede">Ranked picks for every price range, with one clear reason for each, an honest drawback, and links to both Amazon and Flipkart so you can grab whichever is cheaper today.</p>
<div class="hero-stats"><span class="pill">${nProducts} picks across ${tops.length} budgets</span>${latest ? `<span class="pill hot">Prices checked ${esc(latest)}</span>` : ''}</div>
</div>
<form class="finder" id="finder" onsubmit="return false" aria-label="Find your pick">
<h2>Find your pick</h2>
<fieldset class="step"><legend><span class="step-n">1</span>I want to buy</legend><div class="cat-tiles" id="f-cats">${tiles}</div></fieldset>
<fieldset class="step"><legend><span class="step-n">2</span>My budget is <span class="hint">pick one or more</span></legend><div class="chips" id="f-ranges"></div></fieldset>
<fieldset class="step" id="f-use-step"><legend><span class="step-n">3</span>What matters most?</legend><div class="chips" id="f-use"></div></fieldset>
<a class="chip on" href="#results" style="justify-content:center;border-radius:12px;font-size:17px;padding:14px">See my picks ↓</a>
</form>
</div></section>

<section class="results" id="results" aria-live="polite"><div class="wrap">
<div class="results-head"><h2 id="r-heading">Best picks</h2><span class="note">Tap a store to see today's price</span></div>
<ol class="rlist" id="r-list"><li class="empty">Loading picks…</li></ol>
<noscript><p class="empty">Turn on JavaScript to use the finder, or browse the budget pages below.</p></noscript>
<a class="more-link" id="r-more" href="/phones/">Read the full guide for this budget →</a>
</div></section>

<section class="band" id="cats"><div class="wrap section">
<div class="section-head"><h2>Browse by category</h2><p>Pick a category, then your price range</p></div>
<div class="cat-grid">${catCards}</div>
</div></section>

<section class="section"><div class="wrap">
<div class="section-head"><h2>Top pick in every budget</h2><p>The #1 choice in each price range</p></div>
<div class="picks-grid">${topCards}</div>
</div></section>

<section class="dark"><div class="wrap section how">
<div><h2>How we pick</h2><p style="margin-top:10px">No sponsored rankings. Every list is built the same way.</p></div>
<div><h3>1. Store data first</h3><p>We filter Amazon and Flipkart by price, ratings and specs, then read the 1–3★ reviews to catch repeated problems.</p></div>
<div><h3>2. Value decides the rank</h3><p>Picks are ranked by what you get for the money, then brand service and update promises. Commission never counts.</p></div>
<div><h3>3. Honest drawbacks</h3><p>Every pick lists one real weakness and a "buy this if" line, so you can choose the one that fits you.</p></div>
</div></section>
<script type="application/json" id="bb-data">${JSON.stringify(finderData).replace(/</g, '\\u003c')}</script>`;
  write('index.html', layout({
    title: `${config.siteName} — best phones and gadgets for your budget`,
    desc: 'Pick a category and your budget, and get ranked, honest picks with Amazon and Flipkart prices side by side.',
    pathname: '/', body,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: config.siteName, url: config.baseUrl }
  }));
}

/* ---------- category landing ---------- */
function categoryPage(c) {
  const rows = c.ranges.map((r) => {
    const list = picksFor(c.slug, r.slug);
    if (!list.length) return `<div class="cat-card soon"><h3>${esc(r.label)}</h3><p class="soon-text">Researching now</p></div>`;
    const p = list[0];
    return `<div class="cat-card">
<span class="role">${esc(r.label)} · ${list.length} picks</span>
<h3><a href="/${c.slug}/${r.slug}/" style="text-decoration:none">${esc(pageTitle(c, r)).replace(/^./, (m) => m.toUpperCase())}</a></h3>
<p class="rwhy" style="margin:0"><strong style="color:var(--ink)">#1: ${esc(p.brand)} ${esc(p.model)}</strong> — ${esc(p.role.toLowerCase())}</p>
<ul><li><a href="/${c.slug}/${r.slug}/">See all ${list.length} picks <span aria-hidden="true">→</span></a></li></ul>
</div>`;
  }).join('');
  const body = `<div class="wrap">
<div class="page-top">
<div class="crumbs"><a href="/">Home</a> / ${esc(c.name)}</div>
<h1>Best ${esc(lower(c.name))} for every budget</h1>
<p class="lede">Choose your price range to see our ranked picks, from ${esc(c.ranges[0].title)} to ${esc(c.ranges[c.ranges.length - 1].title)}.</p>
</div>
<div class="cat-grid" style="padding:24px 0 40px">${rows}</div>
${c.guide ? `<section class="guide" style="padding-bottom:64px;max-width:860px"><h2>How to choose ${esc(lower(c.name))}</h2>${c.guide.map((g) => `<p>${esc(g)}</p>`).join('')}</section>` : ''}
</div>`;
  write(`${c.slug}/index.html`, layout({
    title: `Best ${lower(c.name)} by budget (${new Date().getFullYear()}) — ${config.siteName}`,
    desc: `Ranked ${lower(c.name)} picks for every budget in India, with Amazon and Flipkart prices.`,
    pathname: `/${c.slug}/`, body, activeCat: c.slug
  }));
}

/* ---------- budget page ---------- */
function budgetPage(c, r) {
  const list = picksFor(c.slug, r.slug);
  if (!list.length) return false;
  const title = pageTitle(c, r);
  const H1 = title.charAt(0).toUpperCase() + title.slice(1);
  const checked = list.map((p) => p.checked).find(Boolean) || '';
  const others = c.ranges.filter((x) => picksFor(c.slug, x.slug).length).map((x) =>
    x.slug === r.slug ? `<span class="chip on" aria-current="page">${esc(x.label)}</span>`
      : `<a class="chip" href="/${c.slug}/${x.slug}/">${esc(x.label)}</a>`).join('');
  const usedTags = Object.keys(c.usage || {}).filter((u) => list.some((p) => p.usage.includes(u)));
  const useBar = usedTags.length > 1 ? `<div class="other" id="use-bar" role="group" aria-label="Filter by what matters most">
<span class="other-label">What matters most:</span>
<button type="button" class="chip" data-use="all" aria-pressed="true">Anything</button>
${usedTags.map((u) => `<button type="button" class="chip" data-use="${u}" aria-pressed="false">${esc(c.usage[u])}</button>`).join('')}
</div>` : '';
  const quick = list.map((p, i) => `<tr data-usage="${esc(p.usage.join(' '))}">
<td>${esc(p.role)}</td><td>${esc(p.brand)} ${esc(p.model)}<br><span class="note">${esc(p.variant)}</span></td>
<td>${p.ap ? rupee(p.ap) : '—'}</td><td>${p.fp ? rupee(p.fp) : '—'}</td>
<td style="text-align:right"><a href="#pick-${i + 1}">See why →</a></td></tr>`).join('');
  const cards = list.map((p, i) => `<article class="pick${i === 0 ? ' top' : ''}" id="pick-${i + 1}" data-usage="${esc(p.usage.join(' '))}">
<div class="pick-head"><span class="rank">${i + 1}</span><span class="role-pill">${esc(p.role)}</span>${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}</div>
<h2>${esc(p.brand)} ${esc(p.model)}<span>${esc(p.variant)}</span></h2>
${p.usage.length && c.usage ? `<div class="tags">${p.usage.map((u) => `<span class="tag">${esc(c.usage[u] || u)}</span>`).join('')}</div>` : ''}
<div class="why"><div class="why-h">Why we picked it</div>
<p><span class="y" aria-hidden="true">✓</span>${esc(p.why1)}</p>
${p.why2 ? `<p><span class="y" aria-hidden="true">✓</span>${esc(p.why2)}</p>` : ''}
${p.drawback ? `<p><span class="n" aria-hidden="true">✕</span><span><span class="sr">Drawback: </span>${esc(p.drawback)}</span></p>` : ''}
</div>
${p.buyIf ? `<p class="buyif"><strong>Buy this if</strong> ${esc(p.buyIf.replace(/^./, (m) => m.toLowerCase()))}</p>` : ''}
<div class="buy">${storeBtn('Amazon', p.amz, p.ap, 'btn-amz')}${storeBtn('Flipkart', p.fk, p.fp, 'btn-fk')}</div>
${p.checked ? `<p class="checked">Prices checked ${esc(p.checked)}. Tap through to see today's price.</p>` : ''}
</article>`).join('');
  const brands = list.map((p) => p.brands).find(Boolean);
  const body = `<div class="narrow">
<div class="page-top">
<div class="crumbs"><a href="/">Home</a> / <a href="/${c.slug}/">${esc(c.name)}</a> / ${esc(r.label)}</div>
<h1>${esc(H1)}</h1>
<p class="lede">${list.length} picks for different kinds of buyers, ranked by value for money. Find the one that matches how you'll use it, check both stores, and buy the cheaper one.</p>
<div class="hero-stats">${checked ? `<span class="pill">Prices checked ${esc(checked)}</span>` : ''}<span class="pill hot">Re-checked during the sale</span></div>
</div>
<div class="stack">
<div class="other"><span class="other-label">Other budgets:</span>${others}</div>
${useBar}
<section class="quick" aria-labelledby="quick-h"><div class="quick-h" id="quick-h">Quick answer</div>
<div class="tscroll"><table><thead><tr><th>Best for</th><th>Pick</th><th>Amazon</th><th>Flipkart</th><th><span class="sr">Details</span></th></tr></thead><tbody>${quick}</tbody></table></div></section>
<p class="empty" id="use-none" hidden>None of the picks in this budget are tagged for that. Try "Anything" or another budget.</p>
${cards}
${c.guide ? `<section class="guide"><h2>How to choose ${esc(lower(c.name))} ${esc(r.title)}</h2>${c.guide.map((g) => `<p>${esc(g)}</p>`).join('')}${brands ? `<p class="brands"><strong style="color:var(--ink)">Brands worth buying in this range:</strong> ${esc(brands)}.</p>` : ''}</section>` : ''}
<div class="disclose"><strong>Disclosure:</strong> We earn a small commission when you buy through these Amazon and Flipkart links, at no extra cost to you. Prices change often during sales — the store page always shows the final price.</div>
</div></div>`;
  write(`${c.slug}/${r.slug}/index.html`, layout({
    title: `${H1} (${new Date().getFullYear()}) — ${config.siteName}`,
    desc: `${list.length} ranked ${lower(c.name)} ${r.title}: ${list.slice(0, 3).map((p) => p.brand + ' ' + p.model).join(', ')}. Amazon and Flipkart prices side by side.`,
    pathname: `/${c.slug}/${r.slug}/`, body, activeCat: c.slug,
    jsonld: {
      '@context': 'https://schema.org', '@type': 'ItemList', name: H1,
      itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: `${p.brand} ${p.model} ${p.variant}` }))
    }
  }));
  return true;
}

/* ---------- static pages ---------- */
function prose(slug, title, html, desc) {
  write(`${slug}/index.html`, layout({
    title: `${title} — ${config.siteName}`, desc, pathname: `/${slug}/`,
    body: `<div class="narrow prose"><div class="crumbs"><a href="/">Home</a> / ${esc(title)}</div><h1>${esc(title)}</h1>${html}</div>`
  }));
}

/* ---------- build ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
if (!PREVIEW) { write('assets/styles.css', CSS); write('assets/finder.js', JS); }

home();
const urls = ['/'];
for (const c of cats.filter((x) => !x.comingSoon)) {
  categoryPage(c); urls.push(`/${c.slug}/`);
  for (const r of c.ranges) if (budgetPage(c, r)) urls.push(`/${c.slug}/${r.slug}/`);
}

prose('about', 'How we pick', `
<p>${esc(config.siteName)} answers one question: what is the best thing to buy for the money you have? Every list follows the same process.</p>
<h2>1. We start on the stores</h2>
<p>We search Amazon and Flipkart with price filters, rating filters and spec filters, using several different searches per budget so popular listings don't hide better options.</p>
<h2>2. We read the bad reviews</h2>
<p>For every shortlisted product we read recent 1–3★ buyer reviews. Repeated problems — heating, dead screens, battery drain, poor service — knock a product down or off the list.</p>
<h2>3. We rank by value, not commission</h2>
<p>Picks are ranked by what you get for the price, then by how well they suit a specific use, then by brand service and software-update promises. How much a store pays us never affects a ranking.</p>
<h2>4. We show the drawback</h2>
<p>Every pick has one honest weakness and a "buy this if" line. If a cheaper phone inside a budget gets you most of the way, it gets a "Best value" badge so you don't overspend.</p>
<h2>5. We re-check prices</h2>
<p>Prices move fast, especially during sales. Each pick shows the date we last checked it, and the store page always has the final price.</p>`,
'How Budget Buys researches and ranks its picks.');
prose('disclosure', 'Affiliate disclosure', `
<p>${esc(config.siteName)} is a participant in the Amazon Associates programme and other affiliate programmes, including programmes covering Flipkart. When you buy through our links, we may earn a small commission at no extra cost to you.</p>
<p>Commissions help pay for the time spent researching. They never decide which products we pick or how we rank them. We link to both Amazon and Flipkart wherever a product is sold on both, so you can choose the cheaper store.</p>
<p>As an Amazon Associate we earn from qualifying purchases.</p>`,
'How Budget Buys earns money from affiliate links.');
prose('privacy', 'Privacy', `
<p>${esc(config.siteName)} does not ask for an account, does not collect your name or email, and does not set its own cookies.</p>
<p>When you tap a "Buy on Amazon" or "Buy on Flipkart" button you leave this site. Amazon and Flipkart may set cookies to record that you came from us, so they can pay us a commission. Their own privacy policies apply on their sites.</p>
<p>Our pages load fonts from Google Fonts, which may log your IP address as part of serving the files.</p>`,
'Budget Buys privacy policy.');

write('404.html', layout({
  title: `Page not found — ${config.siteName}`, desc: 'Page not found', pathname: '/404',
  body: `<div class="narrow prose"><h1>We couldn't find that page</h1><p>The budget you're looking for may have moved. <a href="/">Go to the finder</a> or pick a category from the menu.</p></div>`
}));
const base = config.baseUrl.replace(/\/$/, '');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
  [...urls, '/about/', '/disclosure/', '/privacy/'].map((u) => `<url><loc>${base}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
write('_headers', `/assets/*\n  Cache-Control: public, max-age=3600\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

console.log(`Built ${urls.length} pages from ${products.length} products → ${path.basename(OUT)}/`);
if (!config.amazonTag) console.log('Note: amazonTag is empty in config.json, so Amazon links have no affiliate tag yet.');
