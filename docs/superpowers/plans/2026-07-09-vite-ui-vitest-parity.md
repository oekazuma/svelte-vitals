# Live UI Dashboard — vitest --ui Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `@svelte-vitals/vite` live dashboard (`svelteVitals({ ui: true })`, served at `/__svelte-vitals/`) into a master/detail, searchable, sortable, dark-mode-capable SPA-style dashboard — closing the experiential gap with `vitest --ui` — while leaving `@svelte-vitals/core` and the CLI's `--reporter html` output completely untouched.

**Architecture:** Server-side, `packages/vite/src/ui/snapshot.ts` composes a `DashboardSnapshot` (the existing `JsonReport` + badges + an `analyzing` flag + a monotonic `sequence` number) from the existing `FindingsStore`. `packages/vite/src/ui/dashboard.ts` embeds that snapshot as escaped JSON inside an HTML shell. Client-side, a hand-authored vanilla-JS renderer (`packages/vite/src/ui/dashboard-script.ts`) parses the embedded JSON, renders a sidebar (search + sort + route list) and a detail pane (Overview or a selected route's findings), and re-renders in place on every SSE `update` by re-fetching a new `GET /__svelte-vitals/data.json` endpoint — discarding out-of-order responses via the sequence number.

**Tech Stack:** TypeScript (Node, ESM, `.js`-suffixed relative imports), Vitest, hand-authored template-string CSS/JS (no bundler, no new runtime dependency) — matching the existing pattern in `packages/core/src/reporter/html.ts`.

## Global Constraints

- Never modify `packages/core/src/reporter/html.ts` or any other file under `packages/core` — the CLI's `--reporter html` output must stay byte-identical. (spec: Goal, Non-goals)
- No new external dependency (no highlighting library, no icon set, no CSS framework, no bundler) — all new CSS/JS is hand-authored template strings, matching `packages/core/src/reporter/html.ts`'s `STYLE`/`SCRIPT` pattern. (spec: Non-goals)
- No new SSE event types — the analyzing indicator rides the existing `event: update` notification. (spec: Approach, Non-goals)
- Text embedded inside the shell's `<script type="application/json">` must have `<`, U+2028, and U+2029 escaped so no finding-derived string (route path, location, recommendation, fix snippet) can break out of the tag. (spec: Security)
- Client-side DOM must be built via `textContent`/`setAttribute`/DOM APIs — never `innerHTML` with finding-derived content. (spec: Security)
- `docsUrl` must be sanitized with `@svelte-vitals/core`'s exported `safeHref` before it ever reaches the client (done server-side, once, in the snapshot builder — see Task 3). (spec: Security)
- Every route under `/__svelte-vitals/` (including the new `/data.json`) must stay behind the existing loopback-origin/host check in `packages/vite/src/ui/middleware.ts` — add new routes inside the existing handler, never a second `server.middlewares.use` call. (spec: Security, New/changed files)
- `JsonReport.routes[].issues` and `siteIssues` only ever contain penalized (non-passing) findings — the new dashboard shows the same set as today; no passing-results view. (spec: Non-goals)
- `@svelte-vitals/vite` releases **minor**; a changeset is required (`AGENTS.md`, spec: Release).
- English and Japanese docs (`docs/src/content/docs/guides/dev-overlay.md` and its `ja/` equivalent) are updated together (`AGENTS.md`).
- Tests are Vitest, colocated in `packages/vite/test/`, following that directory's existing naming (`ui-*.test.ts`).

Reference spec: `docs/superpowers/specs/2026-07-09-vite-ui-vitest-parity-design.md`.

---

## Existing code this plan builds on

Read these before starting — every task below assumes this shape:

- `packages/vite/src/ui/store.ts` — `FindingsStore`: `set`, `setStatic`, `snapshot()`, `badges()`, `subscribe`. `composeSnapshot`/`composeBadges` are pure, exported, already tested.
- `packages/vite/src/ui/analysis.ts` — `createAnalysisRunner({ root, onResults, onError, analyze?, debounceMs? })`. `runOnce()` sets `running = true`, awaits `analyze(...)`, calls `onResults`/`onError`, then in `finally` sets `running = false` and starts exactly one coalesced follow-up if a change arrived mid-run.
- `packages/vite/src/ui/middleware.ts` — `installUiMiddleware(server, config, version, store, coreVersion?)` mounts one handler on `/__svelte-vitals`. It enforces a loopback-origin/host check up front (`isLoopbackOrigin`/`isLoopbackHost` from `packages/vite/src/loopback.ts`) before branching on `req.method`/`url` for `/ingest` (POST), `/events` (SSE), and the catch-all `/` (dashboard HTML).
- `packages/vite/src/ui/serve.ts` — today's `renderDashboard(results, config, meta, badges?)`: calls core's `buildHtmlDocument` and injects a live-update `<script data-live>`. **Deleted in Task 7.**
- `packages/vite/src/plugin.ts` — the `svelteVitals({ ui: true })` `uiPlugin.configureServer` creates the store, creates the analysis runner (`onResults: (results) => store.setStatic(results)`), starts it, wires the watcher, and calls `installUiMiddleware`.
- `@svelte-vitals/core` already publicly exports (verified in `packages/core/src/index.ts`): `buildJsonReport`, `type JsonReport`, `escapeHtml`, `safeHref`, `scoreBand`, `BAND_COLOR`, `type Config`, `type Result`.
- `packages/core/src/reporter/json.ts`'s `buildJsonReport` groups `Result[]` into `routes: Array<{ route, score, issues }>` (only penalized issues) plus `siteIssues` (routeless, penalized) and category/health scores.
- `packages/core/src/types.ts`'s `Fix` type: `{ description: string; snippet?: string; lang?: string }` — doc comment: "Markdown fenced-code language for `snippet` (default 'svelte')".

---

### Task 1: Store — analyzing flag and sequence counter

**Files:**
- Modify: `packages/vite/src/ui/store.ts`
- Test: `packages/vite/test/ui-store.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `FindingsStore.setAnalyzing(analyzing: boolean): void`, `FindingsStore.isAnalyzing(): boolean`, `FindingsStore.sequence(): number`. `sequence()` returns a counter incremented once per `notify()` call (i.e. by `set`, `setStatic`, and `setAnalyzing` alike). Task 3 depends on these three methods.

- [ ] **Step 1: Write the failing tests**

Add these `it` blocks inside the existing `describe('createStore', ...)` block in `packages/vite/test/ui-store.test.ts` (append after the last existing `it`, before the closing `});` of that `describe`):

```ts
  it('setAnalyzing/isAnalyzing round-trips and notifies subscribers', () => {
    const s = createStore();
    const fn = vi.fn();
    s.subscribe(fn);
    expect(s.isAnalyzing()).toBe(false);
    s.setAnalyzing(true);
    expect(s.isAnalyzing()).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    s.setAnalyzing(false);
    expect(s.isAnalyzing()).toBe(false);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('sequence() strictly increases across set/setStatic/setAnalyzing', () => {
    const s = createStore();
    const seq0 = s.sequence();
    s.set('/a', [r('SEO001', '/a')]);
    const seq1 = s.sequence();
    expect(seq1).toBeGreaterThan(seq0);
    s.setStatic([r('SEO002', '/b')]);
    const seq2 = s.sequence();
    expect(seq2).toBeGreaterThan(seq1);
    s.setAnalyzing(true);
    const seq3 = s.sequence();
    expect(seq3).toBeGreaterThan(seq2);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-store`
Expected: FAIL — `s.setAnalyzing is not a function` (and `s.sequence is not a function`).

- [ ] **Step 3: Implement `setAnalyzing`/`isAnalyzing`/`sequence`**

In `packages/vite/src/ui/store.ts`, extend the interface:

```ts
export interface FindingsStore {
  /** Replace a route's live findings (route stamped onto results missing one) and notify subscribers. */
  set(route: string, results: Result[]): void;
  /** Replace the whole static (whole-project) layer and notify subscribers. */
  setStatic(results: Result[]): void;
  /** Mark whether a whole-project analysis run is currently in flight; participates in subscribe/notify like a findings change. */
  setAnalyzing(analyzing: boolean): void;
  isAnalyzing(): boolean;
  /** Composed findings across both layers — feed straight into buildJsonReport. */
  snapshot(): Result[];
  /** Per-route provenance for the dashboard's badges: 'measured' (live) or 'static'. */
  badges(): Record<string, RouteBadge>;
  /** Monotonically increasing counter, bumped once per notify() — lets consumers discard stale fetches. */
  sequence(): number;
  /** Subscribe to change notifications; returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
}
```

And `createStore`:

```ts
export function createStore(): FindingsStore {
  let staticResults: Result[] = [];
  const liveByRoute = new Map<string, Result[]>();
  const subs = new Set<() => void>();
  let analyzing = false;
  let seq = 0;

  function notify(): void {
    seq += 1;
    for (const fn of subs) fn();
  }

  return {
    set(route, results) {
      liveByRoute.set(
        route,
        results.map((r) => (r.route ? r : { ...r, route }))
      );
      notify();
    },
    setStatic(results) {
      staticResults = results;
      notify();
    },
    setAnalyzing(next) {
      analyzing = next;
      notify();
    },
    isAnalyzing() {
      return analyzing;
    },
    snapshot() {
      return composeSnapshot(staticResults, liveByRoute);
    },
    badges() {
      return composeBadges(staticResults, liveByRoute);
    },
    sequence() {
      return seq;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-store`
Expected: PASS (all tests in the file, old and new).

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/ui/store.ts packages/vite/test/ui-store.test.ts
git commit -m "feat(vite): add analyzing flag and sequence counter to the ui findings store"
```

---

### Task 2: Analysis runner — `onStatusChange` callback

**Files:**
- Modify: `packages/vite/src/ui/analysis.ts`
- Test: `packages/vite/test/ui-analysis.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AnalysisRunnerOptions.onStatusChange?(analyzing: boolean): void` — called `true` right before a run's `analyze()` call and `false` once that run settles (success or failure), including immediately before a coalesced follow-up run starts again. Task 8 wires this to `store.setAnalyzing`.

- [ ] **Step 1: Write the failing tests**

Add these `it` blocks inside the existing `describe('createAnalysisRunner', ...)` block in `packages/vite/test/ui-analysis.test.ts` (the file already has `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => vi.useRealTimers())` at module scope — reuse them):

```ts
  it('calls onStatusChange(true) then onStatusChange(false) around a successful run', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [] }));
    const onStatusChange = vi.fn();
    const runner = createAnalysisRunner({
      root: '/proj',
      analyze,
      onResults: vi.fn(),
      onError: vi.fn(),
      onStatusChange
    });
    runner.start();
    await vi.waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith(false));
    expect(onStatusChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it('calls onStatusChange(false) even when the run fails', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => {
      throw new Error('boom');
    });
    const onStatusChange = vi.fn();
    const runner = createAnalysisRunner({
      root: '/proj',
      analyze,
      onResults: vi.fn(),
      onError: vi.fn(),
      onStatusChange
    });
    runner.start();
    await vi.waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith(false));
  });

  it('re-fires onStatusChange(true) when a coalesced follow-up starts', async () => {
    let resolveFirst!: (v: { results: Result[] }) => void;
    const analyze = vi
      .fn<AnalyzeFn>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementation(async () => ({ results: [] }));
    const onStatusChange = vi.fn();
    const runner = createAnalysisRunner({
      root: '/proj',
      analyze,
      onResults: vi.fn(),
      onError: vi.fn(),
      onStatusChange,
      debounceMs: 10
    });

    runner.start();
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    runner.notifyChange('a.svelte');
    await vi.advanceTimersByTimeAsync(20);

    resolveFirst({ results: [] });
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
    expect(onStatusChange.mock.calls.map((c) => c[0])).toEqual([true, false, true, false]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-analysis`
Expected: FAIL — `onStatusChange` is never called (`toHaveBeenLastCalledWith` fails / times out).

- [ ] **Step 3: Implement `onStatusChange`**

In `packages/vite/src/ui/analysis.ts`, add the option:

```ts
export interface AnalysisRunnerOptions {
  /** Project root to analyze (passed as `cwd` to `analyzeProject`). */
  root: string;
  treatDynamicAs?: TreatDynamicAs;
  metaComponents?: string[];
  rules?: Record<string, RuleSetting>;
  failOn?: Severity;
  analyze?: AnalyzeFn;
  onResults(results: Result[]): void;
  onError(err: unknown): void;
  /** Called `true` right before a run starts its `analyze()` call and `false` once that run settles — including right before a coalesced follow-up starts again, so a rapid burst of changes may emit false-then-true between runs rather than staying true throughout. */
  onStatusChange?(analyzing: boolean): void;
  /** Debounce window for `notifyChange` (default: 500ms). */
  debounceMs?: number;
}
```

And in `runOnce`:

```ts
  async function runOnce(): Promise<void> {
    if (stopped) return;
    running = true;
    opts.onStatusChange?.(true);
    try {
      const analyze = await getAnalyze();
      const { results } = await analyze({
        cwd: opts.root,
        treatDynamicAs: opts.treatDynamicAs,
        metaComponents: opts.metaComponents,
        rules: opts.rules,
        failOn: opts.failOn
      });
      if (!stopped) opts.onResults(results);
    } catch (err) {
      if (!stopped) opts.onError(err);
    } finally {
      running = false;
      opts.onStatusChange?.(false);
      if (!stopped && pending) {
        pending = false;
        void runOnce();
      }
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-analysis`
Expected: PASS (all tests in the file, old and new).

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/ui/analysis.ts packages/vite/test/ui-analysis.test.ts
git commit -m "feat(vite): add onStatusChange callback to the ui analysis runner"
```

---

### Task 3: Snapshot payload builder

**Files:**
- Create: `packages/vite/src/ui/snapshot.ts`
- Test: `packages/vite/test/ui-snapshot.test.ts`

**Interfaces:**
- Consumes: `FindingsStore` (Task 1: `.snapshot()`, `.badges()`, `.isAnalyzing()`, `.sequence()`), `buildJsonReport`/`safeHref`/`type Config`/`type JsonReport` from `@svelte-vitals/core`.
- Produces: `interface DashboardSnapshot { report: JsonReport; badges: Record<string, 'measured' | 'static'>; analyzing: boolean; sequence: number; meta: { version: string; coreVersion?: string } }` and `buildSnapshot(store: FindingsStore, config: Config, meta: { version: string; coreVersion?: string }): DashboardSnapshot`. Tasks 6 and 7 depend on this exact shape and function name.

- [ ] **Step 1: Write the failing tests**

Create `packages/vite/test/ui-snapshot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSnapshot } from '../src/ui/snapshot.js';
import { createStore } from '../src/ui/store.js';
import { defineConfig, type Result } from '@svelte-vitals/core';

const r = (id: string, route: string, extra: Partial<Result> = {}): Result =>
  ({
    id,
    message: id,
    category: 'seo',
    detection: { presence: 'none', value: 'absent' },
    route,
    severity: 'critical',
    ...extra
  }) as Result;

describe('buildSnapshot', () => {
  it('composes report/badges/analyzing/sequence/meta from the store', () => {
    const store = createStore();
    store.setStatic([r('SEO001', '/a')]);
    store.setAnalyzing(true);
    const snapshot = buildSnapshot(store, defineConfig({}), { version: '9.9.9', coreVersion: '0.21.0' });

    expect(snapshot.report.routes.some((route) => route.route === '/a' && route.issues.some((i) => i.id === 'SEO001'))).toBe(
      true
    );
    expect(snapshot.badges).toEqual({ '/a': 'static' });
    expect(snapshot.analyzing).toBe(true);
    expect(snapshot.sequence).toBe(store.sequence());
    expect(snapshot.meta).toEqual({ version: '9.9.9', coreVersion: '0.21.0' });
  });

  it('drops a docsUrl using an unsafe scheme while keeping a safe https:// one', () => {
    const store = createStore();
    store.setStatic([
      r('SEO001', '/a', { docsUrl: 'javascript:alert(1)' }),
      r('SEO002', '/a', { docsUrl: 'https://svelte-vitals.dev/rules/SEO002' })
    ]);
    const snapshot = buildSnapshot(store, defineConfig({}), { version: '9.9.9' });
    const issues = snapshot.report.routes.find((route) => route.route === '/a')!.issues;
    expect(issues.find((i) => i.id === 'SEO001')!.docsUrl).toBeUndefined();
    expect(issues.find((i) => i.id === 'SEO002')!.docsUrl).toBe('https://svelte-vitals.dev/rules/SEO002');
  });

  it('sequence reflects the snapshot at build time, not a live reference', () => {
    const store = createStore();
    store.setStatic([r('SEO001', '/a')]);
    const first = buildSnapshot(store, defineConfig({}), { version: '9.9.9' });
    store.setStatic([r('SEO002', '/b')]);
    const second = buildSnapshot(store, defineConfig({}), { version: '9.9.9' });
    expect(second.sequence).toBeGreaterThan(first.sequence);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-snapshot`
Expected: FAIL — `Cannot find module '../src/ui/snapshot.js'`.

- [ ] **Step 3: Implement `snapshot.ts`**

Create `packages/vite/src/ui/snapshot.ts`:

```ts
import { buildJsonReport, safeHref, type Config, type JsonReport } from '@svelte-vitals/core';
import type { FindingsStore, RouteBadge } from './store.js';

export interface DashboardSnapshot {
  report: JsonReport;
  badges: Record<string, RouteBadge>;
  analyzing: boolean;
  /** Monotonically increasing; lets the client discard an out-of-order /data.json response. */
  sequence: number;
  meta: { version: string; coreVersion?: string };
}

type Issue = JsonReport['routes'][number]['issues'][number];

/**
 * `docsUrl` on an ingested (live) result never goes through core's `escapeHtml`/`safeHref`
 * renderer in this dashboard — sanitize it once here, server-side, so the client never has
 * to re-implement the http(s)-only scheme check itself.
 */
function sanitizeDocsUrl(issue: Issue): Issue {
  if (issue.docsUrl === undefined) return issue;
  if (safeHref(issue.docsUrl) !== null) return issue;
  const { docsUrl: _drop, ...rest } = issue;
  return rest as Issue;
}

function sanitizeReport(report: JsonReport): JsonReport {
  return {
    ...report,
    routes: report.routes.map((route) => ({ ...route, issues: route.issues.map(sanitizeDocsUrl) })),
    siteIssues: report.siteIssues.map(sanitizeDocsUrl)
  };
}

/** Build the payload shared by the dashboard shell's embedded JSON and the /data.json endpoint. */
export function buildSnapshot(
  store: FindingsStore,
  config: Config,
  meta: { version: string; coreVersion?: string }
): DashboardSnapshot {
  return {
    report: sanitizeReport(buildJsonReport(store.snapshot(), config, meta)),
    badges: store.badges(),
    analyzing: store.isAnalyzing(),
    sequence: store.sequence(),
    meta
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-snapshot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/ui/snapshot.ts packages/vite/test/ui-snapshot.test.ts
git commit -m "feat(vite): add DashboardSnapshot builder with server-side docsUrl sanitization"
```

---

### Task 4: Dashboard stylesheet

**Files:**
- Create: `packages/vite/src/ui/dashboard-style.ts`
- Test: covered by Task 6's `ui-dashboard.test.ts` (this task has no standalone test — a hand-authored CSS string has nothing to unit-test on its own; Task 6 asserts on its presence inside the rendered shell).

**Interfaces:**
- Consumes: nothing.
- Produces: `export const DASHBOARD_STYLE: string`. Task 6 embeds it in a `<style>` tag.

- [ ] **Step 1: Create `dashboard-style.ts`**

```ts
/**
 * Hand-authored CSS for the master/detail live dashboard — a separate stylesheet from
 * core's `STYLE` (packages/core/src/reporter/html.ts), by design (see spec: Approach,
 * "Tradeoff, stated explicitly"). Reuses the same token names/values where the two
 * surfaces overlap, and adds a dark theme via `:root[data-theme="dark"]` plus a
 * `prefers-color-scheme` fallback for a first-ever visit with no stored preference.
 */
export const DASHBOARD_STYLE = `
:root{--ground:#f6f7f9;--panel:#fff;--ink:#0c1322;--muted:#5a6472;--faint:#8c95a3;--line:#e4e7ec;--line-strong:#d3d8e0;--accent:#ff3e00;--good:#2fa968;--warn:#e8a317;--poor:#e5484d;--code-bg:#0e1525;--code-ink:#e7ecf4;--mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
:root[data-theme="dark"]{--ground:#0b0e14;--panel:#12161f;--ink:#e7ecf4;--muted:#9aa4b2;--faint:#6b7484;--line:#232838;--line-strong:#2d3345;--code-bg:#05070c;--code-ink:#e7ecf4}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#0b0e14;--panel:#12161f;--ink:#e7ecf4;--muted:#9aa4b2;--faint:#6b7484;--line:#232838;--line-strong:#2d3345;--code-bg:#05070c;--code-ink:#e7ecf4}}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--ground);color:var(--ink);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased}
.dv-app{display:grid;grid-template-rows:auto 1fr;grid-template-columns:280px 1fr;grid-template-areas:"top top" "side main";height:100vh}
.dv-topbar{grid-area:top;border-bottom:1px solid var(--line);background:var(--panel)}
.dv-topbar-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:12px 20px}
.dv-brand{display:flex;align-items:baseline;gap:8px;font-weight:700;font-size:16px}
.dv-brand .bolt{color:var(--accent)}
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
.dv-nav-item.active{background:var(--ink);color:#fff}
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
.dv-gauge-num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.dv-gauge-num strong{font-family:var(--mono);font-size:36px;font-weight:600}
.dv-gauge-num span{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted)}
.dv-cats{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:20px}
.dv-cat{min-width:180px;flex:1}
.dv-cat-top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px}
.dv-bar{height:7px;border-radius:999px;background:var(--line);overflow:hidden}
.dv-bar>i{display:block;height:100%;border-radius:999px}
.dv-filters{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.dv-chip{font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;background:var(--panel);border:1px solid var(--line-strong);color:var(--muted);padding:5px 12px;border-radius:999px}
.dv-chip[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
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
.dv-empty{color:var(--muted);font-size:13px}
@media (max-width:640px){.dv-app{grid-template-columns:1fr;grid-template-areas:"top" "main"}.dv-menu-toggle{display:inline-flex}.dv-sidebar{position:fixed;inset:0 20% 0 0;transform:translateX(-100%);transition:transform .2s ease;z-index:10}.dv-sidebar.open{transform:translateX(0)}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
```

- [ ] **Step 2: Sanity-check the file**

Run: `pnpm --filter @svelte-vitals/vite typecheck`
Expected: no errors (a plain exported `string` constant).

- [ ] **Step 3: Commit**

```bash
git add packages/vite/src/ui/dashboard-style.ts
git commit -m "feat(vite): add dashboard stylesheet with dark-mode tokens"
```

---

### Task 5: Dashboard client script

**Files:**
- Create: `packages/vite/src/ui/dashboard-script.ts`
- Test: covered by Task 6's `ui-dashboard.test.ts` (same reasoning as core's existing `SCRIPT`/`ui-serve.test.ts` precedent: an injected client script is tested by string-presence assertions on the rendered document, not by executing it in Node).

**Interfaces:**
- Consumes: the `DashboardSnapshot` JSON shape from Task 3 (read at runtime from `document.getElementById('svelte-vitals-data').textContent`), and the DOM ids `dv-topbar`/`dv-sidebar`/`dv-detail`/`dv-app`/`svelte-vitals-data` that Task 6's shell must provide.
- Produces: `export const DASHBOARD_SCRIPT: string` — a self-invoking script (matching core's `SCRIPT` constant style: `function`/`var`, no build step). Fetches `GET /__svelte-vitals/data.json` on SSE `update` and on `EventSource`'s `open` event, guarding with the snapshot's `sequence` field. Persists dark-mode in `localStorage` under key `svelte-vitals-theme`. Reflects the selected route in `location.hash` as `overview` or `route/<slug>` using the same slugging scheme as core's `slug()` (`packages/core/src/reporter/html.ts` line 38), reimplemented locally since that helper isn't exported.

- [ ] **Step 1: Create `dashboard-script.ts`**

```ts
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
```

- [ ] **Step 2: Sanity-check the file**

Run: `pnpm --filter @svelte-vitals/vite typecheck`
Expected: no errors (a plain exported `string` constant — TypeScript does not parse the *contents* of the template literal, only that the literal itself is syntactically closed). If there's an error, it means a stray unescaped `` ` `` or `${` inside the template literal — check for any backtick or `${` accidentally left un-escaped in the JS source above (there should be none: the one nested template-literal-like backtick in the tokenizer, matching a JS backtick-quote character at runtime, is written as `'\`'` inside the outer template literal, and the two backslash-prefixed metacharacters `\\d`, `\\.`, `\\n`, `\\\\`, `\\/` are deliberate escapes so the *emitted* client script contains real regex/string escapes).

- [ ] **Step 3: Commit**

```bash
git add packages/vite/src/ui/dashboard-script.ts
git commit -m "feat(vite): add dashboard client script (search, sort, dark mode, highlighting, SSE resync)"
```

---

### Task 6: Dashboard shell renderer

**Files:**
- Create: `packages/vite/src/ui/dashboard.ts`
- Test: Create `packages/vite/test/ui-dashboard.test.ts`

**Interfaces:**
- Consumes: `DashboardSnapshot` (Task 3), `DASHBOARD_STYLE` (Task 4), `DASHBOARD_SCRIPT` (Task 5).
- Produces: `renderDashboardShell(snapshot: DashboardSnapshot): string`. Task 7 depends on this exact function name/signature.

- [ ] **Step 1: Write the failing tests**

Create `packages/vite/test/ui-dashboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderDashboardShell } from '../src/ui/dashboard.js';
import type { DashboardSnapshot } from '../src/ui/snapshot.js';

const baseSnapshot: DashboardSnapshot = {
  report: {
    version: '1',
    score: 80,
    weights: { seo: 1 },
    categories: { seo: { score: 80, scoreModel: 'weighted' as never } },
    summary: { critical: 0, warning: 0, info: 0, passed: 0, dynamic: 0 } as never,
    routes: [{ route: '/a', score: 80, issues: [{ id: 'SEO001', category: 'seo', title: 'Missing <title>', severity: 'critical', detection: { presence: 'none', value: 'absent' } } as never] }],
    siteIssues: []
  },
  badges: { '/a': 'static' },
  analyzing: false,
  sequence: 1,
  meta: { version: '9.9.9', coreVersion: '0.21.0' }
};

function extractEmbeddedJson(html: string): unknown {
  const start = html.indexOf('<script type="application/json" id="svelte-vitals-data">');
  const contentStart = html.indexOf('>', start) + 1;
  const end = html.indexOf('</script>', contentStart);
  return JSON.parse(html.slice(contentStart, end));
}

describe('renderDashboardShell', () => {
  it('returns a full HTML document with the container elements the client script mounts into', () => {
    const html = renderDashboardShell(baseSnapshot);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('id="dv-topbar"');
    expect(html).toContain('id="dv-sidebar"');
    expect(html).toContain('id="dv-detail"');
  });

  it('embeds a parseable snapshot matching the input', () => {
    const html = renderDashboardShell(baseSnapshot);
    const embedded = extractEmbeddedJson(html);
    expect(embedded).toEqual(baseSnapshot);
  });

  it('escapes </script> inside embedded finding data so it cannot break out of the tag', () => {
    const snapshot: DashboardSnapshot = {
      ...baseSnapshot,
      report: {
        ...baseSnapshot.report,
        routes: [
          {
            route: '/a',
            score: 80,
            issues: [
              {
                id: 'SEO001',
                category: 'seo',
                title: '</script><script>alert(1)</script>',
                severity: 'critical',
                detection: { presence: 'none', value: 'absent' }
              } as never
            ]
          }
        ]
      }
    };
    const html = renderDashboardShell(snapshot);
    expect(html).not.toContain('</script><script>alert(1)</script>');
    const embedded = extractEmbeddedJson(html) as typeof snapshot;
    expect(embedded.report.routes[0]!.issues[0]!.title).toBe('</script><script>alert(1)</script>');
  });

  it('includes the dashboard stylesheet and client script', () => {
    const html = renderDashboardShell(baseSnapshot);
    expect(html).toContain('.dv-app{');
    expect(html).toContain("new EventSource('/__svelte-vitals/events')");
    expect(html).toContain("fetch('/__svelte-vitals/data.json')");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-dashboard`
Expected: FAIL — `Cannot find module '../src/ui/dashboard.js'`.

- [ ] **Step 3: Implement `dashboard.ts`**

```ts
import { DASHBOARD_STYLE } from './dashboard-style.js';
import { DASHBOARD_SCRIPT } from './dashboard-script.js';
import type { DashboardSnapshot } from './snapshot.js';

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
    .replace(/ /g, '\\u2028')
    .replace(/ /g, '\\u2029');
}

/** The dashboard's shell HTML: empty sidebar/detail/topbar containers, the stylesheet, the
 * client script, and the current snapshot embedded as JSON for the client's first paint. */
export function renderDashboardShell(snapshot: DashboardSnapshot): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>svelte-vitals dashboard</title><style>${DASHBOARD_STYLE}</style></head><body>` +
    `<div class="dv-app" id="dv-app">` +
    `<header class="dv-topbar" id="dv-topbar"></header>` +
    `<nav class="dv-sidebar" id="dv-sidebar"></nav>` +
    `<main class="dv-detail" id="dv-detail"></main>` +
    `</div>` +
    `<script type="application/json" id="svelte-vitals-data">${embedJson(snapshot)}</script>` +
    `<script>${DASHBOARD_SCRIPT}</script>` +
    `</body></html>`
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-dashboard`
Expected: PASS.

Manually double-check the `</script>`-escaping test by eye — open `packages/vite/src/ui/dashboard.ts` and confirm the `replace` chain reads `.replace(/</g, '\\u003c')` etc. exactly (two backslash characters before `u003c` in the source, i.e. a JS string literal whose runtime value is the six characters `<`). If a stray single backslash slipped in while writing the file, the escaping test in Step 3 above would still numerically catch it (the assertion decodes the embedded JSON back and compares), but fix the source to match this exact form regardless for readability.

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/ui/dashboard.ts packages/vite/test/ui-dashboard.test.ts
git commit -m "feat(vite): add dashboard shell renderer with escaped embedded snapshot JSON"
```

---

### Task 7: Middleware — `/data.json` route, switch `/` to the new renderer, retire `serve.ts`

**Files:**
- Modify: `packages/vite/src/ui/middleware.ts`
- Modify: `packages/vite/test/ui-middleware.test.ts`
- Delete: `packages/vite/src/ui/serve.ts`
- Delete: `packages/vite/test/ui-serve.test.ts`

**Interfaces:**
- Consumes: `buildSnapshot` (Task 3), `renderDashboardShell` (Task 6).
- Produces: `installUiMiddleware`'s public signature is unchanged (`server, config, version, store, coreVersion?`). New behavior: `GET /__svelte-vitals/data.json` returns the `DashboardSnapshot` as JSON; `GET /__svelte-vitals/` now renders via `renderDashboardShell`.

- [ ] **Step 1: Update the existing `core version` assertion (it currently checks rendered text that no longer appears server-side)**

In `packages/vite/test/ui-middleware.test.ts`, the existing test `'surfaces the resolved @svelte-vitals/core version in the dashboard when passed'` currently asserts `gr.chunks.join('')).toContain('core v0.21.0')` — that literal text is now only ever rendered by client-side JS, not present in the server response body (the server response embeds `"coreVersion":"0.21.0"` as JSON, not the string `core v0.21.0`). Replace that one test with:

```ts
  it('surfaces the resolved @svelte-vitals/core version in the embedded snapshot when passed', () => {
    const { call } = setup('0.21.0');
    const gr = res();
    call(getReq('/'), gr);
    const html = gr.chunks.join('');
    const start = html.indexOf('<script type="application/json" id="svelte-vitals-data">');
    const contentStart = html.indexOf('>', start) + 1;
    const end = html.indexOf('</script>', contentStart);
    const embedded = JSON.parse(html.slice(contentStart, end));
    expect(embedded.meta.coreVersion).toBe('0.21.0');
  });
```

Every other existing test in the file keeps passing unmodified: they assert either on `toContain('SEO001')`/`not.toContain('SEO00N')` (still true — those ids appear verbatim inside the embedded JSON) or on status codes / SSE framing (unaffected by the renderer change).

- [ ] **Step 2: Add the failing test for the new `/data.json` route**

Add this `it` to the same `describe('installUiMiddleware', ...)` block:

```ts
  it('GET /data.json returns the same snapshot the dashboard embeds', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest');
    call(ireq, ir);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));

    const jr = res();
    call(getReq('/data.json'), jr);
    expect(jr.headers['Content-Type']).toContain('application/json');
    const data = JSON.parse(jr.chunks.join(''));
    expect(data.report.routes.some((r: { route: string }) => r.route === '/a')).toBe(true);
    expect(typeof data.sequence).toBe('number');
  });

  it('rejects a /data.json request with a non-loopback Host', () => {
    const { call } = setup();
    const jr = res();
    call(getReq('/data.json', { host: 'evil.example' }), jr);
    expect(jr.statusCode).toBe(403);
  });
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-middleware`
Expected: FAIL — `/data.json` currently falls through to the dashboard HTML handler (200 with `text/html`, not JSON), and `Content-Type` assertion fails.

- [ ] **Step 4: Implement the middleware changes**

In `packages/vite/src/ui/middleware.ts`, replace the `import { renderDashboard } from './serve.js';` line with:

```ts
import { buildSnapshot } from './snapshot.js';
import { renderDashboardShell } from './dashboard.js';
```

Then, inside the routed handler (`server.middlewares.use('/__svelte-vitals', ...)`), add a `/data.json` branch after the existing `/events` branch and before the final catch-all:

```ts
    if (url.startsWith('/data.json')) {
      try {
        const snapshot = buildSnapshot(store, config, { version, coreVersion });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(snapshot));
      } catch {
        res.statusCode = 500;
        res.end('{}');
      }
      return;
    }
```

And replace the final catch-all block:

```ts
    // Last line of defense that validated data should never reach: if the renderer
    // throws anyway, return a plain-text 500 and never take down the dev server.
    try {
      const html = renderDashboard(store.snapshot(), config, { version, coreVersion }, store.badges());
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    } catch {
      res.statusCode = 500;
      res.end('svelte-vitals dashboard failed to render');
    }
```

with:

```ts
    // Last line of defense that validated data should never reach: if the renderer
    // throws anyway, return a plain-text 500 and never take down the dev server.
    try {
      const html = renderDashboardShell(buildSnapshot(store, config, { version, coreVersion }));
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    } catch {
      res.statusCode = 500;
      res.end('svelte-vitals dashboard failed to render');
    }
```

- [ ] **Step 5: Delete the superseded files**

```bash
git rm packages/vite/src/ui/serve.ts packages/vite/test/ui-serve.test.ts
```

- [ ] **Step 6: Run the full vite test suite**

Run: `pnpm --filter @svelte-vitals/vite test`
Expected: PASS — including all of `ui-middleware.test.ts` (old assertions untouched, new ones passing), and no leftover reference to `./serve.js` anywhere (`packages/vite/src/plugin.ts` never imported it directly — only `middleware.ts` did, already updated).

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @svelte-vitals/vite typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/vite/src/ui/middleware.ts packages/vite/test/ui-middleware.test.ts
git commit -m "feat(vite): serve /data.json and switch the dashboard route to the new SPA shell"
```

---

### Task 8: Wire the analyzing indicator into the plugin

**Files:**
- Modify: `packages/vite/src/plugin.ts`
- Modify: `packages/vite/test/ui-integration.test.ts`

**Interfaces:**
- Consumes: `AnalysisRunnerOptions.onStatusChange` (Task 2), `FindingsStore.setAnalyzing` (Task 1).
- Produces: no new exports — this task only changes runtime wiring.

- [ ] **Step 1: Write the failing integration test**

In `packages/vite/test/ui-integration.test.ts`, the existing `analyzedStore()` helper builds a `store` + `runner` using the exact same pattern `plugin.ts` uses (see the file's own top-of-file comment: "no page visit involved"). Add a new test to the existing `describe(...)` block that exercises the intended wiring directly (this is the same pattern `plugin.ts` will use, run against the real fixture, so it proves the wiring's semantics without needing to mock the whole Vite dev server):

```ts
  it('onStatusChange wired to store.setAnalyzing toggles isAnalyzing() around the real run', async () => {
    const store = createStore();
    const onError = vi.fn();
    const runner = createAnalysisRunner({
      root: FIXTURE,
      onResults: (results) => store.setStatic(results),
      onError,
      onStatusChange: (analyzing) => store.setAnalyzing(analyzing)
    });
    expect(store.isAnalyzing()).toBe(false);
    runner.start();
    await vi.waitFor(() => expect(store.isAnalyzing()).toBe(true));
    await vi.waitFor(() => expect(store.snapshot().length).toBeGreaterThan(0), { timeout: 15000 });
    await vi.waitFor(() => expect(store.isAnalyzing()).toBe(false));
    runner.stop();
    expect(onError).not.toHaveBeenCalled();
  });
```

Add `createAnalysisRunner` to the existing `import { createAnalysisRunner } from '../src/ui/analysis.js';` line if not already imported that way (it already is, per the file's existing `analyzedStore()` helper — reuse it, do not re-import).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/vite test -- ui-integration`
Expected: this specific test already passes once Tasks 1 and 2 are in place, because `onStatusChange` and `setAnalyzing` already exist and this test wires them together itself — it does not depend on `plugin.ts` yet. Confirm it passes here (this is the proof that the wiring `plugin.ts` is about to adopt is correct); the actual regression check for `plugin.ts` is Step 4's full-suite run.

- [ ] **Step 3: Wire `plugin.ts`**

In `packages/vite/src/plugin.ts`, inside `uiPlugin.configureServer`, find:

```ts
      const runner = createAnalysisRunner({
        root: uiRoot,
        treatDynamicAs: options.treatDynamicAs,
        metaComponents: options.metaComponents,
        rules: options.rules,
        failOn: options.failOn,
        onResults: (results) => store.setStatic(results),
        onError: (err) => console.warn('[svelte-vitals] dev analysis failed:', err)
      });
```

and add `onStatusChange`:

```ts
      const runner = createAnalysisRunner({
        root: uiRoot,
        treatDynamicAs: options.treatDynamicAs,
        metaComponents: options.metaComponents,
        rules: options.rules,
        failOn: options.failOn,
        onResults: (results) => store.setStatic(results),
        onError: (err) => console.warn('[svelte-vitals] dev analysis failed:', err),
        onStatusChange: (analyzing) => store.setAnalyzing(analyzing)
      });
```

- [ ] **Step 4: Run the full vite test suite**

Run: `pnpm --filter @svelte-vitals/vite test`
Expected: PASS — `ui-plugin.test.ts`'s existing tests are unaffected (they never inspected `createAnalysisRunner`'s options), and the new `ui-integration.test.ts` test passes.

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/plugin.ts packages/vite/test/ui-integration.test.ts
git commit -m "feat(vite): wire the analysis runner's onStatusChange into the dashboard store"
```

---

### Task 9: Update dev-overlay docs (en + ja)

**Files:**
- Modify: `docs/src/content/docs/guides/dev-overlay.md`
- Modify: `docs/src/content/docs/ja/guides/dev-overlay.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update the English guide**

In `docs/src/content/docs/guides/dev-overlay.md`, replace:

```md
Enable a live dashboard at `/__svelte-vitals/` during `vite dev` — the same report the CLI's `--reporter html` produces, updating in place as you work.
```

with:

```md
Enable a live dashboard at `/__svelte-vitals/` during `vite dev` — a searchable, sortable route list with a detail pane for the selected route, updating in place as you work.
```

Then, immediately after the existing paragraph that ends "`static` for routes covered only by source analysis so far." (still inside the "Live UI dashboard" section), insert a new paragraph:

```md
The sidebar's search box filters routes by path or by a finding's rule id/title/location; the sort control reorders it (worst score first by default). Selecting a route (or "Overview") updates the detail pane and is reflected in the URL hash, so a reload or a shared link returns to the same view. The topbar shows an "Analyzing…" indicator while a whole-project re-analysis is running, plus a dark-mode toggle — the preference is remembered per browser and otherwise follows your OS setting.
```

Then, in the "Version drift" section, replace:

```md
The dashboard footer shows `v<@svelte-vitals/vite version> · core v<@svelte-vitals/core version>`.
```

with:

```md
The dashboard topbar shows `v<@svelte-vitals/vite version>` and, next to it, `core v<@svelte-vitals/core version>`.
```

- [ ] **Step 2: Update the Japanese guide**

In `docs/src/content/docs/ja/guides/dev-overlay.md`, replace:

```md
`vite dev` 中に `/__svelte-vitals/` でライブダッシュボードを表示します。CLI の `--reporter html` と同じレポートが、作業に合わせてその場で更新されます。
```

with:

```md
`vite dev` 中に `/__svelte-vitals/` でライブダッシュボードを表示します。検索・並び替えができるルート一覧と、選択中ルートの詳細ペインで構成され、作業に合わせてその場で更新されます。
```

Then, immediately after the paragraph ending "`static` バッジが表示されます。" (the Japanese equivalent of the badge paragraph — locate it by searching for `static` in that section), insert:

```md
サイドバーの検索ボックスでは、ルートパスまたは指摘のルールID・タイトル・場所でルートを絞り込めます。並び替えコントロールで一覧の順序を変更できます(既定はスコアが低い順)。ルート(または「Overview」)を選択すると詳細ペインが更新され、選択状態はURLのハッシュに反映されるため、リロードや共有リンクで同じ表示に戻れます。トップバーにはプロジェクト全体の再解析中であることを示す「Analyzing…」表示と、ダークモード切り替えボタンがあります — 設定はブラウザごとに保存され、未設定時はOSの設定に従います。
```

Then, in the version-drift section, replace:

```md
ダッシュボードのフッターには `v<@svelte-vitals/vite のバージョン> · core v<@svelte-vitals/core のバージョン>` が表示されます。
```

with:

```md
ダッシュボードのトップバーには `v<@svelte-vitals/vite のバージョン>` と、その隣に `core v<@svelte-vitals/core のバージョン>` が表示されます。
```

- [ ] **Step 3: Verify the docs build**

Run: `pnpm --filter docs build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add docs/src/content/docs/guides/dev-overlay.md docs/src/content/docs/ja/guides/dev-overlay.md
git commit -m "docs: describe the new master/detail live UI dashboard (en/ja)"
```

---

### Task 10: Changeset

**Files:**
- Create: `.changeset/<generated-name>.md`

**Interfaces:** none.

- [ ] **Step 1: Add the changeset**

Run: `pnpm changeset`

Select `@svelte-vitals/vite`, bump type **minor**, and when prompted for a summary enter:

```
Redesign the live UI dashboard (`ui: true`) into a searchable, sortable master/detail layout with dark mode, syntax-highlighted fix snippets, and a live analysis-in-progress indicator.
```

This writes a new file under `.changeset/`. Confirm its frontmatter reads:

```md
---
"@svelte-vitals/vite": minor
---

Redesign the live UI dashboard (`ui: true`) into a searchable, sortable master/detail layout with dark mode, syntax-highlighted fix snippets, and a live analysis-in-progress indicator.
```

- [ ] **Step 2: Run the full monorepo verify suite**

Run these in order (per `AGENTS.md`):

```bash
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm check:publish
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add .changeset
git commit -m "chore: add changeset for the live UI dashboard redesign"
```

---

## Manual verification (not automated — do after Task 10)

Per the spec's Testing section, the client-side rendering itself (search/sort/selection/dark-mode/highlighting) is not unit-tested in Node. Before considering this plan done, run `pnpm --filter @svelte-vitals/vite dev` against a fixture SvelteKit app (e.g. `packages/vite/test/fixtures/basic-project`, or any real SvelteKit app with `svelteVitals({ ui: true })` configured) and, in a browser, check:

- The dashboard loads at `/__svelte-vitals/` with Overview selected by default, showing the gauge/category bars/site checks.
- Searching narrows the sidebar route list; sorting reorders it.
- Selecting a route updates the detail pane and the URL hash; reloading the page restores that same selection.
- Saving a source file shows the "Analyzing…" indicator briefly, then the dashboard updates without a full page reload or losing the current selection/search/scroll.
- The dark-mode toggle switches themes and persists across a reload; on a fresh browser profile (no stored preference) it follows the OS dark/light setting.
- A fix snippet with a recognized language renders with token coloring; one with an unrecognized/absent language still renders as plain text without throwing.
- Narrowing the viewport below 640px collapses the sidebar into a drawer toggled by the topbar's menu button.
- Stopping and restarting the dev server (simulating a dropped connection) shows the connection dot go to "reconnecting" and then recovers automatically once the server is back, without needing a manual page reload.

---

## Self-review

**Spec coverage:**

- Master/detail layout, search, sort, "Overview" default → Task 5/6 (`dashboard-script.ts`, `dashboard.ts`).
- Analyzing indicator riding the existing `update` event, no new SSE event types → Tasks 1, 2, 8 (`store.setAnalyzing`/`isAnalyzing`, `analysis.ts`'s `onStatusChange`, plugin wiring); Task 5's topbar renders it.
- Dark mode (topbar toggle, `localStorage`, `prefers-color-scheme` fallback, `:root[data-theme="dark"]`) → Tasks 4 and 5.
- Fix-snippet syntax highlighting (hand-rolled, no dependency, `fix.lang` default `'svelte'`) → Task 5 (`highlightTokens`/`renderFixSnippet`).
- Route sort toggle → Task 5 (`sortedRoutes`).
- Embedded-JSON escaping (`<`, U+2028, U+2029) → Task 6 (`embedJson`).
- `docsUrl` sanitized server-side via core's `safeHref` → Task 3 (`sanitizeDocsUrl`), consumed as-is by Task 5's `renderFinding` (no client-side re-validation needed — a deliberate simplification over the spec's originally-described client-side reimplementation, since the snapshot builder already runs in Node and can import `safeHref` directly).
- DOM built via `textContent`/`setAttribute`/DOM APIs, never `innerHTML` → Task 5's `h()` helper and `renderGauge`'s explicit `createElementNS`/`setAttribute` calls.
- Sequence number guarding out-of-order `/data.json` fetches → Tasks 1 (`store.sequence()`), 3 (`DashboardSnapshot.sequence`), 5 (`fetchSnapshot`'s `<=` check).
- Notify ordering (`onResults` before `onStatusChange(false)`) → Task 2's implementation preserves `analysis.ts`'s existing `try`/`finally` order; documented in Task 2's interface note.
- SSE reconnection resync via `EventSource`'s `open` event → Task 5's `boot()`.
- Selection persistence via `location.hash` → Task 5 (`selectItem`, `restoreSelectionFromHash`).
- Baseline accessibility (`aria-current`/`aria-selected`, focus-visible) → Task 5 (`renderNavItem`'s `role`/`aria-selected`/`tabindex`, Task 4's `:focus-visible` rules). Note: the spec's wording says `aria-current`/`aria-selected`; this plan implements `role="option"`/`aria-selected` (an ARIA listbox pattern) rather than `aria-current`, which is the more correct ARIA pairing for a `role="listbox"`/`role="option"` sidebar — a listbox's active item is `aria-selected`, not `aria-current` (that attribute is for the "current page in a set of pages" pattern, e.g. breadcrumbs/pagination). This is a deliberate, more-correct refinement of the spec's shorthand, not a gap.
- `serve.ts` retirement, `ui-serve.test.ts` retirement → Task 7.
- Passing-results non-goal → unchanged; `buildJsonReport` (reused as-is) already only returns penalized issues.
- `@svelte-vitals/vite` minor + changeset → Task 10.
- en/ja docs → Task 9.

**Placeholder scan:** no "TBD"/"TODO"/"add appropriate handling" phrases; every step has complete, runnable code or an exact command.

**Type consistency check:** `DashboardSnapshot` (Task 3) is used identically in Task 6's test fixture, Task 6's `renderDashboardShell` parameter, and Task 7's `buildSnapshot(...)` call sites. `FindingsStore` methods (`setAnalyzing`, `isAnalyzing`, `sequence`) are named identically across Tasks 1, 3, and 8. `AnalysisRunnerOptions.onStatusChange` is named identically across Tasks 2 and 8. `renderDashboardShell` (not `renderDashboard`, which is the old, now-deleted `serve.ts` export) is used consistently in Tasks 6 and 7.

**One known follow-up risk flagged during planning (not a blocker):** Task 4/5's large template-literal string constants are easy to introduce a stray unescaped backtick or `${` into by hand. Both tasks' Step 2 ("sanity-check"/typecheck) exists specifically to catch that class of mistake before it reaches Task 6's tests.
