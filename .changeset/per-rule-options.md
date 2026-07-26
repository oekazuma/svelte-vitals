---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Rule settings now accept an object form, `{ severity?, options? }`, alongside the existing
`'off' | Severity` strings. Options let a project move a rule's thresholds or extend its
built-in lists, globally or per path via `overrides`.

Configurable rules: `architecture/prop-count` and `architecture/component-size` (`max`),
`seo/title-length` and `seo/description-length` (`min`, `max`), `performance/heavy-import`
(`packages`), `performance/preconnect` (`origins`). List and map options are **added** to the
built-in set, never replacing it, so new built-in entries keep reaching every project.

Two notes for existing setups. Values in the config file's `rules` map are now validated —
an invalid severity that was previously passed through unchecked is now a fatal config error.
And the `RuleSetting` union has gained a member, which can make an exhaustive `switch` over it
in external TypeScript code non-exhaustive.

The `svelteVitals()` Vite plugin's `rules` and `overrides` options get the same validation as
the config file: an unknown rule id, an unknown option key, or an option value outside its
declared type/bounds is now a fatal, synchronous error at plugin construction, instead of being
silently ignored (an unknown id) or silently dropped (an invalid option).

In an `overrides[].rules` entry, a rule-id key and a category key are resolved independently:
a rule-id key that carries no `severity` (an options-only object, e.g.
`'architecture/prop-count': { options: { max: 4 } }`) does not shadow a category key's
severity in the same entry — the category's severity still applies, alongside the rule's
options. Only a rule-id key that _does_ specify a `severity` beats the category key, as before.
