---
title: correctness/base-path-navigation · Root-relative navigation under a base path
description: 'A hardcoded root-relative link resolves against the domain root, not kit.paths.base — under a base path it lands outside the app and 404s in production.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Only projects that configure a base path are checked — via `sveltekit({ paths: { base } })` in the Vite config, which takes precedence, or `kit.paths.base` in `svelte.config.*`. In those, the rule flags navigation written as a hardcoded root-relative literal on three surfaces:

```svelte
<a href="/about">About</a>
```

```js
goto('/dashboard');
redirect(303, '/login');
```

Under `base: '/docs'` these target `/about`, `/dashboard`, and `/login` on the domain root — outside the app — and 404 in production.

The base path is read the way SvelteKit reads it: from `sveltekit({ paths: { base } })` in your Vite config when present (which makes `svelte.config` irrelevant, as SvelteKit itself warns), otherwise from `kit.paths.base` in `svelte.config.js`/`.ts`.

A computed base — the common `base: dev ? '' : '/repo'` deploy form — still opens the gate, since the app is served under a base in at least one environment. No base, or an explicit `base: ''`, keeps the rule silent.

Detection is literal-only, which means the correct forms are never flagged: `href="{base}/about"`, `href={resolve('/about')}`, `goto(resolve('/about'))`, and ``goto(`${base}/about`)`` are all dynamic expressions, not string literals.

## Why it matters

The break is invisible where you develop it: a base path usually applies only in the deployed environment, so locally `base` is `''` and every hardcoded link works. Nothing else catches it either — the compiler sees an ordinary attribute, and `svelte-check` types the string, not what it resolves to. It surfaces as "every link 404s" after deploy.

## How to fix

Wrap the path in `resolve()` from `$app/paths`:

```svelte
<script>
  import { resolve } from '$app/paths';
</script>

<a href={resolve('/about')}>About</a>
```

```js
import { resolve } from '$app/paths';
import { goto } from '$app/navigation';
import { redirect } from '@sveltejs/kit';

goto(resolve('/dashboard')); // in a component or a .svelte.ts module
redirect(303, resolve('/login')); // in a load function or form action
```

`resolve()` (SvelteKit 2.26+) prefixes the base path for you, and also populates route parameters when you pass a route ID. It supersedes both `base` and `resolveRoute`, which are deprecated.

## Limitations

Not covered:

- `<form action="/…">`, `fetch('/api/…')`, and static assets (`<img src="/logo.png">`, `<link href>`) — assets break the same way but are fixed with `asset()` rather than `resolve()`, so they are left to a future rule.
- Dynamic paths of any kind, `<svelte:element this="a">`, and namespace-imported `goto`/`redirect` (`import * as nav from '$app/navigation'`).
- A `sveltekit()` argument that cannot be read statically, such as an imported config object — the rule stays silent rather than guessing.
- `goto()` in a plain `.ts`/`.js` module: only `.svelte`, `.svelte.ts` and `.svelte.js` are read for component facts.
- `redirect()` in `src/hooks.client.ts` or `src/hooks.ts`, which fall outside the Kit-module collector's file set.

## Disabling

```js svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/base-path-navigation': 'off'
  }
};
```
