---
title: correctness/base-path-navigation · Root-relative navigation under a base path
description: 'A hardcoded root-relative link resolves against the domain root, not kit.paths.base — under a base path it lands outside the app and 404s in production.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Only projects that configure `kit.paths.base` are checked. In those, the rule flags navigation written as a hardcoded root-relative literal on three surfaces:

```svelte
<a href="/about">About</a>
```

```js
goto('/dashboard');
redirect(303, '/login');
```

Under `base: '/docs'` these target `/about`, `/dashboard`, and `/login` on the domain root — outside the app — and 404 in production.

The base path is read the way SvelteKit reads it: from the `sveltekit({ paths: { base } })` argument in your Vite config when it has one (which makes `svelte.config` irrelevant, as SvelteKit itself warns), otherwise from `kit.paths.base` in `svelte.config.js`/`.ts`. A base that the config computes — the common `base: dev ? '' : '/repo'` deploy form — still opens the gate: the app is served under a base in at least one environment. An absent base, or an explicit `base: ''`, keeps the rule silent entirely.

Detection is literal-only, which means the correct forms are never flagged: `href="{base}/about"`, `href={resolve('/about')}`, `goto(resolve('/about'))`, and ``goto(`${base}/about`)`` are all dynamic expressions, not string literals.

## Why it matters

The break is invisible where you develop it. A base path is usually applied only in the deployed environment, so locally `base` is `''` and every hardcoded link works. Nothing else catches it either: the Svelte compiler sees an ordinary attribute, and `svelte-check` type-checks the string, not what it resolves to at runtime. The bug surfaces as "every link 404s" after deploy.

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

`<form action="/…">`, `fetch('/api/…')`, and static assets (`<img src="/logo.png">`, `<link href>`) are not covered — assets break the same way but are fixed with `asset()` rather than `resolve()`, so they are left to a future rule. Dynamic paths of any kind are out of static reach, as are `<svelte:element this="a">` and namespace-imported `goto`/`redirect` (`import * as nav from '$app/navigation'`). If your Vite config passes a `sveltekit()` argument that cannot be read statically — an imported config object, for example — the rule stays silent rather than guessing. A `goto()` written in a plain `.ts`/`.js` module is never scanned either, since only `.svelte`, `.svelte.ts`, and `.svelte.js` files are read for component facts, and neither are `redirect()` calls in `src/hooks.client.ts` or `src/hooks.ts`, which fall outside the Kit-module collector's file set.

## Disabling

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/base-path-navigation': 'off'
  }
};
```
