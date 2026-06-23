// Self-contained visual HTML report (design: visual-html-report, sub-project A).
// Runtime-agnostic: pure string building, no `node:` imports, no external resources.
import type { Category, Config, Result } from '../types.js';
import { buildJsonReport, type JsonReport } from './json.js';

type Band = 'good' | 'warn' | 'poor';

export const BAND_COLOR: Record<Band, string> = {
  good: '#2FA968',
  warn: '#E8A317',
  poor: '#E5484D'
};

export function scoreBand(score: number): Band {
  return score >= 90 ? 'good' : score >= 50 ? 'warn' : 'poor';
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}

const slug = (route: string): string => 'route-' + route.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

type Issue = JsonReport['routes'][number]['issues'][number];

function renderFinding(issue: Issue): string {
  const sev = issue.severity;
  const dyn = issue.detection.value === 'dynamic' ? ' <span class="dyn" title="set dynamically (verified at runtime)">↯</span>' : '';
  const line = issue.line !== undefined ? `:${issue.line}` : '';
  const fix =
    issue.fix?.snippet !== undefined
      ? `<div class="fix"><div class="label">fix</div><pre><code>${escapeHtml(issue.fix.snippet)}</code></pre></div>`
      : '';
  const docs = issue.docsUrl ? `<a class="f-link" href="${escapeHtml(issue.docsUrl)}">Learn more</a>` : '';
  return (
    `<article class="finding sev-${sev}" data-severity="${sev}" data-category="${escapeHtml(issue.category)}">` +
    `<div class="f-head"><span class="ruleid">${escapeHtml(issue.id)}</span>` +
    `<span class="f-title">${escapeHtml(issue.title)}</span>` +
    `<span class="sev-tag ${sev}">${sev}</span></div>` +
    `<p class="f-loc">${escapeHtml(issue.location ?? '')}${line}${dyn}</p>` +
    `<p class="f-rec">${escapeHtml(issue.recommendation ?? '')}</p>` +
    fix +
    docs +
    `</article>`
  );
}

function renderTopbar(report: JsonReport, meta: { version: string }): string {
  const findings = report.routes.reduce((n, r) => n + r.issues.length, 0) + report.siteIssues.length;
  return (
    `<header class="topbar"><div class="brand"><span class="bolt">↯</span>svelte-<span class="v">vitals</span></div>` +
    `<div class="meta"><span>v${escapeHtml(meta.version)}</span>` +
    `<span>${report.routes.length} routes</span>` +
    `<span>${findings} findings</span></div></header>`
  );
}

function renderHero(report: JsonReport): string {
  const C = 2 * Math.PI * 58;
  const offset = (C * (1 - report.score / 100)).toFixed(1);
  const hb = scoreBand(report.score);
  const s = report.summary;
  const dynNote = s.dynamic > 0 ? `<span class="tally"><span class="dot dyn-dot">↯</span>Dynamic <span class="n">${s.dynamic}</span></span>` : '';
  const cats = Object.entries(report.categories)
    .map(([cat, { score }]) => {
      const b = scoreBand(score);
      const weight = report.weights[cat as Category];
      const w = weight !== undefined ? `<span class="w">weight ${weight}</span>` : '';
      const name = cat === 'seo' ? 'SEO' : cat.charAt(0).toUpperCase() + cat.slice(1);
      return (
        `<div class="cat"><div class="top"><span class="name">${name} ${w}</span>` +
        `<span class="sc" style="color:${BAND_COLOR[b]}">${score}</span></div>` +
        `<div class="bar"><i style="width:${score}%;background:${BAND_COLOR[b]}"></i></div></div>`
      );
    })
    .join('');
  return (
    `<section class="hero"><div class="gauge">` +
    `<svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">` +
    `<circle cx="66" cy="66" r="58" fill="none" stroke="#e4e7ec" stroke-width="11"></circle>` +
    `<circle id="arc" cx="66" cy="66" r="58" fill="none" stroke="${BAND_COLOR[hb]}" stroke-width="11" ` +
    `stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${offset}"></circle></svg>` +
    `<div class="num"><strong id="hnum">${report.score}</strong><span>Health</span></div></div>` +
    `<div class="readout"><div class="eyebrow">SvelteKit · SEO &amp; Performance</div>` +
    `<div class="tallies">` +
    `<span class="tally"><span class="dot crit"></span>Critical <span class="n">${s.critical}</span></span>` +
    `<span class="tally"><span class="dot warn"></span>Warning <span class="n">${s.warning}</span></span>` +
    `<span class="tally"><span class="dot info"></span>Info <span class="n">${s.info}</span></span>` +
    `<span class="tally"><span class="dot pass"></span>Passed <span class="n">${s.passed}</span></span>` +
    dynNote +
    `</div><div class="cats">${cats}</div></div></section>`
  );
}

function renderRoutes(report: JsonReport): string {
  if (report.routes.length === 0) return '';
  const rows = report.routes
    .map((r) => {
      const b = scoreBand(r.score);
      const crit = r.issues.filter((i) => i.severity === 'critical').length;
      const warn = r.issues.filter((i) => i.severity === 'warning').length;
      const info = r.issues.filter((i) => i.severity === 'info').length;
      const parts: string[] = [];
      if (crit) parts.push(`${crit} critical`);
      if (warn) parts.push(`${warn} warning${warn > 1 ? 's' : ''}`);
      if (info) parts.push(`${info} info`);
      const sum = parts.length ? parts.join(' · ') : '<span class="none">no issues</span>';
      const body = r.issues.length
        ? r.issues.map(renderFinding).join('')
        : '<p class="empty">No issues found on this route.</p>';
      return (
        `<details class="route" id="${slug(r.route)}" data-score="${r.score}"${r.issues.length ? ' open' : ''}>` +
        `<summary><span class="route-name"><span class="path">${escapeHtml(r.route)}</span></span>` +
        `<span class="issue-sum">${sum}</span>` +
        `<span class="score-chip"><span class="ring" style="background:${BAND_COLOR[b]}"></span>${r.score}</span>` +
        `<span class="chev">›</span></summary><div class="route-body">${body}</div></details>`
      );
    })
    .join('');
  return `<section class="section"><h2>Routes</h2><div class="routes">${rows}</div></section>`;
}

function renderSiteChecks(report: JsonReport): string {
  if (report.siteIssues.length === 0) return '';
  const cards = report.siteIssues.map(renderFinding).join('');
  return `<section class="section"><h2>Site checks</h2>${cards}</section>`;
}

function renderFilters(): string {
  const chip = (label: string, pressed = false) => `<button class="chip" type="button" aria-pressed="${pressed}">${label}</button>`;
  return (
    `<div class="filters" role="group" aria-label="Filter findings">` +
    chip('All', true) +
    chip('Critical') +
    chip('Warning') +
    chip('Info') +
    chip('SEO') +
    chip('Performance') +
    `</div>`
  );
}

const STYLE = `
:root{--ground: #f6f7f9;--panel: #fff;--ink: #0c1322;--muted: #5a6472;--faint: #8c95a3;--line: #e4e7ec;--line-strong: #d3d8e0;--accent: #ff3e00;--good: #2fa968;--warn: #e8a317;--poor: #e5484d;--code-bg: #0e1525;--code-ink: #e7ecf4;--radius: 12px;--mono: ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;--sans: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:960px;margin:0 auto;padding:0 20px 96px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:18px 0 16px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:baseline;gap:8px;font-weight:700;font-size:18px;letter-spacing:-.02em}
.brand .bolt{color:var(--accent);font-size:20px}.brand .v{color:var(--accent)}
.meta{font-family:var(--mono);font-size:12.5px;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap}
.hero{display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center;padding:30px 0 24px}
.gauge{position:relative;width:132px;height:132px}.gauge svg{transform:rotate(-90deg);display:block}
.gauge .num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.gauge .num strong{font-family:var(--mono);font-size:40px;font-weight:600;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.gauge .num span{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin-top:6px}
.readout{min-width:0}
.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:var(--accent);font-weight:700}
.eyebrow::before{content:"↯ "}
.tallies{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 18px}
.tally{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;background:var(--panel);border:1px solid var(--line);padding:5px 11px;border-radius:999px}
.tally .dot{width:9px;height:9px;border-radius:50%}.tally .n{font-family:var(--mono);font-variant-numeric:tabular-nums}
.dot.crit{background:var(--poor)}.dot.warn{background:var(--warn)}.dot.info{background:var(--faint)}.dot.pass{background:var(--good)}
.dot.dyn-dot{background:transparent;color:var(--accent);font-weight:700;width:auto;height:auto}
.cats{display:flex;gap:22px;flex-wrap:wrap}
.cat{min-width:190px;flex:1}.cat .top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px}
.cat .name{font-size:13px;font-weight:600}.cat .name .w{color:var(--faint);font-family:var(--mono);font-size:11px;font-weight:500;margin-left:6px}
.cat .sc{font-family:var(--mono);font-weight:600;font-variant-numeric:tabular-nums}
.bar{height:7px;border-radius:999px;background:var(--line);overflow:hidden}.bar>i{display:block;height:100%;border-radius:999px}
.section{margin-top:40px}
.section>h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:700;margin:0 0 14px}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-top:28px}
.chip{font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;background:var(--panel);border:1px solid var(--line-strong);color:var(--muted);padding:5px 12px;border-radius:999px}
.chip:hover{border-color:var(--faint);color:var(--ink)}
.chip[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
.chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.routes{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--panel)}
.route{border-top:1px solid var(--line)}.route:first-child{border-top:0}
.route>summary{display:grid;grid-template-columns:1fr auto auto auto;gap:16px;align-items:center;padding:13px 16px;cursor:pointer;list-style:none}
.route>summary::-webkit-details-marker{display:none}
.route>summary:hover{background:#fbfcfd}
.route-name{font-family:var(--mono);font-size:13.5px;min-width:0}
.route-name .path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.issue-sum{font-size:12.5px;color:var(--muted);font-family:var(--mono);white-space:nowrap}.issue-sum .none{color:var(--good)}
.score-chip{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-weight:600;font-variant-numeric:tabular-nums;font-size:14px}
.score-chip .ring{width:10px;height:10px;border-radius:50%}
.chev{color:var(--faint);font-family:var(--mono);transition:transform .15s ease}
.route[open]>summary .chev{transform:rotate(90deg)}
.route-body{padding:4px 16px 16px}.empty{color:var(--muted);font-size:13px;margin:6px 0}
.finding{background:var(--panel);border:1px solid var(--line);border-left-width:3px;border-radius:10px;padding:16px 18px;margin:0 0 12px}
.finding.sev-critical{border-left-color:var(--poor)}.finding.sev-warning{border-left-color:var(--warn)}.finding.sev-info{border-left-color:var(--faint)}
.f-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ruleid{font-family:var(--mono);font-size:12px;font-weight:600;background:#eef1f5;padding:2px 8px;border-radius:6px}
.f-title{font-weight:650;font-size:15px}
.sev-tag{margin-left:auto;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.sev-tag.critical{color:var(--poor)}.sev-tag.warning{color:var(--warn)}.sev-tag.info{color:var(--faint)}
.f-loc{font-family:var(--mono);font-size:12.5px;color:var(--muted);margin:8px 0 0}.dyn{color:var(--accent);font-weight:700}
.f-rec{font-size:14px;color:#2b3340;margin:10px 0 0}
.fix{margin:12px 0 0;background:var(--code-bg);border-radius:8px;overflow:hidden}
.fix .label{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8da0bd;padding:8px 14px 0}
.fix pre{margin:0;padding:8px 14px 14px;overflow-x:auto}
.fix code{font-family:var(--mono);font-size:12.5px;color:var(--code-ink);line-height:1.65;white-space:pre}
.f-link{display:inline-block;margin-top:12px;font-size:13px;font-weight:600;color:var(--accent);text-decoration:none}
.f-link:hover{text-decoration:underline}.f-link::after{content:" →"}
.foot{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);font-family:var(--mono);font-size:12px;color:var(--faint);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
.foot a{color:var(--accent);text-decoration:none}
@media (max-width:640px){.hero{grid-template-columns:1fr;justify-items:start}.route>summary{grid-template-columns:1fr auto}.chev{display:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
const SCRIPT = `
(function(){
  var arc=document.getElementById('arc'),num=document.getElementById('hnum');
  if(arc&&num){
    var C=2*Math.PI*58,score=parseInt(num.textContent,10)||0;
    var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!reduce){
      arc.style.transition='stroke-dashoffset 1.1s cubic-bezier(.22,.61,.36,1)';
      arc.style.strokeDashoffset=C.toFixed(1);
      var start=null;
      requestAnimationFrame(function step(t){
        if(start===null)start=t;
        var p=Math.min((t-start)/1100,1);
        num.textContent=Math.round(score*(p<1?1-Math.pow(1-p,3):1));
        if(p<1)requestAnimationFrame(step);
      });
      requestAnimationFrame(function(){arc.style.strokeDashoffset=(C*(1-score/100)).toFixed(1);});
    }
  }
  var chips=document.querySelectorAll('.chip'),findings=document.querySelectorAll('.finding');
  function apply(f){
    findings.forEach(function(el){
      var ok=f==='all'||el.getAttribute('data-severity')===f||el.getAttribute('data-category')===f;
      el.style.display=ok?'':'none';
    });
  }
  chips.forEach(function(c){
    c.addEventListener('click',function(){
      chips.forEach(function(o){o.setAttribute('aria-pressed','false');});
      c.setAttribute('aria-pressed','true');
      apply(c.textContent.trim().toLowerCase());
    });
  });
})();
`;

export function buildHtmlDocument(report: JsonReport, meta: { version: string }): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>svelte-vitals report</title><style>${STYLE}</style></head><body>` +
    `<div class="wrap">` +
    renderTopbar(report, meta) +
    renderHero(report) +
    renderFilters() +
    renderRoutes(report) +
    renderSiteChecks(report) +
    `<footer class="foot"><span>Generated by svelte-vitals · static analysis, no browser</span>` +
    `<span><a href="https://oekazuma.github.io/svelte-vitals/">oekazuma.github.io/svelte-vitals</a></span></footer>` +
    `</div><script>${SCRIPT}</script></body></html>`
  );
}

export function formatHtmlReport(results: Result[], config: Config, meta: { version: string }): string {
  return buildHtmlDocument(buildJsonReport(results, config, meta), meta);
}
