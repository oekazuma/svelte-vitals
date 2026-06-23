# Design: Combined weighted Health Report (1.0 capstone)

Issue: [#10](https://github.com/oekazuma/svelte-vitals/issues/10) (roadmap epic). The differentiated capstone: synthesize the per-category scores (SEO, Performance, A11y) into one weighted **Health** score, surfaced across reporters and the MCP `analyze` tool. This is the headline number for `1.0` and is svelte-vitals' own synthesis — not something official Svelte tooling provides.

## Goal

Add a single **Health** score = the weighted average of the present category scores, with **equal default weights** (1/3 each, re-normalized over whichever categories are present). Surface it as the top-level `score` in the JSON report, a console/agent headline, and (for free) the MCP `analyze` output. Add an optional `--min-health <0-100>` CI gate. Keep severity-based exit codes unchanged.

Reuses the multi-category foundation from Performance v0.4 (`scoresByCategory`, category-aware reporters). Static + plugin modes (the report is computed from `Result[]`, mode-independent).

## Decisions (settled in brainstorming)

- **Default weights: equal** (each present category weight 1). Overridable via `Config.weights`; a CLI flag is deferred to the config-file feature (roadmap C).
- **JSON top-level `score` becomes the Health score** (was the SEO score) — a deliberate breaking change, announced for `1.0` via the changeset. Per-category scores remain in `categories`.
- **Exit codes stay severity-based** (`hasFailureAtOrAbove`); Health is informational unless the new optional `--min-health` flag is set.

## core — `computeHealth` + `Config.weights`

- **`Config`** gains `weights?: Partial<Record<Category, number>>`. `defineConfig` passes it through; `defaultConfig` leaves it `undefined` (= equal). Effective weight: `weightOf(cat) = config.weights?.[cat] ?? 1`.
- **`computeHealth(results, config): HealthResult`** (new, in `packages/core/src/scoring/score.ts`):
  - `const byCat = scoresByCategory(results, config)` — only categories with findings/seeds (so a suppressed a11y category, or a project with no routes, is excluded).
  - `health = round( Σ_present(score_c × weightOf(c)) / Σ_present(weightOf(c)) )`. When no categories are present, `health = 100` (consistent with `computeScore`'s empty → 100).
  - Returns `{ health: number; categories: Partial<Record<Category, ScoreResult>>; weights: Partial<Record<Category, number>> }` where `weights` is the **effective** weight actually used per present category (so the report can show how Health was derived).
- Exported from `@svelte-vitals/core`'s index alongside `computeScore`/`scoresByCategory`.

```ts
export interface HealthResult {
  health: number;
  categories: Partial<Record<Category, ScoreResult>>;
  weights: Partial<Record<Category, number>>;
}
export function computeHealth(results: Result[], config: Config): HealthResult;
```

## core — JSON report reshape (`buildJsonReport`)

The report object changes shape (breaking, for 1.0):

- top-level **`score`** = `computeHealth(...).health` (was the SEO subset score).
- top-level **`scoreModel`** is **removed** (it was the SEO route-average model and is now redundant with `categories.seo.scoreModel`).
- add top-level **`weights`** = the effective per-category weights used for Health.
- **`categories`** unchanged: `{ seo: { score, scoreModel }, performance: {…}, a11y: {…} }` (only present categories).
- `summary`, `routes`, `siteIssues` unchanged.

Result shape:

```jsonc
{
  "version": "1.0.0",
  "score": 91,                  // Health (weighted avg of present categories)
  "weights": { "seo": 1, "performance": 1, "a11y": 1 },
  "categories": {
    "seo": { "score": 86, "scoreModel": { … } },
    "performance": { "score": 95, "scoreModel": { … } },
    "a11y": { "score": 92, "scoreModel": { … } }
  },
  "summary": { … },
  "routes": [ … ],
  "siteIssues": [ … ]
}
```

`formatJsonReport` keeps stringifying `buildJsonReport`. The **MCP `analyze`** tool returns `buildJsonReport`'s object as `structuredContent`, so it surfaces `score`(=Health) + `weights` + `categories` with **no MCP code change**.

## core — reporters

- **console**: prepend a headline `Svelte Vitals  ·  Health: N/100  (static mode)` (or a dedicated `Health: N/100` line at the very top), then the existing per-category score lines (`SEO Score:`, `Performance Score:`, `Accessibility Score:`), then findings. The per-category lines and findings are unchanged.
- **agent**: add a single leading line `Health: N/100` after the `# svelte-vitals — fixes` heading (cheap, informative for the agent).
- **sarif / github**: **unchanged** — a single overall score has no per-finding SARIF/annotation representation; these reporters keep emitting findings only.

## cli — `--min-health` gate + wiring

- **`bin.ts`**: parse `--min-health <n>` (string → number). Invalid/out-of-range (`!Number.isFinite` or `<0`/`>100`) → stderr warning and ignore (consistent with the `--treat-dynamic-as` warning pattern), not a hard error.
- **`RunOptions`/`AnalyzeOptions`** gain `minHealth?: number`; `analyzeProject` does not need it (it returns raw results), but `run()` computes Health and applies the gate.
- **`run()`** exit logic: compute `const { health } = computeHealth(results, config)`. Return `1` when `hasFailureAtOrAbove(summary, config.failOn)` **OR** (`opts.minHealth != null && health < opts.minHealth`). Exit `2` (execution error) unchanged. So `--min-health` adds a score gate on top of the existing severity gate; without it, behavior is unchanged.
- Help text documents `--min-health`.

> Weights are **not** a CLI flag in this increment (no `--weights`); they default to equal and are overridable programmatically via `defineConfig({ weights })`, with a config-file surface arriving in roadmap item C.

## Backward-compat & migration

- The JSON `score` semantic change (SEO → Health) and the removal of top-level `scoreModel` are breaking for JSON consumers. Per-category SEO data moves to `categories.seo`. Announce clearly in the changeset (this lands as the lead-in to `1.0`).
- console/agent gain a headline line (additive to human output; no existing console assertion pins the absence of a Health line — verify and update the console/agent tests for the new headline).
- sarif/github/exit-codes (default) unchanged.

## Testing (TDD)

- **core**: `computeHealth` — equal-weight mean of present categories; `Config.weights` override changes the result; a suppressed/absent category is excluded and weights re-normalize; no categories → 100; `weights` field reflects effective weights. `buildJsonReport` — `score` === `computeHealth().health`, top-level `scoreModel` gone, `weights` present, `categories` intact; `formatJsonReport` === `JSON.stringify(buildJsonReport)`.
- **cli**: `run()` returns 1 when `--min-health` threshold is unmet even with no failing severity; returns 0 when Health ≥ threshold and no failing severity; severity gate still fires independently; invalid `--min-health` warns and is ignored. console/agent show the Health headline.
- **mcp**: `analyze` `structuredContent.score` is the Health value and `weights` is present (the report flows through unchanged).
- Existing per-category/score tests updated for the reshaped top-level (the `categories` map already carries per-category data, so most assertions move from top-level to `categories.seo`).

## Roadmap / release

- README roadmap: move the **combined Health Report** to Shipped; explicitly drop the Upgrade category (redundant with official Svelte tooling — compiler/MCP/Skills/`sv migrate`); state that `1.0` is the polish/stabilization of SEO + Performance + A11y + Health.
- Changeset: `@svelte-vitals/core` **minor** (`computeHealth`, `Config.weights`, JSON reshape) and `svelte-vitals` **minor** (`--min-health`, console/agent headline). Call out the JSON `score`/`scoreModel` breaking change prominently.

## Non-goals / follow-ups (post-Health, toward/after 1.0)

- Rule-reference docs / fixing the `svelte-vitals.dev/rules/<id>` dead `docsUrl` links (roadmap item B — 1.0-required, next).
- Config-file support + `--weights` CLI flag (roadmap item C — 1.0-required).
- Upgrade/deprecation category (declined), plugin-mode Performance parity, layout breakouts (#12) — post-1.0.
