# Retire the dev overlay, default the live dashboard on — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `svelteVitalsHandle`'s `console.warn` output (the "dev overlay") entirely, default `@svelte-vitals/vite`'s `svelteVitals()` plugin's `ui` option to `true` so the live dashboard is on by default, and update every CLI/docs surface that names or describes the old behavior.

**Architecture:** No new components. Three small, independent code changes (the handle stops printing; the plugin's dev-time default flips; the CLI installer's target id/copy is renamed) plus a documentation pass that makes the live dashboard the primary dev-time story instead of terminal warnings. Each code task keeps its own test suite green before moving to the next.

**Tech Stack:** TypeScript, vitest, `@svelte-vitals/core`'s `isPenalized`/`effectiveSeverity` helpers, `magicast` (installer codemods, untouched by this plan), Astro Starlight docs (frontmatter + Markdown).

## Global Constraints

- No backward-compatibility shims for anything removed or renamed in this plan — per the maintainer, the dev overlay has near-zero adoption (spec: `docs/superpowers/specs/2026-07-12-retire-dev-overlay-design.md`, "Maintainer context").
- `console.warn` removal from `svelteVitalsHandle` is **unconditional** — it never prints, regardless of the vite plugin's `ui` setting or whether the plugin is installed at all.
- The handle keeps running server-side and keeps POSTing to `/__svelte-vitals/ingest` when `SVELTE_VITALS_UI` is set — only the terminal-facing `console.warn(report)` call goes away, not the ingest/dashboard-accuracy behavior.
- `svelteVitalsHandle`'s exported name and `@svelte-vitals/vite/hooks` import path are **not** renamed (non-goal in the spec).
- The build-mode plugin (`apply: 'build'`, `closeBundle`) is **untouched** by every task in this plan.
- en/ja docs stay in sync (`AGENTS.md`) — every English doc change in this plan has a matching Japanese one in the same task.
- Any user-facing change needs a changeset (`AGENTS.md`) — Task 6 adds one for `@svelte-vitals/vite` and one for `svelte-vitals`.

---

### Task 1: Remove `console.warn` from the dev handle

**Files:**

- Modify: `packages/vite/src/hooks/format.ts`
- Modify: `packages/vite/src/hooks/handle.ts`
- Modify: `packages/vite/test/dev-format.test.ts`
- Modify: `packages/vite/test/dev-handle.test.ts`
- (No change needed: `packages/vite/test/ui-ingest.test.ts` already asserts on the `fetch`/ingest side effect independently of `console.warn` — it stays green as-is.)

**Interfaces:**

- Consumes: `isPenalized`, `effectiveSeverity`, `defineConfig`, `type Config`, `type Result` from `@svelte-vitals/core` (all already imported in the files touched here).
- Produces: `findingSignature(results: Result[], config: Config): string` (unchanged signature, still exported from `format.ts` — Task 2 and later tasks don't depend on anything new from this task).

- [ ] **Step 1: Delete `formatDevReport` from `format.ts`**

Replace the full contents of `packages/vite/src/hooks/format.ts` with:

```ts
import { isPenalized, effectiveSeverity, type Config, type Result } from '@svelte-vitals/core';

function penalized(results: Result[], config: Config): Result[] {
  return results.filter((r) => isPenalized(r.detection, config.treatDynamicAs));
}

/** Stable signature of a route's penalized findings, so ingest is skipped when a repeat visit finds nothing new. */
export function findingSignature(results: Result[], config: Config): string {
  return penalized(results, config)
    .map((r) => `${r.id}:${effectiveSeverity(r, config)}:${r.detection.presence}:${r.detection.value}`)
    .sort()
    .join('|');
}
```

(This drops the `Severity` import, the `GLYPH`/`RANK` tables, and `formatDevReport` — all only used by the deleted terminal-report formatting. `findingSignature`'s doc comment is updated: it no longer describes "re-printed," since nothing prints anymore.)

- [ ] **Step 2: Update `dev-format.test.ts` to drop `formatDevReport` coverage**

Replace the full contents of `packages/vite/test/dev-format.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { findingSignature } from '../src/hooks/format.js';
import { defineConfig, type Result } from '@svelte-vitals/core';

const config = defineConfig({});

const failing: Result[] = [
  {
    id: 'SEO003',
    severity: 'warning',
    detection: { presence: 'none', value: 'absent' },
    route: '/p',
    message: 'Missing <link rel="canonical">'
  },
  {
    id: 'SEO001',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    route: '/p',
    message: 'Missing <title>'
  }
];

const passing: Result[] = [
  {
    id: 'SEO001',
    severity: 'critical',
    detection: { presence: 'own', value: 'static' },
    route: '/p',
    message: '<title>'
  }
];

describe('findingSignature', () => {
  it('is stable regardless of input order', () => {
    const reversed = [...failing].reverse();
    expect(findingSignature(failing, config)).toBe(findingSignature(reversed, config));
  });

  it('ignores passing findings and changes when penalized findings change', () => {
    expect(findingSignature(passing, config)).toBe('');
    const sigA = findingSignature(failing, config);
    const sigB = findingSignature([failing[0]!], config);
    expect(sigA).not.toBe(sigB);
  });

  it('distinguishes a missing tag from an empty one (same id and severity)', () => {
    const missing: Result[] = [
      {
        id: 'SEO001',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/p',
        message: 'Missing <title>'
      }
    ];
    const empty: Result[] = [
      {
        id: 'SEO001',
        severity: 'critical',
        detection: { presence: 'own', value: 'absent' },
        route: '/p',
        message: 'Empty <title>'
      }
    ];
    expect(findingSignature(missing, config)).not.toBe(findingSignature(empty, config));
  });
});
```

- [ ] **Step 3: Run the format test to confirm it's green**

Run: `pnpm --filter @svelte-vitals/vite exec vitest run test/dev-format.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Update `handle.ts` — drop the `console.warn`, rename the analysis function**

In `packages/vite/src/hooks/handle.ts`:

Change the import (line 19) from:

```ts
import { findingSignature, formatDevReport } from './format.js';
```

to:

```ts
import { findingSignature } from './format.js';
```

Rename `analyzeAndWarn` to `analyzeAndIngest` and drop the report/console.warn lines. Replace:

```ts
async function analyzeAndWarn(
  html: string,
  route: string,
  origin: string,
  rules: Rule[],
  config: Config,
  lastSignature: Map<string, string>
): Promise<void> {
  try {
    const { tags, htmlLang, headings: levels, images: imgs } = parseHtmlHead(html);
    const head: ResolvedHead = { route, source: 'rendered', tags, file: route };
    // Rendered mode does not track source lines (line 0 = unknown); file is the route.
    const headings: ResolvedHeadings[] = [
      { route, headings: levels.map((level) => ({ level, line: 0, file: route })) }
    ];
    const images: ResolvedImages[] = [{ route, images: imgs.map((img) => ({ ...img, file: route })) }];
    // robots/sitemap are not page-scoped, so mark them present to suppress SEO006/SEO007;
    // htmlLang comes from the rendered document so SEO009 is evaluated against reality.
    const project: Project = { hasRobotsTxt: true, hasSitemap: true, htmlLang };
    const results = applyRuleSeverities(
      await runRules(rules, { heads: [head], headings, images, project, config }),
      config
    );

    const signature = findingSignature(results, config);
    if (lastSignature.get(route) === signature) return;
    lastSignature.set(route, signature);

    const report = formatDevReport(route, results, config);
    if (report) console.warn(report);
    if (globalThis.process?.env?.SVELTE_VITALS_UI) void postIngest(origin, route, results);
  } catch (err) {
    // Dev tooling must never break the request: swallow any parse/rule error.
    // Set SVELTE_VITALS_DEBUG to surface tool-internal errors while debugging.
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      console.warn('[svelte-vitals] dev analysis failed:', err);
    }
  }
}
```

with:

```ts
async function analyzeAndIngest(
  html: string,
  route: string,
  origin: string,
  rules: Rule[],
  config: Config,
  lastSignature: Map<string, string>
): Promise<void> {
  try {
    const { tags, htmlLang, headings: levels, images: imgs } = parseHtmlHead(html);
    const head: ResolvedHead = { route, source: 'rendered', tags, file: route };
    // Rendered mode does not track source lines (line 0 = unknown); file is the route.
    const headings: ResolvedHeadings[] = [
      { route, headings: levels.map((level) => ({ level, line: 0, file: route })) }
    ];
    const images: ResolvedImages[] = [{ route, images: imgs.map((img) => ({ ...img, file: route })) }];
    // robots/sitemap are not page-scoped, so mark them present to suppress SEO006/SEO007;
    // htmlLang comes from the rendered document so SEO009 is evaluated against reality.
    const project: Project = { hasRobotsTxt: true, hasSitemap: true, htmlLang };
    const results = applyRuleSeverities(
      await runRules(rules, { heads: [head], headings, images, project, config }),
      config
    );

    // Skip a repeat POST (and the SSE churn it would cause) when a route re-renders
    // with the exact same findings — e.g. an unrelated HMR pass.
    const signature = findingSignature(results, config);
    if (lastSignature.get(route) === signature) return;
    lastSignature.set(route, signature);

    if (globalThis.process?.env?.SVELTE_VITALS_UI) void postIngest(origin, route, results);
  } catch (err) {
    // Dev tooling must never break the request: swallow any parse/rule error.
    // Set SVELTE_VITALS_DEBUG to surface tool-internal errors while debugging.
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      console.warn('[svelte-vitals] dev analysis failed:', err);
    }
  }
}
```

Update the `svelteVitalsHandle` doc comment (currently "prints SEO warnings for each visited page's rendered `<head>`, in dev only"). Replace:

```ts
/**
 * SvelteKit `handle` that prints SEO warnings for each visited page's rendered `<head>`,
 * in dev only. Add it to `src/hooks.server.ts`, e.g. `sequence(svelteVitalsHandle())`.
 */
```

with:

```ts
/**
 * SvelteKit `handle` that analyzes each visited page's rendered `<head>`, in dev only,
 * and (when the live dashboard is enabled) feeds the results in — upgrading that
 * route's dashboard findings from static (source-only) to `measured` (real rendered
 * HTML). Add it to `src/hooks.server.ts`, e.g. `sequence(svelteVitalsHandle())`.
 */
```

Update the two remaining call sites of `analyzeAndWarn` inside `svelteVitalsHandle`'s `transformPageChunk` (the comment above it and the call itself). Replace:

```ts
        // Observe-only: return the chunk unchanged and never block the response on
        // analysis. We fire-and-forget on the final chunk; analyzeAndWarn swallows
        // its own errors, so the floating promise can never reject.
        if (done)
          void analyzeAndWarn(
```

with:

```ts
        // Observe-only: return the chunk unchanged and never block the response on
        // analysis. We fire-and-forget on the final chunk; analyzeAndIngest swallows
        // its own errors, so the floating promise can never reject.
        if (done)
          void analyzeAndIngest(
```

- [ ] **Step 5: Rewrite `dev-handle.test.ts` to observe ingest instead of `console.warn`**

Replace the full contents of `packages/vite/test/dev-handle.test.ts` with:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Handle } from '@sveltejs/kit';
import { isPenalized, defineConfig, type Result } from '@svelte-vitals/core';
import { svelteVitalsHandle } from '../src/hooks/index.js';

// A minimal fake RequestEvent carrying only what the handle reads.
function fakeEvent(routeId: string | null, pathname = '/') {
  return { route: { id: routeId }, url: new URL(`http://localhost${pathname}`) } as unknown as Parameters<
    Parameters<Handle>[0]['resolve']
  >[0];
}

// A resolve() that feeds the given HTML chunks through transformPageChunk, awaiting each.
function resolveWith(chunks: string[]) {
  return (async (event: unknown, opts?: { transformPageChunk?: (i: { html: string; done: boolean }) => unknown }) => {
    const tpc = opts?.transformPageChunk;
    const seen: unknown[] = [];
    if (tpc) {
      for (let i = 0; i < chunks.length; i++) {
        seen.push(await tpc({ html: chunks[i]!, done: i === chunks.length - 1 }));
      }
    }
    return { seen, transformed: tpc !== undefined } as unknown as Response;
  }) as Parameters<Handle>[0]['resolve'];
}

// The handle analyzes fire-and-forget (it never blocks the response), so the
// resulting ingest POST lands a few microtasks after handle() resolves. One
// macrotask tick drains that chain — analysis is purely in-memory, no real I/O.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const PAGE_NO_TITLE = '<html lang="en"><head><meta name="description" content="x"></head><body></body></html>';
const PAGE_OK =
  '<html lang="en"><head><meta charset="utf-8"><title>Quality Widgets and Tools for Modern Builders Shop</title><meta name="description" content="Browse our curated selection of quality widgets and builder tools for modern projects and teams.">' +
  '<link rel="canonical" href="https://e.com/"><meta property="og:title" content="t">' +
  '<meta property="og:image" content="https://e.com/o.png">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<meta name="twitter:card" content="summary_large_image">' +
  '<meta property="og:description" content="x">' +
  '<meta property="og:url" content="https://e.com/">' +
  '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Home","url":"https://e.com/"}</script></head><body><h1>Quality Widgets</h1></body></html>';

// PAGE_OK with a second <h1> in the body — everything else stays clean, so the
// only finding is SEO027 (heading hierarchy), confirming the rule sees the
// rendered body through the dev hook.
const PAGE_TWO_H1 = PAGE_OK.replace('</body>', '<h1>Second heading</h1></body>');

// PAGE_OK with a body <img> missing alt + dimensions — proves the dev hook now
// threads rendered images into the rule context (image rules were CLI-only before).
const PAGE_BAD_IMG = PAGE_OK.replace('</body>', '<img src="/photo.jpg"></body>');

const config = defineConfig({});

// Ids of results that actually penalize the score — mirrors format.ts's own filter,
// so these tests check the same "did this rule fail" question the dashboard cares
// about, without depending on any internal (non-exported) helper.
function penalizedIds(results: Result[]): string[] {
  return results.filter((r) => isPenalized(r.detection, config.treatDynamicAs)).map((r) => r.id);
}

function setup() {
  process.env.SVELTE_VITALS_UI = '1';
  const fetchMock = vi.fn<(url: string | URL, init?: RequestInit) => Promise<Response>>(
    async () => ({ ok: true }) as Response
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentResults(fetchMock: ReturnType<typeof setup>, callIndex = 0): Result[] {
  const [, init] = fetchMock.mock.calls[callIndex]!;
  return JSON.parse((init as RequestInit).body as string).results as Result[];
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SVELTE_VITALS_UI;
});

describe('svelteVitalsHandle', () => {
  it('reports a missing <title> for the visited route', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(penalizedIds(sentResults(fetchMock))).toContain('SEO001');
  });

  it('reports no penalized findings for a clean page', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/ok', '/ok'), resolve: resolveWith([PAGE_OK]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(penalizedIds(sentResults(fetchMock))).toEqual([]);
  });

  it('reports multiple <h1> from the rendered body (SEO027)', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/two-h1', '/two-h1'), resolve: resolveWith([PAGE_TWO_H1]) });
    await flush();
    expect(penalizedIds(sentResults(fetchMock))).toContain('SEO027');
  });

  it('reports a rendered <img> missing alt/dimensions (image rules in rendered mode)', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/img', '/img'), resolve: resolveWith([PAGE_BAD_IMG]) });
    await flush();
    const ids = penalizedIds(sentResults(fetchMock));
    expect(ids).toContain('SEO025'); // missing alt
    expect(ids).toContain('PERF001'); // missing width/height
  });

  it('returns each chunk unchanged', async () => {
    setup();
    const handle = svelteVitalsHandle();
    const res = (await handle({
      event: fakeEvent('/none', '/none'),
      resolve: resolveWith(['<html><head>', '</head></html>'])
    })) as unknown as { seen: string[] };
    expect(res.seen).toEqual(['<html><head>', '</head></html>']);
  });

  it('dedups: the same findings on a repeat visit POST only once', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Outside dev (production builds, and non-Node/edge runtimes), esm-env resolves
  // `DEV` to false, so the handle short-circuits to a pass-through. Mocking esm-env
  // is the canonical way to exercise that branch — `DEV` is a static import, not a
  // runtime read of NODE_ENV, so toggling env vars wouldn't flip it.
  it('is a pass-through when not in dev (no transformPageChunk, no ingest)', async () => {
    vi.resetModules();
    vi.doMock('esm-env', () => ({ DEV: false }));
    const fetchMock = setup();
    try {
      const { svelteVitalsHandle: prodHandle } = await import('../src/hooks/index.js');
      const handle = prodHandle();
      const res = (await handle({
        event: fakeEvent('/none', '/none'),
        resolve: resolveWith([PAGE_NO_TITLE])
      })) as unknown as { transformed: boolean };
      expect(res.transformed).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('esm-env');
      vi.resetModules();
    }
  });

  it('does not throw when the HTML is unparseable garbage', async () => {
    setup();
    const handle = svelteVitalsHandle();
    await expect(
      handle({ event: fakeEvent(null, '/x'), resolve: resolveWith(['not really <<< html']) })
    ).resolves.toBeDefined();
  });

  it('honors per-rule overrides from options (rules)', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle({ rules: { SEO001: 'off' } });
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    // The page still trips other rules, so results are still sent — but with SEO001
    // disabled, it's excluded from the penalized set. Proves options flow into the config.
    expect(penalizedIds(sentResults(fetchMock))).not.toContain('SEO001');
  });

  it('surfaces swallowed analysis errors when SVELTE_VITALS_DEBUG is set', async () => {
    vi.resetModules();
    vi.doMock('../src/providers/rendered/parse-html.js', () => ({
      parseHtmlHead: () => {
        throw new Error('boom');
      }
    }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prev = process.env.SVELTE_VITALS_DEBUG;
    process.env.SVELTE_VITALS_DEBUG = '1';
    try {
      const { svelteVitalsHandle: debugHandle } = await import('../src/hooks/index.js');
      const handle = debugHandle();
      await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
      await flush();
      const out = warn.mock.calls.map((c) => String(c[0])).join('\n');
      expect(out).toContain('[svelte-vitals] dev analysis failed:');
    } finally {
      // Restore precisely: assigning `undefined` would coerce to the string 'undefined'.
      if (prev === undefined) delete process.env.SVELTE_VITALS_DEBUG;
      else process.env.SVELTE_VITALS_DEBUG = prev;
      vi.doUnmock('../src/providers/rendered/parse-html.js');
      vi.resetModules();
    }
  });
});
```

(The last test, `'surfaces swallowed analysis errors when SVELTE_VITALS_DEBUG is set'`, is unchanged from before — that `console.warn` call is a separate, still-present debug-only error surface, not the findings-report warning this task removes.)

- [ ] **Step 6: Run the vite package's tests**

Run: `pnpm --filter @svelte-vitals/vite test`
Expected: all test files pass, including `dev-handle.test.ts` (11 tests) and `dev-format.test.ts` (3 tests). `ui-ingest.test.ts` and every other file should be unaffected and still green.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter @svelte-vitals/vite typecheck`
Expected: no errors.

```bash
git add packages/vite/src/hooks/format.ts packages/vite/src/hooks/handle.ts \
  packages/vite/test/dev-format.test.ts packages/vite/test/dev-handle.test.ts
git commit -m "fix(vite): stop printing dev-overlay warnings to the terminal

svelteVitalsHandle keeps analyzing rendered pages and feeding the live
dashboard (when enabled), it just no longer console.warns — the dashboard
supersedes that output."
```

---

### Task 2: Default the vite plugin's `ui` option to `true`

**Files:**

- Modify: `packages/vite/src/plugin.ts`
- Modify: `packages/vite/test/ui-plugin.test.ts`
- Modify: `packages/vite/test/plugin-options.test.ts`
- Modify: `packages/vite/test/plugin-error.test.ts`
- Modify: `packages/vite/test/integration.test.ts`

**Interfaces:**

- Consumes: nothing new from Task 1.
- Produces: `svelteVitals(options?: SvelteVitalsOptions): Plugin | Plugin[]` — same signature, but now returns `Plugin[]` (build + ui) whenever `options.ui !== false`, including when `options.ui` is omitted entirely. Every later task that calls `svelteVitals(...)` and expects a single build-only `Plugin` back must now pass `ui: false` explicitly.

- [ ] **Step 1: Write the failing test for the new default**

In `packages/vite/test/ui-plugin.test.ts`, replace the first test (currently named `'returns a single plugin when ui is not set (unchanged)'`) with two tests. Replace:

```ts
it('returns a single plugin when ui is not set (unchanged)', () => {
  const p = svelteVitals({});
  expect(Array.isArray(p)).toBe(false);
  expect((p as Plugin).name).toBe('svelte-vitals');
});
```

with:

```ts
it('defaults ui to true: returns both plugins when ui is not set', () => {
  const plugins = svelteVitals({}) as Plugin[];
  expect(Array.isArray(plugins)).toBe(true);
  expect(plugins.map((p) => p.name).sort()).toEqual(['svelte-vitals', 'svelte-vitals:ui']);
});

it('returns a single build-only plugin when ui: false is passed explicitly', () => {
  const p = svelteVitals({ ui: false });
  expect(Array.isArray(p)).toBe(false);
  expect((p as Plugin).name).toBe('svelte-vitals');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/vite exec vitest run test/ui-plugin.test.ts -t "defaults ui to true"`
Expected: FAIL — `svelteVitals({})` currently returns a single `Plugin`, not an array (the existing `if (!options.ui) return buildPlugin;` check treats `undefined` the same as `false`).

- [ ] **Step 3: Flip the default in `plugin.ts`**

In `packages/vite/src/plugin.ts`, change:

```ts
if (!options.ui) return buildPlugin;
```

to:

```ts
// `ui` defaults to true: the plugin's real dev-time value is the live dashboard
// (2026-07-12-retire-dev-overlay-design.md) — pass `ui: false` to keep only the
// build-time gate.
if (options.ui === false) return buildPlugin;
```

Also update the `ui` option's JSDoc a few lines above, in the `SvelteVitalsOptions` interface. Change:

```ts
  /** Serve a live dashboard at /__svelte-vitals/ during `vite dev` (requires svelteVitalsHandle in hooks.server.ts). */
  ui?: boolean;
```

to:

```ts
  /**
   * Serve a live dashboard at /__svelte-vitals/ during `vite dev` (add
   * svelteVitalsHandle to hooks.server.ts for accurate, per-route `measured` results
   * as you browse — the dashboard still works without it, from whole-project static
   * analysis alone). Default: `true`. Pass `false` to keep only the build-time gate.
   */
  ui?: boolean;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/vite exec vitest run test/ui-plugin.test.ts`
Expected: all tests in the file pass (the two new ones plus the pre-existing `ui: true`-based tests, which are unaffected since explicit `true` behaves exactly as before).

- [ ] **Step 5: Fix every other test that assumed a single build-only `Plugin` by default**

Four call sites across three files construct `svelteVitals({...})` without `ui` and immediately cast `as Plugin`, then read `.closeBundle` off it — these break at runtime once the default returns an array. Add `ui: false` to each (these tests are about the build-time gate specifically; they don't want the dashboard's `configureServer` side effects at all).

In `packages/vite/test/plugin-options.test.ts`, change all four occurrences:

- `svelteVitals({ cwd, report: false, failOn: 'info', outFile: 'reports/seo.json' })` → `svelteVitals({ cwd, ui: false, report: false, failOn: 'info', outFile: 'reports/seo.json' })`
- `svelteVitals({ cwd, report: 'json' })` → `svelteVitals({ cwd, ui: false, report: 'json' })`
- `svelteVitals({ cwd: empty, failOn: 'critical' })` → `svelteVitals({ cwd: empty, ui: false, failOn: 'critical' })`
- `svelteVitals({ cwd, report: false, failOn: 'info', outFile: abs })` → `svelteVitals({ cwd, ui: false, report: false, failOn: 'info', outFile: abs })`

In `packages/vite/test/plugin-error.test.ts`, change:

- `svelteVitals({ cwd, failOn: 'critical' })` → `svelteVitals({ cwd, ui: false, failOn: 'critical' })`

In `packages/vite/test/integration.test.ts`, change all three occurrences:

- `svelteVitals({ cwd })` → `svelteVitals({ cwd, ui: false })`
- `svelteVitals({ cwd, report: false, failOn: 'critical' })` (both occurrences, one per test) → `svelteVitals({ cwd, ui: false, report: false, failOn: 'critical' })`

Also update the first test's name in `integration.test.ts` (currently `'is a build-only plugin named svelte-vitals'`) — it's still accurate once `ui: false` is passed, so the name and body both stay correct as long as `ui: false` is added to that call. No further change needed there beyond adding the option.

- [ ] **Step 6: Run the full vite package test suite**

Run: `pnpm --filter @svelte-vitals/vite test`
Expected: all test files pass. This is the check that catches any remaining `svelteVitals({...}) as Plugin` call site this plan missed — if any test still fails with something like "closeBundle is not a function" or "p.name is undefined", grep the file for `svelteVitals(` and add `ui: false` the same way.

- [ ] **Step 7: Typecheck, build, and commit**

Run: `pnpm --filter @svelte-vitals/vite typecheck && pnpm --filter @svelte-vitals/vite build`
Expected: no errors.

```bash
git add packages/vite/src/plugin.ts packages/vite/test/ui-plugin.test.ts \
  packages/vite/test/plugin-options.test.ts packages/vite/test/plugin-error.test.ts \
  packages/vite/test/integration.test.ts
git commit -m "feat(vite): default the ui option to true

The live dashboard is now the vite plugin's dev-time default; pass
ui: false to keep only the build-time gate."
```

---

### Task 3: Rename the CLI installer's `vite-dev-overlay` target to `vite-hooks`

**Files:**

- Modify: `packages/cli/src/install/vite-targets.ts`
- Modify: `packages/cli/src/install/index.ts`
- Modify: `packages/cli/src/install/cli.ts`
- Modify: `packages/cli/test/install/vite-targets.test.ts`
- Modify: `packages/cli/test/install/args.test.ts`
- Modify: `packages/cli/test/install/run.test.ts`

**Interfaces:**

- Consumes: nothing from Tasks 1-2.
- Produces: `ViteTargetId = 'vite-plugin' | 'vite-hooks'` (was `'vite-dev-overlay'`). `VITE_TARGETS`, `viteTargetById`, `isViteTargetId` keep their existing signatures.

- [ ] **Step 1: Rename the id, label, and hint in `vite-targets.ts`**

Replace the full contents of `packages/cli/src/install/vite-targets.ts` with:

```ts
export type ViteTargetId = 'vite-plugin' | 'vite-hooks';

export interface ViteTarget {
  id: ViteTargetId;
  label: string;
  hint: string;
}

// Vite install targets with metadata for the CLI wizard
export const VITE_TARGETS: ViteTarget[] = [
  {
    id: 'vite-plugin',
    label: 'Vite plugin (build gate)',
    hint: 'Fails `vite build` when prerendered pages cross the SEO/Performance threshold'
  },
  {
    id: 'vite-hooks',
    label: 'Live dashboard accuracy',
    hint: 'Feeds real rendered results into the live dashboard as you browse — improves per-route accuracy, never fails a build'
  }
];

// Lookup a Vite target by its id
export function viteTargetById(id: string): ViteTarget | undefined {
  return VITE_TARGETS.find((t) => t.id === id);
}

/** Whether an id is one of the Vite install targets (as opposed to an MCP client id). */
export function isViteTargetId(id: string): id is ViteTargetId {
  return VITE_TARGETS.some((t) => t.id === id);
}
```

- [ ] **Step 2: Update `vite-targets.test.ts`**

In `packages/cli/test/install/vite-targets.test.ts`, change:

- `expect(VITE_TARGETS.map((t) => t.id).sort()).toEqual(['vite-dev-overlay', 'vite-plugin']);` → `expect(VITE_TARGETS.map((t) => t.id).sort()).toEqual(['vite-hooks', 'vite-plugin']);`
- `expect(isViteTargetId('vite-dev-overlay')).toBe(true);` → `expect(isViteTargetId('vite-hooks')).toBe(true);`

Run: `pnpm --filter svelte-vitals exec vitest run test/install/vite-targets.test.ts`
Expected: 5 passed.

- [ ] **Step 3: Update `index.ts`'s lookup and fallback help string**

In `packages/cli/src/install/index.ts`, change:

```ts
function planForDevOverlay(io: InstallIO): PlanRow {
  const { path, content } = resolveCandidate(io, ['src/hooks.server.ts', 'src/hooks.server.js']);
  const result = codemodHooksServer(content);
  return { id: 'vite-dev-overlay', label: viteTargetById('vite-dev-overlay')!.label, path, ...result };
}
```

to:

```ts
function planForViteHooks(io: InstallIO): PlanRow {
  const { path, content } = resolveCandidate(io, ['src/hooks.server.ts', 'src/hooks.server.js']);
  const result = codemodHooksServer(content);
  return { id: 'vite-hooks', label: viteTargetById('vite-hooks')!.label, path, ...result };
}
```

Update its call site — change:

```ts
rows.push(viteId === 'vite-plugin' ? planForVitePlugin(io) : planForDevOverlay(io));
```

to:

```ts
rows.push(viteId === 'vite-plugin' ? planForVitePlugin(io) : planForViteHooks(io));
```

Update the no-TTY fallback message — change:

```ts
'svelte-vitals: no TTY; pass --client <claude-code,cursor,codex,vite-plugin,vite-dev-overlay,claude-skill,cursor-rules> to install non-interactively.';
```

to:

```ts
'svelte-vitals: no TTY; pass --client <claude-code,cursor,codex,vite-plugin,vite-hooks,claude-skill,cursor-rules> to install non-interactively.';
```

- [ ] **Step 4: Update `cli.ts`'s help text**

In `packages/cli/src/install/cli.ts`, inside `INSTALL_HELP`, change:

```
  --client <ids>    Comma-separated: claude-code,cursor,codex,vite-plugin,vite-dev-overlay,claude-skill,cursor-rules
                    (skips the interactive picker)
                    vite-plugin registers the build-mode plugin in vite.config.{ts,js,mjs}; vite-dev-overlay
                    wires up the dev-overlay hook in src/hooks.server.{ts,js}. --force does not apply
                    to either of these two — an existing registration is always left as-is.
```

to:

```
  --client <ids>    Comma-separated: claude-code,cursor,codex,vite-plugin,vite-hooks,claude-skill,cursor-rules
                    (skips the interactive picker)
                    vite-plugin registers the build-mode plugin in vite.config.{ts,js,mjs}; vite-hooks
                    wires up the svelteVitalsHandle hook in src/hooks.server.{ts,js}, which improves the
                    live dashboard's per-route accuracy as you browse. --force does not apply
                    to either of these two — an existing registration is always left as-is.
```

- [ ] **Step 5: Update `args.test.ts` and `run.test.ts`**

In `packages/cli/test/install/args.test.ts`, change:

```ts
it('accepts vite-plugin and vite-dev-overlay in --client', () => {
  const r = resolveInstallArgs(parse(['--client', 'vite-plugin,vite-dev-overlay']));
  expect(r.errors).toEqual([]);
  expect(r.flags!.client).toEqual(['vite-plugin', 'vite-dev-overlay']);
});
```

to:

```ts
it('accepts vite-plugin and vite-hooks in --client', () => {
  const r = resolveInstallArgs(parse(['--client', 'vite-plugin,vite-hooks']));
  expect(r.errors).toEqual([]);
  expect(r.flags!.client).toEqual(['vite-plugin', 'vite-hooks']);
});
```

In `packages/cli/test/install/run.test.ts`, change:

```ts
it('vite-dev-overlay: no hooks.server.ts → created', async () => {
  const { io, writes } = fakeIO({ files: { '/proj/package.json': '{}' }, runCommand: () => 0 });
  await runInstall({ client: ['vite-dev-overlay'], yes: true }, io, noPrompts);
  expect(writes['/proj/src/hooks.server.ts']).toContain('svelteVitalsHandle');
});
```

to:

```ts
it('vite-hooks: no hooks.server.ts → created', async () => {
  const { io, writes } = fakeIO({ files: { '/proj/package.json': '{}' }, runCommand: () => 0 });
  await runInstall({ client: ['vite-hooks'], yes: true }, io, noPrompts);
  expect(writes['/proj/src/hooks.server.ts']).toContain('svelteVitalsHandle');
});
```

- [ ] **Step 6: Run the CLI package's install tests**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/`
Expected: all pass.

- [ ] **Step 7: Typecheck, build, and commit**

Run: `pnpm --filter svelte-vitals typecheck && pnpm --filter svelte-vitals build`
Expected: no errors.

```bash
git add packages/cli/src/install/vite-targets.ts packages/cli/src/install/index.ts \
  packages/cli/src/install/cli.ts packages/cli/test/install/vite-targets.test.ts \
  packages/cli/test/install/args.test.ts packages/cli/test/install/run.test.ts
git commit -m "fix(cli): rename the vite-dev-overlay install target to vite-hooks

Its real effect is improving the live dashboard's per-route accuracy, not
printing terminal warnings — id, label, and hint now say that. No back-compat
shim for the old id (near-zero existing adoption)."
```

---

### Task 4: Rewrite the dev-overlay guide as the live-dashboard guide (en + ja)

**Files:**

- Create: `docs/src/content/docs/guides/dev-dashboard.md`
- Create: `docs/src/content/docs/ja/guides/dev-dashboard.md`
- Delete: `docs/src/content/docs/guides/dev-overlay.md`
- Delete: `docs/src/content/docs/ja/guides/dev-overlay.md`

**Interfaces:** None (documentation only). Task 5 depends on this task's new path: `/svelte-vitals/guides/dev-dashboard/` (en) and `/svelte-vitals/ja/guides/dev-dashboard/` (ja).

- [ ] **Step 1: Create the English guide**

Write `docs/src/content/docs/guides/dev-dashboard.md`:

````md
---
title: Live dashboard
description: A live, filterable code-health dashboard during `vite dev` — enabled by default, no build step needed.
sidebar:
  order: 5
---

`@svelte-vitals/vite`'s `svelteVitals()` plugin serves a live dashboard at `/__svelte-vitals/` during `vite dev` — a searchable, sortable route list with a detail pane for the selected route, or an "Overview" that aggregates every finding across the whole project. It updates in place as you work, and it's **on by default**; see [Disabling it](#disabling-it) to opt out.

```js
// vite.config.{js,ts}
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [svelteVitals() /* , sveltekit() */]
};
```
````

`vite dev` prints the dashboard's URL right after its own `Local:`/`Network:` lines every time the server starts, so you don't have to remember the `/__svelte-vitals/` path:

```
  ➜  svelte-vitals: http://localhost:5173/__svelte-vitals/
```

## Whole-project coverage from startup

From the moment the dev server starts, the dashboard shows the **whole project**: a static analysis of all routes across every category (SEO, Performance, Correctness, Security, Architecture) runs asynchronously at startup — the same analysis as `npx svelte-vitals@latest` — so you get the real project Health without visiting a single page. Saving a source file (anything under `src/` or `static/`, or a `svelte.config.*` / `svelte-vitals.config.*`) triggers a debounced re-analysis, and the dashboard refreshes itself.

"Overview" lists every finding across the whole project — every route plus the project's site-wide checks — in one place, and the severity/category chips filter that list directly. Each finding shows which route it came from; clicking it jumps straight to that route's detail pane.

The sidebar's search box filters routes by path or by a finding's rule id/title/location; the sort control reorders it (worst score first by default). Selecting a route (or "Overview") updates the detail pane and is reflected in the URL hash, so a reload or a shared link returns to the same view. The topbar shows an "Analyzing…" indicator while a whole-project re-analysis is running, plus a dark-mode toggle — the preference is remembered per browser and otherwise follows your OS setting.

If the whole-project analysis fails (for example the dev server root is not a SvelteKit project), the failure is logged with `console.warn` and the dashboard falls back to live-only mode — showing just the routes you visit — without ever breaking the dev server.

## Improve accuracy by browsing

On top of that static baseline, browsing your app refines the picture. Add the `svelteVitalsHandle` hook to `src/hooks.server.ts`:

```ts
// src/hooks.server.ts
import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(svelteVitalsHandle());
```

If you already have other handles, place `svelteVitalsHandle()` alongside them inside `sequence`.

`svelteVitalsHandle` uses SvelteKit's `transformPageChunk` to observe each request's fully-rendered `<head>`, fire-and-forget — it never modifies or delays the response, and swallows its own errors, so it can never break the dev server. Each visited route's rendered results replace the static ones for that route in the dashboard — a rendered page is closer to the truth, especially for dynamic values. Route headings carry a provenance badge: `measured` for routes whose findings come from a real rendered page, `static` for routes covered only by source analysis so far.

The handle is a **no-op outside dev**: the `DEV` flag from `esm-env` resolves statically at build time, so the rule set is never built and the hook adds zero runtime cost in production.

`svelteVitalsHandle` accepts an optional options object:

| Option           | Type                          | Description                                      |
| ---------------- | ----------------------------- | ------------------------------------------------ |
| `metaComponents` | `string[]`                    | Component names treated as head-metadata sources |
| `rules`          | `Record<string, RuleSetting>` | Per-rule overrides, e.g. `{ SEO008: 'off' }`     |

Example:

```ts
export const handle = sequence(
  svelteVitalsHandle({
    metaComponents: ['SeoHead'],
    rules: { SEO008: 'off' }
  })
);
```

Notes:

- Only the rendered HTML `<head>` is analyzed — the same data the browser receives. Source-level dynamic values (e.g. `{data.title}`) are always resolved by the time the handle sees them, so `treatDynamicAs` is not applicable here.
- `failOn` is not used: the handle feeds the dashboard but never gates the request.
- Live updates only flow over a loopback origin (`localhost`, `127.0.0.1`, `[::1]`). When you run `vite dev --host` and open the app via a LAN IP, the handle skips the ingest POST (a guard against a spoofed `Host` header), so visited routes won't refine to `measured` — open it from `localhost` instead.
- Set `SVELTE_VITALS_DEBUG=true` to surface swallowed internal errors (analysis failures, skipped ingests) to the terminal for troubleshooting.

## Disabling it

The dashboard is on by default. If you only want the [build-time gate](/svelte-vitals/guides/plugin-mode/) and not the dev-time dashboard — for example on a very large project where you'd rather avoid the startup/re-analysis cost — pass `ui: false`:

```js
export default {
  plugins: [svelteVitals({ ui: false })]
};
```

## Version drift

The dashboard topbar shows `v<@svelte-vitals/vite version>` and, next to it, `core v<@svelte-vitals/core version>`. That second number is the one that matters when comparing findings against the CLI: `svelte-vitals` (CLI) and `@svelte-vitals/vite` are versioned independently, both wrapping the shared `@svelte-vitals/core` rule engine — so it's possible for the two to resolve to _different_ core versions even when both packages themselves look up to date, and a rule added in a newer core release will only show up on whichever surface actually depends on it.

This is easy to hit without noticing through package-manager cooldown/pinning features — e.g. pnpm's [`minimumReleaseAge`](https://pnpm.io/settings#minimumreleaseage) can silently resolve a `pnpm dlx svelte-vitals@latest` run down to an older "mature" release (with an older core) than what `@svelte-vitals/vite` in your lockfile depends on. If the CLI and the dashboard disagree on findings for the same project, run `svelte-vitals --version` and compare its `(core X.Y.Z)` against the dashboard topbar's `core vX.Y.Z` — a mismatch there is the first thing to check before assuming a bug.

````

- [ ] **Step 2: Create the Japanese guide**

Write `docs/src/content/docs/ja/guides/dev-dashboard.md`:

```md
---
title: ライブダッシュボード
description: `vite dev` 中に動作する、フィルタ可能なライブのコード健全性ダッシュボード — デフォルトで有効、ビルド不要。
sidebar:
  order: 5
---

`@svelte-vitals/vite` の `svelteVitals()` プラグインは、`vite dev` 中に `/__svelte-vitals/` でライブダッシュボードを配信します。検索・並び替えができるルート一覧と選択中ルートの詳細ペイン、あるいはプロジェクト全体の指摘を集約した「Overview」で構成され、作業に合わせてその場で更新されます。**デフォルトで有効**です — 無効化する場合は[無効化する](#無効化する)を参照してください。

```js
// vite.config.{js,ts}
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [svelteVitals() /* , sveltekit() */]
};
````

`vite dev` はサーバー起動のたびに本来の `Local:`/`Network:` 表示の直後にダッシュボードのURLを出力するので、`/__svelte-vitals/` というパスを覚えておく必要はありません。

```
  ➜  svelte-vitals: http://localhost:5173/__svelte-vitals/
```

## 起動直後からのプロジェクト全体カバレッジ

dev サーバーの起動直後から、ダッシュボードは**プロジェクト全体**を表示します。起動時に全ルート・全カテゴリ（SEO・Performance・Correctness・Security・Architecture）の静的解析が非同期で実行され（`npx svelte-vitals@latest` と同じ解析です）、ページを1つも訪問しなくても本物のプロジェクト Health が得られます。ソースファイル（`src/` または `static/` 配下、あるいは `svelte.config.*` / `svelte-vitals.config.*`）を保存すると、デバウンス付きの再解析が走り、ダッシュボードが自動的に更新されます。

「Overview」では、全ルートの指摘とプロジェクト全体のサイトチェックをひとつのリストにまとめて表示し、重要度・カテゴリのチップでそのリストを直接絞り込めます。各指摘にはどのルートのものかが表示され、クリックするとそのルートの詳細ペインへ直接移動します。

サイドバーの検索ボックスでは、ルートパスまたは指摘のルールID・タイトル・場所でルートを絞り込めます。並び替えコントロールで一覧の順序を変更できます(既定はスコアが低い順)。ルート(または「Overview」)を選択すると詳細ペインが更新され、選択状態はURLのハッシュに反映されるため、リロードや共有リンクで同じ表示に戻れます。トップバーにはプロジェクト全体の再解析中であることを示す「Analyzing…」表示と、ダークモード切り替えボタンがあります — 設定はブラウザごとに保存され、未設定時はOSの設定に従います。

プロジェクト全体の解析が失敗した場合(例:dev サーバーのルートが SvelteKit プロジェクトでない場合)、失敗は `console.warn` でログに出力され、ダッシュボードはライブのみのモード — 訪問したルートだけを表示 — にフォールバックします。dev サーバーが壊れることはありません。

## ブラウジングで精度を上げる

この静的なベースラインの上に、アプリを操作することで結果が精緻化されます。`src/hooks.server.ts` に `svelteVitalsHandle` フックを追加してください:

```ts
// src/hooks.server.ts
import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(svelteVitalsHandle());
```

他のハンドルが既にある場合は、`sequence` の中に `svelteVitalsHandle()` を並べて配置してください。

`svelteVitalsHandle` は SvelteKit の `transformPageChunk` を使用して各リクエストの完全にレンダリングされた `<head>` を観察します。ファイアー&フォーゲットで実行され、レスポンスを変更もブロックもせず、独自のエラーを飲み込むため、開発サーバーを壊すことはありません。訪問した各ルートのレンダリング済み結果が、ダッシュボード上でそのルートの静的結果を置き換えます — レンダリング済みのページのほうが、特に動的な値については真実に近いためです。ルート見出しには由来を示すバッジが付きます:実際にレンダリングされたページ由来の結果なら `measured`、まだソース解析のみでカバーされているルートなら `static` です。

このフックは**開発時以外は何もしません**。`esm-env` の `DEV` フラグはビルド時に静的に解決されるため、ルールセットは構築されず、本番環境でのランタイムコストはゼロです。

`svelteVitalsHandle` はオプションのオブジェクトを受け付けます:

| オプション       | 型                            | 説明                                              |
| ---------------- | ----------------------------- | ------------------------------------------------- |
| `metaComponents` | `string[]`                    | ヘッドメタデータソースとして扱うコンポーネント名  |
| `rules`          | `Record<string, RuleSetting>` | ルールごとの上書き設定（例：`{ SEO008: 'off' }`） |

例:

```ts
export const handle = sequence(
  svelteVitalsHandle({
    metaComponents: ['SeoHead'],
    rules: { SEO008: 'off' }
  })
);
```

注意事項:

- 分析されるのはレンダリングされた HTML の `<head>` のみです — ブラウザが受け取るデータと同じです。ソースレベルの動的な値(例:`{data.title}`)はハンドルが見る時点で常に解決されているため、`treatDynamicAs` はここでは適用されません。
- `failOn` は使用されません:このハンドルはダッシュボードに結果を供給するだけで、リクエストをゲートしません。
- ライブ更新はループバックオリジン(`localhost`・`127.0.0.1`・`[::1]`)でのみ流れます。`vite dev --host` で LAN の IP からアプリを開いた場合、ハンドルは ingest の POST をスキップする(`Host` ヘッダー偽装への防御)ため、訪問したルートが `measured` に精緻化されません。その場合は `localhost` から開いてください。
- `SVELTE_VITALS_DEBUG=true` を設定すると、飲み込まれた内部エラー(分析失敗、ingestのスキップ)がトラブルシューティング用にターミナルへ表示されます。

## 無効化する

ダッシュボードはデフォルトで有効です。[ビルド時ゲート](/svelte-vitals/ja/guides/plugin-mode/)だけが必要で、dev時のダッシュボードは不要な場合(例:起動時/再解析のコストを避けたい非常に大きなプロジェクトなど)は、`ui: false` を指定してください:

```js
export default {
  plugins: [svelteVitals({ ui: false })]
};
```

## バージョンのずれ

ダッシュボードのトップバーには `v<@svelte-vitals/vite のバージョン>` と、その隣に `core v<@svelte-vitals/core のバージョン>` が表示されます。CLI と検出結果を比較するときに重要なのは後者の core バージョンです。`svelte-vitals`(CLI)と `@svelte-vitals/vite` はそれぞれ独立してバージョン管理されつつ、共有のルールエンジンである `@svelte-vitals/core` をラップしているだけなので、両方のパッケージ自体は最新に見えていても、実際には**異なる** core バージョンに解決されることがあります。その場合、新しい core リリースで追加されたルールは、実際にそのバージョンに依存している側にしか現れません。

これはパッケージマネージャーのクールダウン/固定機能によって、気づかないうちに発生し得ます — 例えば pnpm の [`minimumReleaseAge`](https://pnpm.io/settings#minimumreleaseage) は、`pnpm dlx svelte-vitals@latest` の実行結果を、lockfile 上の `@svelte-vitals/vite` が依存している core より古い「成熟した」リリース(古い core を伴う)に静かに解決してしまうことがあります。同じプロジェクトで CLI とダッシュボードの検出結果が食い違う場合は、まず `svelte-vitals --version` を実行して `(core X.Y.Z)` の部分をダッシュボードのトップバーの `core vX.Y.Z` と比較してください — バグを疑う前に真っ先に確認すべき点です。

````

- [ ] **Step 3: Delete the old guide files**

```bash
git rm docs/src/content/docs/guides/dev-overlay.md docs/src/content/docs/ja/guides/dev-overlay.md
````

- [ ] **Step 4: Verify the docs site builds**

Run: `pnpm --filter docs build`
Expected: build succeeds, no broken-page errors for the new/removed paths. (Cross-links to the old `dev-overlay` path still exist at this point — Task 5 fixes them — so a link-checker step, if the docs build runs one, may still flag those until Task 5 lands. If `pnpm --filter docs build` fails specifically on stale `dev-overlay` links, that's expected here and resolved by Task 5, not a bug in this task.)

- [ ] **Step 5: Commit**

```bash
git add docs/src/content/docs/guides/dev-dashboard.md docs/src/content/docs/ja/guides/dev-dashboard.md \
  docs/src/content/docs/guides/dev-overlay.md docs/src/content/docs/ja/guides/dev-overlay.md
git commit -m "docs: rewrite the dev-overlay guide as the live-dashboard guide

Renamed dev-overlay.md -> dev-dashboard.md (en+ja) and rewrote it
dashboard-first: the dashboard is on by default, and svelteVitalsHandle's
role is now framed as improving its accuracy, not printing warnings."
```

---

### Task 5: Fix cross-links and the package-comparison table

**Files:**

- Modify: `docs/src/content/docs/guides/cli.md`
- Modify: `docs/src/content/docs/ja/guides/cli.md`
- Modify: `docs/src/content/docs/guides/plugin-mode.md`
- Modify: `docs/src/content/docs/ja/guides/plugin-mode.md`
- Modify: `docs/src/content/docs/guides/choosing-a-package.md`
- Modify: `docs/src/content/docs/ja/guides/choosing-a-package.md`
- Modify: `README.md`

**Interfaces:** None (documentation only). Depends on Task 4's new path (`guides/dev-dashboard/`).

- [ ] **Step 1: Fix `cli.md` (en)**

In `docs/src/content/docs/guides/cli.md`, change:

```
Print the CLI's own version and the resolved `@svelte-vitals/core` version, e.g. `0.20.0 (core 0.21.0)`. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases — compare this `core` version against the one shown in the [dev overlay](/svelte-vitals/guides/dev-overlay/#version-drift) footer if the two surfaces ever disagree on findings.
```

to:

```
Print the CLI's own version and the resolved `@svelte-vitals/core` version, e.g. `0.20.0 (core 0.21.0)`. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases — compare this `core` version against the one shown in the [live dashboard](/svelte-vitals/guides/dev-dashboard/#version-drift) topbar if the two surfaces ever disagree on findings.
```

And change:

```
Comma-separated clients/targets to configure: `claude-code`, `cursor`, `codex`, `vite-plugin`, `vite-dev-overlay`, `claude-skill`, `cursor-rules`. When given, the interactive picker is skipped.
```

to:

```
Comma-separated clients/targets to configure: `claude-code`, `cursor`, `codex`, `vite-plugin`, `vite-hooks`, `claude-skill`, `cursor-rules`. When given, the interactive picker is skipped.
```

And change:

```
`vite-plugin` registers `@svelte-vitals/vite`'s build-mode plugin in `vite.config.{ts,js,mjs}`; `vite-dev-overlay` wires up the dev-overlay hook in `src/hooks.server.{ts,js}`. Both use a `magicast` codemod that only touches a file whose shape it confidently recognizes — anything else is left alone and a snippet is printed instead. If either is written and `@svelte-vitals/vite` isn't already a dependency, it's installed automatically via the detected package manager. **`--force` does not apply to these two** — an existing registration is always left as-is regardless of the flag.
```

to:

```
`vite-plugin` registers `@svelte-vitals/vite`'s build-mode plugin in `vite.config.{ts,js,mjs}` (its live dashboard is on by default); `vite-hooks` wires up the `svelteVitalsHandle` hook in `src/hooks.server.{ts,js}`, which improves the dashboard's per-route accuracy as you browse. Both use a `magicast` codemod that only touches a file whose shape it confidently recognizes — anything else is left alone and a snippet is printed instead. If either is written and `@svelte-vitals/vite` isn't already a dependency, it's installed automatically via the detected package manager. **`--force` does not apply to these two** — an existing registration is always left as-is regardless of the flag.
```

- [ ] **Step 2: Fix `cli.md` (ja)**

In `docs/src/content/docs/ja/guides/cli.md`, change:

```
CLI 自身のバージョンと、解決された `@svelte-vitals/core` のバージョンを表示して終了します（例：`0.20.0 (core 0.21.0)`）。`svelte-vitals` と `@svelte-vitals/vite` はそれぞれ独立してバージョン管理されており、異なる `@svelte-vitals/core` リリースに依存する状態になり得ます。CLI と[開発オーバーレイ](/svelte-vitals/ja/guides/dev-overlay/#バージョンのずれ)で検出結果が食い違う場合は、この `core` バージョンをダッシュボードのフッターに表示される値と比較してください。
```

to:

```
CLI 自身のバージョンと、解決された `@svelte-vitals/core` のバージョンを表示して終了します（例：`0.20.0 (core 0.21.0)`）。`svelte-vitals` と `@svelte-vitals/vite` はそれぞれ独立してバージョン管理されており、異なる `@svelte-vitals/core` リリースに依存する状態になり得ます。CLI と[ライブダッシュボード](/svelte-vitals/ja/guides/dev-dashboard/#バージョンのずれ)で検出結果が食い違う場合は、この `core` バージョンをダッシュボードのトップバーに表示される値と比較してください。
```

And change:

```
設定するクライアント／ターゲットをカンマ区切りで指定します：`claude-code`、`cursor`、`codex`、`vite-plugin`、`vite-dev-overlay`、`claude-skill`、`cursor-rules`。指定した場合は対話式の選択がスキップされます。
```

to:

```
設定するクライアント／ターゲットをカンマ区切りで指定します：`claude-code`、`cursor`、`codex`、`vite-plugin`、`vite-hooks`、`claude-skill`、`cursor-rules`。指定した場合は対話式の選択がスキップされます。
```

And change:

```
`vite-plugin` は `@svelte-vitals/vite` のビルドモードのプラグインを `vite.config.{ts,js,mjs}` に登録します。`vite-dev-overlay` は開発オーバーレイのフックを `src/hooks.server.{ts,js}` に組み込みます。どちらも `magicast` によるコードモッドを使用し、確実に認識できる形のファイルのみを変更します — それ以外の場合は何もせず、代わりに手動で追加するためのスニペットを表示します。どちらかが書き込まれ、かつ `@svelte-vitals/vite` がまだ依存関係に含まれていない場合、検出されたパッケージマネージャー経由で自動インストールされます。**`--force` はこの2つには適用されません** — フラグの有無にかかわらず、既存の登録は常にそのまま維持されます。
```

to:

```
`vite-plugin` は `@svelte-vitals/vite` のビルドモードのプラグインを `vite.config.{ts,js,mjs}` に登録します(ライブダッシュボードはデフォルトで有効です)。`vite-hooks` は `svelteVitalsHandle` フックを `src/hooks.server.{ts,js}` に組み込み、ブラウジングに応じてダッシュボードのルート別の精度を上げます。どちらも `magicast` によるコードモッドを使用し、確実に認識できる形のファイルのみを変更します — それ以外の場合は何もせず、代わりに手動で追加するためのスニペットを表示します。どちらかが書き込まれ、かつ `@svelte-vitals/vite` がまだ依存関係に含まれていない場合、検出されたパッケージマネージャー経由で自動インストールされます。**`--force` はこの2つには適用されません** — フラグの有無にかかわらず、既存の登録は常にそのまま維持されます。
```

- [ ] **Step 3: Fix `plugin-mode.md` (en)**

In `docs/src/content/docs/guides/plugin-mode.md`, change:

```
## Dev overlay

At dev time, `@svelte-vitals/vite` also injects live warnings into the browser via `transformPageChunk`. See [Dev overlay](/svelte-vitals/guides/dev-overlay/) for details.
```

to:

```
## Live dashboard

At dev time, `@svelte-vitals/vite` also serves a live dashboard at `/__svelte-vitals/`, on by default. See [Live dashboard](/svelte-vitals/guides/dev-dashboard/) for details.
```

- [ ] **Step 4: Fix `plugin-mode.md` (ja)**

In `docs/src/content/docs/ja/guides/plugin-mode.md`, change:

```
## 開発オーバーレイ

開発時には、`@svelte-vitals/vite` は `transformPageChunk` を通じてブラウザにライブ警告を注入します。詳細は [開発オーバーレイ](/svelte-vitals/ja/guides/dev-overlay/) を参照してください。
```

to:

```
## ライブダッシュボード

開発時には、`@svelte-vitals/vite` は `/__svelte-vitals/` でライブダッシュボードも配信します(デフォルトで有効)。詳細は [ライブダッシュボード](/svelte-vitals/ja/guides/dev-dashboard/) を参照してください。
```

- [ ] **Step 5: Fix `choosing-a-package.md` (en)**

In `docs/src/content/docs/guides/choosing-a-package.md`, change the intro paragraph:

```
svelte-vitals ships as three packages — `svelte-vitals` (CLI), `@svelte-vitals/vite` (plugin + dev overlay), and `@svelte-vitals/mcp` (MCP server). They share the same rule engine and scoring, but read different input and cover different ground. Most projects end up using more than one.

Each package is versioned independently and depends on `@svelte-vitals/core` (the shared rule engine) as its own semver range, so two packages installed at the "same time" can still resolve to different core versions — see [dev overlay: Version drift](/svelte-vitals/guides/dev-overlay/#version-drift) if the CLI and the Vite plugin ever disagree on findings for the same project.
```

to:

```
svelte-vitals ships as three packages — `svelte-vitals` (CLI), `@svelte-vitals/vite` (plugin + live dashboard), and `@svelte-vitals/mcp` (MCP server). They share the same rule engine and scoring, but read different input and cover different ground. Most projects end up using more than one.

Each package is versioned independently and depends on `@svelte-vitals/core` (the shared rule engine) as its own semver range, so two packages installed at the "same time" can still resolve to different core versions — see [live dashboard: Version drift](/svelte-vitals/guides/dev-dashboard/#version-drift) if the CLI and the Vite plugin ever disagree on findings for the same project.
```

Change the "Quick answer" table row:

```
| See warnings live while developing, with no build step                                   | **Vite plugin**, dev overlay         |
```

to:

```
| See live findings while developing, whole project, from the moment `vite dev` starts     | **Vite plugin**, live dashboard      |
```

Replace the "Comparison" table:

```
|                | CLI (`svelte-vitals`)                                         | Vite plugin — build mode                                      | Vite plugin — dev overlay         | MCP server                       |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------- | -------------------------------- |
| Reads          | Source (`.svelte` files, layout chain)                        | Prerendered HTML output + `.svelte` source (component rules)  | Rendered HTML, per dev request    | Source (same engine as the CLI)  |
| Categories     | All 5 — SEO, Performance, Correctness, Security, Architecture | All 5 — SEO, Performance, Correctness, Security, Architecture | SEO, Performance                  | All 5                            |
| Routes covered | Every route — SSR, dynamic, prerendered                       | Prerendered routes only                                       | Only routes you've visited in dev | Every route                      |
| Runs           | On demand — terminal, CI, pre-commit                          | Every `vite build`                                            | Live, while `vite dev` runs       | On demand — an agent's tool call |
| Needs a build  | No                                                            | Yes                                                           | No                                | No                               |
| Typical home   | CI, pre-commit hooks, one-off audits                          | Build pipeline gate                                           | Local dev feedback                | An AI agent's tool loop          |
```

with:

```
|                | CLI (`svelte-vitals`)                                         | Vite plugin — build mode                                      | Vite plugin — live dashboard                                    | MCP server                       |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------- |
| Reads          | Source (`.svelte` files, layout chain)                        | Prerendered HTML output + `.svelte` source (component rules)  | Source at startup; rendered HTML for routes you've visited        | Source (same engine as the CLI)  |
| Categories     | All 5 — SEO, Performance, Correctness, Security, Architecture | All 5 — SEO, Performance, Correctness, Security, Architecture | All 5 (static baseline); visited routes refine to rendered SEO/Performance accuracy | All 5    |
| Routes covered | Every route — SSR, dynamic, prerendered                       | Prerendered routes only                                       | Every route from startup — visited routes upgrade to `measured`   | Every route                      |
| Runs           | On demand — terminal, CI, pre-commit                          | Every `vite build`                                            | Live, while `vite dev` runs                                       | On demand — an agent's tool call |
| Needs a build  | No                                                            | Yes                                                           | No                                                                 | No                               |
| Typical home   | CI, pre-commit hooks, one-off audits                          | Build pipeline gate                                           | Local dev feedback (on by default)                                 | An AI agent's tool loop          |
```

Change the "Why build-mode coverage is close to the CLI's" section:

```
### Why build-mode coverage is close to the CLI's

Correctness, Security, and Architecture rules read component **source** — `$effect` bodies, `{@html}` calls, prop counts — which only exists before compilation. The CLI, MCP (which runs the CLI's own analysis engine), and the Vite plugin's **build mode** all read this source directly, so all three run the full 5-category rule set.

The dev overlay is the one path that inspects **rendered HTML only** (the response for each route you visit, with no whole-project source scan), which keeps it SEO/Performance-only, but library-agnostic and exact for the pages it covers: whatever produced the `<head>`, if it's missing from the shipped HTML, the overlay sees it. Build mode reads rendered HTML too (for the same exact-verification reason), _in addition to_ the source scan — it's the only path that gets both.
```

to:

```
### Why build-mode coverage is close to the CLI's

Correctness, Security, and Architecture rules read component **source** — `$effect` bodies, `{@html}` calls, prop counts — which only exists before compilation. The CLI, MCP (which runs the CLI's own analysis engine), the Vite plugin's **build mode**, and the live dashboard's whole-project static baseline all read this source directly, so all four cover the full 5-category rule set.

Once you actually visit a route in dev, the dashboard additionally re-checks that route's **rendered HTML** (via `svelteVitalsHandle`) for SEO/Performance — library-agnostic and exact for the pages it covers: whatever produced the `<head>`, if it's missing from the shipped HTML, it's seen. That per-route rendered re-check is the one thing the dashboard's static baseline alone doesn't give you. Build mode reads rendered HTML too (for the same exact-verification reason), _in addition to_ the source scan — it's the only build-time path that gets both.
```

Change the package description:

```
The same package also adds a **dev overlay** — live warnings in the terminal (and an optional dashboard at `/__svelte-vitals/`) as you navigate `vite dev`, with zero build step. It's feedback, not a gate: nothing here fails a build or a CI run. See [Dev overlay](/svelte-vitals/guides/dev-overlay/).
```

to:

```
The same package also serves a **live dashboard** at `/__svelte-vitals/` during `vite dev`, on by default, with zero build step — whole-project coverage from startup, refined to real rendered results as you browse. It's feedback, not a gate: nothing here fails a build or a CI run. See [Live dashboard](/svelte-vitals/guides/dev-dashboard/).
```

Change the last bullet in "Recommended setups":

```
- **Polishing prerendered/marketing pages:** add the Vite plugin's build mode for an exact, build-time gate on shipped HTML, and the dev overlay for live feedback while you write.
```

to:

```
- **Polishing prerendered/marketing pages:** add the Vite plugin's build mode for an exact, build-time gate on shipped HTML — its live dashboard (on by default) gives you feedback while you write, no extra setup needed.
```

- [ ] **Step 6: Fix `choosing-a-package.md` (ja)**

Apply the same set of changes as Step 5, translated, to `docs/src/content/docs/ja/guides/choosing-a-package.md`:

In `docs/src/content/docs/ja/guides/choosing-a-package.md`, change the intro paragraphs:

```
svelte-vitals は `svelte-vitals`(CLI)、`@svelte-vitals/vite`(プラグイン + 開発オーバーレイ)、`@svelte-vitals/mcp`(MCPサーバー)という3つのパッケージで構成されています。いずれも同じルールエンジンとスコアリングを共有していますが、読み取る対象とカバー範囲が異なります。ほとんどのプロジェクトでは複数を組み合わせて使うことになります。

各パッケージは独立してバージョン管理されており、共有ルールエンジンである `@svelte-vitals/core` にはそれぞれ自分の semver 範囲で依存しています。そのため「同時に」インストールした2つのパッケージが、実際には異なる core バージョンに解決されることがあります — CLI と Vite プラグインで検出結果が食い違う場合は[開発オーバーレイ § バージョンのずれ](/svelte-vitals/ja/guides/dev-overlay/#バージョンのずれ)を参照してください。
```

to:

```
svelte-vitals は `svelte-vitals`(CLI)、`@svelte-vitals/vite`(プラグイン + ライブダッシュボード)、`@svelte-vitals/mcp`(MCPサーバー)という3つのパッケージで構成されています。いずれも同じルールエンジンとスコアリングを共有していますが、読み取る対象とカバー範囲が異なります。ほとんどのプロジェクトでは複数を組み合わせて使うことになります。

各パッケージは独立してバージョン管理されており、共有ルールエンジンである `@svelte-vitals/core` にはそれぞれ自分の semver 範囲で依存しています。そのため「同時に」インストールした2つのパッケージが、実際には異なる core バージョンに解決されることがあります — CLI と Vite プラグインで検出結果が食い違う場合は[ライブダッシュボード § バージョンのずれ](/svelte-vitals/ja/guides/dev-dashboard/#バージョンのずれ)を参照してください。
```

Change the "早見表" table row:

```
| ビルドを待たずに、開発中にライブで警告を見たい                                          | **Vite プラグイン**(開発オーバーレイ） |
```

to:

```
| ビルドを待たずに、開発中にプロジェクト全体をライブで確認したい                          | **Vite プラグイン**(ライブダッシュボード） |
```

Replace the "比較" table:

```
|                | CLI (`svelte-vitals`)                                         | Vite プラグイン — ビルドモード                                         | Vite プラグイン — 開発オーバーレイ           | MCPサーバー                         |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------- |
| 読み取る対象   | ソース(`.svelte`ファイル、レイアウトチェーン）                | プレレンダリング済みHTML出力 + `.svelte`ソース（コンポーネントルール） | 開発中のリクエストごとのレンダリング済みHTML | ソース(CLIと同じエンジン）          |
| カテゴリ       | 全5種 — SEO・Performance・Correctness・Security・Architecture | 全5種 — SEO・Performance・Correctness・Security・Architecture          | SEO・Performance                             | 全5種                               |
| 対象ルート     | 全ルート(SSR・動的・プレレンダリング）                        | プレレンダリングされたルートのみ                                       | 開発中に実際に訪れたルートのみ               | 全ルート                            |
| 実行タイミング | 任意 — ターミナル・CI・pre-commit                             | `vite build` の都度                                                    | `vite dev` 実行中にライブ                    | 任意 — エージェントのツール呼び出し |
| ビルドが必要か | 不要                                                          | 必要                                                                   | 不要                                         | 不要                                |
| 主な用途       | CI・pre-commitフック・単発の監査                              | ビルドパイプラインのゲート                                             | ローカル開発中のフィードバック               | AIエージェントのツールループ        |
```

with:

```
|                | CLI (`svelte-vitals`)                                         | Vite プラグイン — ビルドモード                                         | Vite プラグイン — ライブダッシュボード                                                  | MCPサーバー                         |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| 読み取る対象   | ソース(`.svelte`ファイル、レイアウトチェーン）                | プレレンダリング済みHTML出力 + `.svelte`ソース（コンポーネントルール） | 起動時はソース、訪問済みルートはレンダリング済みHTML                                      | ソース(CLIと同じエンジン）          |
| カテゴリ       | 全5種 — SEO・Performance・Correctness・Security・Architecture | 全5種 — SEO・Performance・Correctness・Security・Architecture          | 全5種(静的ベースライン)、訪問済みルートはレンダリング済みSEO/Performanceの精度に精緻化    | 全5種                               |
| 対象ルート     | 全ルート(SSR・動的・プレレンダリング）                        | プレレンダリングされたルートのみ                                       | 起動時から全ルート — 訪問済みルートは `measured` に格上げ                                 | 全ルート                            |
| 実行タイミング | 任意 — ターミナル・CI・pre-commit                             | `vite build` の都度                                                    | `vite dev` 実行中にライブ                                                                  | 任意 — エージェントのツール呼び出し |
| ビルドが必要か | 不要                                                          | 必要                                                                   | 不要                                                                                        | 不要                                |
| 主な用途       | CI・pre-commitフック・単発の監査                              | ビルドパイプラインのゲート                                             | ローカル開発中のフィードバック(デフォルトで有効)                                          | AIエージェントのツールループ        |
```

Change the "なぜビルドモードのカバー範囲はCLIに近いのか" section:

```
Correctness・Security・Architecture のルールはコンポーネントの**ソースコード**(`$effect`の中身、`{@html}`の呼び出し、propsの数など)を読み取りますが、これらはコンパイル前にしか存在しません。CLI、MCP（CLI自身の解析エンジンをそのまま呼び出す）、そして Vite プラグインの**ビルドモード**はいずれもソースを直接読むため、この3つすべてが全5カテゴリのルールセットを実行できます。

開発オーバーレイだけが**レンダリング済みHTMLのみ**を検査する経路です(訪問した各ルートのレスポンスのみ、プロジェクト全体を横断するソーススキャンはありません)。そのためSEO/Performanceのみに限定されますが、カバーする範囲においてはライブラリ非依存かつ正確です — 何が `<head>` を生成したかに関わらず、実際に配信されるHTMLに欠けていればそれを検出します。ビルドモードも同じ理由でレンダリング済みHTMLを読み取りますが、それに**加えて**ソーススキャンも行う唯一の経路です。
```

to:

```
Correctness・Security・Architecture のルールはコンポーネントの**ソースコード**(`$effect`の中身、`{@html}`の呼び出し、propsの数など)を読み取りますが、これらはコンパイル前にしか存在しません。CLI、MCP（CLI自身の解析エンジンをそのまま呼び出す）、Vite プラグインの**ビルドモード**、そしてライブダッシュボードの静的ベースラインはいずれもソースを直接読むため、この4つすべてが全5カテゴリのルールセットを実行できます。

実際にdevでルートを訪問すると、ダッシュボードはさらにそのルートの**レンダリング済みHTML**を(`svelteVitalsHandle` 経由で)SEO/Performanceについて再チェックします — カバーする範囲においてはライブラリ非依存かつ正確です:何が `<head>` を生成したかに関わらず、実際に配信されるHTMLに欠けていればそれを検出します。この訪問済みルートのレンダリング済み再チェックだけが、ダッシュボードの静的ベースライン単体では得られないものです。ビルドモードも同じ理由でレンダリング済みHTMLを読み取りますが、それに**加えて**ソーススキャンも行う唯一のビルド時経路です。
```

Change the package description:

```
同じパッケージには**開発オーバーレイ**も含まれており、`vite dev` を実行してページを巡回するだけで、ビルド不要でターミナルにライブ警告(任意でダッシュボードを `/__svelte-vitals/` に)を表示します。これはゲートではなくフィードバックです — ビルドやCIを失敗させることはありません。詳細は [開発オーバーレイ](/svelte-vitals/ja/guides/dev-overlay/) を参照してください。
```

to:

```
同じパッケージは `vite dev` 中に `/__svelte-vitals/` で**ライブダッシュボード**もデフォルトで配信しており、ビルド不要で、起動時からプロジェクト全体をカバーし、ブラウジングに応じて実際のレンダリング結果に精緻化されます。これはゲートではなくフィードバックです — ビルドやCIを失敗させることはありません。詳細は [ライブダッシュボード](/svelte-vitals/ja/guides/dev-dashboard/) を参照してください。
```

Change the "おすすめの組み合わせ" bullet:

```
- **プレレンダリング/マーケティングページを磨き込むなら:** Vite プラグインのビルドモードで配信HTMLを正確にビルド時ゲートし、開発オーバーレイで執筆中のライブフィードバックも得る。
```

to:

```
- **プレレンダリング/マーケティングページを磨き込むなら:** Vite プラグインのビルドモードで配信HTMLを正確にビルド時ゲートする — ライブダッシュボードはデフォルトで有効なので、執筆中のライブフィードバックも追加のセットアップなしで得られる。
```

- [ ] **Step 7: Fix `README.md`**

In `README.md`, change:

```
- **Dev overlay** — request-driven SEO/Performance feedback as you navigate in `dev`, checking each route's **rendered** `<head>` so dynamic routes are seen with real values. → [Dev overlay](https://oekazuma.github.io/svelte-vitals/guides/dev-overlay/)
```

to:

```
- **Live dashboard** — a searchable, filterable dashboard at `/__svelte-vitals/` during `vite dev`, on by default: whole-project coverage from startup, refined to real rendered values as you browse. → [Live dashboard](https://oekazuma.github.io/svelte-vitals/guides/dev-dashboard/)
```

- [ ] **Step 8: Grep for any remaining stray references**

Run: `grep -rn "dev-overlay\|Dev overlay\|開発オーバーレイ\|vite-dev-overlay" --include="*.md" --include="*.ts" . | grep -v node_modules | grep -v "/dist/" | grep -v "CHANGELOG.md" | grep -v "docs/superpowers/"`

Expected: no output. (`CHANGELOG.md` files and `docs/superpowers/plans|specs/` are historical/generated and intentionally excluded, per `AGENTS.md`.) If anything remains, fix it the same way as the matching case above before moving on.

- [ ] **Step 9: Reformat the tables and verify the docs site builds cleanly**

The table edits in Step 5/6 change column widths without repadding every cell, which `pnpm lint`'s prettier check will flag. Run `pnpm exec prettier --write` on the two edited table files to let prettier repad them automatically (an already-established fix for this exact class of issue in this repo — see `docs/src/content/docs/guides/choosing-a-package.md`'s and its ja counterpart's git history for precedent):

Run: `pnpm exec prettier --write docs/src/content/docs/guides/choosing-a-package.md docs/src/content/docs/ja/guides/choosing-a-package.md`
Expected: exits 0; `git diff` shows only whitespace/column-padding changes in the two tables, no content changes.

Then run: `pnpm --filter docs build`
Expected: build succeeds with no broken-link warnings.

- [ ] **Step 10: Commit**

```bash
git add docs/src/content/docs/guides/cli.md docs/src/content/docs/ja/guides/cli.md \
  docs/src/content/docs/guides/plugin-mode.md docs/src/content/docs/ja/guides/plugin-mode.md \
  docs/src/content/docs/guides/choosing-a-package.md docs/src/content/docs/ja/guides/choosing-a-package.md \
  README.md
git commit -m "docs: point every dev-overlay cross-link at the live dashboard

Also corrects the package-comparison table in choosing-a-package.md, which
had gone stale since the dashboard gained whole-project static analysis
(2026-07-08-dev-dashboard-whole-project-design.md) — it still described the
old visited-routes-only, SEO/Performance-only behavior."
```

---

### Task 6: Changesets and final verification

**Files:**

- Create: `.changeset/retire-dev-overlay.md`

**Interfaces:** None.

- [ ] **Step 1: Add the changeset**

Write `.changeset/retire-dev-overlay.md`:

```md
---
'@svelte-vitals/vite': minor
'svelte-vitals': minor
---

Live dashboard: `svelteVitals()`'s `ui` option now defaults to `true` — the dashboard at `/__svelte-vitals/` is on during `vite dev` unless you pass `ui: false`. `svelteVitalsHandle` no longer prints findings to the terminal (the dashboard supersedes that output); it still feeds the dashboard's per-route accuracy when enabled.

CLI: the `install` wizard's `vite-dev-overlay` target is renamed `vite-hooks`, with copy describing its real effect (dashboard accuracy) instead of terminal warnings.
```

- [ ] **Step 2: Run the full monorepo verify suite**

Run: `pnpm build && pnpm typecheck && pnpm test && pnpm lint`
Expected: all four pass with zero errors (matching `AGENTS.md`'s CI job list: `lint`, `check` (build + typecheck + check:publish), `test`, `docs`).

Run: `pnpm check:publish`
Expected: passes (publint + attw).

Run: `pnpm --filter docs build`
Expected: passes (already verified in Task 5, re-run here as part of the full-suite pass).

- [ ] **Step 3: Commit**

```bash
git add .changeset/retire-dev-overlay.md
git commit -m "chore: add changeset for retiring the dev overlay"
```

---

## Self-Review Notes

- **Spec coverage:** every numbered "Decision" and "Component" in `docs/superpowers/specs/2026-07-12-retire-dev-overlay-design.md` maps to a task: Decision 1 → Task 1, Decision 2 → Task 2, Decision 3 → Task 3, Decision 4 → Tasks 4-5. The spec's Testing section maps 1:1 onto the test-file changes in Tasks 1-3. The spec's Release section maps to Task 6.
- **Beyond the spec's explicit file list:** the investigation while writing this plan (not visible from the spec's Components section alone) found that `plugin-options.test.ts`, `plugin-error.test.ts`, and `integration.test.ts` all call `svelteVitals({...})` without `ui` and assume a single-`Plugin` return — these would break at runtime, not just fail an assertion, once the default flips. Task 2 Step 5 covers all eight call sites explicitly. The investigation also found `choosing-a-package.md`'s comparison table had gone stale independent of this change (predating the 2026-07-08 whole-project-analysis work) — Task 5 corrects it since it's directly in the path of the required rename.
- **Type consistency:** `findingSignature(results: Result[], config: Config): string` is unchanged end to end (Task 1). `ViteTargetId = 'vite-plugin' | 'vite-hooks'` is used consistently across `vite-targets.ts`, `index.ts`, and every test touched in Task 3. `svelteVitals(options?: SvelteVitalsOptions): Plugin | Plugin[]`'s signature is unchanged in Task 2 — only the runtime behavior for an omitted `ui` changes.
