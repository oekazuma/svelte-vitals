---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Two more corrections from the a11y rule-validity review.

- **`a11y/no-missing-id-ref` read a text fragment as an id reference.** `href="#:~:text=hello%20world"`
  is a shipped web-platform feature — everything after `:~:` instructs the user agent to find text,
  and names no element — so the rule reported a missing id, printing the percent-decoded form and
  sending the reader to look for a string that is not in their source. Exempt in both modes, like
  `#top`. This narrows detection.
- **`a11y/interactive-nesting` did not say which element it meant.** A finding read
  `<button> is nested inside interactive <div>`, which is unactionable on a page with many divs.
  When the container is a container because of its `role`, the message now names it:
  `<button> is nested inside interactive <div role="button">`.
