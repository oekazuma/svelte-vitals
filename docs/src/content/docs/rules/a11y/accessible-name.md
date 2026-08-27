---
title: a11y/accessible-name · Interactive element has no accessible name
description: A button, link, image button, or iframe needs a way to compute its accessible name.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a `<button>`, `<a href="…">`, `<input type="image">`, or `<iframe>` with no computable accessible name.

Any of the following, if present, is a name source — the element is not flagged:

- A non-whitespace text descendant, e.g. `<button>Save</button>`.
- An `aria-label`, `aria-labelledby`, or `title` attribute — a literal non-empty value, or any expression (its rendered value is unknowable, but the attribute's presence is enough). `title` counts because the name computation uses it as a last resort, but it is a poor way to name a control: it is unavailable to touch users, keyboard users, and many screen-reader and magnifier users. Prefer visible text or `aria-label`.
- A descendant `<img>` with an `alt` — a non-empty literal, or any expression, on the same footing as `aria-label` above.
- For `<input type="image">`, its own `alt`, under the same rule.
- A `<label>` that names it: one wrapping it, or one pointing `for` at its `id`. This step comes ahead of the element's own subtree in the name computation, and applies to `<button>` and `<input type="image">` only — `<a>` has no such step. It counts only when the label itself contributes something: a label that is provably empty leaves the control unnamed and still reported, and a wrapping label reaches only the **first** labelable element inside it, so a second control in the same label is judged on its own. The `for` route is same-file only; a label in another component is a known limitation.

Not flagged, even with no name source found:

- An element whose content is unknowable — any `{expression}` child, a component child, `{@render …}`, `{@html …}`, a `<slot>` or `<svelte:fragment>` (its content comes from the parent), a hyphenated custom element (its shadow root may supply content), or a spread attribute on the element itself.
  The rule only flags what it can prove is unnamed; it never guesses at dynamic content.
- Namespace is not tracked here: an `<a href>` inside `<svg>` is judged as the HTML `<a>`, so an SVG link without a computable accessible name (no text descendant, `aria-label`, `aria-labelledby`, or `<title>`) is reported — the same thing the SVG accessibility guidance asks for, so the verdict stands even though the reason differs.

```svelte
<button></button>
<a href="/x"><img src="i.png" /></a>
```

### The iframe arm

An `<iframe>` is named by its `title`, `aria-label`, or `aria-labelledby` only — a literal non-empty value, or any expression (unknowable → assumed to name, as above). A blank literal `title=""` computes no name and **is** flagged. Its children never count: iframe content is fallback for browsers without frames, not rendered content, so there is no name-from-content step — and a `<label>` cannot name it either (an iframe is not labelable).

Not flagged, specific to this arm:

- An iframe with `aria-hidden="true"`, a `hidden` attribute, or `role="presentation"`/`role="none"` — the hidden tracking/analytics-frame class, where a name helps nobody. An expression value in any of these resolves unknowable → not flagged, consistent with the rest of the rule. These skips apply to the iframe arm only: a hidden unnamed button is still reported.
- An iframe inside `<svg>` — SVG has no `iframe`, the element never renders. (This is narrower than the `<a>` note above, which is judged in both namespaces because SVG `<a>` is a real link.)
- A spread attribute on the iframe — its rendered attributes are unknowable.

## Why it matters

Assistive technology announces an interactive control by its accessible name. With none, a screen reader falls back to the bare role — "button", "link" — indistinguishable from every other unnamed control on the page. A sighted user relying on an icon alone has no such gap, which is why the problem hides in visual review. An unnamed `<iframe>` has the same failure at a larger scale: it is announced as a bare frame, with no way to tell an embedded video from a map or an ad slot before entering it.

## How to fix

Give the element visible text, a labelling attribute, or an `alt` on its icon image:

```svelte
<button aria-label="Save">💾</button>
<a href="/x"><img src="i.png" alt="Home" /></a>
<input type="image" src="search.png" alt="Search" />
<iframe src="https://example.com/embed" title="Product demo video" loading="lazy"></iframe>
```

## Overlap with the Svelte compiler

For iframes, the compiler warns as `a11y_missing_attribute` when `title` is missing. That overlap is deliberate: the compiler streams into the build log and does not score, gate, or suppress — this rule feeds the health score, respects `svelte-vitals-disable-next-line`, and fails CI through `--fail-on`.

The compiler's check is presence-only and title-only, which leaves four divergences:

- `aria-label`/`aria-labelledby` name the frame for this rule, while the compiler still warns — only `title` silences it.
- A blank `title=""` silences the compiler but computes no name, so this rule reports it — the blank title is a common way to quiet the build warning without naming anything.
- A hidden or presentational iframe (`aria-hidden="true"`, `hidden`, `role="presentation"`/`"none"`) makes the compiler warn, while this rule skips it.
- An expression-valued `title` silences both.

The button/link/image-button arms have no compiler counterpart (`a11y_missing_content` covers only anchors and headings, on different grounds).

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If the name is supplied some other way this rule can't see (e.g. a wrapping label element), silence a single element with `<!-- svelte-vitals-disable-next-line a11y/accessible-name -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/accessible-name': 'off'
  }
};
```
