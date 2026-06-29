# Security category — component XSS surfaces (SEC001/SEC002)

**Date:** 2026-06-29
**Status:** Approved (per maintainer; next slice of #69)
**Packages:** `@svelte-vitals/core` (category + rules), `@svelte-vitals/mcp` (surfaces via `allRules`)

## Goal

The second "Svelte Doctor" code-health category, reusing the component-body scan
(`ctx.components`, CLI/static only) from the Correctness slice. Two high-precision
XSS-surface checks the Svelte compiler / `svelte-check` don't flag as health signals.

| ID     | Check                             | Severity |
| ------ | --------------------------------- | -------- |
| SEC001 | `{@html}` raw-HTML render         | warning  |
| SEC002 | `javascript:` URL in an attribute | warning  |

## Design

### Shared factory

Extract the existing `correctnessRule` into a generic `componentRule({ category,
severity?, applies, bad, ... })` (`packages/core/src/rules/component-rule.ts`).
Correctness rules pass `category: 'correctness'`; security rules pass
`category: 'security'`. Behavior unchanged (file-unit findings, CLI-only).

### New category

Add `'security'` to `Category`, and to the console reporter's
`CATEGORY_ORDER`/`CATEGORY_LABEL` (html/json enumerate categories dynamically).

### Facts (`ComponentFacts`)

- `htmlTags: { line }[]` — `{@html …}` occurrences (template node `HtmlTag`).
- `javascriptUrls: { line }[]` — an element attribute (`href`/`src`/`action`/
  `formaction`) whose **literal** value starts with `javascript:` (dynamic values
  are skipped — can't be known statically).

### Rules

- **SEC001** — flags every `{@html}`. It renders unescaped HTML; if the value is
  not sanitized it is an XSS vector. (Always a review surface; static analysis
  can't prove sanitization, so we surface it with guidance.)
- **SEC002** — flags a literal `javascript:` URL (XSS / unsafe navigation).

## Out of scope

- `target="_blank"` without `rel="noopener"` — modern browsers imply `noopener`
  for `target=_blank`, so the reverse-tabnabbing risk is largely mitigated; low
  value, deferred (revisit if demand).
- Hardcoded-secret detection (separate, higher-FP effort).

## Testing

- Parser facts: `{@html}` collected; `javascript:` literal in `href`/`src`
  detected; a dynamic `href={url}` not flagged; a normal `https:` URL not flagged.
- Rules: SEC001 flags `{@html}` / passes a component without it; SEC002 flags a
  `javascript:` URL / passes otherwise; both no-op when `ctx.components` unset.
- Console reporter shows a Security score line. Docs (en+ja), changeset.
- Full `pnpm -r test` + typecheck + lint + docs build green.
