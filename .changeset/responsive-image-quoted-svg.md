---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/responsive-image` reads a quoted lone expression (`src="{logo}"`) like `src={logo}`, so an imported `.svg` is exempt in both forms.
