---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add SEO022 (title length, 30–60 chars) and SEO023 (meta description length,
70–160 chars). Both check only static text — the literal title/description is now
captured onto the head model — and flag both too-short and too-long values; a
dynamic title/description is skipped (presence stays owned by SEO001/SEO002).
Static literal `title`/`description` props on `svelte-meta-tags` and `svelte-seo`
components are measured too (a `titleTemplate` correctly suppresses title
measurement). Length is counted by grapheme cluster, so emoji (ZWJ/flag/skin-tone
sequences) count as one character.
