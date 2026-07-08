---
title: Dev overlay
description: Get live SEO warnings in the dev server without waiting for a build.
sidebar:
  order: 5
---

`@svelte-vitals/vite` includes a SvelteKit `handle` hook — `svelteVitalsHandle` — that runs SEO analysis on every page served in the **development server**. Warnings are printed to the terminal as you navigate your app. No build step needed.

## How it works

`svelteVitalsHandle` uses SvelteKit's `transformPageChunk` to observe the fully-rendered HTML for each request. After the final chunk arrives, it parses the `<head>`, runs the active rules, and logs any findings via `console.warn`. The response is never modified or delayed — the analysis runs fire-and-forget and swallows its own errors, so it can never break the dev server.

The handle is a **no-op outside dev**. The `DEV` flag from `esm-env` resolves statically at build time, so the rule set is never built and the hook adds zero runtime cost in production.

Findings are deduplicated by signature: if the same route produces the same set of findings it only logs once, avoiding noise during hot-reloads.

## Setup

Install the package if you have not already:

```bash
npm install --save-dev @svelte-vitals/vite
# or
pnpm add -D @svelte-vitals/vite
```

Add `svelteVitalsHandle` to `src/hooks.server.ts`:

```ts
// src/hooks.server.ts
import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(svelteVitalsHandle());
```

If you already have other handles, place `svelteVitalsHandle()` alongside them inside `sequence`.

## Options

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

## Notes

- Only the rendered HTML `<head>` is analyzed — the same data the browser receives. Source-level dynamic values (e.g. `{data.title}`) are always resolved by the time the handle sees them, so `treatDynamicAs` is not applicable here.
- `failOn` is not used: the handle reports findings but never gates the request.
- Set `SVELTE_VITALS_DEBUG=true` to surface any internal analysis errors to the terminal.

## Live UI dashboard

Enable a live dashboard at `/__svelte-vitals/` during `vite dev` — the same report the CLI's `--reporter html` produces, updating in place as you work.

```js
// vite.config.{js,ts}
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [svelteVitals({ ui: true }) /* , sveltekit() */]
};
```

From the moment the dev server starts, the dashboard shows the **whole project**: a static analysis of all routes across every category (SEO, Performance, Correctness, Security, Architecture) runs asynchronously at startup — the same analysis as `npx svelte-vitals` — so you get the real project Health without visiting a single page. Saving a source file (anything under `src/` or `static/`, or a `svelte.config.*` / `svelte-vitals.config.*`) triggers a debounced re-analysis, and the dashboard refreshes itself.

On top of that static baseline, browsing your app refines the picture: it is fed by the dev handle (the same one the overlay above uses), so keep `svelteVitalsHandle()` in `src/hooks.server.ts`. Each visited route's rendered `<head>` is analyzed, and those live results replace the static ones for that route — a rendered page is closer to the truth, especially for dynamic values. Route headings carry a provenance badge: `measured` for routes whose findings come from a real rendered page, `static` for routes covered only by source analysis so far.

Live updates only flow over a loopback origin (`localhost`, `127.0.0.1`, `[::1]`). When you run `vite dev --host` and open the app via a LAN IP, the handle skips the ingest POST (a guard against a spoofed `Host` header), so visited routes won't refine to `measured` — open it from `localhost` instead. Set `SVELTE_VITALS_DEBUG=true` to log when an ingest is skipped.

If the whole-project analysis fails (for example the dev server root is not a SvelteKit project), the failure is logged with `console.warn` and the dashboard falls back to live-only mode — showing just the routes you visit — without ever breaking the dev server.

## Version drift

The dashboard footer shows `v<@svelte-vitals/vite version> · core v<@svelte-vitals/core version>`. That second number is the one that matters when comparing findings against the CLI: `svelte-vitals` (CLI) and `@svelte-vitals/vite` are versioned independently, both wrapping the shared `@svelte-vitals/core` rule engine — so it's possible for the two to resolve to _different_ core versions even when both packages themselves look up to date, and a rule added in a newer core release will only show up on whichever surface actually depends on it.

This is easy to hit without noticing through package-manager cooldown/pinning features — e.g. pnpm's [`minimumReleaseAge`](https://pnpm.io/settings#minimumreleaseage) can silently resolve a `pnpm dlx svelte-vitals@latest` run down to an older "mature" release (with an older core) than what `@svelte-vitals/vite` in your lockfile depends on. If the CLI and the dev overlay disagree on findings for the same project, run `svelte-vitals --version` and compare its `(core X.Y.Z)` against the dashboard footer's `core vX.Y.Z` — a mismatch there is the first thing to check before assuming a bug.
