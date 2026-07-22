---
title: performance/minify-disabled · Minification disabled
description: A build.minify:false left in vite.config ships unminified JS/CSS to production.
---

**Severity:** warning · **Category:** performance

## What it checks

Flags a Vite config whose production build disables minification with `build.minify: false`. The CLI statically parses `vite.config.*` (the first file in Vite's own resolution order) and detects the literal form — `export default { … }`, `defineConfig({ … })` (including a same-file identifier passed as its argument), a same-file alias export, or the CommonJS `module.exports = { … }` form — with `satisfies`/`as` unwrapped. The Vite plugin instead reads the **resolved** config during `vite build`, so it also catches function-form and conditional configs — and never flags an override that doesn't apply to the actual build.

Not flagged: `minify: 'esbuild' | 'terser' | true`, `minify` keys outside the `build` object, and projects without a Vite config. An object spread that could override `minify` after the literal (e.g. `{ minify: false, ...prod }`) makes the CLI's static reading of the value unknowable, so it conservatively skips the finding — the plugin channel still judges the actual resolved value regardless.

## Why it matters

Vite minifies with esbuild by default; turning it off is almost always a leftover from debugging a production issue. Unminified bundles are several times larger, so every route pays for it in download and parse time — and nothing in the toolchain warns you: the build succeeds and dev behaves identically.

## How to fix

Remove the override (the default already minifies), or scope it so production keeps minification:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    minify: mode === 'production' ? 'esbuild' : false
  }
}));
```

Note the CLI's static pass deliberately skips this conditional form — only the plugin channel (which sees the resolved value) verifies which branch your build actually takes.

## Limitations

The two channels differ in strength. The CLI flags only the literal `build.minify: false`; a dynamic expression that evaluates to `false` is invisible to it. The Vite plugin judges the resolved value, so its verdict is exact for the build it runs in; when the offending config is dynamic (or the override comes from another plugin), the finding carries no line number and its message says the value was resolved from the actual build, rather than pointing at a specific line. For an inline programmatic config (no config file at all), the finding carries no file either.

## Disabling

If unminified production output is intentional, turn the rule off in your config:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF012: 'off'
  }
};
```
