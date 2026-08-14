---
'@svelte-vitals/core': minor
---

Add the **Accessibility** category (`a11y`): 15 native, Svelte-aware markup rules — ARIA role/attribute/value validity and required-props checks (`a11y/invalid-role`, `a11y/unknown-aria-attribute`, `a11y/invalid-aria-value`, `a11y/required-aria-props`), interactive-element nesting, accessible-name computability, label/control association, list-like text, `<select>` placeholder options, machine-readable `<time>`, an `app.html` doctype check, and — enabled by resolving the layout chain the way the SEO `<head>`/heading rules already do — landmark duplication/nesting and project-wide id/idref integrity across component boundaries, which no single-file linter can check. `aria-query` is a new runtime dependency, wrapped in a typed spec-data module.

**Health score composition changes.** A sixth category enters the weighted average, so existing projects' Health numbers shift on upgrade with no code change on their side — see [Health score](https://oekazuma.github.io/svelte-vitals/guides/health-report/).
