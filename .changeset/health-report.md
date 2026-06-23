---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Add the combined **Health Report** (#10): a single weighted Health score across the
SEO, Performance, and Accessibility categories (equal weights by default, overridable
via `Config.weights`), surfaced as the headline in the console/agent reporters and the
MCP `analyze` output, with an optional `--min-health <0-100>` CI gate.

**Breaking (JSON report):** the top-level `score` is now the combined Health score (it
was the SEO score); the top-level `scoreModel` is removed; a `weights` field is added.
Per-category scores remain under `categories` (e.g. `categories.seo.score` /
`categories.seo.scoreModel`).
