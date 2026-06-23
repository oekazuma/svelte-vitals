---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Add a visual HTML report: `svelte-vitals --reporter html` writes a self-contained,
styled HTML page (Health score, per-category and per-route scores, findings with
fixes) you can open in a browser. Output path defaults to `svelte-vitals-report.html`;
override with `--out-file <path>` or `--out-file -` for stdout. The core gains
`buildHtmlDocument` / `formatHtmlReport` for reuse by other surfaces.
