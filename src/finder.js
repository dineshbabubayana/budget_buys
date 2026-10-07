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
      ranges: (params.get('range') || '').split(',').filter(Boolean),
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
      // keep only valid ranges with picks, in the category's own order
      state.ranges = c.ranges.filter(function (r) {
        return state.ranges.indexOf(r.slug) >= 0 && countFor(c.slug, r.slug) > 0;
      }).map(function (r) { return r.slug; });
      if (!state.ranges.length) {
        var firstWith = c.ranges.find(function (r) { return countFor(c.slug, r.slug) > 0; });
        state.ranges = [(c.ranges.find(function (r) { return r.slug === c.defaultRange; }) || firstWith || c.ranges[0]).slug];
      }
      rangeBox.textContent = '';
      c.ranges.forEach(function (r) {
        var n = countFor(c.slug, r.slug);
        var on = state.ranges.indexOf(r.slug) >= 0;
        var b = chip(r.label, on, function () {
          if (on && state.ranges.length === 1) return; // always keep one budget selected
          state.ranges = on
            ? state.ranges.filter(function (x) { return x !== r.slug; })
            : state.ranges.concat(r.slug);
          update();
        });
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

    // "₹10,000 to ₹15,000" + "₹15,000 to ₹20,000" → "₹10,000 to ₹20,000"; gaps → "₹10–15k + ₹20–30k"
    function budgetTitle(c, sel) {
      if (sel.length === 1) return sel[0].title;
      var idx = sel.map(function (r) { return c.ranges.indexOf(r); });
      var joined = idx.every(function (v, i) { return i === 0 || v === idx[i - 1] + 1; });
      if (!joined) return sel.map(function (r) { return r.label; }).join(' + ');
      var a = sel[0].title, z = sel[sel.length - 1].title;
      var lo = /^under /.test(a) ? null : a.replace(/^above /, '').split(' to ')[0];
      var hi = /^above /.test(z) ? null : z.replace(/^under /, '').split(' to ').pop();
      if (lo && hi) return lo + ' to ' + hi;
      if (hi) return 'under ' + hi;
      if (lo) return 'above ' + lo;
      return 'at every budget';
    }

    function renderResults() {
      var c = cur();
      var sel = c.ranges.filter(function (x) { return state.ranges.indexOf(x.slug) >= 0; });
      var multi = sel.length > 1;
      var baseEl = document.querySelector('[data-base]');
      var base = baseEl ? baseEl.dataset.base : '/';
      var idx = baseEl ? (baseEl.dataset.index || '') : '';
      var hash = state.use !== 'all' ? '#use-' + state.use : '';
      heading.textContent = (state.use === 'all' ? 'Best ' : 'Best for ' + c.usage[state.use].toLowerCase() + ': ') +
        c.name.toLowerCase() + ' ' + budgetTitle(c, sel);
      list.textContent = '';
      var total = 0, totalAll = 0;
      sel.forEach(function (r) {
        var all = data.products.filter(function (p) { return p.cat === c.slug && p.range === r.slug; })
          .sort(function (a, b) { return a.p - b.p; });
        var shown = state.use === 'all' ? all : all.filter(function (p) { return p.usage.indexOf(state.use) >= 0; });
        totalAll += all.length; total += shown.length;
        if (multi && shown.length) {
          var g = el('li', 'rgroup');
          g.appendChild(el('span', 'rgroup-name', r.label));
          var gl = el('a', 'rgroup-link', 'Full guide →');
          gl.href = base + c.slug + '/' + r.slug + '/' + idx + hash;
          g.appendChild(gl);
          list.appendChild(g);
        }
        shown.forEach(function (p, i) { list.appendChild(card(p, i)); });
      });
      if (!total) {
        var e = el('li', 'empty', totalAll
          ? 'None of our picks in ' + (multi ? 'these budgets' : 'this budget') + ' are tagged for this use. Try "Anything" or add the next budget up.'
          : 'We are still researching this budget. Check back soon.');
        list.appendChild(e);
      }
      more.href = base + c.slug + '/' + sel[0].slug + '/' + idx + hash;
      more.hidden = multi || !totalAll;
    }

    function card(p, i) {
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
      return li;
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
      var q = new URLSearchParams({ cat: state.cat, range: state.ranges.join(',') });
      if (state.use !== 'all') q.set('use', state.use);
      history.replaceState(null, '', '?' + q.toString().replace(/%2C/g, ',') + location.hash);
    }

    catBox.querySelectorAll('.tile').forEach(function (t) {
      t.addEventListener('click', function () { state.cat = t.dataset.cat; state.ranges = []; state.use = 'all'; update(); });
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
