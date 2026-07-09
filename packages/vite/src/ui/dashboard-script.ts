/**
 * Hand-authored client script for the live dashboard — no bundler, no framework, matching
 * core's SCRIPT constant (packages/core/src/reporter/html.ts). Parses the DashboardSnapshot
 * embedded by dashboard.ts, then owns all rendering: sidebar (search/sort/route list) and
 * detail pane (Overview or a selected route). Re-fetches /data.json on every SSE `update`
 * and on the EventSource's `open` event (covers the initial connection and every
 * auto-reconnect, since EventSource replays no missed events) — discarding any response
 * whose `sequence` isn't newer than what's already rendered.
 */
export const DASHBOARD_SCRIPT = `
(function(){
  var BAND_COLOR = { good: '#2fa968', warn: '#e8a317', poor: '#e5484d' };
  function scoreBand(score) { return score >= 90 ? 'good' : score >= 50 ? 'warn' : 'poor'; }

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : String(v));
      }
    }
    (kids || []).forEach(function (c) {
      if (c === undefined || c === null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function mount(id, node) { var el = document.getElementById(id); clear(el); el.appendChild(node); }

  var HL_KEYWORDS = ['import','export','from','const','let','var','function','return','if','else','for','while','class','new','await','async','default','type','interface','extends','implements','this','typeof','instanceof','of','in','true','false','null','undefined'];
  var HL_LANGS = { js: 1, javascript: 1, ts: 1, typescript: 1, svelte: 1, html: 1, css: 1 };

  function highlightTokens(code) {
    var tokens = [];
    var i = 0;
    var n = code.length;
    var reIdent = /[A-Za-z_$][A-Za-z0-9_$]*/y;
    var reNum = /\\d+(\\.\\d+)?/y;
    while (i < n) {
      var ch = code[i];
      if (ch === '/' && code[i + 1] === '/') {
        var end = code.indexOf('\\n', i);
        if (end === -1) end = n;
        tokens.push({ text: code.slice(i, end), cls: 'cm' });
        i = end;
        continue;
      }
      if (ch === '/' && code[i + 1] === '*') {
        var end2 = code.indexOf('*/', i + 2);
        end2 = end2 === -1 ? n : end2 + 2;
        tokens.push({ text: code.slice(i, end2), cls: 'cm' });
        i = end2;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '\`') {
        var quote = ch;
        var j = i + 1;
        while (j < n && code[j] !== quote) {
          if (code[j] === '\\\\') j++;
          j++;
        }
        j = Math.min(j + 1, n);
        tokens.push({ text: code.slice(i, j), cls: 'str' });
        i = j;
        continue;
      }
      reIdent.lastIndex = i;
      var mIdent = reIdent.exec(code);
      if (mIdent && mIdent.index === i) {
        var word = mIdent[0];
        tokens.push({ text: word, cls: HL_KEYWORDS.indexOf(word) !== -1 ? 'kw' : 'id' });
        i += word.length;
        continue;
      }
      reNum.lastIndex = i;
      var mNum = reNum.exec(code);
      if (mNum && mNum.index === i) {
        tokens.push({ text: mNum[0], cls: 'num' });
        i += mNum[0].length;
        continue;
      }
      tokens.push({ text: ch, cls: 'pn' });
      i += 1;
    }
    return tokens;
  }

  function renderFixSnippet(fix) {
    var pre = h('pre', null, []);
    var code = h('code', null, []);
    var lang = (fix.lang || 'svelte').toLowerCase();
    if (HL_LANGS[lang]) {
      highlightTokens(fix.snippet).forEach(function (t) {
        code.appendChild(h('span', { class: 'tok-' + t.cls, text: t.text }, []));
      });
    } else {
      code.textContent = fix.snippet;
    }
    pre.appendChild(code);
    return pre;
  }

  var state = {
    snapshot: null,
    selected: 'overview',
    search: '',
    sort: 'score-asc',
    filter: 'all',
    theme: initialTheme(),
    connection: 'connecting',
    routeBySlug: {}
  };

  function initialTheme() {
    try {
      var stored = localStorage.getItem('svelte-vitals-theme');
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (e) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme() { document.documentElement.setAttribute('data-theme', state.theme); }
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('svelte-vitals-theme', state.theme); } catch (e) {}
    applyTheme();
    renderTopbar();
  }
  function toggleSidebar() {
    var sb = document.getElementById('dv-sidebar');
    if (sb) sb.classList.toggle('open');
  }

  function renderTopbar() {
    var s = state.snapshot;
    var findings = s.report.routes.reduce(function (n, r) { return n + r.issues.length; }, 0) + s.report.siteIssues.length;
    var kids = [
      h('button', { type: 'button', class: 'dv-menu-toggle', 'aria-label': 'Toggle route list', onclick: toggleSidebar, text: '≡' }, []),
      h('div', { class: 'dv-brand' }, [h('span', { class: 'bolt', text: '↯' }, []), document.createTextNode('svelte-vitals')]),
      h('div', { class: 'dv-meta' }, [
        h('span', { text: 'v' + s.meta.version }, []),
        s.meta.coreVersion ? h('span', { title: '@svelte-vitals/core version', text: 'core v' + s.meta.coreVersion }, []) : null,
        h('span', { text: s.report.routes.length + ' routes' }, []),
        h('span', { text: findings + ' findings' }, [])
      ].filter(Boolean)),
      h('div', { class: 'dv-status' }, [
        s.analyzing ? h('span', { class: 'dv-analyzing', text: 'Analyzing…' }, []) : null,
        h('span', { class: 'dv-conn dv-conn-' + state.connection, title: state.connection }, []),
        h('button', { type: 'button', class: 'dv-theme-toggle', 'aria-label': 'Toggle dark mode', onclick: toggleTheme, text: state.theme === 'dark' ? '☀' : '☾' }, [])
      ].filter(Boolean))
    ];
    mount('dv-topbar', h('div', { class: 'dv-topbar-inner' }, kids));
  }

  function slugify(route) {
    return 'route-' + route.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  }

  function matchesSearch(route, q) {
    if (!q) return true;
    q = q.toLowerCase();
    if (route.route.toLowerCase().indexOf(q) !== -1) return true;
    return route.issues.some(function (iss) {
      return (iss.id + ' ' + iss.title + ' ' + (iss.location || '')).toLowerCase().indexOf(q) !== -1;
    });
  }

  function sortedRoutes() {
    var s = state.snapshot;
    var q = state.search.trim();
    var list = s.report.routes.filter(function (r) { return matchesSearch(r, q); }).slice();
    var sort = state.sort;
    if (sort === 'score-asc') list.sort(function (a, b) { return a.score - b.score; });
    else if (sort === 'score-desc') list.sort(function (a, b) { return b.score - a.score; });
    else if (sort === 'alpha') list.sort(function (a, b) { return a.route.localeCompare(b.route); });
    else if (sort === 'most-findings') list.sort(function (a, b) { return b.issues.length - a.issues.length; });
    return list;
  }

  function renderNavItem(label, key, route, active) {
    var kids = [h('span', { class: 'dv-nav-label', text: label }, [])];
    if (route) {
      var band = scoreBand(route.score);
      var crit = route.issues.filter(function (i) { return i.severity === 'critical'; }).length;
      var warn = route.issues.filter(function (i) { return i.severity === 'warning'; }).length;
      var info = route.issues.filter(function (i) { return i.severity === 'info'; }).length;
      var summary = [];
      if (crit) summary.push(crit + ' critical');
      if (warn) summary.push(warn + ' warning' + (warn > 1 ? 's' : ''));
      if (info) summary.push(info + ' info');
      var badge = state.snapshot.badges[route.route];
      kids.push(h('span', { class: 'dv-nav-meta' }, [
        badge ? h('span', { class: 'dv-badge dv-badge-' + badge, text: badge }, []) : null,
        h('span', { class: 'dv-nav-score', style: 'color:' + BAND_COLOR[band], text: String(route.score) }, []),
        h('span', { class: 'dv-nav-sum', text: summary.length ? summary.join(' · ') : 'no issues' }, [])
      ].filter(Boolean)));
    }
    return h('div', {
      class: 'dv-nav-item' + (active ? ' active' : ''),
      role: 'option',
      'aria-selected': active ? 'true' : 'false',
      tabindex: '0',
      onclick: function () { selectItem(key); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectItem(key); } }
    }, kids);
  }

  function selectItem(key) {
    state.selected = key;
    location.hash = key === 'overview' ? 'overview' : 'route/' + slugify(key);
    var sb = document.getElementById('dv-sidebar');
    if (sb) sb.classList.remove('open');
    renderSidebar();
    renderDetail();
  }

  function renderSidebar() {
    var s = state.snapshot;
    state.routeBySlug = {};

    var searchInput = h('input', {
      type: 'search',
      class: 'dv-search',
      placeholder: 'Search routes or rules…',
      value: state.search,
      oninput: function (e) { state.search = e.target.value; renderSidebar(); }
    }, []);

    var sortSelect = h('select', { class: 'dv-sort', 'aria-label': 'Sort routes', onchange: function (e) { state.sort = e.target.value; renderSidebar(); } }, [
      h('option', { value: 'score-asc', selected: state.sort === 'score-asc' || undefined, text: 'Score (worst first)' }, []),
      h('option', { value: 'score-desc', selected: state.sort === 'score-desc' || undefined, text: 'Score (best first)' }, []),
      h('option', { value: 'alpha', selected: state.sort === 'alpha' || undefined, text: 'Alphabetical' }, []),
      h('option', { value: 'most-findings', selected: state.sort === 'most-findings' || undefined, text: 'Most findings' }, [])
    ]);

    var items = [renderNavItem('Overview', 'overview', null, state.selected === 'overview')];
    sortedRoutes().forEach(function (r) {
      var slug = slugify(r.route);
      state.routeBySlug[slug] = r.route;
      items.push(renderNavItem(r.route, r.route, r, state.selected === r.route));
    });

    var nav = h('div', { class: 'dv-nav', role: 'listbox', 'aria-label': 'Routes' }, items);
    mount('dv-sidebar', h('div', { class: 'dv-sidebar-inner' }, [searchInput, sortSelect, nav]));
  }

  function renderFilterChips(categories) {
    var chip = function (filter, label) {
      return h('button', {
        type: 'button', class: 'dv-chip', 'aria-pressed': state.filter === filter ? 'true' : 'false',
        onclick: function () { state.filter = filter; renderDetail(); },
        text: label
      }, []);
    };
    var catChips = Object.keys(categories).map(function (cat) {
      var name = cat === 'seo' ? 'SEO' : cat.charAt(0).toUpperCase() + cat.slice(1);
      return chip(cat, name);
    });
    return h('div', { class: 'dv-filters', role: 'group', 'aria-label': 'Filter findings' },
      [chip('all', 'All'), chip('critical', 'Critical'), chip('warning', 'Warning'), chip('info', 'Info')].concat(catChips));
  }

  function passesFilter(issue) {
    var f = state.filter;
    return f === 'all' || issue.severity === f || issue.category === f;
  }

  function renderFinding(issue) {
    var kids = [
      h('div', { class: 'dv-f-head' }, [
        h('span', { class: 'dv-ruleid', text: issue.id }, []),
        h('span', { class: 'dv-f-title', text: issue.title }, []),
        h('span', { class: 'dv-sev-tag dv-sev-' + issue.severity, text: issue.severity }, [])
      ])
    ];
    if (issue.location) {
      kids.push(h('p', { class: 'dv-f-loc', text: issue.location + (issue.line !== undefined ? ':' + issue.line : '') }, []));
    }
    if (issue.recommendation) {
      kids.push(h('p', { class: 'dv-f-rec', text: issue.recommendation }, []));
    }
    if (issue.fix && issue.fix.snippet) {
      kids.push(h('div', { class: 'dv-fix' }, [h('div', { class: 'dv-fix-label', text: 'fix' }, []), renderFixSnippet(issue.fix)]));
    }
    if (issue.docsUrl) {
      kids.push(h('a', { class: 'dv-f-link', href: issue.docsUrl, text: 'Learn more' }, []));
    }
    return h('article', { class: 'dv-finding dv-finding-' + issue.severity }, kids);
  }

  function renderGauge(score) {
    var band = scoreBand(score);
    var svgNs = 'http://www.w3.org/2000/svg';
    var C = 2 * Math.PI * 58;
    var offset = (C * (1 - score / 100)).toFixed(1);
    var svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', '132');
    svg.setAttribute('height', '132');
    svg.setAttribute('viewBox', '0 0 132 132');
    var bg = document.createElementNS(svgNs, 'circle');
    bg.setAttribute('cx', '66'); bg.setAttribute('cy', '66'); bg.setAttribute('r', '58');
    bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', '#e4e7ec'); bg.setAttribute('stroke-width', '11');
    var arc = document.createElementNS(svgNs, 'circle');
    arc.setAttribute('cx', '66'); arc.setAttribute('cy', '66'); arc.setAttribute('r', '58');
    arc.setAttribute('fill', 'none'); arc.setAttribute('stroke', BAND_COLOR[band]); arc.setAttribute('stroke-width', '11');
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', C.toFixed(1));
    arc.setAttribute('stroke-dashoffset', offset);
    svg.appendChild(bg);
    svg.appendChild(arc);
    var wrap = h('div', { class: 'dv-gauge' }, [h('div', { class: 'dv-gauge-num' }, [h('strong', { text: String(score) }, []), h('span', { text: 'Health' }, [])])]);
    wrap.insertBefore(svg, wrap.firstChild);
    return wrap;
  }

  function renderOverview(s) {
    var gauge = renderGauge(s.report.score);
    var cats = Object.keys(s.report.categories).map(function (cat) {
      var c = s.report.categories[cat];
      var band = scoreBand(c.score);
      var weight = s.report.weights[cat];
      var name = cat === 'seo' ? 'SEO' : cat.charAt(0).toUpperCase() + cat.slice(1);
      return h('div', { class: 'dv-cat' }, [
        h('div', { class: 'dv-cat-top' }, [
          h('span', { text: name + (weight !== undefined ? ' (weight ' + weight + ')' : '') }, []),
          h('span', { style: 'color:' + BAND_COLOR[band], text: String(c.score) }, [])
        ]),
        h('div', { class: 'dv-bar' }, [h('i', { style: 'width:' + c.score + '%;background:' + BAND_COLOR[band] }, [])])
      ]);
    });
    var chips = renderFilterChips(s.report.categories);
    var siteFindings = s.report.siteIssues.filter(passesFilter);
    var siteChecks = s.report.siteIssues.length
      ? h('section', { class: 'dv-section' }, [h('h2', { text: 'Site checks' }, [])].concat(siteFindings.map(renderFinding)))
      : null;
    return h('div', { class: 'dv-overview' }, [gauge, h('div', { class: 'dv-cats' }, cats), chips, siteChecks].filter(Boolean));
  }

  function renderRouteDetail(route) {
    var badge = state.snapshot.badges[route.route];
    var band = scoreBand(route.score);
    var header = h('div', { class: 'dv-detail-header' }, [
      h('span', { class: 'dv-route-path', text: route.route }, []),
      badge ? h('span', { class: 'dv-badge dv-badge-' + badge, text: badge }, []) : null,
      h('span', { class: 'dv-score-chip', style: 'color:' + BAND_COLOR[band], text: String(route.score) }, [])
    ].filter(Boolean));
    var chips = renderFilterChips(state.snapshot.report.categories);
    var findings = route.issues.filter(passesFilter);
    var body = findings.length ? findings.map(renderFinding) : [h('p', { class: 'dv-empty', text: 'No issues match the current filter.' }, [])];
    return h('div', { class: 'dv-route-detail' }, [header, chips].concat(body));
  }

  function renderDetail() {
    var s = state.snapshot;
    if (state.selected === 'overview') {
      mount('dv-detail', renderOverview(s));
      return;
    }
    var route = s.report.routes.filter(function (r) { return r.route === state.selected; })[0];
    if (!route) {
      state.selected = 'overview';
      mount('dv-detail', renderOverview(s));
      return;
    }
    mount('dv-detail', renderRouteDetail(route));
  }

  function renderAll() {
    renderTopbar();
    renderSidebar();
    renderDetail();
  }

  function restoreSelectionFromHash() {
    var raw = location.hash.replace(/^#/, '');
    if (!raw || raw === 'overview') { state.selected = 'overview'; return; }
    var m = /^route\\/(.+)$/.exec(raw);
    if (m && state.routeBySlug[m[1]]) state.selected = state.routeBySlug[m[1]];
  }

  function fetchSnapshot() {
    fetch('/__svelte-vitals/data.json').then(function (r) { return r.json(); }).then(function (data) {
      if (state.snapshot && data.sequence <= state.snapshot.sequence) return;
      state.snapshot = data;
      renderAll();
    }).catch(function () {});
  }

  function boot() {
    var raw = document.getElementById('svelte-vitals-data');
    state.snapshot = JSON.parse(raw.textContent);
    applyTheme();
    renderSidebar(); // populates routeBySlug before the hash can be trusted
    restoreSelectionFromHash();
    renderAll();

    window.addEventListener('hashchange', function () {
      restoreSelectionFromHash();
      renderSidebar();
      renderDetail();
    });

    if (typeof EventSource !== 'undefined') {
      var es = new EventSource('/__svelte-vitals/events');
      es.addEventListener('open', function () { state.connection = 'connected'; renderTopbar(); fetchSnapshot(); });
      es.addEventListener('update', fetchSnapshot);
      es.addEventListener('error', function () { state.connection = 'reconnecting'; renderTopbar(); });
    }
  }

  boot();
})();
`;
