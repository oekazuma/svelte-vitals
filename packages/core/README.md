# @svelte-vitals/core

[![npm](https://img.shields.io/npm/v/@svelte-vitals/core)](https://www.npmjs.com/package/@svelte-vitals/core)
[![MIT](https://img.shields.io/npm/l/@svelte-vitals/core)](https://opensource.org/licenses/MIT)

Runtime-agnostic core for [svelte-vitals](https://github.com/oekazuma/svelte-vitals): shared types, the rule engine, scorer, and reporters, plus the full rule set across six categories — SEO, Performance, Correctness, Security, Architecture, Accessibility.

This package is **mode-independent** and contains no I/O — it operates on a normalized `ResolvedHead[]` intermediate representation, so the same rules run unchanged whether heads come from static source analysis (the `svelte-vitals` CLI) or from prerendered HTML (the `@svelte-vitals/vite` plugin). It has zero runtime dependencies and no `node:` imports.

> Most users don't depend on this directly — install [`svelte-vitals`](https://www.npmjs.com/package/svelte-vitals) instead. This package is for building tools on top of the shared engine.

> **ESM-only** (Node 24.16+). Ships ES modules only; `require()` is unsupported by design.

## Entry points

| Entry                          | Contents                                                                                            | Stability                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `@svelte-vitals/core`          | `defineConfig` and the config types; the `JsonReport` types for reading a report                    | Follows semver.                                                               |
| `@svelte-vitals/core/internal` | The engine, rules, fact collection, reporters, and scoring — what the CLI and the Vite plugin share | **No guarantee. Anything here may change in any release, including a patch.** |

Reach for `/internal` only if you accept pinning an exact version. If something there is what you
actually need, open an issue — the point of the split is that promoting a name into the stable
entry is an additive change.

## License

[MIT](https://github.com/oekazuma/svelte-vitals/blob/main/LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
