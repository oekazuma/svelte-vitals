---
title: Config file
description: Configure svelte-vitals once with svelte-vitals.config, instead of repeating flags.
sidebar:
  order: 3.5
---

Instead of repeating `--rules`, `--ignore`, `--fail-on`, and `--weights` on every invocation, put them in a `svelte-vitals.config` file at your project root. The CLI and the [MCP server](/svelte-vitals/guides/mcp/) both read it automatically (the MCP server inherits it because it calls the same `analyzeProject` function as the CLI).

## Where it lives

svelte-vitals looks for one of these, in this order, **in the analyzed directory only** (no upward search into parent directories — the analyzed directory is the SvelteKit project root, the same place `vite.config.*` lives):

1. `svelte-vitals.config.mjs`
2. `svelte-vitals.config.js`
3. `svelte-vitals.config.ts`

The first match wins. If none exist, svelte-vitals runs with its built-in defaults, same as before this feature existed.

## Example

```js
// svelte-vitals.config.mjs
import { defineConfig } from 'svelte-vitals';

export default defineConfig({
  treatDynamicAs: 'warn',
  metaComponents: ['Seo'],
  rules: {
    SEO008: 'off'
  },
  failOn: 'warning',
  weights: {
    seo: 2
  }
});
```

`defineConfig` is just an identity helper that merges your object over the built-in defaults — it exists for type-checking and editor autocomplete, not because it does anything magic. A plain object default export works exactly the same:

```js
// svelte-vitals.config.mjs
export default {
  failOn: 'warning'
};
```

Import `defineConfig` from `svelte-vitals` — the package you actually installed. (It is re-exported from `@svelte-vitals/core` too, but that package is normally a transitive dependency, and a strict `node_modules` layout — pnpm's default — won't let your project resolve a transitive dependency directly.)

## Available options

| Option           | Type                                                         | Default            | Description                                                                                |
| ---------------- | ------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------ |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'`                                 | `'pass'`           | How to score routes where a metadata value is set dynamically                              |
| `metaComponents` | `string[]`                                                   | `[]`               | Custom component names that emit `<head>` metadata                                         |
| `rules`          | `Record<string, 'off' \| 'critical' \| 'warning' \| 'info'>` | `{}`               | Per-rule overrides — disable a rule or change its severity                                 |
| `failOn`         | `'critical' \| 'warning' \| 'info'`                          | `'critical'`       | Minimum severity that fails the run (exit code `1`)                                        |
| `weights`        | `Partial<Record<Category, number>>`                          | every category `1` | Per-category weights for the combined [Health score](/svelte-vitals/guides/health-report/) |

`Category` is `'seo' | 'performance' | 'correctness' | 'security' | 'architecture'`.

## Precedence

For each field, the first of these that is set wins: **CLI flag > config file > built-in default**. This is per field, not all-or-nothing — a one-off `--fail-on info` does not discard the rest of your config file.

One exception: `rules` is replaced as a whole, not merged key-by-key. If you pass `--rules` or `--ignore` on the command line, the flag-built rule set replaces the config file's `rules` entirely for that run — it does not merge with it.

## Validation

- **Invalid and svelte-vitals stops (exit `2`)**: the file can't be loaded (syntax error, no default export, or a `.ts` file on a Node version that can't load it — see below); an unknown rule id inside `rules`; an unknown category or a negative/non-numeric value inside `weights`.
- **Invalid but ignored, with a warning (analysis still runs)**: an unrecognized `treatDynamicAs` or `failOn` value (falls back to flag/default); an unrecognized top-level key (forward-compatible with future config fields).

## TypeScript configs

`svelte-vitals.config.ts` works out of the box on **Node 22.18+ or 23.6+** (that's when Node's native TypeScript type-stripping became unflagged). svelte-vitals' floor is Node 22.13, so on **22.13–22.17** loading a `.ts` config fails with a descriptive error; pick one of:

- Upgrade to Node 22.18+ (still the same 22 LTS line).
- Re-run with `node --experimental-strip-types`.
- Rename the file to `.mjs` or `.js` — plain JavaScript works on every supported Node version, with no flag.

## Using the config file with the Vite plugin

`@svelte-vitals/vite` does not read `svelte-vitals.config.*` itself — it intentionally doesn't depend on the `svelte-vitals` CLI package, so there's no loader to wire in. Since `vite.config.ts` already runs through Vite's own TypeScript loading, import your config file there and spread it into the plugin options directly:

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';
import config from './svelte-vitals.config.js';

export default {
  plugins: [sveltekit(), svelteVitals({ ...config, report: 'console' })]
};
```

This keeps one source of truth for `treatDynamicAs` / `metaComponents` / `rules` / `failOn` across the CLI and the Vite plugin. (The plugin has no concept of Health `weights` — that field is ignored if present.)
