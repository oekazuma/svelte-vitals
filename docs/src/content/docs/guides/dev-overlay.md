---
title: Dev overlay
description: Get live SEO warnings in the dev server without waiting for a build.
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

Enable a live dashboard at `/__svelte-vitals/` during `vite dev` — the same report the CLI's `--reporter html` produces, updating in place as you navigate your app.

```js
// vite.config.{js,ts}
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [svelteVitals({ ui: true }) /* , sveltekit() */]
};
```

It is fed by the dev handle (the same one the overlay above uses), so keep `svelteVitalsHandle()` in `src/hooks.server.ts`. Open `http://localhost:5173/__svelte-vitals/` and browse your app: each visited route's rendered `<head>` is analyzed and the dashboard updates live.

Live updates only flow over a loopback origin (`localhost`, `127.0.0.1`, `[::1]`). When you run `vite dev --host` and open the app via a LAN IP, the handle skips the ingest POST (a guard against a spoofed `Host` header), so the dashboard stays empty — open it from `localhost` instead. Set `SVELTE_VITALS_DEBUG=true` to log when an ingest is skipped.

Like the overlay, this is dev-only and rendered-based: it covers the SEO `<head>` rules for the routes you visit. For a whole-project report (all routes, Performance, site checks), run `npx svelte-vitals` or `npx svelte-vitals --reporter html`.
