---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Known-limitation sweep for the a11y rules:

- `a11y/use-list` now needs **two or more** bullet items under one parent (sibling text nodes, or sibling elements each opening with a bullet) before it reports — a lone `- note` line is a dash, not a list (WCAG H48 is about sequences). Projects with a single planted bullet line lose that finding.
- `a11y/unknown-aria-attribute` and `a11y/invalid-aria-value` anchor their findings at the element's start tag instead of the attribute's line, so one `svelte-vitals-disable-next-line` above a multi-line element now reaches them. Recorded suppressions-file entries are unaffected (the key carries no line).
- `a11y/invalid-aria-value` rejects an empty token list (`aria-relevant=""`): a token list is one or more tokens.
- `a11y/required-aria-props` no longer asks a native combobox for `aria-expanded`/`aria-controls` — the host supplies both (HTML-AAM). That is a `<select role="combobox">` without `multiple`/`size > 1` and an `<input list role="combobox">` whose type is omitted or text/search/tel/url/email; `<select multiple>`, `<select size="2">`, and other input types still owe them.
- `a11y/no-missing-id-ref` now follows every ARIA id-reference property (`aria-owns`, `aria-details`, `aria-errormessage`, `aria-flowto`) and HTML's `list`, `headers`, `form`, `popovertarget`, `commandfor`, not only `for`/`aria-labelledby`/`aria-describedby`/`aria-controls`/`aria-activedescendant`.
- `svelte-vitals explain` prints a `string-list` option's entry grammar where one is declared (`each entry a bare tag name …`).

Two of these widen an existing rule rather than adding one, and a rule's findings are suppressed by `id::route::location` without a line — so a project with a recorded suppressions entry for `a11y/no-missing-id-ref` or `a11y/invalid-aria-value` at a location will find the new idref attributes and the empty-token-list case already silenced there.
