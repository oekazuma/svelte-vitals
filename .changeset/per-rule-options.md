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
