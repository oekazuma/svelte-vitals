---
'@svelte-vitals/core': patch
---

Correct four a11y rule texts that claimed more than their sources support.

- `a11y/doctype` said quirks mode breaks "accessibility tree behavior". The sourceable claim is
  about layout and the box model; no primary source ties quirks mode to the accessibility tree,
  and the WCAG criterion that used to justify markup-validity rules is obsolete and removed.
- `a11y/require-datetime` said "last Tuesday" cannot be parsed by assistive technology "so its
  meaning is lost to anything that isn't a sighted reader". A screen reader reads it exactly as a
  sighted reader does — what gets no date is every machine consumer, which is what the HTML spec's
  requirement is about.
- `a11y/interactive-nesting` said a nested control is "unreachable by keyboard" (no source found,
  and a nested `<button>` is Tab-focusable) and that the nesting "violates the HTML content model",
  which is false for its own role-based container arm, since a `<div>` may contain interactive
  descendants. The claim is now scoped to `<a href>` and `<button>`.
- `a11y/accessible-name` recommended `title` as a way to name a control. It stays a _detected_
  name source, because the name computation uses it — but it fails touch users, keyboard users,
  and many screen-reader and magnifier users, so it is no longer advice.
