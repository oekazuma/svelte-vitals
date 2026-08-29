---
'@svelte-vitals/core': patch
---

Lowercase tag names in `collectAriaElements`.

Svelte accepts a mixed-case regular element (`<dIv>`; a leading capital instead makes Svelte treat
the tag as a component reference, so `<Div>` was never affected), but the collector recorded
`node.name` verbatim while `collectElements` already normalized with `.toLowerCase()`. The rules
reading `ariaElements` were affected unevenly: `a11y/invalid-role`,
`a11y/unknown-aria-attribute`, and `a11y/invalid-aria-value` never key off `e.tag` and were unaffected.
`a11y/disallowed-aria-props` and `a11y/deprecated-aria` look up `HTML_SPEC.elements` by tag through
`roleCandidates`, so a mixed-case tag missed the lookup and silently dropped every finding for that
element. `a11y/required-aria-props`'s `HOST_SUPPLIED` table checks `e.tag`/`e.inputType`/`e.selectKind`
to recognize a native control (a checkbox `<input>`, a combobox `<select>`) that already supplies a
required prop natively — a mixed-case tag missed that recognition too, but in the other direction:
the prop was wrongly reported missing on an element that already had it. Normalizing at collection
fixes every consumer at once.
