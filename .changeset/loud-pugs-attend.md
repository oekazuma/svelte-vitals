---
'@svelte-vitals/core': patch
---

Stop `a11y/accessible-name` and `a11y/label-has-control` reporting content they cannot see.

Both rules already skip content they cannot resolve — an expression, a component, `{@render}`,
`{@html}` — but four routes were read as _absent_ rather than _unknowable_:

- **A `<slot>` or `<svelte:fragment>`** supplies content from the parent, so `<button><slot /></button>`
  and `<label>Name<slot name="control" /></label>` were flagged despite being named and associated
  by whoever renders them.
- **A hyphenated custom element** may be form-associated (and so labelable) and may name its host
  from a shadow root, so `<label>Name <my-input></my-input></label>` was flagged.
- **An expression-valued `alt`** was invisible while an expression `aria-label` was accepted, so
  the idiomatic `<a href="/about"><img src="/logo.png" alt={siteName} /></a>` was "unnamed".
- **A `<label>` naming a `button` or `input type="image"`**, by wrapping it or by pointing `for` at
  its `id`, is a step in the name computation ahead of the element's own subtree. `<a>` has no such
  step, so links are unchanged. It counts only when the label itself contributes something — a
  provably empty label leaves the control unnamed and still reported — and a wrapping label reaches
  only the first labelable element inside it. The `for` route is same-file only.

All four narrow detection, so recorded suppressions keep matching.
