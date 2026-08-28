// The shared "app shell" behind both HTML surfaces (design: 2026-06-23-vite-live-ui,
// reinstated after 2026-07-09-vite-ui-vitest-parity explicitly accepted their divergence
// and the two drifted apart): the vite live dashboard serves it with `live: true`, and
// the CLI's `--reporter html` emits the identical document with `live: false` — same
// master/detail layout, search/sort/filter, dark mode, and per-finding AI Prompt, minus
// the SSE machinery. Runtime-agnostic: pure string building, no `node:` imports, no
// external resources.
import type { Config, Result } from '../types.js';
import { buildJsonReport, type JsonReport } from './json.js';
import { CATEGORY_LABEL } from './console.js';

type Band = 'good' | 'warn' | 'poor';

export const BAND_COLOR = {
  good: '#2FA968',
  warn: '#E8A317',
  poor: '#E5484D'
} satisfies Record<Band, string>;

export function scoreBand(score: number): Band {
  return score >= 90 ? 'good' : score >= 50 ? 'warn' : 'poor';
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}

/**
 * Return the URL only when it uses a safe http/https scheme, else null.
 * Guards a finding's `docsUrl` against `javascript:`/`data:` hrefs — escapeHtml
 * neutralizes attribute breakout but not a malicious scheme. Browsers strip
 * ASCII whitespace (tab/newline/CR) from a URL before resolving its scheme (so
 * `java\tscript:` runs as `javascript:`), so strip whitespace first; anything not
 * plainly http(s):// afterward is rejected. Pure string work — no `URL` global,
 * keeping core runtime-agnostic and lib-minimal.
 */
export function safeHref(url: string): string | null {
  const normalized = url.replace(/\s/g, '').toLowerCase();
  return /^https?:\/\//.test(normalized) ? url : null;
}

/** Provenance of a route's findings: real rendered page vs. source-only analysis. */
export type RouteBadge = 'measured' | 'static';

export interface AppSnapshot {
  report: JsonReport;
  badges: Record<string, RouteBadge>;
  analyzing: boolean;
  /** Monotonically increasing; lets the client discard an out-of-order /data.json response. */
  sequence: number;
  /** Whether a dev server is behind this page (SSE updates, /data.json refetch, connection dot). */
  live: boolean;
  meta: { version: string; coreVersion?: string };
}

/**
 * JSON.stringify escapes `"` inside string values but not `<` or the JS line terminators
 * U+2028/U+2029 — all three matter once the result is embedded inside an inline
 * <script type="application/json"> element: an unescaped `</script>` in any finding-derived
 * string (route path, location, recommendation, fix snippet, title) would close the tag
 * early, and U+2028/U+2029 can still break some script-parsing environments.
 */
function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

type Issue = JsonReport['routes'][number]['issues'][number];

/**
 * The client script renders `docsUrl` straight into an <a href>, so a malicious scheme
 * (`javascript:`, `data:`) must never reach the embedded snapshot — `buildHtmlDocument`
 * is a public API fed loosely-typed reports. Sanitized server-side once, here.
 */
function sanitizeDocsUrl(issue: Issue): Issue {
  if (issue.docsUrl === undefined) return issue;
  if (safeHref(issue.docsUrl) !== null) return issue;
  return { ...issue, docsUrl: undefined };
}

function sanitizeReport(report: JsonReport): JsonReport {
  return {
    ...report,
    routes: report.routes.map((route) => ({ ...route, issues: route.issues.map(sanitizeDocsUrl) })),
    siteIssues: report.siteIssues.map(sanitizeDocsUrl)
  };
}

/**
 * Hand-authored CSS for the master/detail shell. Reuses the same design-token
 * names/values as the rest of the project, and adds a dark theme via
 * `:root[data-theme="dark"]` plus a `prefers-color-scheme` fallback for a
 * first-ever visit with no stored preference.
 */
export const APP_STYLE: string = `
:root{--ground:#f6f7f9;--panel:#fff;--ink:#0c1322;--muted:#5a6472;--faint:#8c95a3;--line:#e4e7ec;--line-strong:#d3d8e0;--accent:#ff3e00;--good:#2fa968;--warn:#e8a317;--poor:#e5484d;--code-bg:#0e1525;--code-ink:#e7ecf4;--active-bg:#0c1322;--active-ink:#fff;--mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
:root[data-theme="dark"]{--ground:#0b0e14;--panel:#12161f;--ink:#e7ecf4;--muted:#9aa4b2;--faint:#6b7484;--line:#232838;--line-strong:#2d3345;--code-bg:#05070c;--code-ink:#e7ecf4;--active-bg:#e7ecf4;--active-ink:#0b0e14}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#0b0e14;--panel:#12161f;--ink:#e7ecf4;--muted:#9aa4b2;--faint:#6b7484;--line:#232838;--line-strong:#2d3345;--code-bg:#05070c;--code-ink:#e7ecf4;--active-bg:#e7ecf4;--active-ink:#0b0e14}}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--ground);color:var(--ink);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased}
.dv-app{display:grid;grid-template-rows:auto 1fr;grid-template-columns:280px 1fr;grid-template-areas:"top top" "side main";height:100vh}
.dv-topbar{grid-area:top;border-bottom:1px solid var(--line);background:var(--panel)}
.dv-topbar-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:12px 20px}
.dv-brand{display:flex;align-items:center;background:none;border:none;padding:0;cursor:pointer;border-radius:6px}
.dv-brand svg{height:28px;width:auto;display:block}
.dv-brand:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
.dv-meta{font-family:var(--mono);font-size:12px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap}
.dv-status{display:flex;align-items:center;gap:10px}
.dv-analyzing{font-size:12px;color:var(--accent);font-weight:600}
.dv-conn{width:8px;height:8px;border-radius:50%;background:var(--faint);display:inline-block}
.dv-conn-connected{background:var(--good)}
.dv-conn-reconnecting{background:var(--warn)}
.dv-menu-toggle{display:none;border:1px solid var(--line-strong);background:var(--panel);color:var(--ink);border-radius:8px;width:28px;height:28px;cursor:pointer}
.dv-theme-toggle{border:1px solid var(--line-strong);background:var(--panel);color:var(--ink);border-radius:999px;width:28px;height:28px;cursor:pointer}
.dv-theme-toggle:focus-visible,.dv-menu-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.dv-sidebar{grid-area:side;border-right:1px solid var(--line);background:var(--panel);overflow-y:auto}
.dv-sidebar-inner{display:flex;flex-direction:column;gap:10px;padding:14px}
.dv-search{font:inherit;font-size:13px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--ground);color:var(--ink)}
.dv-sort{font:inherit;font-size:12.5px;padding:6px 8px;border:1px solid var(--line-strong);border-radius:8px;background:var(--ground);color:var(--ink)}
.dv-nav{display:flex;flex-direction:column;gap:2px}
.dv-nav-item{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;cursor:pointer}
.dv-nav-item:hover{background:var(--ground)}
.dv-nav-item.active{background:var(--active-bg);color:var(--active-ink)}
.dv-nav-item:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.dv-nav-label{font-family:var(--mono);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dv-nav-meta{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--muted)}
.dv-nav-item.active .dv-nav-meta{color:inherit}
.dv-nav-score{font-family:var(--mono);font-weight:700}
.dv-badge{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:1px 6px;border-radius:999px}
.dv-badge-measured{background:rgba(47,169,104,.16);color:var(--good)}
.dv-badge-static{background:rgba(140,149,163,.2);color:var(--muted)}
.dv-detail{grid-area:main;overflow-y:auto;padding:24px 28px 80px}
.dv-gauge{position:relative;width:132px;height:132px;margin-bottom:20px}
.dv-gauge svg{position:absolute;inset:0;transform:rotate(-90deg)}
.dv-gauge-track{stroke:var(--line)}
.dv-gauge-num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.dv-gauge-num strong{font-family:var(--mono);font-size:36px;font-weight:600}
.dv-gauge-num span{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted)}
.dv-cats{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:20px}
.dv-cat{min-width:180px;flex:1}
.dv-cat-top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px}
.dv-bar{height:7px;border-radius:999px;background:var(--line);overflow:hidden}
.dv-bar>i{display:block;height:100%;border-radius:999px}
.dv-cat-reach{font-size:11.5px;color:var(--muted);margin-top:5px}
.dv-filters{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.dv-chip{font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;background:var(--panel);border:1px solid var(--line-strong);color:var(--muted);padding:5px 12px;border-radius:999px}
.dv-chip[aria-pressed="true"]{background:var(--active-bg);border-color:var(--active-bg);color:var(--active-ink)}
.dv-chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.dv-section h2{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:24px 0 12px}
.dv-detail-header{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.dv-route-path{font-family:var(--mono);font-size:16px;font-weight:600}
.dv-score-chip{font-family:var(--mono);font-weight:700}
.dv-finding{background:var(--panel);border:1px solid var(--line);border-left-width:3px;border-radius:10px;padding:16px 18px;margin:0 0 12px}
.dv-finding-critical{border-left-color:var(--poor)}
.dv-finding-warning{border-left-color:var(--warn)}
.dv-finding-info{border-left-color:var(--faint)}
.dv-f-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dv-ruleid{font-family:var(--mono);font-size:12px;font-weight:600;background:var(--ground);padding:2px 8px;border-radius:6px}
.dv-f-title{font-weight:650;font-size:15px}
.dv-sev-tag{margin-left:auto;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.dv-sev-critical{color:var(--poor)}
.dv-sev-warning{color:var(--warn)}
.dv-sev-info{color:var(--faint)}
.dv-f-route{display:block;font:inherit;font-family:var(--mono);font-size:12.5px;font-weight:600;color:var(--accent);background:none;border:none;padding:0;margin:8px 0 0;cursor:pointer;text-align:left}
.dv-f-route:hover{text-decoration:underline}
.dv-f-route:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.dv-f-loc{font-family:var(--mono);font-size:12.5px;color:var(--muted);margin:8px 0 0}
.dv-f-rec{font-size:14px;margin:10px 0 0}
.dv-fix{margin:12px 0 0;background:var(--code-bg);border-radius:8px;overflow:hidden}
.dv-fix-label{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8da0bd;padding:8px 14px 0}
.dv-fix pre{margin:0;padding:8px 14px 14px;overflow-x:auto}
.dv-fix code{font-family:var(--mono);font-size:12.5px;color:var(--code-ink);line-height:1.65;white-space:pre}
.tok-kw{color:#ff7ab8}
.tok-str{color:#9ece6a}
.tok-num{color:#ff9e64}
.tok-cm{color:#6b7280;font-style:italic}
.tok-id{color:var(--code-ink)}
.tok-pn{color:#8da0bd}
.dv-f-link{display:inline-block;margin-top:12px;font-size:13px;font-weight:600;color:var(--accent);text-decoration:none}
.dv-f-link:hover{text-decoration:underline}
.dv-ai-prompt{margin-top:12px;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.dv-ai-prompt>summary{cursor:pointer;list-style:none;padding:8px 12px;font-size:12px;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:6px;user-select:none}
.dv-ai-prompt>summary::-webkit-details-marker{display:none}
.dv-ai-prompt>summary::before{content:"▸";display:inline-block;transition:transform .15s ease}
.dv-ai-prompt[open]>summary::before{transform:rotate(90deg)}
.dv-ai-prompt-body{padding:0 12px 12px;display:flex;flex-direction:column;gap:8px}
.dv-ai-prompt-pre{margin:0;padding:10px 12px;background:var(--code-bg);color:var(--code-ink);border-radius:8px;font-family:var(--mono);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:280px;overflow-y:auto}
.dv-ai-copy-btn{align-self:flex-start;font:inherit;font-size:12px;font-weight:600;cursor:pointer;background:var(--panel);border:1px solid var(--line-strong);color:var(--ink);padding:5px 12px;border-radius:999px}
.dv-ai-copy-btn:hover{border-color:var(--faint)}
.dv-ai-copy-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.dv-empty{color:var(--muted);font-size:13px}
@media (max-width:640px){.dv-app{grid-template-columns:1fr;grid-template-areas:"top" "main"}.dv-menu-toggle{display:inline-flex}.dv-sidebar{position:fixed;inset:0 20% 0 0;transform:translateX(-100%);transition:transform .2s ease;z-index:10}.dv-sidebar.open{transform:translateX(0)}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

/**
 * Hand-authored client script for the shell — no bundler, no framework. Parses the
 * AppSnapshot embedded by renderAppShell, then owns all rendering: sidebar
 * (search/sort/route list) and detail pane (Overview or a selected route). When the
 * snapshot says `live`, it additionally re-fetches /data.json on every SSE `update`
 * and on the EventSource's `open` event (covers the initial connection and every
 * auto-reconnect, since EventSource replays no missed events) — discarding any
 * response whose `sequence` isn't newer than what's already rendered.
 */
export const APP_SCRIPT: string = `
(function(){
  var BAND_COLOR = { good: '#2fa968', warn: '#e8a317', poor: '#e5484d' };
  var CATEGORY_NAMES = ${JSON.stringify(CATEGORY_LABEL)};
  function scoreBand(score) { return score >= 90 ? 'good' : score >= 50 ? 'warn' : 'poor'; }

  // Same mark as the docs site's hero wordmark (docs/public/wordmark.svg) — an inline
  // copy, not an <img src>, since the dashboard is a single self-contained HTML response
  // with no other static assets to serve alongside it. Fixed brand colors (not CSS custom
  // properties), matching the docs usage: the wordmark reads the same in both themes.
  var WORDMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 56" role="img" aria-labelledby="dv-wordmark-title"><title id="dv-wordmark-title">svelte-vitals</title><defs><clipPath id="dv-wordmark-clip"><rect x="2" y="2" width="52" height="52" rx="14"/></clipPath></defs><rect x="2" y="2" width="52" height="52" rx="14" fill="#FF3E00"/><polyline clip-path="url(#dv-wordmark-clip)" points="4,28 15,28 17.5,23.5 20,28 23,28 26,7 29,49 32,28 35,28 37,24.5 39.5,28 52,28" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="70" y="38" font-family="ui-sans-serif, system-ui, -apple-system, \\'Segoe UI\\', Roboto, sans-serif" font-size="30" font-weight="700" fill="#FF3E00">svelte-vitals</text></svg>';

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

  // Analyzed-repo strings (title, location, recommendation, fix description, docs URL) flow
  // into a prompt the user pastes into a coding agent — same threat model as
  // reporter/sanitize.ts's mdEscape, re-implemented here in ES5 because APP_SCRIPT runs in
  // the browser and cannot import build-time modules. Keep the two in sync.
  function mdSafe(text) {
    return String(text)
      .replace(/\\r\\n|\\r|\\n/g, ' ')
      .replace(/<[^>]+>/g, function (tag) {
        var longest = 0;
        var runs = tag.match(/\`+/g);
        if (runs) for (var i = 0; i < runs.length; i++) if (runs[i].length > longest) longest = runs[i].length;
        var fence = Array(longest + 2).join('\`');
        var pad = tag.charAt(0) === '\`' || tag.charAt(tag.length - 1) === '\`' ? ' ' : '';
        return fence + pad + tag + pad + fence;
      })
      .replace(/\\[([^\\]]*)\\]\\(([^)]*)\\)/g, '[$1]\\\\($2\\\\)');
  }

  function fenceFor(snippet) {
    var longest = 0;
    var runs = String(snippet).match(/\`+/g);
    if (runs) for (var i = 0; i < runs.length; i++) if (runs[i].length > longest) longest = runs[i].length;
    return Array(Math.max(3, longest + 1) + 1).join('\`');
  }

  // Plain-text, copy-pasteable prompt for a single finding — same ingredients as the
  // agent reporter's per-finding block (rule id, location, recommendation, fix, docs),
  // reshaped for a standalone request rather than a whole-project remediation doc.
  function buildAiPrompt(issue, route) {
    var lines = ['Fix this svelte-vitals finding:', ''];
    lines.push('- Rule: ' + issue.id + ' — ' + mdSafe(issue.title) + ' (' + issue.severity + ')');
    if (route) lines.push('- Route: ' + mdSafe(route));
    if (issue.location) {
      lines.push('- Location: ' + mdSafe(issue.location) + (issue.line !== undefined ? ':' + issue.line : ''));
    }
    if (issue.recommendation) lines.push('- Recommendation: ' + mdSafe(issue.recommendation));
    if (issue.fix) {
      lines.push('- Fix: ' + mdSafe(issue.fix.description));
      if (issue.fix.snippet) {
        var fence = fenceFor(issue.fix.snippet);
        lines.push('', fence + (issue.fix.lang || 'svelte'), issue.fix.snippet, fence);
      }
    }
    if (issue.docsUrl) lines.push('- Docs: ' + mdSafe(issue.docsUrl));
    lines.push(
      '',
      'After fixing, re-run \`svelte-vitals --diff\` (or revisit this route) to confirm ' +
        issue.id +
        ' passes' +
        (route ? ' for ' + mdSafe(route) : '') +
        '.'
    );
    return lines.join('\\n');
  }

  function copyToClipboard(text, btn) {
    var original = 'Copy';
    function reset(label) {
      btn.textContent = label;
      setTimeout(function () { btn.textContent = original; }, 1500);
    }
    function done() { reset('Copied!'); }
    function fail() { reset('Copy failed'); }
    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy() ? done() : fail(); });
    } else {
      fallbackCopy() ? done() : fail();
    }
  }

  function renderAiPrompt(issue, route) {
    var text = buildAiPrompt(issue, route);
    var btn = h('button', { type: 'button', class: 'dv-ai-copy-btn', text: 'Copy' }, []);
    btn.addEventListener('click', function () { copyToClipboard(text, btn); });
    return h('details', { class: 'dv-ai-prompt' }, [
      h('summary', { text: 'AI Prompt' }, []),
      h('div', { class: 'dv-ai-prompt-body' }, [
        h('pre', { class: 'dv-ai-prompt-pre', text: text }, []),
        btn
      ])
    ]);
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

  function brandEl() {
    var el = h('button', { type: 'button', class: 'dv-brand', 'aria-label': 'Go to Overview', onclick: function () { selectItem('overview'); } }, []);
    el.innerHTML = WORDMARK_SVG;
    return el;
  }

  function renderTopbar() {
    var s = state.snapshot;
    var findings = s.report.routes.reduce(function (n, r) { return n + r.issues.length; }, 0) + s.report.siteIssues.length;
    var kids = [
      h('button', { type: 'button', class: 'dv-menu-toggle', 'aria-label': 'Toggle route list', onclick: toggleSidebar, text: '≡' }, []),
      brandEl(),
      h('div', { class: 'dv-meta' }, [
        h('span', { text: 'v' + s.meta.version }, []),
        s.meta.coreVersion ? h('span', { title: '@svelte-vitals/core version', text: 'core v' + s.meta.coreVersion }, []) : null,
        h('span', { text: s.report.routes.length + ' routes' }, []),
        h('span', { text: findings + ' findings' }, [])
      ].filter(Boolean)),
      h('div', { class: 'dv-status' }, [
        s.live && s.analyzing ? h('span', { class: 'dv-analyzing', text: 'Analyzing…' }, []) : null,
        s.live ? h('span', { class: 'dv-conn dv-conn-' + state.connection, title: state.connection }, []) : null,
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

    // mount() clears and rebuilds the whole sidebar, including the <input> itself, so
    // a naive re-render on every keystroke drops focus and cursor position — capture
    // them before rebuilding and restore them on the freshly-created input afterward.
    var prevSearch = document.querySelector('.dv-search');
    var hadFocus = !!prevSearch && document.activeElement === prevSearch;
    var selStart = hadFocus ? prevSearch.selectionStart : null;
    var selEnd = hadFocus ? prevSearch.selectionEnd : null;

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

    if (hadFocus) {
      searchInput.focus();
      if (selStart !== null && searchInput.setSelectionRange) {
        searchInput.setSelectionRange(selStart, selEnd);
      }
    }
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
      var name = CATEGORY_NAMES[cat] || cat;
      return chip(cat, name);
    });
    return h('div', { class: 'dv-filters', role: 'group', 'aria-label': 'Filter findings' },
      [chip('all', 'All'), chip('critical', 'Critical'), chip('warning', 'Warning'), chip('info', 'Info')].concat(catChips));
  }

  function passesFilter(issue) {
    var f = state.filter;
    return f === 'all' || issue.severity === f || issue.category === f;
  }

  var SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

  function renderFinding(issue, route, promptRoute) {
    var kids = [
      h('div', { class: 'dv-f-head' }, [
        h('span', { class: 'dv-ruleid', text: issue.id }, []),
        h('span', { class: 'dv-f-title', text: issue.title }, []),
        h('span', { class: 'dv-sev-tag dv-sev-' + issue.severity, text: issue.severity }, [])
      ])
    ];
    if (route) {
      kids.push(h('button', { type: 'button', class: 'dv-f-route', onclick: function () { selectItem(route); }, text: route }, []));
    }
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
    kids.push(renderAiPrompt(issue, promptRoute !== undefined ? promptRoute : route));
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
    bg.setAttribute('fill', 'none'); bg.setAttribute('class', 'dv-gauge-track'); bg.setAttribute('stroke-width', '11');
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
      var name = CATEGORY_NAMES[cat] || cat;
      // keys/affectedKeys are absent on hand-built snapshots (older fixtures, tests) —
      // render nothing rather than "undefined of undefined". 0 affected of N keys is still
      // rendered: on a real project that's the signal a thin score can't give, that the
      // category is clean project-wide and not just on the one key it happened to look at
      // (design: 2026-08-05-score-floor-and-reach-design.md).
      var reach = typeof c.keys === 'number' && c.keys > 0
        ? h('div', { class: 'dv-cat-reach', text: c.affectedKeys + ' of ' + c.keys + ' keys affected' }, [])
        : null;
      return h('div', { class: 'dv-cat' }, [
        h('div', { class: 'dv-cat-top' }, [
          h('span', { text: name + (weight !== undefined ? ' (weight ' + weight + ')' : '') }, []),
          h('span', { style: 'color:' + BAND_COLOR[band], text: String(c.score) }, [])
        ]),
        h('div', { class: 'dv-bar' }, [h('i', { style: 'width:' + c.score + '%;background:' + BAND_COLOR[band] }, [])]),
        reach
      ]);
    });
    var chips = renderFilterChips(s.report.categories);
    var totalCount = s.report.routes.reduce(function (n, r) { return n + r.issues.length; }, 0) + s.report.siteIssues.length;
    var entries = [];
    s.report.routes.forEach(function (r) {
      r.issues.forEach(function (issue) { entries.push({ issue: issue, route: r.route }); });
    });
    s.report.siteIssues.forEach(function (issue) { entries.push({ issue: issue, route: null }); });
    entries = entries.filter(function (e) { return passesFilter(e.issue); });
    entries.sort(function (a, b) {
      var sd = SEVERITY_ORDER[a.issue.severity] - SEVERITY_ORDER[b.issue.severity];
      if (sd !== 0) return sd;
      return (a.route || '').localeCompare(b.route || '');
    });
    var body = entries.length
      ? entries.map(function (e) { return renderFinding(e.issue, e.route); })
      : [h('p', { class: 'dv-empty', text: totalCount ? 'No issues match the current filter.' : 'No issues found — nice work!' }, [])];
    var findings = h('section', { class: 'dv-section' }, [h('h2', { text: 'Findings' }, [])].concat(body));
    return h('div', { class: 'dv-overview' }, [gauge, h('div', { class: 'dv-cats' }, cats), chips, findings].filter(Boolean));
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
    var body = findings.length
      ? findings.map(function (issue) { return renderFinding(issue, undefined, route.route); })
      : [h('p', { class: 'dv-empty', text: 'No issues match the current filter.' }, [])];
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

    // Static export (the CLI's --reporter html): no dev server behind the page, so no
    // SSE connection, no /data.json refetch, no connection indicator.
    if (state.snapshot.live && typeof EventSource !== 'undefined') {
      var es = new EventSource('/__svelte-vitals/events');
      es.addEventListener('open', function () { state.connection = 'connected'; renderTopbar(); fetchSnapshot(); });
      es.addEventListener('update', fetchSnapshot);
      es.addEventListener('error', function () { state.connection = 'reconnecting'; renderTopbar(); });
    }
  }

  boot();
})();
`;

/** The shell HTML: empty sidebar/detail/topbar containers, the stylesheet, the
 * client script, and the snapshot embedded as JSON for the client's first paint. */
export function renderAppShell(snapshot: AppSnapshot): string {
  const safe = { ...snapshot, report: sanitizeReport(snapshot.report) };
  const title = snapshot.live ? 'svelte-vitals dashboard' : 'svelte-vitals report';
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${title}</title><style>${APP_STYLE}</style></head><body>` +
    `<div class="dv-app" id="dv-app">` +
    `<header class="dv-topbar" id="dv-topbar"></header>` +
    `<nav class="dv-sidebar" id="dv-sidebar"></nav>` +
    `<main class="dv-detail" id="dv-detail"></main>` +
    `</div>` +
    `<script type="application/json" id="svelte-vitals-data">${embedJson(safe)}</script>` +
    `<script>${APP_SCRIPT}</script>` +
    `</body></html>`
  );
}

/**
 * Static (non-live) document over a prebuilt JsonReport — kept as the public name the
 * html reporter has always exported.
 */
export function buildHtmlDocument(report: JsonReport, meta: { version: string; coreVersion?: string }): string {
  return renderAppShell({
    report,
    badges: {},
    analyzing: false,
    sequence: 0,
    live: false,
    meta
  });
}

/** Render results as the self-contained HTML report (the CLI's `--reporter html`). */
export function formatHtmlReport(
  results: Result[],
  config: Config,
  meta: { version: string; coreVersion?: string }
): string {
  // No rule-id list threaded through: unlike the `json` reporter, `report.rules` here is
  // seeded from `results` alone, so presence means "produced a result", not "was selected"
  // (design doc 2026-08-03-json-rule-evidence-design.md, Not in scope).
  return buildHtmlDocument(buildJsonReport(results, config, meta), meta);
}
