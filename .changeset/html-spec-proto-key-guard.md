---
'@svelte-vitals/core': patch
---

Guard HTML spec lookups against `Object.prototype` keys.

`HTML_SPEC.elements` is `JSON.parse` output, so it inherits `Object.prototype`. A component
containing an element like `<constructor>` — a legal, if unusual, tag name — indexed straight into
`Object`'s own function instead of getting `undefined`, and the subsequent property access threw.
`a11y/deprecated-attr` crashed outright; when a rule throws, the runner drops it from scoring
silently rather than failing the run, so the finding loss was easy to miss. `a11y/deprecated-element`
traversed the same unguarded lookup without crashing — its `.obsolete === true` check happened to
read `undefined` off the `Object` function and land on a correct-by-accident `false`. `a11y/deprecated-aria`
and `a11y/disallowed-aria-props` shared the same unguarded lookup pattern in `roleCandidates`, and the
content-model checker and the attribute-name lookup each had one too — none of them crashed today, but
all were one field access away from it. All lookups by an author-controlled tag or attribute name now
check `Object.hasOwn` first, matching the existing convention this repo already uses elsewhere for
attacker-shaped keys.
