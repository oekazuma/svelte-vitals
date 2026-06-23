# Design: Remove the Accessibility (a11y) category

Toward the 1.0 product thesis: the core is **SEO + deep static Performance**; a11y is dropped because the Svelte compiler, eslint-plugin-svelte, and axe already cover accessibility well. a11y shipped in v0.5 (aggregating the Svelte compiler's `a11y_*` warnings), so this is a **breaking-change removal**, done as its own increment before the docs site and the visual report (so neither documents/visualizes a category we're removing).

## Goal

Remove the Accessibility category entirely. After this, the analyzer reports **SEO + Performance** only, and the combined Health score averages those two.

## Decision

`Category` is trimmed to exactly **`'seo' | 'performance'`** — removing both the now-dropped `'a11y'` and the never-used `'maintainability'` (the Upgrade slot, also declined), so the type matches reality.

## Scope — what to remove

**Source:**

- **Delete** `packages/cli/src/providers/source/a11y.ts` (the `collectA11y` compiler-warning collector).
- `packages/cli/src/index.ts` (`analyzeProject`): remove the `collectA11y` import and the merge of its results; the result set is just `runRules(...)` output again (still passed through `applyRuleSeverities`, filtered by the route matcher as before for SEO/Perf).
- `packages/cli/src/rules-config.ts`:
  - `findUnknownRuleIds` — remove the `a11y_*` acceptance (revert to: known = `KNOWN_IDS.has(id)`).
  - `buildRulesConfig` — remove the `a11y_category` sentinel logic (the allow-list a11y suppression).
- `packages/core/src/types.ts`: `Category = 'seo' | 'performance'`.
- `packages/core/src/reporter/console.ts`: `CATEGORY_ORDER` and `CATEGORY_LABEL` keep only `seo` + `performance` (drop the `a11y`/`maintainability` entries).

**Tests:**

- **Delete** `packages/cli/test/a11y.test.ts`.
- `packages/cli/test/run.test.ts`: remove the a11y e2e assertion (the "reports an Accessibility finding for an `<img>` without alt" test).
- `packages/cli/test/rules-config.test.ts`: remove the `a11y_*` known-id and `a11y_category` sentinel tests.

**Fixtures:**

- `packages/cli/test/fixtures/basic-project/src/routes/img/+page.svelte`: it lost its `alt` attribute in v0.5 purely to trigger an a11y finding. Restore `alt="hero"` (it still exercises PERF001/PERF002 via missing `width`/`height`/`loading`; no behavior depends on the missing alt once a11y is gone).

**Docs/release:**

- `README.md`: remove the "Accessibility checks (0.5)" Shipped bullet.
- Changeset: `@svelte-vitals/core` **minor** (Category narrowed; console categories) + `svelte-vitals` **minor** (a11y collection removed; `--ignore a11y_*` / allow-list a11y suppression removed). Call out the removal as breaking.

## What stays unchanged (verify)

- `scoresByCategory` / `computeHealth` are category-generic — with no a11y results, Health is the weighted mean of SEO + Performance automatically; no logic change. (`computeHealth` over `Record<Category, …>` still typechecks with the narrowed union.)
- json/agent/sarif/github reporters carry whatever findings exist; they have no a11y literals (only console's `CATEGORY_ORDER/LABEL` did). The json `categories` map simply no longer contains an `a11y` key.
- MCP `analyze` returns the report unchanged (no a11y-specific code).
- SEO and Performance findings, scoring, and the `--min-health` gate are untouched.

## Testing

- Update/confirm `scoresByCategory`/`computeHealth` tests still pass (they don't reference a11y, or if a fixture used `category: 'a11y'` purely as a sample, switch it to `'performance'` — the math is identical and category-agnostic).
- After removal: `pnpm -r test`, `pnpm -r typecheck`, `pnpm build`, `pnpm lint`, `pnpm check:publint` all green; an `<img>`-without-dimensions fixture still yields PERF findings and no a11y finding anywhere; `--ignore a11y_missing_attribute` is now an unknown-rule-id error (exit 2), confirming the a11y config surface is gone.

## Non-goals / follow-ups

- The docs site (next), the HTML/visual report, deeper Performance, and the config file — all separate, and now simpler (no a11y to account for).
- No deprecation/back-compat shim for the removed a11y output — it's a clean break announced in the changeset.
