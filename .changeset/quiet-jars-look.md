---
'@svelte-vitals/core': patch
---

Match the Svelte compiler on ARIA attribute casing.

HTML attribute names are case-insensitive — the parser lowercases them, so `ARIA-LABEL` and `ROLE`
reach the DOM as `aria-label` and `role`, and Svelte's own compiler judges them lowercased. The
collector matched the source casing instead, so a typo written in capitals (`ARIA-LABLE`, `ROLE="bogus"`)
was invisible to every ARIA rule while the compiler warned about it. Names are now matched
case-insensitively and reported lowercased, as the compiler reports them.

This widens detection: a project with an uppercase ARIA attribute or role that was silently
unchecked may see new findings — the same ones `svelte-check` already reports.

Recorded while here, with no behaviour change: this rule set deliberately follows the compiler over
the letter of the ARIA spec where the two disagree. The spec lists `undefined` as a value for
several boolean attributes and says a zero-length string should be treated as absent; the compiler
rejects both, and so do we. A rule that disagreed with the build you run would be noise rather than
a second opinion. The `a11y/invalid-aria-value` page now says so in both languages.
