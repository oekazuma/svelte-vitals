---
title: Plugin mode
description: Integrate svelte-vitals into vite build to analyze prerendered HTML at build time.
sidebar:
  order: 4
---

`@svelte-vitals/vite` is a Vite / SvelteKit plugin that piggybacks on `vite build`, parses the **prerendered HTML's `<head>`**, and runs the same SEO and Performance rules as the CLI. Because it inspects the real HTML output, it is library-agnostic. Build mode additionally scans your source under `src/` — components, runes modules (`.svelte.ts`/`.svelte.js`), and SvelteKit route/hooks files — for Correctness, Security, Architecture, and the component-scoped Performance (bundle) rules, the same file-scoped rules the CLI runs, enabled by default. The build fails when findings reach the `failOn` threshold.

> **ESM-only** (Node 22.13+). Ships ES modules only; `require()` is unsupported by design.

## Installation

```bash
npm install --save-dev @svelte-vitals/vite
# or
pnpm add -D @svelte-vitals/vite
```

## Setup

Add `svelteVitals` to your `vite.config.ts`:

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [sveltekit(), svelteVitals({ failOn: 'critical', report: 'console' })]
};
```

## Options

| Option           | Type                                                         | Default      | Description                                                                                                 |
| ---------------- | ------------------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------- |
| `failOn`         | `'critical' \| 'warning' \| 'info'`                          | `'critical'` | Minimum severity that fails the build                                                                       |
| `report`         | `'console' \| 'json' \| false`                               | `'console'`  | Output format for the analysis report                                                                       |
| `outFile`        | `string`                                                     | —            | Write the JSON report to a file at this path                                                                |
| `rules`          | `Record<string, 'off' \| 'critical' \| 'warning' \| 'info'>` | `{}`         | Per-rule overrides — disable a rule or change its severity                                                  |
| `metaComponents` | `string[]`                                                   | —            | Custom component names that emit head metadata                                                              |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'`                                 | `'pass'`     | How to treat dynamically-set metadata                                                                       |
| `weights`        | `Partial<Record<Category, number>>`                          | every `1`    | Per-category weights for the combined Health score in the report                                            |
| `prerenderDir`   | `string`                                                     | —            | Override the prerendered-pages directory                                                                    |
| `ui`             | `boolean`                                                    | `true`       | Serve the [live dashboard](/guides/dev-dashboard) during `vite dev`; `false` keeps only the build-time gate |
| `cwd`            | `string`                                                     | Vite root    | Project root                                                                                                |

## Config file

`@svelte-vitals/vite` reads `svelte-vitals.config.*` from the project root automatically — an explicit option above always wins over the config file's value. See [Config file § Using the config file with the Vite plugin](/guides/configuration#using-the-config-file-with-the-vite-plugin) for the precedence rules and how the live dashboard uses it too.

## Scope

Only **prerendered** routes are analyzed. For SSR or dynamic routes, use the `svelte-vitals` CLI instead.

## How it works

During `vite build`, after SvelteKit prerenders your pages, `@svelte-vitals/vite` locates the output HTML files, parses each page's `<head>`, and runs the full rule set. If any finding meets the `failOn` threshold, the build process exits with a non-zero code.

## Live dashboard

At dev time, `@svelte-vitals/vite` also serves a live dashboard at `/__svelte-vitals/`, on by default. See [Live dashboard](/guides/dev-dashboard) for details.
