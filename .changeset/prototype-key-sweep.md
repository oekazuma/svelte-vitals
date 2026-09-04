---
'@svelte-vitals/core': patch
---

Guard three remaining `Object.prototype`-keyed lookups. A page whose JSON-LD `@type` is a name like `constructor` no longer crashes `seo/json-ld-required-props` (a crashed rule drops out of scoring project-wide, raising Health); a rule option keyed by such a name is now rejected as `unknown option` instead of being accepted silently or reported with the wrong message; and `architecture/reserved-name-placement` no longer throws when a directory named like that is declared in only one of its placement maps.
