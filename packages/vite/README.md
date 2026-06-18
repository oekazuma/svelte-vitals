# @svelte-vitals/vite

[![npm](https://img.shields.io/npm/v/@svelte-vitals/vite)](https://www.npmjs.com/package/@svelte-vitals/vite)

Vite/SvelteKit plugin for [svelte-vitals](https://github.com/oekazuma/svelte-vitals). It piggybacks on `vite build`, parses the **prerendered HTML's `<head>`**, and runs the same SEO rules as the CLI — library-agnostic, because it inspects the real output. Fails the build when findings reach `failOn`.

## Usage

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [sveltekit(), svelteVitals({ failOn: 'critical', report: 'console' })]
};
```

## Options

- `failOn` — minimum severity that fails the build (default `critical`).
- `report` — `'console' | 'json' | false` (default `console`).
- `outFile` — write the JSON report to a path.
- `rules` / `metaComponents` / `treatDynamicAs` — same as the CLI/core config.
- `prerenderDir` — override the prerendered-pages directory.

Only **prerendered** routes are analyzed; for SSR/dynamic routes use the `svelte-vitals` CLI.

## License

[MIT](https://github.com/oekazuma/svelte-vitals/blob/main/LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
