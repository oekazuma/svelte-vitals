---
'svelte-vitals': patch
---

Source mode no longer collapses `<script src>` tags that share a `src`. The composed `<svelte:head>` used to keep only the last `<script>` per `src` across the layout chain, so a page's `defer` copy of a script the layout loads synchronously masked the layout's render-blocking one, and `performance/render-blocking-script` reported nothing. Every head `<script src>` is now kept in chain order, like JSON-LD, and each blocking occurrence is reported at its own file. Projects with baselines or recorded suppressions may see new `performance/render-blocking-script` findings on layout scripts that were previously invisible.
