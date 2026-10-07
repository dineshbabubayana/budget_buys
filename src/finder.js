(function () {
  'use strict';

  /* ---------- Home page: category → budget → usage finder ---------- */
  var dataEl = document.getElementById('bb-data');
  var root = document.getElementById('finder');
  if (dataEl && root) {
    var data = JSON.parse(dataEl.textContent);
    var params = new URLSearchParams(location.search);
    var live = data.categories.filter(function (c) { return !c.comingSoon; });
    var state = {
      cat: params.get('cat') || (live[0] && live[0].slug),
      range: params.get('range') || '',
      use: params.get('use') || 'all'
    };

    var catBox = document.getElementById('f-cats');
    var rangeBox = document.getElementById('f-ranges');
    var useBox = document.getElementById('f-use');
    var useStep = document.getElementById('f-use-step');
    var list = document.getElementById('r-list');
    var heading = document.getElementById('r-heading');
    var more = document.getElementById('r-more');

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }
    function cur() { return data.categories.find(function (c) { return c.slug === state.cat; }) || live[0]; }
    function rupee(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

    function chip(label, on, onClick, extra) {
      var b = el('button', 'chip', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (extra) { var s = el('small', null, extra); b.appendChild(s); }
      b.addEventListener('click', onClick);
      return b;
    }

    function renderControls() {
      var c = cur();
      catBox.querySelectorAll('.tile').forEach(function (t) {
        t.setAttribute('aria-pressed', t.dataset.cat === c.slug ? 'true' : 'false');
      });
      if (!c.ranges.some(function (r) { return r.slug === state.range; })) {
        var counts = c.ranges.map(function (r) { return countFor(c.slug, r.slug); });
        var firstWith = c.ranges.find(function (r, i) { return counts[i] > 0; });
        state.range = (c.ranges.find(function (r) { return r.slug === c.defaultRange; }) || firstWith || c.ranges[0]).slug;
      }
      rangeBox.textContent = '';
      c.ranges.forEach(function (r) {
        var n = countFor(c.slug, r.slug);
        var b = chip(r.label, r.slug === state.range, function () { state.range = r.slug; update(); });
        if (!n) b.disabled = true;
        rangeBox.appendChild(b);
      });
      useBox.textContent = '';
      var uses = c.usage ? Object.keys(c.usage) : [];
      useStep.hidden = uses.length === 0;
      if (uses.length) {
        if (state.use !== 'all' && uses.indexOf(state.use) < 0) state.use = 'all';
        useBox.appendChild(chip('Anything', state.use === 'all', function () { state.use = 'all'; update(); }));
        uses.forEach(function (u) {
          useBox.appendChild(chip(c.usage[u], state.use === u, function () { state.use = u; update(); }));
        });
      }
    }

    function countFor(cat, range) {
      return data.products.filter(function (p) { return p.cat === cat && p.range === range; }).length;
    }

    function renderResults() {
      var c = cur();
      var r = c.ranges.find(function (x) { return x.slug === state.range; });
      var all = data.products.filter(function (p) { return p.cat === c.slug && p.range === state.range; })
        .sort(function (a, b) { return a.p - b.p; });
      var shown = state.use === 'all' ? all : all.filter(function (p) { return p.usage.indexOf(state.use) >= 0; });
      heading.textContent = (state.use === 'all' ? 'Best ' : 'Best for ' + c.usage[state.use].toLowerCase() + ': ') +
        c.name.toLowerCase() + ' ' + (r ? r.title : '');
      list.textContent = '';
      if (!shown.length) {
        var e = el('li', 'empty', all.length
          ? 'None of our picks in this budget are tagged for this use. Try "Anything" or the next budget up.'
          : 'We are still researching this budget. Check back soon.');
        list.appendChild(e);
      }
      shown.forEach(function (p, i) {
        var li = el('li', 'rcard' + (i === 0 ? ' first' : ''));
        li.appendChild(el('span', 'rank', String(i + 1)));
        var body = el('div', 'rbody');
        body.appendChild(el('span', 'role', p.role));
        var name = el('div', 'rname', p.brand + ' ' + p.model + ' ');
        name.appendChild(el('span', null, p.variant));
        body.appendChild(name);
        body.appendChild(el('div', 'rwhy', p.why));
        if (p.badge) body.appendChild(el('span', 'badge', p.badge));
        li.appendChild(body);
        var buy = el('div', 'buy');
        buy.appendChild(storeBtn('Amazon', p.amz, p.ap, 'btn-amz'));
        buy.appendChild(storeBtn('Flipkart', p.fk, p.fp, 'btn-fk'));
        li.appendChild(buy);
        list.appendChild(li);
      });
      var baseEl = document.querySelector('[data-base]');
      var base = baseEl ? baseEl.dataset.base : '/';
      var idx = baseEl ? (baseEl.dataset.index || '') : '';
      more.href = base + c.slug + '/' + state.range + '/' + idx + (state.use !== 'all' ? '#use-' + state.use : '');
      more.hidden = !all.length;
    }

    function storeBtn(store, url, price, cls) {
      if (!url) { var off = el('span', 'btn off', 'Not on ' + store); return off; }
      var a = el('a', 'btn ' + cls, store);
      a.href = url;
      a.rel = 'sponsored nofollow noopener';
      a.target = '_blank';
      if (price) a.appendChild(el('span', null, rupee(price)));
      return a;
    }

    function update() {
      renderControls();
      renderResults();
      var q = new URLSearchParams({ cat: state.cat, range: state.range });
      if (state.use !== 'all') q.set('use', state.use);
      history.replaceState(null, '', '?' + q.toString() + location.hash);
    }

    catBox.querySelectorAll('.tile').forEach(function (t) {
      t.addEventListener('click', function () { state.cat = t.dataset.cat; state.range = ''; state.use = 'all'; update(); });
    });
    update();
  }

  /* ---------- Budget page: filter picks by usage ---------- */
  var useBar = document.getElementById('use-bar');
  if (useBar) {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.pick[data-usage]'));
    var rows = Array.prototype.slice.call(document.querySelectorAll('.quick tr[data-usage]'));
    var none = document.getElementById('use-none');
    var buttons = Array.prototype.slice.call(useBar.querySelectorAll('button'));
    function apply(use) {
      var shown = 0;
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.use === use ? 'true' : 'false'); });
      cards.concat(rows).forEach(function (n) {
        var ok = use === 'all' || (' ' + n.dataset.usage + ' ').indexOf(' ' + use + ' ') >= 0;
        n.hidden = !ok;
        if (ok && n.classList.contains('pick')) shown++;
      });
      if (none) none.hidden = shown > 0;
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        apply(b.dataset.use);
        history.replaceState(null, '', b.dataset.use === 'all' ? location.pathname : '#use-' + b.dataset.use);
      });
    });
    var m = location.hash.match(/^#use-([a-z-]+)$/);
    if (m && buttons.some(function (b) { return b.dataset.use === m[1]; })) apply(m[1]);
  }
})();
