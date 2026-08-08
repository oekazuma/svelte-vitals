---
'svelte-vitals': patch
---

Fix `--baseline` silently masking a genuine regression: for the SEO rules whose passing results already carry a file `location` (`seo/title-presence` and the ten `headTagRule`-backed ids — `canonical-url`, `og-title`, `og-image`, `charset`, `viewport`, `twitter-card`, `description-presence`, `og-description`, `json-ld`, `og-url`), a route that passed at the baseline ref and then regressed (e.g. a `<title>` deleted) produced identical comparison keys on both sides and was dropped as "not new" instead of being reported. `findingKey` comparison is now penalized-findings-only on both the current and baseline sides (matching the pattern `suppressions.ts` already uses), so a passing result can never key-collide with a penalized one.

Behavior change as a result: passing results no longer appear in `--baseline` output at all — previously, a route that was penalized at the baseline and now passes could still surface its passing result. Under `--baseline --score`, Health is now computed over the new penalized findings only — pass-seeded routes and categories no longer raise it — so a `--baseline` run's Health/`--min-health` can report a lower (stricter) score than before. See `docs/superpowers/specs/2026-08-08-pass-result-location-design.md` ("`findingKey` / `filterToNewFindings`" section) for the design record.
