---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add three info-level a11y rules for small markup-conformance gaps.

`a11y/no-duplicate-dt` flags a `<dt>` whose static text duplicates an earlier `<dt>` in the same `<dl>` — the spec says one name should not appear twice, and a duplicate is usually a copy-paste error where two descriptions were meant to share one term. Names under logic blocks, with non-static content, or in nested lists' own scopes are exempt.

`a11y/abbr-title` flags an `<abbr>` with no `title` (blank included) giving the expansion. This is a best-practice nudge, not a conformance check: an expansion given in the surrounding prose is correct markup this rule cannot see — that known false-positive class is silenced with the inline `svelte-vitals-disable-next-line` directive, which the docs page shows.

`a11y/pattern-title` flags an `<input pattern>` with no `title` (blank included) describing the expected format — browsers surface the title in the validation error, so without it a failed submit says only that the value is wrong. Only judged where `pattern` is effective (no `type`, or a literal type in the spec's applies-to set).

All three treat expression-valued attributes as unknowable and stay silent, matching the other element rules.
