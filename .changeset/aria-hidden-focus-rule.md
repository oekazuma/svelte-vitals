---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add the warning-level `a11y/aria-hidden-focus` rule: a keyboard-focusable element hidden from assistive technology by a literal `aria-hidden="true"` — on the element itself or an ancestor. A screen reader user can tab onto such a control while their reader announces nothing for it, and the author cannot see the defect because `aria-hidden` changes nothing visually; WAI-ARIA forbids hiding focusable content this way.

Focusable uses the same element classification as `a11y/interactive-nesting`. An expression-valued `aria-hidden` is unknowable and stays silent, so the legitimate toggle pattern (`aria-hidden={!open}`) never triggers the rule. Consistently-hidden states are exempt as not focusable: a negative or expression `tabindex` (`<button tabindex="-1" aria-hidden="true">` is the documented remediation), a `disabled` form control, and anything at or under an `inert` element. The recommendation points at `inert` for hiding inactive regions such as modal backdrops.
