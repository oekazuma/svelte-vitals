# Vite Live UI Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `svelteVitals({ ui: true })` serves a live svelte-vitals dashboard at `/__svelte-vitals/` during `vite dev`, fed by the existing `svelteVitalsHandle`, reusing the core `buildHtmlDocument` renderer.

**Architecture:** The SvelteKit `handle` (SSR) analyzes each visited page's rendered `<head>` and, when the UI is enabled, POSTs the findings to the dev server. The Vite plugin's dev-server middleware keeps an in-memory store, serves `buildHtmlDocument(...)` (plus an injected live-update script) at `/__svelte-vitals/`, and pushes SSE `update` events so the page re-renders without a full reload. Handle↔plugin talk over HTTP (they may be different module instances), not shared module state.

**Tech Stack:** TypeScript, ESM-only (tsup, `target: es2022`), vitest, Vite dev middleware (connect), SSE, `fetch` (Node 18+ global).

## Global Constraints

- ESM-only; no CJS. `@svelte-vitals/core` is **not modified** — the UI consumes `buildHtmlDocument` / `buildJsonReport` from it.
- All server/serve/SSE/store/injection code lives in `@svelte-vitals/vite`. **No dependency on the CLI package.** No new runtime dependencies (use Node built-ins + `vite` peer types).
- The dashboard is served only in **dev** (`apply: 'serve'`); the existing build-time plugin (`apply: 'build'`) is unchanged.
- Handle↔plugin coupling is **HTTP over the dev server's own origin**, gated by `process.env.SVELTE_VITALS_UI`. Dev-overlay-only users (flag unset) see **no behavior change** — no POST.
- `buildHtmlDocument` is reused **verbatim**; the live behavior is a `<script data-live>` injected before `</body>` by the vite side.
- Coverage is the rendered model (same as the dev overlay): **SEO `<head>` rules**, visited routes only; Performance image rules and project-wide checks are out of scope for the live UI.
- Dev tooling must never break a request: the handle's ingest POST is fire-and-forget with all errors swallowed.

### Reference: existing signatures (read-only — already in the codebase)

```ts
// @svelte-vitals/core
function buildJsonReport(results: Result[], config: Config, meta: { version: string }): JsonReport
function buildHtmlDocument(report: JsonReport, meta: { version: string }): string
function defineConfig(partial): Config
type Result = { id: string; message: string; category?: Category; detection: {...}; location?: string; route?: string; severity?: Severity; ... }

// packages/vite/src/hooks/handle.ts (current)
//   analyzeAndWarn(html, route, rules, config, lastSignature) — computes `results`, dedupes by signature, console.warn's formatDevReport
//   svelteVitalsHandle(options) returns a SvelteKit Handle; DEV-only; uses transformPageChunk to capture rendered HTML

// packages/vite/src/plugin.ts (current)
//   svelteVitals(options: SvelteVitalsOptions): Plugin  — apply:'build', closeBundle gates the build
//   readPackageVersion() from './version.js'
```

---

### Task 1: Findings store

An in-memory store the dev middleware owns: findings keyed by route, a flattened snapshot for `buildJsonReport`, and change subscriptions for SSE.

**Files:**
- Create: `packages/vite/src/ui/store.ts`
- Test: `packages/vite/test/ui-store.test.ts`

**Interfaces:**
- Consumes: `type Result` from `@svelte-vitals/core`.
- Produces:
  - `interface FindingsStore { set(route: string, results: Result[]): void; snapshot(): Result[]; subscribe(fn: () => void): () => void; }`
  - `function createStore(): FindingsStore`

- [ ] **Step 1: Write the failing test**

Create `packages/vite/test/ui-store.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/ui/store.js';
import type { Result } from '@svelte-vitals/core';

const r = (id: string, route?: string): Result =>
  ({ id, message: id, category: 'seo', detection: { presence: 'none', value: 'absent' }, route, severity: 'critical' }) as Result;

describe('createStore', () => {
  it('flattens results across routes in snapshot()', () => {
    const s = createStore();
    s.set('/a', [r('SEO001', '/a')]);
    s.set('/b', [r('SEO002', '/b')]);
    expect(s.snapshot().map((x) => x.id).sort()).toEqual(['SEO001', 'SEO002']);
  });

  it('replaces (not appends) a route on re-set', () => {
    const s = createStore();
    s.set('/a', [r('SEO001', '/a')]);
    s.set('/a', [r('SEO002', '/a')]);
    expect(s.snapshot().map((x) => x.id)).toEqual(['SEO002']);
  });

  it('stamps the route onto results missing one', () => {
    const s = createStore();
    s.set('/a', [r('SEO001')]); // no route on the result
    expect(s.snapshot()[0]!.route).toBe('/a');
  });

  it('notifies subscribers on set and supports unsubscribe', () => {
    const s = createStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set('/a', [r('SEO001', '/a')]);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.set('/b', [r('SEO002', '/b')]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vite && pnpm vitest run test/ui-store.test.ts`
Expected: FAIL — `../src/ui/store.js` does not exist.

- [ ] **Step 3: Implement the store**

Create `packages/vite/src/ui/store.ts`:

```ts
import type { Result } from '@svelte-vitals/core';

/** In-memory findings store for the dev UI. Owned by the dev-server middleware. */
export interface FindingsStore {
  /** Replace a route's findings (route stamped onto results missing one) and notify subscribers. */
  set(route: string, results: Result[]): void;
  /** All findings across routes, flattened — feed straight into buildJsonReport. */
  snapshot(): Result[];
  /** Subscribe to change notifications; returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
}

export function createStore(): FindingsStore {
  const byRoute = new Map<string, Result[]>();
  const subs = new Set<() => void>();
  return {
    set(route, results) {
      byRoute.set(
        route,
        results.map((r) => (r.route ? r : { ...r, route }))
      );
      for (const fn of subs) fn();
    },
    snapshot() {
      return [...byRoute.values()].flat();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/vite && pnpm vitest run test/ui-store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/ui/store.ts packages/vite/test/ui-store.test.ts
git commit -m "feat(vite): findings store for the live UI"
```

---

### Task 2: Dashboard renderer (reuse buildHtmlDocument + inject live script)

Build the served HTML: the core `buildHtmlDocument` output with a `<script data-live>` injected before `</body>` that subscribes to SSE and swaps the `.wrap` content on update.

**Files:**
- Create: `packages/vite/src/ui/serve.ts`
- Test: `packages/vite/test/ui-serve.test.ts`

**Interfaces:**
- Consumes: `buildHtmlDocument`, `buildJsonReport`, `type Config`, `type Result` from `@svelte-vitals/core`.
- Produces: `function renderDashboard(results: Result[], config: Config, meta: { version: string }): string`

- [ ] **Step 1: Write the failing test**

Create `packages/vite/test/ui-serve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderDashboard } from '../src/ui/serve.js';
import { defineConfig, type Result } from '@svelte-vitals/core';

const config = defineConfig({});
const results: Result[] = [
  { id: 'SEO001', message: 'Missing <title>', category: 'seo', detection: { presence: 'none', value: 'absent' }, route: '/a', location: 'a/+page.svelte', severity: 'critical' } as Result
];

describe('renderDashboard', () => {
  const html = renderDashboard(results, config, { version: '9.9.9' });

  it('reuses buildHtmlDocument (full doc with the finding)', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('SEO001');
  });

  it('injects a live-update script before </body>', () => {
    expect(html).toContain('data-live');
    expect(html).toContain("EventSource('/__svelte-vitals/events')");
    // injected before the closing body tag
    expect(html.indexOf('data-live')).toBeLessThan(html.indexOf('</body>'));
  });

  it('renders an empty snapshot without throwing', () => {
    expect(() => renderDashboard([], config, { version: '0' })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vite && pnpm vitest run test/ui-serve.test.ts`
Expected: FAIL — `../src/ui/serve.js` does not exist.

- [ ] **Step 3: Implement the renderer**

Create `packages/vite/src/ui/serve.ts`:

```ts
import { buildHtmlDocument, buildJsonReport, type Config, type Result } from '@svelte-vitals/core';

// Injected only by the live UI (not part of the shared core renderer). On an SSE
// `update`, re-fetch the dashboard, swap the `.wrap` element, and re-run the core
// init script (freshly appended <script> executes) so the gauge/filters rebind.
const LIVE_SCRIPT = `<script data-live>
(function(){
  var es=new EventSource('/__svelte-vitals/events');
  es.addEventListener('update',function(){
    fetch('/__svelte-vitals/').then(function(r){return r.text();}).then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html');
      var next=doc.querySelector('.wrap'),cur=document.querySelector('.wrap');
      if(next&&cur)cur.replaceWith(next);
      var scripts=doc.querySelectorAll('body > script:not([data-live])');
      var core=scripts[scripts.length-1];
      if(core){var s=document.createElement('script');s.textContent=core.textContent;document.body.appendChild(s);s.remove();}
    }).catch(function(){});
  });
})();
</script>`;

/** The dashboard HTML: the core report document plus the injected live-update script. */
export function renderDashboard(results: Result[], config: Config, meta: { version: string }): string {
  const html = buildHtmlDocument(buildJsonReport(results, config, meta), meta);
  return html.replace('</body>', LIVE_SCRIPT + '</body>');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/vite && pnpm vitest run test/ui-serve.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/ui/serve.ts packages/vite/test/ui-serve.test.ts
git commit -m "feat(vite): dashboard renderer reusing buildHtmlDocument + live script"
```

---

### Task 3: Dev-server middleware (`/`, `/ingest`, `/events`)

Wire the store + renderer onto a Vite dev server: serve the dashboard, accept ingested findings, and stream SSE updates.

**Files:**
- Create: `packages/vite/src/ui/middleware.ts`
- Test: `packages/vite/test/ui-middleware.test.ts`

**Interfaces:**
- Consumes: `createStore` (Task 1), `renderDashboard` (Task 2); `type Config` from `@svelte-vitals/core`; Vite `ViteDevServer` type; Node `IncomingMessage`/`ServerResponse`.
- Produces: `function installUiMiddleware(server: ViteDevServer, config: Config, version: string): void`

- [ ] **Step 1: Write the failing test**

Create `packages/vite/test/ui-middleware.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { installUiMiddleware } from '../src/ui/middleware.js';
import { defineConfig } from '@svelte-vitals/core';

// Capture the handler that installUiMiddleware registers on server.middlewares.use(path, fn).
function setup() {
  let handler: (req: any, res: any, next: () => void) => void = () => {};
  const server = { middlewares: { use: (_path: string, fn: typeof handler) => (handler = fn) } } as any;
  installUiMiddleware(server, defineConfig({}), '9.9.9');
  return { call: (req: any, res: any) => handler(req, res, () => {}) };
}
function res() {
  return { statusCode: 0, headers: {} as Record<string, string>, chunks: [] as string[], setHeader(k: string, v: string) { this.headers[k] = v; }, writeHead(c: number, h?: Record<string, string>) { this.statusCode = c; Object.assign(this.headers, h ?? {}); }, write(c: string) { this.chunks.push(c); }, end(c?: string) { if (c) this.chunks.push(c); } };
}
function postReq(url: string) { return Object.assign(new EventEmitter(), { method: 'POST', url }); }
function getReq(url: string) { return Object.assign(new EventEmitter(), { method: 'GET', url }); }

const ingestBody = JSON.stringify({
  route: '/a',
  results: [{ id: 'SEO001', message: 'Missing <title>', category: 'seo', detection: { presence: 'none', value: 'absent' }, route: '/a', severity: 'critical' }]
});

describe('installUiMiddleware', () => {
  it('serves the dashboard at / reflecting ingested findings', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest');
    call(ireq, ir);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    const html = gr.chunks.join('');
    expect(html).toContain('SEO001');
    expect(gr.headers['Content-Type']).toContain('text/html');
  });

  it('streams an SSE update when findings are ingested', async () => {
    const { call } = setup();
    const sse = res();
    call(getReq('/events'), sse);
    expect(sse.headers['Content-Type']).toContain('text/event-stream');
    const ireq = postReq('/ingest');
    call(ireq, res());
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    expect(sse.chunks.join('')).toContain('event: update');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vite && pnpm vitest run test/ui-middleware.test.ts`
Expected: FAIL — `../src/ui/middleware.js` does not exist.

- [ ] **Step 3: Implement the middleware**

Create `packages/vite/src/ui/middleware.ts`:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import type { Config } from '@svelte-vitals/core';
import { createStore } from './store.js';
import { renderDashboard } from './serve.js';

/** Mount the dev UI at /__svelte-vitals/ : GET / (dashboard), POST /ingest, GET /events (SSE). */
export function installUiMiddleware(server: ViteDevServer, config: Config, version: string): void {
  const store = createStore();
  const clients = new Set<ServerResponse>();

  store.subscribe(() => {
    for (const res of clients) res.write('event: update\ndata: {}\n\n');
  });

  // connect strips the mount path, so req.url is relative ('/', '/ingest', '/events').
  server.middlewares.use('/__svelte-vitals', (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    if (req.method === 'POST' && url.startsWith('/ingest')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { route, results } = JSON.parse(body);
          if (typeof route === 'string' && Array.isArray(results)) store.set(route, results);
        } catch {
          // ignore malformed ingest payloads — dev tooling must not crash the dev server
        }
        res.statusCode = 204;
        res.end();
      });
      return;
    }

    if (url.startsWith('/events')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write('\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    res.end(renderDashboard(store.snapshot(), config, { version }));
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/vite && pnpm vitest run test/ui-middleware.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/ui/middleware.ts packages/vite/test/ui-middleware.test.ts
git commit -m "feat(vite): dev-server middleware (dashboard, ingest, SSE)"
```

---

### Task 4: Plugin `ui` option (serve the dashboard in dev)

Add `ui?: boolean` to the plugin options. When set, `svelteVitals()` returns the existing build plugin **plus** a dev-only plugin whose `configureServer` installs the UI middleware and sets `process.env.SVELTE_VITALS_UI`.

**Files:**
- Modify: `packages/vite/src/plugin.ts`
- Test: `packages/vite/test/ui-plugin.test.ts`

**Interfaces:**
- Consumes: `installUiMiddleware` (Task 3); `defineConfig` from `@svelte-vitals/core`; `readPackageVersion` from `./version.js`; Vite `Plugin`/`ViteDevServer`.
- Produces: `SvelteVitalsOptions` gains `ui?: boolean`; `svelteVitals(options): Plugin | Plugin[]` (returns an array when `ui` is set, a single Plugin otherwise).

- [ ] **Step 1: Write the failing test**

Create `packages/vite/test/ui-plugin.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import type { Plugin, ViteDevServer } from 'vite';
import { svelteVitals } from '../src/index.js';

afterEach(() => {
  delete process.env.SVELTE_VITALS_UI;
});

describe('svelteVitals({ ui })', () => {
  it('returns a single plugin when ui is not set (unchanged)', () => {
    const p = svelteVitals({});
    expect(Array.isArray(p)).toBe(false);
    expect((p as Plugin).name).toBe('svelte-vitals');
  });

  it('adds a dev-only UI plugin when ui:true', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    expect(Array.isArray(plugins)).toBe(true);
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    expect(ui).toBeDefined();
    expect(ui.apply).toBe('serve');
  });

  it('configureServer installs middleware and sets the UI env flag', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const used: string[] = [];
    const server = { middlewares: { use: (path: string) => used.push(path) } } as unknown as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    (hook as (s: ViteDevServer) => void).call({}, server);
    expect(process.env.SVELTE_VITALS_UI).toBe('1');
    expect(used).toContain('/__svelte-vitals');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vite && pnpm vitest run test/ui-plugin.test.ts`
Expected: FAIL — `ui` not handled; `svelteVitals({ui:true})` returns a single plugin.

- [ ] **Step 3: Add the `ui` option and dev plugin**

In `packages/vite/src/plugin.ts`:

- Add to `SvelteVitalsOptions` (after `prerenderDir`):
```ts
  /** Serve a live dashboard at /__svelte-vitals/ during `vite dev` (requires svelteVitalsHandle in hooks.server.ts). */
  ui?: boolean;
```
- Add imports at the top (alongside the existing imports):
```ts
import type { Plugin, ViteDevServer } from 'vite';
import { defineConfig } from '@svelte-vitals/core';
import { installUiMiddleware } from './ui/middleware.js';
import { readPackageVersion } from './version.js';
```
(`type { Plugin }` may already be imported — keep a single import; add `ViteDevServer` to it. Remove any duplicate.)
- Change the signature and wrap the return. The existing function body builds the build-time plugin object; keep it, name it `buildPlugin`, and return conditionally:

```ts
export function svelteVitals(options: SvelteVitalsOptions = {}): Plugin | Plugin[] {
  let root = options.cwd ?? process.cwd();
  const buildPlugin: Plugin = {
    name: 'svelte-vitals',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      if (!options.cwd) root = config.root;
    },
    async closeBundle() {
      // … existing closeBundle body unchanged …
    }
  };

  if (!options.ui) return buildPlugin;

  const uiPlugin: Plugin = {
    name: 'svelte-vitals:ui',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      process.env.SVELTE_VITALS_UI = '1';
      const config = defineConfig({
        treatDynamicAs: options.treatDynamicAs ?? 'pass',
        metaComponents: options.metaComponents ?? [],
        rules: options.rules ?? {},
        failOn: options.failOn ?? 'critical'
      });
      installUiMiddleware(server, config, readPackageVersion());
    }
  };
  return [buildPlugin, uiPlugin];
}
```

> Keep the existing `closeBundle` body exactly as it is — only move it inside `buildPlugin` and wrap the return. Do not change build-time behavior.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/vite && pnpm vitest run test/ui-plugin.test.ts`
Expected: PASS (3 tests).

Also run the existing plugin tests to confirm no regression:
Run: `cd packages/vite && pnpm vitest run test/plugin-options.test.ts test/plugin-error.test.ts`
Expected: PASS (the no-`ui` path still returns a single Plugin).

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/plugin.ts packages/vite/test/ui-plugin.test.ts
git commit -m "feat(vite): svelteVitals({ ui }) serves the dev dashboard"
```

---

### Task 5: Handle feeds findings to the UI (env-gated ingest)

When `process.env.SVELTE_VITALS_UI` is set, `svelteVitalsHandle` additionally POSTs each analyzed route's findings to the dev server's `/__svelte-vitals/ingest`. Terminal-warning behavior is unchanged; the POST is fire-and-forget.

**Files:**
- Modify: `packages/vite/src/hooks/handle.ts`
- Test: `packages/vite/test/ui-ingest.test.ts`

**Interfaces:**
- Consumes: the ingest endpoint contract from Task 3 (`POST /__svelte-vitals/ingest` with `{ route, results }`).
- Produces: no new exports; behavior change in `svelteVitalsHandle` gated by `SVELTE_VITALS_UI`.

- [ ] **Step 1: Write the failing test**

Create `packages/vite/test/ui-ingest.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Handle } from '@sveltejs/kit';
import { svelteVitalsHandle } from '../src/hooks/index.js';

function fakeEvent(routeId: string | null, pathname = '/') {
  return { route: { id: routeId }, url: new URL(`http://localhost:5173${pathname}`) } as unknown as Parameters<
    Parameters<Handle>[0]['resolve']
  >[0];
}
function resolveWith(chunks: string[]) {
  return (async (_event: unknown, opts?: { transformPageChunk?: (i: { html: string; done: boolean }) => unknown }) => {
    const tpc = opts?.transformPageChunk;
    if (tpc) for (let i = 0; i < chunks.length; i++) await tpc({ html: chunks[i]!, done: i === chunks.length - 1 });
    return {} as unknown as Response;
  }) as Parameters<Handle>[0]['resolve'];
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const PAGE_NO_TITLE = '<html lang="en"><head><meta name="description" content="x"></head><body></body></html>';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SVELTE_VITALS_UI;
});

describe('handle ingest (UI feed)', () => {
  it('POSTs findings to /__svelte-vitals/ingest when the UI env flag is set', async () => {
    process.env.SVELTE_VITALS_UI = '1';
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [urlArg, init] = fetchMock.mock.calls[0]!;
    expect(String(urlArg)).toBe('http://localhost:5173/__svelte-vitals/ingest');
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.route).toBe('/none');
    expect(Array.isArray(sent.results)).toBe(true);
  });

  it('does NOT POST when the UI env flag is unset', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vite && pnpm vitest run test/ui-ingest.test.ts`
Expected: FAIL — the handle does not POST.

- [ ] **Step 3: Add the env-gated ingest POST**

In `packages/vite/src/hooks/handle.ts`:

- Add a fire-and-forget ingest helper above `analyzeAndWarn`:
```ts
async function postIngest(origin: string, route: string, results: Result[]): Promise<void> {
  try {
    await fetch(`${origin}/__svelte-vitals/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ route, results })
    });
  } catch {
    // dev tooling must never break a request — swallow ingest failures
  }
}
```
- Import `Result` in the existing `@svelte-vitals/core` type import (add `type Result`).
- Thread `origin` through `analyzeAndWarn`. Change its signature and the dedupe tail so it posts whenever a route's findings change:
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
    const { tags, htmlLang } = parseHtmlHead(html);
    const head: ResolvedHead = { route, source: 'rendered', tags, file: route };
    const project: Project = { hasRobotsTxt: true, hasSitemap: true, htmlLang };
    const results = applyRuleSeverities(await runRules(rules, { heads: [head], project, config }), config);

    const signature = findingSignature(results, config);
    if (lastSignature.get(route) === signature) return;
    lastSignature.set(route, signature);

    const report = formatDevReport(route, results, config);
    if (report) console.warn(report);
    if (globalThis.process?.env?.SVELTE_VITALS_UI) void postIngest(origin, route, results);
  } catch (err) {
    if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      console.warn('[svelte-vitals] dev analysis failed:', err);
    }
  }
}
```
- Update the single call site inside the returned handle to pass `event.url.origin`:
```ts
        if (done) void analyzeAndWarn(buffer, event.route.id ?? event.url.pathname, event.url.origin, rules, config, lastSignature);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/vite && pnpm vitest run test/ui-ingest.test.ts test/dev-handle.test.ts`
Expected: PASS — ingest behavior gated by the flag; existing dev-handle warnings unaffected.

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/hooks/handle.ts packages/vite/test/ui-ingest.test.ts
git commit -m "feat(vite): handle feeds findings to the live UI when enabled"
```

---

### Task 6: Docs + changeset + full verification

Document the live UI (docs site, en + ja) and add the release changeset, then run the full verification suite.

**Files:**
- Modify: `docs/src/content/docs/guides/dev-overlay.md` and `docs/src/content/docs/ja/guides/dev-overlay.md` (add a "Live UI" section)
- Create: `.changeset/vite-live-ui.md`

**Interfaces:** none (docs + release).

- [ ] **Step 1: Add a "Live UI" section to the dev-overlay guide (en)**

Open `docs/src/content/docs/guides/dev-overlay.md`, match its heading style/tone, and append:

````md
## Live UI dashboard

Enable a live dashboard at `/__svelte-vitals/` during `vite dev` — the same report the CLI's `--reporter html` produces, updating in place as you navigate your app.

```js
// vite.config.{js,ts}
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [svelteVitals({ ui: true }) /* , sveltekit() */]
};
```

It is fed by the dev handle (the same one the overlay above uses), so keep `svelteVitalsHandle()` in `src/hooks.server.ts`. Open `http://localhost:5173/__svelte-vitals/` and browse your app: each visited route's rendered `<head>` is analyzed and the dashboard updates live.

Like the overlay, this is dev-only and rendered-based: it covers the SEO `<head>` rules for the routes you visit. For a whole-project report (all routes, Performance, site checks), run `npx svelte-vitals` or `--reporter html`.
````

- [ ] **Step 2: Add the same section to the dev-overlay guide (ja)**

Open `docs/src/content/docs/ja/guides/dev-overlay.md` and append the translated section:

````md
## ライブ UI ダッシュボード

`vite dev` 中に `/__svelte-vitals/` でライブダッシュボードを表示します。CLI の `--reporter html` と同じレポートが、アプリを操作するたびにその場で更新されます。

```js
// vite.config.{js,ts}
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [svelteVitals({ ui: true }) /* , sveltekit() */]
};
```

これは dev handle（上記オーバーレイと同じもの）から供給されるため、`src/hooks.server.ts` の `svelteVitalsHandle()` はそのまま残してください。`http://localhost:5173/__svelte-vitals/` を開いてアプリを操作すると、訪問した各ルートのレンダリング済み `<head>` が解析され、ダッシュボードがライブ更新されます。

オーバーレイと同様、これは dev 専用かつレンダリングベースで、訪問したルートの SEO `<head>` ルールを対象とします。プロジェクト全体のレポート（全ルート・パフォーマンス・サイト全体のチェック）が必要な場合は `npx svelte-vitals` または `--reporter html` を実行してください。
````

- [ ] **Step 3: Add the changeset**

Create `.changeset/vite-live-ui.md`:

```md
---
'@svelte-vitals/vite': minor
---

Add a live UI dashboard: `svelteVitals({ ui: true })` serves a svelte-vitals report at
`/__svelte-vitals/` during `vite dev`, fed by `svelteVitalsHandle`, that updates live as you
navigate. It reuses the same renderer as the CLI's `--reporter html`. Dev-only and
rendered-based (SEO `<head>` rules for visited routes); the dev overlay's behavior is
unchanged when the UI is not enabled.
```

- [ ] **Step 4: Full verification**

Run from the repo root:

```bash
CI=true pnpm -r typecheck && CI=true pnpm -r test && pnpm build && CI=true pnpm --filter docs build && pnpm lint && pnpm check:publish
```
Expected: all green. (Run `pnpm format` first if prettier flags the new Markdown; re-run lint. `attw` inside `check:publish` may fail LOCALLY only — known pre-existing local-cache issue, CI-unaffected; if only attw/npm-pack fails and publint passes, treat it as the known issue.)

- [ ] **Step 5: Commit**

```bash
git add docs/src/content/docs/guides/dev-overlay.md docs/src/content/docs/ja/guides/dev-overlay.md .changeset/vite-live-ui.md
git commit -m "docs: document the live UI; changeset (@svelte-vitals/vite minor)"
```

---

## Self-Review

**Spec coverage:**
- `svelteVitals({ ui: true })` serves `/__svelte-vitals/` in dev → Task 4. ✅
- Reuse `buildHtmlDocument` verbatim + inject live script → Task 2. ✅
- Handle↔plugin over HTTP, env-gated (`SVELTE_VITALS_UI`), no change when unset → Tasks 4 (sets env) + 5 (gated POST). ✅
- In-memory store keyed by route, flattened snapshot, route-stamping → Task 1. ✅
- Middleware `/`, `/ingest`, `/events` (SSE) → Task 3. ✅
- Live-update script: SSE → re-fetch → swap `.wrap` → re-run core init → Task 2 (`LIVE_SCRIPT`). ✅
- Core unchanged; vite-only; no cli dep; ESM-only → all tasks (core only imported). ✅
- Rendered-model coverage caveats (SEO head, visited routes) → Task 6 docs state them. ✅
- `@svelte-vitals/vite` minor changeset; no core changeset → Task 6. ✅
- Docs en + ja → Task 6. ✅

**Placeholder scan:** No "TBD"/"add error handling"/"similar to". The one prose carryover (Task 4 "existing closeBundle body unchanged") is explicit about preserving exact existing code rather than re-printing the unchanged ~30-line build body — intentional, since reprinting risks drift; the instruction is to move it verbatim. Every new code path has complete code.

**Type consistency:** `createStore(): FindingsStore` (Task 1) is consumed by `installUiMiddleware` (Task 3). `renderDashboard(results, config, meta)` (Task 2) is consumed by Task 3. `installUiMiddleware(server, config, version)` (Task 3) is consumed by Task 4. `postIngest(origin, route, results)` and `analyzeAndWarn(html, route, origin, rules, config, lastSignature)` (Task 5) match the ingest contract `{ route, results }` from Task 3's middleware. `svelteVitals(): Plugin | Plugin[]` (Task 4) — the no-`ui` path returns a single `Plugin`, preserving existing callers/tests. The env flag string `'SVELTE_VITALS_UI'` and endpoint paths (`/__svelte-vitals`, `/ingest`, `/events`) are identical across Tasks 3, 4, 5.
