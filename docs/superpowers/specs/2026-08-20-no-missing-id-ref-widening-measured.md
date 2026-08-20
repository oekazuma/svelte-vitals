# no-missing-id-ref widening — measured

Input for the widening design that issue #533 left open. Produced with the skip-visibility
surface (`2026-08-20-no-missing-id-ref-skip-visibility-design.md`): the built CLI at
`0.49.0` + skip visibility (merge commit `a1aca372`) was run with `--reporter json
--no-suppressions` against fresh default-branch clones of the ecosystem corpus
(`scripts/ecosystem-smoke.js`) plus `itswadesh/svelte-commerce` (the app issue #533
measured), each clone's `svelte-vitals.config.*` removed. The aggregation script was a
throwaway (per the design's Measurement section); every number below is recomputable from
the report's `skipped` map alone.

Definitions, from the design: a skipped route is **unlockable** only when `refs > 0` — a
route with no literal id references produces nothing even if the rule runs. A remedy set S
unlocks a route iff every recorded cause kind is in S and `refs > 0`. Per-kind counts are
routes carrying that kind; a route usually carries several, so rows overlap.

## Per-app skip landscape

| app                | sha       | analyzed | skipped | skipped with refs > 0 | component | spread | {@html} | dynamic id |
| ------------------ | --------- | -------: | ------: | --------------------: | --------: | -----: | ------: | ---------: |
| shadcn-svelte      | `dabbd4c` |       16 |      16 |                     2 |        16 |     15 |       4 |          4 |
| cobalt             | `a636575` |       18 |      18 |                    18 |        18 |     18 |       0 |         18 |
| svelte-commerce    | `40e0965` |       54 |      54 |                    37 |        54 |     54 |      54 |         54 |
| networking-toolbox | `776805f` |      193 |     193 |                   193 |         3 |      0 |     193 |        193 |
| joy-of-code        | `73dc40e` |        8 |       8 |                     8 |         8 |      0 |       0 |          0 |
| kener              | `880080c` |       41 |      41 |                     1 |        41 |     39 |       8 |          1 |
| CMSaasStarter      | `2e61406` |       25 |      14 |                     8 |         3 |      0 |       1 |         10 |
| AdventureLog       | `5673ef5` |       25 |      25 |                    19 |        25 |      0 |      25 |          6 |
| svelte.dev         | `6d238f9` |       18 |      18 |                     0 |        18 |      1 |      10 |          1 |
| **total**          |           |  **398** | **387** |               **286** |           |        |         |            |

Sanity anchors against issue #533's hand instrumentation hold: kener 41 routes all
skipped (spread on 39, expression id on 1), svelte-commerce 54/54 with every cause class on
every route, CMSaasStarter the only app with any fully resolved route (11 of 25 here; the
issue counted 3 the rule actually ran on — running additionally needs `refs > 0`).

## Routes unlocked per remedy set

| app                | component | spread |  html | dynamic-id | comp+spread | comp+dyn | comp+spread+dyn | all four |
| ------------------ | --------: | -----: | ----: | ---------: | ----------: | -------: | --------------: | -------: |
| shadcn-svelte      |         0 |      0 |     0 |          0 |           2 |        0 |               2 |        2 |
| cobalt             |         0 |      0 |     0 |          0 |           0 |        0 |              18 |       18 |
| svelte-commerce    |         0 |      0 |     0 |          0 |           0 |        0 |               0 |       37 |
| networking-toolbox |         0 |      0 |     0 |          0 |           0 |        0 |               0 |      193 |
| joy-of-code        |         8 |      0 |     0 |          0 |           8 |        8 |               8 |        8 |
| kener              |         0 |      0 |     0 |          0 |           1 |        0 |               1 |        1 |
| CMSaasStarter      |         0 |      0 |     0 |          8 |           0 |        8 |               8 |        8 |
| AdventureLog       |         0 |      0 |     0 |          0 |           0 |        0 |               0 |       19 |
| svelte.dev         |         0 |      0 |     0 |          0 |           0 |        0 |               0 |        0 |
| **total**          |     **8** |  **0** | **0** |      **8** |      **11** |   **16** |          **37** |  **286** |

## Unresolvable component names

Distinct component names among each app's `component` causes, with routes whose only cause
kind is `component` (the population per-name mapping alone can ever unlock):

| app                | distinct names | component-only unlockable routes | most frequent names                                      |
| ------------------ | -------------: | -------------------------------: | -------------------------------------------------------- |
| shadcn-svelte      |            313 |                                0 | ModeWatcher, Tooltip.Provider, Toaster, icons, Button    |
| cobalt             |             42 |                                0 | Icon\* (tabler icon set, 18 routes each)                 |
| svelte-commerce    |            191 |                                0 | ColorPalette, GoogleAnalytics, Toaster, lucide icons     |
| networking-toolbox |              7 |                                0 | Check, Copy, Download, Globe, Type, Mail                 |
| joy-of-code        |             15 |                                8 | Search, YouTube, X, Bluesky, RSS, Cog, Menu, Mail        |
| kener              |            275 |                                0 | ModeWatcher, Toaster, Button, DropdownMenu.\*, Dialog.\* |
| CMSaasStarter      |              1 |                                0 | Auth                                                     |
| AdventureLog       |            231 |                                0 | icon set (25 routes each)                                |
| svelte.dev         |             25 |                                0 | Shell, Nav, Banner, SearchBox, Text                      |

## What the numbers say

- **No single remedy moves the needle.** Every one-kind remedy set unlocks 0 routes in
  seven of nine apps. The two exceptions are structural outliers: joy-of-code (component
  only, 8 routes) and CMSaasStarter (dynamic id only, 8 routes). 16 of 286 unlockable
  routes — 6% — are reachable by the best single remedy per app.
- **Roadmap C-6 (pretender mapping) alone recovers 8 of 286 routes**, all in one app, and
  that app has only 15 distinct names to map. Where component causes dominate instead
  (kener 275 names, shadcn-svelte 313, AdventureLog 231, svelte-commerce 191), the names
  are overwhelmingly icon-set and UI-kit leaves — a hand-written per-name config at that
  scale is not a real user behavior. If C-6 ships, the measured shape suggests it must
  work at a coarser grain than one name per entry to matter.
- **The mass is in combinations.** All four remedies together reach 286 routes; dropping
  `{@html}` alone loses 249 of them (networking-toolbox's 193 and svelte-commerce's 37 are
  behind `{@html}` among other kinds). Any mechanism that cannot make a statement about
  `{@html}` and expression-valued ids leaves the two largest apps at zero.
- **`refs > 0` is the right unlock currency.** 101 of 387 skipped routes (26%) reference
  no id at all — svelte.dev is the extreme: all 18 routes skipped, none unlockable, so
  even a perfect widening yields nothing there. Any future coverage claim should count
  unlockable routes, not skipped routes.
- **The closed-world gate is not paranoid in only one direction.** CMSaasStarter is the
  lone app where the gate ever opens (11 of 25 routes), and its blockers are mostly
  expression-valued ids (10 routes), not library components — a different profile from
  every other app. A widening designed only around "the root layout imports a UI kit"
  story would miss it.

The mechanism decision stays with the follow-up widening design; this document is its
input, alongside the walls issue #533 already records.
