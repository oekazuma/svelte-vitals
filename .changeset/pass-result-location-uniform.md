---
'@svelte-vitals/core': minor
---

Every rule's PASS results now carry the same `location` a penalized result on the same route/file would — visible to library consumers reading `results` and in the `rules.*.passed` counts, not only the two rule ids (`seo/title-presence` and the `headTagRule`-backed family) that already did this. (The JSON report's `routes[].issues`/`siteIssues` arrays stay penalized-only, so this isn't visible there.) Fixes `files:`-scoped `severity: 'off'` overrides silently failing to remove a passing seed (issue #382): `overrideMatches` matches `files:` against a result's `location`, and a PASS with no `location` could never match, so `'off'` removed a rule's penalized findings but left its passing seed counted. `route:`-scoped overrides were unaffected.

`architecture/unit-entry-file`'s per-declaration pass (deliberately route-less since #337) is unchanged — it never had this bug (`location` without `route` was never reachable by a `route:` glob to begin with, and `files:` already matched it via `location`).

No rule's `id`, `severity`, or `detection` changes, and `score.ts` never reads `location` directly. Scores can still move in any mode through the fix itself: a `files:`-scoped `'off'` now removes the passing seeds it always claimed to (the issue's reproduction moves 98 → 96 once the seed is gone), where before it silently removed only the penalized findings. Benign display change: the console reporter's `--verbose` Passed listing prints `location ?? route`, so a rule newly carrying `location` on PASS now lists the file path there instead of the route id. See `docs/superpowers/specs/2026-08-08-pass-result-location-design.md` for the full design record and blast-radius enumeration.
