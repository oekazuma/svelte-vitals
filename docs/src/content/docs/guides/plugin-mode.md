---
title: Plugin mode
description: Integrate svelte-vitals into vite build to analyze prerendered HTML at build time.
sidebar:
  order: 4
---

`@svelte-vitals/vite` is a Vite / SvelteKit plugin that piggybacks on `vite build`, parses the **prerendered HTML's `<head>`**, and runs the same SEO and Performance rules as the CLI. Because it inspects the real HTML output, it is library-agnostic. Build mode additionally scans your `.svelte` source directly under `src/` for Correctness, Security, Architecture, and the two component-scoped Performance rules (PERF009/PERF010 — heavy/namespace imports) — the same component-scoped rules the CLI runs, enabled by default. The build fails when findings reach the `failOn` threshold.

> **ESM-only** (Node 18+). Ships ES modules only; `require()` is unsupported by design.

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

| Option           | Type                                | Default      | Description                                    |
| ---------------- | ----------------------------------- | ------------ | ---------------------------------------------- |
| `failOn`         | `'critical' \| 'warning' \| 'info'` | `'critical'` | Minimum severity that fails the build          |
| `report`         | `'console' \| 'json' \| false`      | `'console'`  | Output format for the analysis report          |
| `outFile`        | `string`                            | —            | Write the JSON report to a file at this path   |
| `rules`          | `string[]`                          | —            | Rule IDs to enable (all others disabled)       |
| `metaComponents` | `string[]`                          | —            | Custom component names that emit head metadata |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'`        | `'pass'`     | How to treat dynamically-set metadata          |
| `prerenderDir`   | `string`                            | —            | Override the prerendered-pages directory       |

## Reusing a config file

`@svelte-vitals/vite` doesn't read `svelte-vitals.config.*` on its own — import it inside `vite.config.ts` and spread it into the plugin options instead. See [Config file § Using the config file with the Vite plugin](/svelte-vitals/guides/configuration/#using-the-config-file-with-the-vite-plugin) for the pattern.

## Scope

Only **prerendered** routes are analyzed. For SSR or dynamic routes, use the `svelte-vitals` CLI instead.

## How it works

During `vite build`, after SvelteKit prerenders your pages, `@svelte-vitals/vite` locates the output HTML files, parses each page's `<head>`, and runs the full rule set. If any finding meets the `failOn` threshold, the build process exits with a non-zero code.

## Dev overlay

At dev time, `@svelte-vitals/vite` also injects live warnings into the browser via `transformPageChunk`. See [Dev overlay](/svelte-vitals/guides/dev-overlay/) for details.
