---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Add the Performance category (v0.4, #10): static `<img>` checks — **PERF001** (missing
`width`/`height`, CLS risk; warning) and **PERF002** (missing `loading` attribute; info
advisory) — with dynamically-bound attributes counting as present. Introduces the
multi-category foundation: `Result.category`/`line`, the `ImageInfo`/`ResolvedImages` IR,
`RuleContext.images`, `imageRule`, `scoresByCategory`, and category-aware reporters
(per-category scores; JSON `categories` map). Existing SEO findings, scores, and output
are unchanged.
