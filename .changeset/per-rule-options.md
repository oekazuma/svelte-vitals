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
built-in set rather than discarding it, so new built-in entries keep reaching every project; in a
map, a key that already exists built-in keeps its entry and takes the configured value.

Two notes for existing setups. Values in the config file's `rules` map are now validated —
an invalid severity that was previously passed through unchecked is now a fatal config error.
And the `RuleSetting` union has gained a member, which can make an exhaustive `switch` over it
in external TypeScript code non-exhaustive.

The `svelteVitals()` Vite plugin's `rules` and `overrides` options get the same validation as
the config file — both funnel through core's `validateRuleSetting`: an unknown rule id, an
invalid `severity`, an unrecognized key in the object form, an unknown option key, or an option
value outside its declared type/bounds is now a fatal, synchronous error at plugin construction,
instead of being silently ignored (an unknown id) or silently dropped (an invalid option). A
`vite.config.js` gets no help from TypeScript, so a typo there previously left the rule at its
built-in severity with no signal at all.

`explain_rule` (`@svelte-vitals/mcp`) now reports a rule's configurable options — name, kind,
default, bounds, and whether the value replaces or extends the default — in both its text and
`structuredContent`. An agent that reads a finding as a threshold disagreement rather than a
defect can name the knob without leaving the tool loop.

In an `overrides[].rules` entry, a rule-id key and a category key are resolved independently:
a rule-id key that carries no `severity` (an options-only object, e.g.
`'architecture/prop-count': { options: { max: 4 } }`) does not shadow a category key's
severity in the same entry — the category's severity still applies, alongside the rule's
options. Only a rule-id key that _does_ specify a `severity` beats the category key, as before.
