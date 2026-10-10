---
'svelte-vitals': patch
---

`performance/responsive-image` reads an `<img>` whose `src` is a call given a `.svg` path as a string literal (`src={asset('/icons/x.svg')}`) as an SVG, which it does not report.
