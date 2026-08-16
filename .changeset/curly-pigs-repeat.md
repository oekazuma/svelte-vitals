---
'@svelte-vitals/core': patch
---

Stop three a11y ARIA rules reporting valid markup.

- `a11y/invalid-role` treated a fallback list as invalid when any token was unknown. A user agent
  resolves the attribute to the first token naming a concrete role, so `role="button bogus"` and
  `role="widget checkbox"` are correct markup — the list form exists precisely so a value can name
  a role older user agents do not know. Only a value that resolves to nothing is reported now, and
  its message names that rather than echoing one token's verdict onto the whole literal.
- `a11y/invalid-role` and `a11y/unknown-aria-attribute` rejected names ARIA 1.3 added after the
  pinned ARIA data snapshot but that browsers already ship: the roles `comment`, `image`,
  `sectionheader`, `sectionfooter`, `suggestion`, and the attributes `aria-colindextext`,
  `aria-rowindextext`. `image` is the sharpest — it is now the spec's preferred synonym for `img`.
- `a11y/required-aria-props` demanded `aria-selected` on `role="option"` and `role="treeitem"`,
  an ARIA 1.1 requirement neither 1.2 nor the 1.3 draft carries, so idiomatic listbox and tree
  markup was flagged.

All three changes narrow detection, so recorded suppressions keep matching.
