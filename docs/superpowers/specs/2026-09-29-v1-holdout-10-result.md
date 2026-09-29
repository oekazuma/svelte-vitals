# v1 holdout 10 — result (2026-09-29)

Measured with `main` at 6697e009 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-29-v1-holdout-10-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: 13 of 14 installed;
open-communities's install stopped on `ERR_PNPM_UNSUPPORTED_ENGINE` and it was measured uninstalled.
Raw first look: `scripts/corpus/holdout-10-2026-09-29.json`; verdicts:
`scripts/corpus/holdout-10-2026-09-29-verdicts.json` (5,356 distinct keys from 14 apps, every one
labelled by checks over the source at the pinned commit).

**Result: not ready.** Four of ten criteria fail: C3, C6, C7 and C8. C3 and C7 fail on one class — a
database client's `update()` read as a module-state write. C4 (99.6%) and C5 (99.7%) are the best of
any holdout.

| #   | Criterion                          | Threshold      | Measured                                                        | Result | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | --------------------------------------------------------------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                                               | pass   | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 5 of which built                  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 13 (`handler-state-write`)                                      | fail   | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.6% (1,858 / 1,865)                                           | pass   | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.7% (2,332 / 2,338)                                           | pass   | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 2 classes (below)                                               | fail   | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 1 rule below                                                    | fail   | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 33.6% (976 / 2,905)                                             | fail   | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                                           | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (new: `seo/json-ld-deprecated-type`, `seo/json-ld-validity`) | pass   | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 4,241, fp 26, design 1,089, unclear 0.

C7's rule: `security/handler-state-write` 7.1% (1 / 14).

## Critical findings (C3)

53 `title-presence` (50 tp — 46 of them localsnow-legacy's signed-in routes, whose layouts render no
`<title>` and whose SEO component is imported nowhere; 3 design: a Sentry scaffold page with its
`<title>` in the body, an upload test harness, and a screenshot harness) and 15 `handler-state-write`:
13 fp, 1 tp (localsnow-legacy's root universal load sets the shared `sveltekit-i18n` locale per
request), 1 design (kissaten's public image catalogue). The 13 fp are a Prisma client's
`prisma.<model>.update(…)` in augur-hakesch's form actions (12) and a Drizzle `db.update(…).set(…)` in
grocery-manager's cron endpoint (1): the rule exempts database clients only when they come from
`src/lib/server`, and reads a call on any member of another import as a store write.

## False-positive classes

| Class                                                                                                                         | Findings | Apps | Rules                         |
| ----------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ----------------------------- |
| **A database client's `update()`/`set()` chain read as a module-state write** (client imported from outside `src/lib/server`) | 13       | 2    | **handler-state-write**       |
| An imported constant list its module casts (`(LIST as readonly string[]).includes(v)`) loses its exemption                    | 4        | 1    | each-key                      |
| **Headings inside `{@html}` markdown not seen**                                                                               | 2        | 2    | heading-level-skip, single-h1 |
| A component heading behind a data-driven `{#if}` that renders whenever the flagged heading does                               | 3        | 1    | heading-level-skip            |
| A component chosen from a plugin registry at runtime (`<svelte:component this={PageComponent}>`) not followed                 | 2        | 1    | single-h1                     |
| Three sibling `{#if step == n}` blocks, the first and third not read as exclusive across the middle one                       | 1        | 1    | single-h1                     |
| A `$state` exposed through an object getter and written by a child's `bind:this`                                              | 1        | 1    | unmutated-state               |

C6's two classes are the database-client write (augur-hakesch, grocery-manager) and headings inside
`{@html}` (aden.solutions, raksara), a documented limit.

## C2 in detail

GitHub Actions run 36526092589 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 11 apps and crashed on none. Five builds completed (company-of-heroes, awg-manager,
TurfBuilder, e-shiwake, which prerenders 37 routes, and tobamaru). grocery-manager and augur-hakesch
stopped at the plugin's own critical gate — augur-hakesch on the false `handler-state-write`
findings. The others failed on their own: `$env/static` variables not set (aden.solutions, solar-app), a
workspace package with no resolvable entry (welplan2) and an unresolved `marked` import (raksara); and,
before the plugin ran, kissaten's and localsnow-legacy's own build errors (a Svelte compile error and a
bits-ui export the installed version lacks) and open-communities's failed install.

## Labelling notes

- The design share is concentrated in `each-key` (265), `description-presence` (229), `canonical-url`
  (147) and `raw-html` (111); TurfBuilder, localsnow-legacy, awg-manager and grocery-manager together
  have 510 of the 976.
- Conventions the labellers applied but questioned: Bootstrap's own `aria-hidden` on `.modal` markup
  (hidden with `display:none` until opened) as `design` for `aria-hidden-focus` (30, augur-hakesch, new
  shape); og/twitter as `tp` on a Tauri desktop app; `robots-txt` as `tp` on base-path deployments,
  which cannot serve `/robots.txt` at the host root; a DB client under the documented exemption as `fp`
  rather than `design`, because the message asserts a write that does not happen.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs an
eleventh holdout.
