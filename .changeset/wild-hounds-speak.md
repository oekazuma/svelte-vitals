---
'@svelte-vitals/core': patch
---

Correct four a11y rule texts that claimed more than their sources support.

- `a11y/doctype` said quirks mode breaks "accessibility tree behavior". The sourceable claim is
  that quirks mode applies different layout and box-model rules than standards mode; no primary
  source ties it to the accessibility tree, and the WCAG criterion that used to justify
  markup-validity rules is obsolete and removed.
- `a11y/require-datetime` said "last Tuesday" cannot be parsed by assistive technology "so its
  meaning is lost to anything that isn't a sighted reader". A screen reader reads it exactly as a
  sighted reader does. What the element loses is its _standardized_ value: the text is not a valid
  date/time string, so `<time>` exposes no date and a consumer that wants one is left guessing at
  the prose.
- `a11y/interactive-nesting` said a nested control is "unreachable by keyboard" (no source found,
  and a nested `<button>` is Tab-focusable) and that the nesting "violates the HTML content model",
  which is false for its own role-based container arm, since a `<div>` may contain interactive
  descendants. The claim is now scoped to `<a href>` and `<button>`.
- `a11y/accessible-name` recommended `title` as a way to name a control. It stays a _detected_
  name source, because the name computation uses it — but it fails touch users, keyboard users,
  and many screen-reader and magnifier users, so it is no longer advice.
