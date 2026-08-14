# @svelte-vitals/vite

[![npm](https://img.shields.io/npm/v/@svelte-vitals/vite)](https://www.npmjs.com/package/@svelte-vitals/vite)

Vite/SvelteKit plugin for [svelte-vitals](https://github.com/oekazuma/svelte-vitals). Two things in one package:

- **Build-time gate** — piggybacks on `vite build`, parses the **prerendered HTML's `<head>`**, and runs the same rule engine as the CLI (SEO, Performance, Correctness, Security, Architecture, Accessibility) — library-agnostic, because it inspects the real output. Fails the build when findings reach `failOn`.
- **Live dev dashboard** — on by default during `vite dev`: a searchable, filterable code-health dashboard at `/__svelte-vitals/`, covering the whole project from startup via static analysis, refined to real rendered values as you browse.

> **ESM-only** (Node 22.13+). Ships ES modules only; `require()` is unsupported by design.

## Usage

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [sveltekit(), svelteVitals({ failOn: 'critical', report: 'console' })]
};
```

`vite dev` prints the dashboard's URL next to its own `Local:`/`Network:` lines. Add the `svelteVitalsHandle` hook (from `@svelte-vitals/vite/hooks`) to `src/hooks.server.ts` for per-route `measured` accuracy as you browse — the dashboard works without it too, from whole-project static analysis alone.

## Options

- `failOn` — minimum severity that fails the build (default `critical`).
- `report` — `'console' | 'json' | false` (default `console`).
- `outFile` — write the JSON report to a path.
- `rules` / `metaComponents` / `treatDynamicAs` — same as the CLI/core config.
- `weights` — per-category weight overrides for the combined Health score.
- `prerenderDir` — override the prerendered-pages directory.
- `cwd` — project root (defaults to the Vite config root).
- `ui` — serve the live dev dashboard (default `true`); pass `false` to keep only the build-time gate.

Only **prerendered** routes are analyzed at build time; for SSR/dynamic routes use the `svelte-vitals` CLI, or browse them in the live dashboard during `vite dev`.

See [Live dashboard](https://oekazuma.github.io/svelte-vitals/guides/dev-dashboard/) and [Plugin mode](https://oekazuma.github.io/svelte-vitals/guides/plugin-mode/) for the full picture.

## License

[MIT](https://github.com/oekazuma/svelte-vitals/blob/main/LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
