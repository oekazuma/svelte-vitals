# Visual HTML Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-contained visual HTML report — `svelte-vitals --reporter html` writes a single styled `.html` file showing the Health score, per-category and per-route scores, and findings with fixes.

**Architecture:** A runtime-agnostic renderer in `@svelte-vitals/core` turns the existing `JsonReport` into a full self-contained HTML string (server-side templating: data is rendered into the markup; inline `<style>` and inline `<script>` add styling and light interactivity). The CLI adds `--reporter html` + `--out-file` and owns the file write (`node:fs`); core never touches the filesystem. Sub-project B (a future vite live UI) will reuse `buildHtmlDocument` unchanged.

**Tech Stack:** TypeScript, ESM-only (tsup, `target: es2022`), vitest. No new runtime dependencies — no syntax highlighter, chart lib, or framework.

## Global Constraints

- ESM-only; `@svelte-vitals/core` has **no `node:` imports and no I/O** — the renderer is a pure string function. The CLI (`packages/cli`) owns all filesystem access.
- **No new dependencies.** The report is self-contained: inline CSS/JS, no external CSS/JS/font/image references. The only external links are per-finding `docsUrl` anchors.
- **Escape all interpolated content** (titles, messages, file locations, fix snippets) before inserting into HTML.
- **Score color bands:** good `≥ 90` = `#2FA968`, needs-work `50–89` = `#E8A317`, poor `< 50` = `#E5484D`. Svelte orange `#FF3E00` is brand chrome only (wordmark, eyebrows, links, the `↯` marker) — never a score color.
- **Fix snippets render uncolored** (no syntax highlighting in v1).
- Deterministic output (no timestamps/random in core) so snapshot/string tests are stable.
- Reporter signatures mirror the existing ones: `formatHtmlReport(results, config, meta) → string`, where `meta = { version: string }`.
- Reuse the existing `buildJsonReport(results, config, meta): JsonReport` — do not invent a new data model.

### Reference: existing types (read-only — already in the codebase)

```ts
// packages/core/src/reporter/json.ts
interface JsonReport {
  version: string;
  score: number; // combined Health score
  weights: Partial<Record<Category, number>>;
  categories: Record<string, { score: number; scoreModel: ScoreModel }>;
  summary: Summary; // { critical, warning, info, passed, dynamic }  (all numbers)
  routes: Array<{ route: string; score: number; issues: JsonIssue[] }>;
  siteIssues: JsonIssue[];
}
// JsonIssue = {
//   id: string; category: Category; title: string;
//   detection: { presence: 'own'|'inherited'|'none'; value: 'static'|'dynamic'|'absent' };
//   location: string; line?: number; recommendation: string;
//   docsUrl?: string; fix?: { description: string; snippet?: string; lang?: string };
//   severity: 'critical'|'warning'|'info';
// }
export function buildJsonReport(results: Result[], config: Config, meta: { version: string }): JsonReport;
```

---

### Task 1: Core renderer — `JsonReport` → self-contained HTML markup

Renders the full, correct (unstyled) HTML document from a `JsonReport`: topbar, hero (gauge + tallies + category bars), route list (native `<details>`), site checks, footer. Includes all CSS class names and `data-*` hooks that Tasks 2–3 rely on, plus HTML escaping. Empty `<style></style>` and `<script></script>` placeholders are filled in Tasks 2 and 3.

**Files:**

- Create: `packages/core/src/reporter/html.ts`
- Modify: `packages/core/src/index.ts` (export the new functions)
- Test: `packages/core/test/html-report.test.ts`

**Interfaces:**

- Consumes: `buildJsonReport(results, config, meta): JsonReport` and `type JsonReport` from `./json.js`; `Category, Config, Result` from `../types.js`.
- Produces:
  - `escapeHtml(s: string): string`
  - `scoreBand(score: number): 'good' | 'warn' | 'poor'`
  - `BAND_COLOR: Record<'good' | 'warn' | 'poor', string>`
  - `buildHtmlDocument(report: JsonReport, meta: { version: string }): string`
  - `formatHtmlReport(results: Result[], config: Config, meta: { version: string }): string`
  - Internal (same file, not exported): `STYLE: string` (empty in T1), `SCRIPT: string` (empty in T1), and section helpers `renderTopbar`, `renderHero`, `renderRoutes`, `renderSiteChecks`, `renderFinding`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/html-report.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildHtmlDocument, formatHtmlReport, escapeHtml, scoreBand } from '../src/index.js';
import type { JsonReport } from '../src/reporter/json.js';

const report: JsonReport = {
  version: '9.9.9',
  score: 82,
  weights: { seo: 1, performance: 1 },
  categories: {
    seo: { score: 91, scoreModel: { mode: 'weighted' } as never },
    performance: { score: 68, scoreModel: {} as never }
  },
  summary: { critical: 1, warning: 2, info: 1, passed: 37, dynamic: 3 },
  routes: [
    { route: '/', score: 100, issues: [] },
    {
      route: '/products/[id]',
      score: 40,
      issues: [
        {
          id: 'SEO001',
          category: 'seo',
          title: 'Missing <title>',
          detection: { presence: 'none', value: 'absent' },
          location: 'src/routes/products/[id]/+page.svelte',
          recommendation: 'Add a <title> in <svelte:head>.',
          docsUrl: 'https://oekazuma.github.io/svelte-vitals/rules/seo001',
          fix: {
            description: 'Add a <title>.',
            snippet: '<svelte:head>\n  <title>{data.title}</title>\n</svelte:head>',
            lang: 'svelte'
          },
          severity: 'critical'
        }
      ]
    }
  ],
  siteIssues: [
    {
      id: 'SEO007',
      category: 'seo',
      title: 'No sitemap',
      detection: { presence: 'none', value: 'absent' },
      location: 'project',
      recommendation: 'Add a sitemap.',
      severity: 'info'
    }
  ]
};

describe('buildHtmlDocument', () => {
  const html = buildHtmlDocument(report, { version: '9.9.9' });

  it('is a full self-contained HTML document with a title', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>svelte-vitals report</title>');
    expect(html).toContain('</html>');
  });

  it('renders the Health score and category scores', () => {
    expect(html).toContain('>82<'); // health number
    expect(html).toContain('SEO');
    expect(html).toContain('>91<');
    expect(html).toContain('Performance');
    expect(html).toContain('>68<');
  });

  it('renders a row per route and a card per finding', () => {
    expect(html).toContain('/products/[id]');
    expect(html).toContain('SEO001');
    expect(html).toContain('Missing &lt;title&gt;'); // escaped
    expect(html).toContain('SEO007'); // site-wide finding
    expect(html).toContain('data-severity="critical"');
    expect(html).toContain('data-category="seo"');
  });

  it('escapes the fix snippet and renders it in a code block', () => {
    expect(html).toContain('&lt;svelte:head&gt;');
    expect(html).toContain('&lt;title&gt;{data.title}&lt;/title&gt;');
    expect(html).not.toContain('<title>{data.title}</title>'); // raw snippet must not leak
  });

  it('links findings to their docsUrl', () => {
    expect(html).toContain('href="https://oekazuma.github.io/svelte-vitals/rules/seo001"');
  });

  it('is self-contained: no external resource references', () => {
    // strip docsUrl anchors, then assert nothing else points at http(s)
    const withoutDocs = html.replace(/href="https?:\/\/oekazuma\.github\.io[^"]*"/g, '');
    expect(/(?:src|href)\s*=\s*"https?:\/\//i.test(withoutDocs)).toBe(false);
    expect(/url\(\s*['"]?https?:\/\//i.test(withoutDocs)).toBe(false);
  });
});

describe('escapeHtml / scoreBand', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
  it('bands scores', () => {
    expect(scoreBand(95)).toBe('good');
    expect(scoreBand(90)).toBe('good');
    expect(scoreBand(89)).toBe('warn');
    expect(scoreBand(50)).toBe('warn');
    expect(scoreBand(49)).toBe('poor');
  });
});

describe('formatHtmlReport', () => {
  it('matches buildHtmlDocument over the built JsonReport (smoke)', () => {
    // formatHtmlReport builds the JsonReport internally; here we only assert it returns a full doc.
    // A fuller integration check lives in the CLI tests.
    const out = formatHtmlReport(
      [],
      { treatDynamicAs: 'pass', metaComponents: [], rules: {}, failOn: 'critical' } as never,
      { version: '9.9.9' }
    );
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('</html>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run test/html-report.test.ts`
Expected: FAIL — `buildHtmlDocument`/`formatHtmlReport`/`escapeHtml`/`scoreBand` are not exported.

- [ ] **Step 3: Create the renderer**

Create `packages/core/src/reporter/html.ts`:

```ts
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

const slug = (route: string): string =>
  'route-' +
  route
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

type Issue = JsonReport['routes'][number]['issues'][number];

function renderFinding(issue: Issue): string {
  const sev = issue.severity;
  const dyn =
    issue.detection.value === 'dynamic'
      ? ' <span class="dyn" title="set dynamically (verified at runtime)">↯</span>'
      : '';
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
  const dynNote =
    s.dynamic > 0
      ? `<span class="tally"><span class="dot dyn-dot">↯</span>Dynamic <span class="n">${s.dynamic}</span></span>`
      : '';
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
  const chip = (label: string, pressed = false) =>
    `<button class="chip" type="button" aria-pressed="${pressed}">${label}</button>`;
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
```

- [ ] **Step 4: Export from core index**

In `packages/core/src/index.ts`, after the existing reporter exports (the `formatGithubReport` line), add:

```ts
export { buildHtmlDocument, formatHtmlReport, escapeHtml, scoreBand, BAND_COLOR } from './reporter/html.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run test/html-report.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reporter/html.ts packages/core/src/index.ts packages/core/test/html-report.test.ts
git commit -m "feat(core): render JsonReport to a self-contained HTML document"
```

---

### Task 2: Inline styles

Fill the `STYLE` constant with the report's CSS (the approved instrument-report look). Purely presentational — targets the class names already emitted in Task 1.

**Files:**

- Modify: `packages/core/src/reporter/html.ts` (the `STYLE` constant)
- Test: `packages/core/test/html-report.test.ts` (add a styling assertion)

**Interfaces:**

- Consumes: the markup/classes from Task 1 (`.wrap`, `.topbar`, `.brand .v`, `.hero`, `.gauge`, `.num`, `.tallies`, `.tally .dot`, `.cat`, `.bar`, `.filters`, `.chip`, `.routes`, `.route`, `summary`, `.score-chip`, `.finding`, `.sev-critical/.sev-warning/.sev-info`, `.ruleid`, `.fix`, `.f-link`, `.foot`, `.dyn`).
- Produces: no new exports (fills `STYLE`).

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/html-report.test.ts`:

```ts
describe('styling', () => {
  const html = buildHtmlDocument(report, { version: '9.9.9' });
  it('inlines a stylesheet with the brand + score tokens', () => {
    expect(html).toContain('--accent: #ff3e00');
    expect(html).toContain('.finding');
    expect(html).toContain('#2FA968'); // good band used somewhere (inline) — sanity that colors are present
    // still self-contained after adding CSS
    const withoutDocs = html.replace(/href="https?:\/\/oekazuma\.github\.io[^"]*"/g, '');
    expect(/url\(\s*['"]?https?:\/\//i.test(withoutDocs)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run test/html-report.test.ts -t styling`
Expected: FAIL — `--accent: #ff3e00` not present (STYLE is empty).

- [ ] **Step 3: Fill the STYLE constant**

In `packages/core/src/reporter/html.ts`, replace `const STYLE = ``;` with:

```ts
const STYLE = `
:root{--ground:#f6f7f9;--panel:#fff;--ink:#0c1322;--muted:#5a6472;--faint:#8c95a3;--line:#e4e7ec;--line-strong:#d3d8e0;--accent:#ff3e00;--good:#2fa968;--warn:#e8a317;--poor:#e5484d;--code-bg:#0e1525;--code-ink:#e7ecf4;--radius:12px;--mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run test/html-report.test.ts`
Expected: PASS (styling test + all Task 1 tests still green).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/reporter/html.ts packages/core/test/html-report.test.ts
git commit -m "feat(core): style the HTML report (inline, self-contained)"
```

---

### Task 3: Inline interactivity (gauge animation + filters)

Fill the `SCRIPT` constant: animate the Health gauge on load (respecting reduced-motion), and wire the filter chips to show/hide finding cards by severity/category. Operates on the rendered DOM via the `data-*` attributes from Task 1.

**Files:**

- Modify: `packages/core/src/reporter/html.ts` (the `SCRIPT` constant)
- Test: `packages/core/test/html-report.test.ts` (add a behavior-presence assertion)

**Interfaces:**

- Consumes: DOM hooks from Task 1 — `#arc`, `#hnum`, `.chip[aria-pressed]`, `.finding[data-severity][data-category]`.
- Produces: no new exports (fills `SCRIPT`).

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/html-report.test.ts`:

```ts
describe('interactivity', () => {
  const html = buildHtmlDocument(report, { version: '9.9.9' });
  it('inlines the gauge + filter script and stays self-contained', () => {
    expect(html).toContain('prefers-reduced-motion');
    expect(html).toContain('data-severity');
    expect(html).toContain("getElementById('arc')");
    const withoutDocs = html.replace(/href="https?:\/\/oekazuma\.github\.io[^"]*"/g, '');
    expect(/(?:src|href)\s*=\s*"https?:\/\//i.test(withoutDocs)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run test/html-report.test.ts -t interactivity`
Expected: FAIL — `getElementById('arc')` not present (SCRIPT is empty).

- [ ] **Step 3: Fill the SCRIPT constant**

In `packages/core/src/reporter/html.ts`, replace `const SCRIPT = ``;` with:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run test/html-report.test.ts`
Expected: PASS (interactivity + earlier tests).

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run from repo root:

```bash
node -e "import('@svelte-vitals/core').then(m=>{const r={version:'0',score:82,weights:{seo:1,performance:1},categories:{seo:{score:91},performance:{score:68}},summary:{critical:1,warning:2,info:1,passed:37,dynamic:3},routes:[{route:'/',score:100,issues:[]}],siteIssues:[]};require('node:fs').writeFileSync('/tmp/svr.html',m.buildHtmlDocument(r,{version:'0'}));console.log('wrote /tmp/svr.html');})"
```

(Requires a prior `pnpm build`.) Open `/tmp/svr.html` in a browser to eyeball the gauge animation and filters. Not a committed test.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reporter/html.ts packages/core/test/html-report.test.ts
git commit -m "feat(core): animate the gauge and wire finding filters"
```

---

### Task 4: CLI `--reporter html` + `--out-file`

Add the `html` reporter to the CLI: a new reporter name, an `--out-file` option, and a `run()` branch that renders via `formatHtmlReport` and writes the file (default `svelte-vitals-report.html`; `--out-file <path>`; `--out-file -` → stdout; stderr confirmation). The write is injectable for testing.

**Files:**

- Modify: `packages/cli/src/reporter-resolve.ts` (add `'html'`)
- Modify: `packages/cli/src/resolve-args.ts` (parse `--out-file`, update message)
- Modify: `packages/cli/src/index.ts` (`RunOptions.outFile`, `RunOptions.writeFile`, html branch, import)
- Modify: `packages/cli/src/bin.ts` (HELP text + mri `string` option)
- Test: `packages/cli/test/html-reporter.test.ts`

**Interfaces:**

- Consumes: `formatHtmlReport(results, config, { version }): string` from `@svelte-vitals/core`; `RunOptions` from `./index.js`; `ReporterName`/`isReporterName` from `./reporter-resolve.js`.
- Produces: `RunOptions.outFile?: string`, `RunOptions.writeFile?: (path: string, content: string) => void`; `'html'` as a valid `ReporterName`.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/html-reporter.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from '../src/index.js';
import { isReporterName } from '../src/reporter-resolve.js';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'basic-project'); // the SvelteKit fixture the other CLI tests use

describe('html reporter', () => {
  it('accepts "html" as a reporter name', () => {
    expect(isReporterName('html')).toBe(true);
  });

  it('writes a default file and prints the path to stderr', async () => {
    const writes: Array<[string, string]> = [];
    const errs: string[] = [];
    const code = await run({
      cwd: fixture,
      reporter: 'html',
      env: {},
      writeFile: (p, c) => writes.push([p, c]),
      log: () => {},
      errorLog: (l) => errs.push(l)
    });
    expect(code).toBeTypeOf('number');
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe('svelte-vitals-report.html');
    expect(writes[0][1].startsWith('<!doctype html>')).toBe(true);
    expect(errs.some((e) => e.includes('wrote report to svelte-vitals-report.html'))).toBe(true);
  });

  it('honors --out-file path', async () => {
    const writes: Array<[string, string]> = [];
    await run({
      cwd: fixture,
      reporter: 'html',
      outFile: 'out/report.html',
      env: {},
      writeFile: (p, c) => writes.push([p, c]),
      log: () => {},
      errorLog: () => {}
    });
    expect(writes[0][0]).toBe('out/report.html');
  });

  it('writes to stdout (not the filesystem) when out-file is "-"', async () => {
    const writes: string[] = [];
    const logs: string[] = [];
    await run({
      cwd: fixture,
      reporter: 'html',
      outFile: '-',
      env: {},
      writeFile: () => writes.push('FS'),
      log: (l) => logs.push(l),
      errorLog: () => {}
    });
    expect(writes).toHaveLength(0);
    expect(logs.join('\n')).toContain('<!doctype html>');
  });
});
```

> `test/fixtures/basic-project` is the fixture the other CLI tests already use (confirmed). The reporter behavior under test is independent of which fixture is chosen, but reuse this one for consistency.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && pnpm vitest run test/html-reporter.test.ts`
Expected: FAIL — `isReporterName('html')` is false and `run` has no html branch.

- [ ] **Step 3: Add `'html'` to the reporter name**

In `packages/cli/src/reporter-resolve.ts`:

- Change the type:

```ts
export type ReporterName = 'console' | 'json' | 'agent' | 'sarif' | 'github' | 'html';
```

- Update `isReporterName`:

```ts
export function isReporterName(value: string | undefined): value is ReporterName {
  return (
    value === 'console' ||
    value === 'json' ||
    value === 'agent' ||
    value === 'sarif' ||
    value === 'github' ||
    value === 'html'
  );
}
```

(`resolveReporter` needs no change — `html` is only ever chosen explicitly, and the auto-detect branches are unaffected.)

- [ ] **Step 4: Parse `--out-file` and update the unknown-reporter message**

In `packages/cli/src/resolve-args.ts`:

- Update the unknown-reporter error message to include `html`:

```ts
errors.push(
  `svelte-vitals: unknown reporter '${argv.reporter}'. Valid values: console, json, agent, sarif, github, html.`
);
```

- In the returned `options` object, add `outFile`:

```ts
      reporter,
      outFile: typeof argv['out-file'] === 'string' ? argv['out-file'] : undefined,
      byRoute: Boolean(argv['by-route']),
```

- [ ] **Step 5: Add the html branch to `run()`**

In `packages/cli/src/index.ts`:

- Add the import for `formatHtmlReport` to the existing `@svelte-vitals/core` import block (alongside `formatGithubReport`):

```ts
  formatGithubReport,
  formatHtmlReport,
```

- Add a Node fs import near the top of the file (with the other imports):

```ts
import { writeFileSync } from 'node:fs';
```

- Add two fields to `RunOptions`:

```ts
  /** Output path for --reporter html (default 'svelte-vitals-report.html'; '-' = stdout). */
  outFile?: string;
  /** Injected file writer for --reporter html (defaults to node:fs writeFileSync). Mainly for tests. */
  writeFile?: (path: string, content: string) => void;
```

- In the reporter dispatch chain, add an `html` branch **before** the final `else` (the console branch):

```ts
    } else if (reporter === 'html') {
      const html = formatHtmlReport(results, config, { version });
      if (opts.outFile === '-') {
        log(html);
      } else {
        const path = opts.outFile ?? 'svelte-vitals-report.html';
        const write = opts.writeFile ?? ((p: string, c: string) => writeFileSync(p, c));
        write(path, html);
        errorLog(`svelte-vitals: wrote report to ${path}`);
      }
    } else {
```

- [ ] **Step 6: Update HELP and mri options in `bin.ts`**

In `packages/cli/src/bin.ts`:

- Update the `--reporter` help line and add an `--out-file` line:

```ts
  --reporter <fmt>            console | json | agent | sarif | github | html (auto: agent under AI-agent envs, github under GitHub Actions)
  --out-file <path>           Output path for --reporter html (default: svelte-vitals-report.html; '-' for stdout)
```

- Add `'out-file'` to mri's `string` array:

```ts
string: [
  'meta-components',
  'treat-dynamic-as',
  'route',
  'fail-on',
  'reporter',
  'rules',
  'ignore',
  'min-health',
  'out-file'
];
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run test/html-reporter.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/reporter-resolve.ts packages/cli/src/resolve-args.ts packages/cli/src/index.ts packages/cli/src/bin.ts packages/cli/test/html-reporter.test.ts
git commit -m "feat(cli): add --reporter html with --out-file"
```

---

### Task 5: Docs + changeset + full verification

Document the HTML report (docs site, en + ja) and the new flags, add the release changeset, and run the full verification suite.

**Files:**

- Modify: `docs/src/content/docs/guides/reporters.md` and `docs/src/content/docs/ja/guides/reporters.md` (add an HTML report section)
- Modify: `docs/src/content/docs/guides/cli.md` and `docs/src/content/docs/ja/guides/cli.md` (document `--reporter html` + `--out-file`)
- Create: `.changeset/visual-html-report.md`

**Interfaces:** none (docs + release).

- [ ] **Step 1: Add an HTML report section to the Reporters guide (en)**

In `docs/src/content/docs/guides/reporters.md`, add a section (match the file's existing heading style and tone):

````md
## HTML report

`--reporter html` writes a self-contained HTML report — Health score, per-category and per-route scores, and every finding with its fix — that you open in a browser. The file inlines all its CSS and JS, so it works offline and is easy to attach to a CI run or share.

```bash
svelte-vitals --reporter html                 # writes svelte-vitals-report.html
svelte-vitals --reporter html --out-file report.html
svelte-vitals --reporter html --out-file -     # write to stdout instead of a file
```

By default it writes `svelte-vitals-report.html` in the current directory and prints the path to stderr. Use `--out-file <path>` to change the location, or `--out-file -` to stream it to stdout (for piping or CI artifacts).
````

- [ ] **Step 2: Add the same section to the Reporters guide (ja)**

In `docs/src/content/docs/ja/guides/reporters.md`, add the translated section:

````md
## HTML レポート

`--reporter html` は自己完結の HTML レポート（Health スコア・カテゴリ別/ルート別スコア・各検出結果と修正）を出力し、ブラウザで開けます。CSS と JS をすべてインライン化しているためオフラインで動作し、CI 成果物として添付したり共有したりするのも簡単です。

```bash
svelte-vitals --reporter html                 # svelte-vitals-report.html を出力
svelte-vitals --reporter html --out-file report.html
svelte-vitals --reporter html --out-file -     # ファイルではなく標準出力へ
```

既定ではカレントディレクトリに `svelte-vitals-report.html` を書き出し、パスを stderr に表示します。`--out-file <path>` で出力先を変更でき、`--out-file -` で標準出力にストリームします（パイプや CI 成果物向け）。
````

- [ ] **Step 3: Document the flags in the CLI guide (en + ja)**

In `docs/src/content/docs/guides/cli.md`, add `html` to the `--reporter` description and add an `--out-file` entry in the same flag list/table the file already uses. In `docs/src/content/docs/ja/guides/cli.md`, do the same in Japanese. Keep each consistent with that file's existing format (match how the other flags are listed — do not invent a new table shape).

Exact text to use for the additions:

- en `--reporter`: `console, json, agent, sarif, github, or html`
- en `--out-file`: `Output path for --reporter html (default svelte-vitals-report.html; - for stdout).`
- ja `--reporter`: `console, json, agent, sarif, github, html のいずれか`
- ja `--out-file`: `--reporter html の出力先パス（既定 svelte-vitals-report.html、- で標準出力）。`

- [ ] **Step 4: Add the changeset**

Create `.changeset/visual-html-report.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Add a visual HTML report: `svelte-vitals --reporter html` writes a self-contained,
styled HTML page (Health score, per-category and per-route scores, findings with
fixes) you can open in a browser. Output path defaults to `svelte-vitals-report.html`;
override with `--out-file <path>` or `--out-file -` for stdout. The core gains
`buildHtmlDocument` / `formatHtmlReport` for reuse by other surfaces.
```

- [ ] **Step 5: Full verification**

Run from the repo root:

```bash
CI=true pnpm -r typecheck && CI=true pnpm -r test && pnpm build && CI=true pnpm --filter docs build && pnpm lint && pnpm check:publish
```

Expected: all green. (Run `pnpm format` first if prettier flags the new Markdown. The `attw` step may fail locally only — that is the known pre-existing local-cache issue and is unaffected by this change; confirm CI is green on the PR.)

- [ ] **Step 6: Commit**

```bash
git add docs/src/content/docs/guides/reporters.md docs/src/content/docs/ja/guides/reporters.md docs/src/content/docs/guides/cli.md docs/src/content/docs/ja/guides/cli.md .changeset/visual-html-report.md
git commit -m "docs: document the HTML report; changeset (core + cli minor)"
```

---

## Self-Review

**Spec coverage:**

- Shared runtime-agnostic renderer in core (`buildHtmlDocument`/`formatHtmlReport`, no `node:`/I/O) → Tasks 1–3. ✅
- CLI `--reporter html`, default file + `--out-file <path>` + `-` stdout + stderr message, exit codes unchanged → Task 4. ✅
- Reuses existing `buildJsonReport` data model → Task 1 (`formatHtmlReport`). ✅
- Server-side templating + progressive-enhancement JS → Tasks 1 (markup), 3 (JS). ✅
- Rendered content (topbar, hero gauge, tallies, category bars, route table, finding cards w/ fix + docs link) → Tasks 1–2. ✅
- Interactivity (filter by severity/category, native `<details>` expand, gauge animation) → Tasks 1 (`<details>`) + 3 (filter, gauge). Score/path **sort** from the spec is intentionally deferred — routes already arrive sorted by path from `buildJsonReport`, and a sort toggle adds JS for little v1 value; noted here as the one trimmed item. ✅ (documented deviation)
- Score color bands + orange-as-brand-only → Tasks 1–2 (`scoreBand`, `BAND_COLOR`, CSS). ✅
- Uncolored fix snippets, no dark mode → Tasks 1–2 (no highlighter; light CSS only). ✅
- Escape all interpolated content; self-contained guard → Task 1 (escaping + guard test). ✅
- Deterministic output → no timestamps/random anywhere in core. ✅
- Minor changeset (core + cli); cascade for vite/mcp is automatic → Task 5. ✅
- Docs (reporters + cli guides, en + ja) → Task 5. ✅

**Placeholder scan:** No "TBD"/"add error handling"/"similar to" — every code step has complete code. The one prose instruction (Task 5 Step 3, "match the file's existing flag format") gives the exact text to insert; only the surrounding format is matched to the file. The Task 4 fixture-path note gives a concrete fallback (grep existing `test/fixtures`).

**Type consistency:** `buildHtmlDocument(report: JsonReport, meta: { version: string })` and `formatHtmlReport(results, config, meta)` are used identically in Tasks 1, 3, 4. `ReporterName` adds `'html'` (Task 4 Step 3) and is consumed by `resolve-args`/`run`. `RunOptions.outFile`/`writeFile` defined in Task 4 Step 5 match the Task 4 tests. `scoreBand`/`BAND_COLOR` defined in Task 1 are reused by the CSS-color decisions in Task 2. `Issue` type is `JsonReport['routes'][number]['issues'][number]`, consistent across `renderFinding` callers.

**Note on the `formatHtmlReport` smoke test (Task 1 Step 1):** it passes a minimal hand-built `Config` cast; if the real `Config`/`buildJsonReport` rejects empty input at runtime, simplify that single test to assert only on `buildHtmlDocument` (the CLI tests in Task 4 cover `formatHtmlReport` end-to-end against a real fixture). The core behavior under test is `buildHtmlDocument`.
