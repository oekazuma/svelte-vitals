# Per-rule options (`RuleSetting` extension) — Design

Date: 2026-07-26
Status: Approved

## Problem

`RuleSetting` is `'off' | Severity` (`packages/core/src/types.ts`). A user who disagrees with a
rule's built-in threshold has exactly one lever: turn the rule off entirely.

`docs/superpowers/specs/2026-07-25-architecture-threshold-recalibration-design.md` recorded this as
out of scope, with the measurement that motivates fixing it: per-repository p90 for prop count
ranges from **3** (shadcn-svelte, a component library) to **10** (windmill, a large application).
One global number cannot serve both. The same document notes that `component-size`'s corpus was
Tailwind-heavy, so a project using scoped `<style>` gets flagged more often than the corpus
predicts — again with no recourse but disabling the rule.

That range is not only a between-repository phenomenon. SvelteKit's own packaging layout puts a
library in `src/lib` and a demo application in `src/routes` **in one repository**, so a single
project-wide number is insufficient even for a single project.

### Why this comes before more Architecture rules

This spec was reached while brainstorming an expansion of the Architecture category. Architecture
rules divide into three layers by how much of the judgement belongs to svelte-vitals:

| Layer | What decides it                                                                    | Treatment                                          |
| ----- | ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| L1    | The framework's mechanics — "written this way, SvelteKit will eventually break it" | Default on, no configuration                       |
| L2    | The project's own dominant pattern — deviation, not preference                     | Self-calibrating against the project               |
| L3    | Genuine preference — feature-based vs layer-based layout, and the like             | Only checked when the user declares the convention |

Directory-structure rules, the most-requested Architecture expansion, are overwhelmingly L3: the
user must be able to state the convention before anything can be checked against it. There is no
place in the config to state one today. This spec builds that place. The Architecture charter
itself (which layer a proposed rule belongs to, and what evidence admits it) is a separate
follow-up document.

## Rule inventory

All 63 rules were surveyed for hard-coded policy constants. They sort into four groups:

| Group                                              | Treatment                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Policy that legitimately differs by user or market | Give it an option                                                                |
| A project-specific fact the user needs to **add**  | Give it an extension option                                                      |
| An external fact svelte-vitals should track        | **No option** — the user is not the authority; we are responsible for keeping up |
| Mechanical binary detection                        | **No option** — there is no threshold to set                                     |

Result:

| Rule                           | Constant              |   Current |    Option    | Rationale                                                                                           |
| ------------------------------ | --------------------- | --------: | :----------: | --------------------------------------------------------------------------------------------------- |
| `architecture/prop-count`      | `MAX_PROPS`           |         6 |    `max`     | measured per-repo p90 spans 3–10                                                                    |
| `architecture/component-size`  | `MAX_LOC`             |       200 |    `max`     | same, plus the scoped-`<style>` caveat recorded in the recalibration spec                           |
| `seo/title-length`             | `min`/`max`           |     30/60 | `min`, `max` | SERP truncation differs by market and script; character count means something different in Japanese |
| `seo/description-length`       | `min`/`max`           |    70/160 | `min`, `max` | same                                                                                                |
| `performance/heavy-import`     | `HEAVY_PACKAGES`      | 2 entries |  `packages`  | projects have their own heavyweight dependencies                                                    |
| `performance/preconnect`       | `THIRD_PARTY_ORIGINS` | 2 entries |  `origins`   | first-party CDNs and other font hosts                                                               |
| `seo/json-ld-deprecated-type`  | `DEPRECATED_TYPES`    | 3 entries |      —       | Google's fact, not the user's setting                                                               |
| `seo/json-ld-required-props`   | `REQUIRED_PROPS`      |   curated |      —       | same                                                                                                |
| `correctness/*` (11 rules)     | —                     |         — |      —       | mechanical binary detection throughout                                                              |
| `security/*` (5 rules)         | —                     |         — |      —       | same                                                                                                |
| `performance` image/link rules | —                     |         — |      —       | same                                                                                                |
| `seo` presence/structure rules | —                     |         — |      —       | same                                                                                                |

**Six rules out of 63, and only two option shapes**: a bounded integer, and an addition to a
built-in collection. (The latter is expressed as two `kind` values below — a list and a map differ
only in element type, not in semantics.) This is the central finding — no general-purpose schema
mechanism (a zod-alike) is needed, so `packages/core`'s dependency-free constraint is never
threatened.

`seo/json-ld-placeholder`'s `PLACEHOLDER_RES` is the one deferred candidate. Its entries are
regular expressions, so a user-supplied value would be a pattern-source list, raising escaping and
ReDoS questions that the two implemented types do not. Demand for it is also thin. It is left for
a later spec rather than being handled hastily here.

## Config shape

```ts
export interface RuleSettingObject {
  severity?: Severity | 'off';
  options?: Record<string, unknown>;
}
export type RuleSetting = 'off' | Severity | RuleSettingObject;
```

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/prop-count': { options: { max: 10 } },
    'seo/title-length': { severity: 'warning', options: { min: 20, max: 40 } },
    'performance/heavy-import': { options: { packages: { 'chart.js': 'import chart.js/auto' } } }
  },
  overrides: [{ files: 'src/lib/**', rules: { 'architecture/prop-count': { options: { max: 4 } } } }]
};
```

The union only adds a member, so every existing `'off'` / `'warning'` value stays valid, and
discrimination is `typeof setting === 'string'`.

`severity` is optional; omitting it keeps the rule's built-in severity, which is the common case
when a user only wants to move a threshold. `{ severity: 'off', … }` disables the rule and any
`options` alongside it are inert — equivalent to the bare `'off'` string, not an error.

`selectRules` and `applyRuleSeverities` (`packages/core/src/config-apply.ts`) currently compare the
setting against `'off'` and assign it as a `Severity` directly. Both must go through a shared
`settingSeverity(setting)` accessor instead; a raw `!== 'off'` comparison silently stops disabling
rules the moment a user writes the object form.

Alternatives considered and rejected:

- **ESLint-style tuple** (`['warning', { max: 10 }]`). Consistent with the ESLint-style rule ids
  adopted in `2026-07-22-rule-id-eslint-style-design.md`, and familiar. Rejected because an
  override would replace the whole array — partial overriding of a single option becomes
  impossible, which is precisely the confusing part of ESLint's own model.
- **Flat object** (`{ severity: 'warning', max: 10 }`). Most concise, but collides the moment a
  rule wants an option literally named `severity`, and forecloses adding further meta keys.

## Option specs

Each rule declares its own options on the `Rule` interface. Absent means the rule takes no options.

```ts
export type RuleOptionSpec =
  | { kind: 'integer'; default: number; min?: number; max?: number }
  | { kind: 'string-list'; default: readonly string[] }
  | { kind: 'string-map'; default: Readonly<Record<string, string>> };

export type RuleOptionsSpec = Record<string, RuleOptionSpec>;
```

**Merge semantics are a property of `kind`, not of the rule.** `integer` replaces; `string-list`
and `string-map` add to the built-in default. No rule writes merge code of its own, so the
semantics cannot drift between rules.

Addition is the only list semantics offered — no replace, no per-entry exclusion. The reason is
that when svelte-vitals learns about a new heavyweight package, every user should benefit
automatically; a user who opted into replacement would be frozen at the built-in list as of the
day they wrote their config, and would never find out. A user who genuinely disagrees with a
built-in entry can scope the rule off with `overrides`.

`performance/heavy-import`'s `packages` is a `string-map` of package specifier to remediation
advice, mirroring the existing constant. The advice string is what makes the finding actionable,
so it is worth the extra verbosity over a bare name list.

## Resolution

```ts
export function resolveRuleOptions(rule: Rule, config: Config, target?: { route?: string; file?: string }): RuleOptions;
```

Order: **built-in defaults → `config.rules[rule.id].options` → each matching `config.overrides`
entry in order**. Later wins for `integer`; lists accumulate across every layer.

Category keys in `overrides[].rules` (e.g. `architecture: 'off'`) accept a severity but **not**
options — options are rule-specific and a cross-category option is meaningless. Supplying one is a
validation error rather than a silent no-op.

### The severity/options timing split

Severity is resolved **after** rules run (`applyRuleSeverities`, `applyOverrides` rewrite results).
Options cannot be: a threshold is an input to the verdict, and by the time a result exists, `bad()`
has already decided. So options resolve **during** the run, from `ctx.config`, which `Rule.check`
already receives.

This spec accepts that split rather than unifying resolution (which would mean retiring the
`applyOverrides` post-pass and touching every route-scoped SEO and Performance rule — a larger
refactor, deferred). The duality is accepted under one binding constraint:

> **The glob-matching rule itself lives in exactly one place.** Only the timing differs. Which
> files match which override entry must be decided by shared code on both paths.

Violating this produces the worst possible bug — an override where the severity applies but the
threshold does not. `routeGlobToRegExp` and the entry-matching predicate are therefore extracted
from `applyOverrides` into a shared helper that both paths call.

## Wiring

- `componentRule`'s `applies` / `bad` take resolved options as a second argument. Options resolve
  per component, keyed on `c.file`.
- `lengthRule` resolves per route (`seo/title-length`, `seo/description-length`).
- `performance/preconnect` is a hand-written `Rule`, not a factory product, and reads `ctx.config`
  directly.

`componentRule` and `lengthRule` are internal — neither is exported from
`packages/core/src/index.ts` — so these signature changes are not breaking for consumers.
`RuleSetting` itself is exported; widening the union can make an exhaustive `switch` in external
code non-exhaustive. The project is pre-1.0 and this is noted in the changeset.

### Performance

Resolution runs per file per rule; the recalibration corpus had 9,488 `.svelte` files. Two
mitigations, both mirroring what `applyOverrides` already does:

- when `config.overrides` is empty (the common case), return the defaults-plus-global object
  directly, with no matching work at all;
- otherwise compile each override's globs to `RegExp` **once**, outside the per-file loop, and
  reuse the compiled set.

## Validation

`validateRuleOptions(rule, options): string[]` lives in `packages/core` (hand-written, no
dependencies) and is called by the CLI's `packages/cli/src/config-file.ts`. The Vite plugin and the
MCP server reuse the same function.

Fatal (thrown, matching the existing stance that an unknown rule id is fatal):

- an unknown option key for that rule;
- a type mismatch (`max: '10'`, `packages: []`);
- an integer outside the spec's `min`/`max` bounds;
- `options` on a rule that declares none;
- `options` under a category key in `overrides[].rules`.

The failure this prevents is a typo silently leaving the config inert — the same reasoning that
made unknown rule ids fatal.

## Testing

The recalibration spec found that the existing tests did not pin the thresholds at all: an
accidental edit to either constant would not have failed a test. That gap must not widen here.

- `resolveRuleOptions`: defaults with no config; global override of an integer; list accumulation
  across defaults + global + two matching override entries; later-entry-wins for integers;
  no-overrides fast path returning the same values as the general path.
- Shared glob matching: one test asserting a severity override and an option override on the same
  entry select the same set of files.
- Per rule with options: the **built-in default boundary is kept pinned** (`propCount: 6` passes /
  `7` flagged, `loc: 200` passes / `201` flagged), plus a configured-value boundary.
- `settingSeverity`: the object form with `severity: 'off'` disables the rule exactly as the bare
  `'off'` string does, and an object with no `severity` leaves the built-in severity intact.
- CLI config validation: each fatal case above, plus a valid config round-tripping.
- Existing `componentRule` / `lengthRule` tests updated for the new signature.

## Docs and release

- `docs/src/content/docs/guides/configuration.md` and its `ja/` mirror gain a section on rule
  options, the two option types, and addition-only list semantics.
- The six rule pages that gain options get a "Configuration" section, en and ja.
- Changeset: **minor** across the published packages — new capability, no behaviour change for a
  config that does not use it. The body notes the `RuleSetting` union widening.

## Out of scope (recorded, not fixed)

- **CLI flags for options.** Thresholds are config-file only. `--rules` / `--ignore` are
  allow/deny lists; encoding structured options into flag strings reads poorly and no demand has
  been observed.
- **Type-level option completion.** `options` stays `Record<string, unknown>`; correctness is
  enforced at load time by `validateRuleOptions`. A per-rule typed config map would complicate
  core's exported types substantially for autocomplete alone. Revisit if a `defineConfig` helper
  is added.
- **Unifying severity and option resolution** (retiring the `applyOverrides` post-pass). See the
  timing-split section.
- **`seo/json-ld-placeholder` patterns.** See the inventory section.
- **A `files:`-scoped override cannot remove a passing seed for a route-scoped rule.**
  `seo/title-length`, `seo/description-length`, and `performance/preconnect` emit a PASS result
  with `route` but no `location`. An override's `files:` matcher (`applyOverrides` in
  `packages/core/src/config-apply.ts`) can only match a result that carries `location`, so
  `severity: 'off'` on a `files:`-scoped entry silently fails to remove the passing seed for these
  rules — the seed survives and stays counted, even when the same override's `options` are what
  turned the finding into a PASS in the first place. This is a pre-existing gap, not something
  introduced on this branch.

  It was fixed on this branch (commit `e67ed9a`) and then reverted after review found two CLI
  consumers that read `.location` on _all_ results, not just penalized ones —
  `filterToChangedFiles` (`packages/cli/src/changed-files.ts`) uses "no location" as its
  definition of a droppable passing seed, and `findingKey` (`packages/cli/src/baseline.ts`) uses
  `id::route::location` as an identity key. Adding a location to these three rules' PASS results
  broke both assumptions: a changed-file health computation flipped from 79 to 90 on a single
  extra PASS seed, and a baseline run could collide a passing with a penalized result for the same
  route and file.

  **Which PASS results carry a location is currently inconsistent, and that is the real problem
  here.** `headTagRule` (`packages/core/src/rules/seo/head-tag-rule.ts`, backing `seo/canonical-url`,
  `og-title`, `og-image`, `charset`, `viewport`, `twitter-card`, `description-presence`,
  `og-description`, `json-ld`) and `seo/title-presence` already set `location` unconditionally,
  including on passing results; the component- and Kit-module-scoped factories and the remaining
  route-scoped rules do not. So `filterToChangedFiles`'s premise — that a passing seed is
  recognisable by having no location — is already only partly true today, independently of this
  branch. Closing the gap properly means picking one convention for every PASS-emitting rule and
  giving `filterToChangedFiles` and `findingKey` a definition that does not rely on `location`'s
  absence to mean "passing" — a deliberate change of its own, not a one-file patch. Deferred to a
  future spec.
