---
title: Plugin mode
description: Integrate svelte-vitals into vite build to analyze prerendered HTML at build time.
sidebar:
  order: 1
---

`@svelte-vitals/vite` hooks into `vite build`, parses the prerendered HTML, and runs the same SEO, Performance, and Accessibility rules as the CLI. The one exception is `a11y/doctype`, which reads `src/app.html` and stays CLI-only. Because it inspects the real output, it works with any metadata library.

It also scans `src/` for Correctness, Security, Architecture, the rest of Accessibility, and the component-scoped Performance rules: components, runes modules (`.svelte.ts`/`.svelte.js`), route files and hooks files. That scan is on by default. The build fails when findings reach the `failOn` threshold.

> **ESM-only** (Node 24.16+). Ships ES modules only; `require()` is unsupported by design.

## Installation

```bash
npm install --save-dev @svelte-vitals/vite svelte-vitals
# or
pnpm add -D @svelte-vitals/vite svelte-vitals
```

`svelte-vitals` and `@svelte-vitals/core` are peer dependencies of the plugin. Both packages resolve the rule engine from your project's install, so a version mismatch shows up as an install-time peer warning instead of a config that scans clean and then fails `vite build`. npm and pnpm auto-install missing peers, but declaring `svelte-vitals` explicitly keeps the version under your lockfile's control. With yarn, which does not auto-install peers, declaring it is required. Plug'n'Play users add `@svelte-vitals/core` too; classic yarn resolves it transitively.

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

| Option           | Type                                                         | Default      | Description                                                                                                  |
| ---------------- | ------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------ |
| `failOn`         | `'critical' \| 'warning' \| 'info'`                          | `'critical'` | Minimum severity that fails the build                                                                        |
| `report`         | `'console' \| 'json' \| false`                               | `'console'`  | Output format for the analysis report                                                                        |
| `outFile`        | `string`                                                     | —            | Write the JSON report to a file at this path                                                                 |
| `rules`          | `Record<string, 'off' \| 'critical' \| 'warning' \| 'info'>` | `{}`         | Per-rule overrides: disable a rule or change its severity                                                    |
| `metaComponents` | `string[]`                                                   | —            | Head-metadata components the analyzer cannot resolve; it follows resolvable in-repo components automatically |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'`                                 | `'pass'`     | How to treat dynamically-set metadata                                                                        |
| `weights`        | `Partial<Record<Category, number>>`                          | every `1`    | Per-category weights for the combined Health score in the report                                             |
| `prerenderDir`   | `string`                                                     | —            | Override the prerendered-pages directory                                                                     |
| `ui`             | `boolean`                                                    | `true`       | Serve the [live dashboard](/guides/dev-dashboard) during `vite dev`; `false` keeps only the build-time gate  |
| `cwd`            | `string`                                                     | Vite root    | Project root                                                                                                 |

## Config file

`@svelte-vitals/vite` reads `svelte-vitals.config.*` from the project root automatically. An explicit option above always wins over the config file's value. See [Config file § Using the config file with the Vite plugin](/guides/configuration#using-the-config-file-with-the-vite-plugin) for the precedence rules and how the live dashboard uses it too.

## Scope

The HTML check covers prerendered routes only. SSR and dynamic routes have no build output, so nothing here reads their rendered HTML. The `svelte-vitals` CLI covers those routes by source analysis instead, and the [live dashboard](/guides/dev-dashboard) gets a rendered reading of them when you browse during `vite dev`. The source scan applies project-wide regardless of how a route renders.

## How it works

During `vite build`, after SvelteKit prerenders your pages, `@svelte-vitals/vite` locates the output HTML files and parses each page's `<head>` and body; alongside that it scans `src/` for the source-level rules. Because the HTML is the real shipped output, dynamic values are already resolved. A `<title>` the CLI can only mark `↯ dynamic` is checked here for what it actually says. If any finding meets the `failOn` threshold, the build process exits with a non-zero code.

## Live dashboard

At dev time, `@svelte-vitals/vite` also serves a live dashboard at `/__svelte-vitals/`, on by default. See [Live dashboard](/guides/dev-dashboard) for details.
