---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add a **Security** category — the second "Svelte Doctor" code-health category,
reusing the component-body scan (CLI/static mode):

- **SEC001** Raw HTML render: flags `{@html …}` (an unescaped-HTML XSS surface;
  sanitize the value).
- **SEC002** javascript: URL: flags a literal `javascript:` URL in an
  `href`/`src`/`action`/`formaction` attribute.

The component-rule factory is now shared between the Correctness and Security
categories, and the console reporter shows a Security score line.
