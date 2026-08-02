---
title: performance/minify-disabled · Minification disabled
description: A build.minify:false left in vite.config ships unminified JS/CSS to production.
---

**Severity:** warning · **Category:** performance

## What it checks

Flags a Vite config whose production build disables minification with `build.minify: false`.

The CLI statically parses `vite.config.*` (the first file in Vite's own resolution order) and detects the literal form, with `satisfies`/`as` unwrapped:

- `export default { … }`
- `defineConfig({ … })`, including a same-file identifier passed as its argument
- a same-file alias export
- the CommonJS `module.exports = { … }` form

The Vite plugin instead reads the **resolved** config during `vite build`, so it also catches function-form and conditional configs — and never flags an override that doesn't apply to the actual build.

Not flagged: `minify: 'esbuild' | 'terser' | true`, and `minify` keys outside the `build` object. A project with no Vite config is not flagged **by the CLI**, which has nothing to parse; the plugin still judges the resolved value, including for an inline programmatic config.

An object spread that could override `minify` after the literal (`{ minify: false, ...prod }`) makes the value unknowable to static reading, so the CLI skips the finding. The plugin channel still judges the resolved value.

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

The two channels differ in strength. The CLI flags only the literal `build.minify: false`; a dynamic expression evaluating to `false` is invisible to it.

The Vite plugin judges the resolved value, so its verdict is exact for the build it runs in. When the offending config is dynamic, or the override comes from another plugin, the finding carries no line number and says the value came from the actual build. For an inline programmatic config, with no config file at all, it carries no file either.

## Disabling

If unminified production output is intentional, turn the rule off in your config:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'performance/minify-disabled': 'off'
  }
};
```
