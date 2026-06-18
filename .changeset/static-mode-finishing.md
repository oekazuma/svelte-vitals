---
'svelte-vitals': minor
'@svelte-vitals/core': minor
---

Static-mode finishing: scored SEO report.

- New rules SEO002–SEO009 (description, canonical, og:image, og:title, robots.txt, sitemap.xml, JSON-LD, `<html lang>`).
- Scoring model (§12): per-route scores, route average, site penalty, and a critical cap, surfaced in the console header and JSON.
- JSON reporter (`--json` / `--reporter json`) and `--by-route` per-route tree.
- New flags: `--fail-on`/`--fail-on-warning`, `--rules`/`--ignore`. `treatDynamicAs: 'warn'` now reports dynamic values as warnings.
