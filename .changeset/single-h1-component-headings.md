---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

seo/single-h1 in the CLI's static mode now counts headings rendered by imported local components (followed transitively through the same depth-limited traversal head resolution already uses — no additional file reads). Extracting a page's `<h1>` into a `$lib` component no longer produces a false "Missing <h1>" warning, aligning the CLI with the vite plugin's rendered-HTML result. Two finding movements: false "Missing <h1>" warnings on such routes disappear (Health can rise), and routes whose chain plus components render more than one `<h1>` may gain a new info-level multiple-h1 finding (fails only under `--fail-on info`). Headings inside node_modules or dynamically chosen components remain invisible to static mode; the vite plugin stays the authoritative check there. seo/heading-level-skip is unchanged — component headings have no reliable document-order position, so the outline walk deliberately ignores them.
