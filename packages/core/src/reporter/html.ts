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
    `<p class="f-loc">${escapeHtml(issue.location)}${line}${dyn}</p>` +
    `<p class="f-rec">${escapeHtml(issue.recommendation)}</p>` +
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

const STYLE = ``; // filled in Task 2
const SCRIPT = ``; // filled in Task 3

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
