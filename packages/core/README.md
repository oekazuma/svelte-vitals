# @svelte-vitals/core

[![npm](https://img.shields.io/npm/v/@svelte-vitals/core)](https://www.npmjs.com/package/@svelte-vitals/core)
[![MIT](https://img.shields.io/npm/l/@svelte-vitals/core)](https://opensource.org/licenses/MIT)

Runtime-agnostic core for [svelte-vitals](https://github.com/oekazuma/svelte-vitals): shared types, the rule engine, scorer, reporter, and the SEO rule set.

This package is **mode-independent** and contains no I/O — it operates on a normalized `ResolvedHead[]` intermediate representation, so the same rules run unchanged whether heads come from static source analysis (the `svelte-vitals` CLI) or from prerendered HTML (the `@svelte-vitals/vite` plugin). It has zero runtime dependencies and no `node:` imports.

> Most users don't depend on this directly — install [`svelte-vitals`](https://www.npmjs.com/package/svelte-vitals) instead. This package is for building tools on top of the shared engine.

## License

[MIT](https://github.com/oekazuma/svelte-vitals/blob/main/LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
