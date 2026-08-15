---
title: Plugin mode
description: Integrate svelte-vitals into vite build to analyze prerendered HTML at build time.
sidebar:
  order: 1
---

`@svelte-vitals/vite` piggybacks on `vite build`, parses the **prerendered HTML**, and runs the same SEO, Performance, and (landmark/id) Accessibility rules as the CLI. Inspecting the real output makes it library-agnostic.

It also scans `src/` — components, runes modules (`.svelte.ts`/`.svelte.js`), route and hooks files — for Correctness, Security, Architecture, the rest of Accessibility, and the component-scoped Performance rules, enabled by default. The build fails when findings reach the `failOn` threshold.

> **ESM-only** (Node 22.13+). Ships ES modules only; `require()` is unsupported by design.

## Installation

```bash
npm install --save-dev @svelte-vitals/vite
# or
pnpm add -D @svelte-vitals/vite
```

## Setup

Add `svelteVitals` to your `vite.config.ts`:

```ts vite.config.ts
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

The **HTML** check covers **prerendered** routes only: SSR and dynamic routes have no build output, so nothing here reads their rendered HTML. The `svelte-vitals` CLI covers those routes by source analysis instead, and the [live dashboard](/guides/dev-dashboard) gets a rendered reading of them when you browse during `vite dev`. The source scan applies project-wide regardless of how a route renders.

## How it works

During `vite build`, after SvelteKit prerenders your pages, `@svelte-vitals/vite` locates the output HTML files and parses each page's `<head>` and body; alongside that it scans `src/` for the source-level rules. Because the HTML is the real shipped output, dynamic values are already resolved — a `<title>` the CLI can only mark `↯ dynamic` is checked here for what it actually says. If any finding meets the `failOn` threshold, the build process exits with a non-zero code.

## Live dashboard

At dev time, `@svelte-vitals/vite` also serves a live dashboard at `/__svelte-vitals/`, on by default. See [Live dashboard](/guides/dev-dashboard) for details.
