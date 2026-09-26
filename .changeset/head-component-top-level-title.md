---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Source analysis now reads a `<title>` written at the top level of a component that a page or layout renders inside `<svelte:head>` (`<svelte:head><MetaTag title={…} /></svelte:head>` with `<title>{title}</title>` in `MetaTag.svelte`). Its `<meta>` and `<link>` tags were already read; the title was dropped, so every route using such a component was reported as missing a `<title>` (`seo/title-presence`, critical).
