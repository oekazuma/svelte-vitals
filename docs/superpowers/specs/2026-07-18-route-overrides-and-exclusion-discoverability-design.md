# Route-scoped rule overrides + exclusion discoverability

Date: 2026-07-18
Status: approved (user-confirmed direction from CI-adoption feedback on X)

## Motivation

A CI adopter hit a wall: authenticated-only routes were flagged en masse by SEO
meta rules, and they could not find a way to exclude "these rules on these
routes" when running through `@svelte-vitals/action`. Two real problems:

1. **Discoverability** — the mechanism that solves the immediate case already
   exists (`svelte-vitals-suppressions.json` is applied automatically by the
   action, and `svelte-vitals.config.*` is loaded by `analyzeProject`), but
   nothing near the action's docs says so, and `packages/action` has no README
   at all. The action's inputs table reads as "this is all the configuration
   there is".
2. **A real feature gap** — the suppressions file is a snapshot amnesty keyed on
   exact `(id, route, location)`. Adding a *new* authenticated route later fails
   CI again until `--update-suppressions` is re-run. There is no way to express
   the durable policy "routes under `/(app)` are not public; don't run SEO
   rules there".

Three deliverables, in this design:

- **A. Docs**: action README + an "Excluding routes or rules" section in the CI
  guide + `overrides` in the config-file guide (en/ja).
- **B. Report hint**: a one-line footer in the Markdown report (job summary /
  sticky PR comment) linking to the exclusion docs whenever findings exist.
- **C. Feature**: declarative route-scoped rule overrides in the config file.

## C. Route-scoped overrides

### Config shape

```ts
export interface RuleOverride {
  /** Route-id glob(s), e.g. '/admin/**'. Route ids drop (group) segments. */
  route?: string | string[];
  /** Source-path glob(s) matched against a finding's location, e.g. 'src/routes/(app)/**'. */
  files?: string | string[];
  /** Keys are rule ids ('SEO001') or category names ('seo'). */
  rules: Record<string, RuleSetting>; // 'off' | 'critical' | 'warning' | 'info'
}

interface Config {
  // ...existing fields
  /** Route-/file-scoped rule overrides, applied to results after analysis. */
  overrides?: RuleOverride[];
}
```

At least one of `route` / `files` is required per entry (validated fatally).

Rationale for ESLint-style entries (chosen over per-rule `exclude` lists or a
category-only knob): one entry expresses the motivating case in one line
(`{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }`), scales to per-rule
and per-severity tweaks for free by reusing `RuleSetting`, and is the shape
users already know.

**Why `files` exists (found during implementation):** `deriveRoute` drops
`(group)` segments from route ids (`src/routes/(app)/dashboard/+page.svelte`
reports as `/dashboard`), so a route glob cannot target "everything in the
`(app)` group" — the exact shape the motivating auth-routes case takes. `files`
globs match the finding's `location` (source path), where the group directory
is visible.

### Matching semantics

- An entry matches a finding when **any `route` glob matches `Result.route` OR
  any `files` glob matches `Result.location`**. Findings with neither field
  (some project-scoped findings) never match — global `rules` config already
  covers those.
- Caveat: passing seeds generally carry no `location`, so a `files`-only entry
  removes penalized findings but leaves passing seeds of the same rule. Gating
  and scores behave correctly (passing seeds are inert); only the
  "checks passed" count retains them.
- Glob support is deliberately minimal, implemented in core with no new
  dependency (core stays runtime-agnostic; `(`, `)`, `[`, `]` are escaped as
  literals since SvelteKit paths use them):
  - `*` matches within a segment (no `/`),
  - `**` matches across segments,
  - a trailing `/**` also matches the bare prefix (`'/admin/**'` matches
    `/admin` itself — the intuitive reading of "everything under /admin").
  - anything else is literal; matching is case-sensitive and anchored
    (full-string match).
- Precedence: entries are evaluated in array order, **later entries win**;
  within one entry, a rule-id key beats a category key. Overrides are applied
  after global `rules` severities, so an override always wins over the global
  setting for matched routes.

### Application point

New pure function in `packages/core/src/config-apply.ts`:

```ts
applyOverrides(results: Result[], config: Config): Result[]
```

- `'off'` **removes the result entirely** — both penalized and passing entries —
  as if the rule had not run for that route. (Keeping passing seeds while
  dropping failures would inflate the score; symmetric removal keeps
  scoring/`passed` counts honest.)
- A severity value rewrites `result.severity` (same shape as
  `applyRuleSeverities`).
- Called immediately after `applyRuleSeverities` in
  `packages/cli/src/index.ts` (`analyzeProject` — CLI, MCP, and the action all
  inherit it) and `packages/vite/src/analyze.ts` (build gate; also gains an
  `overrides` plugin option with the usual option > file precedence). The dev
  `svelteVitalsHandle` (`packages/vite/src/hooks/handle.ts`) is deliberately
  unchanged: it is observe-only, never gates, and reads no config file. It
  cannot be folded into `selectRules` because that operates pre-run on rules,
  not per-route.

### Validation (config file)

`packages/cli/src/config-file.ts` learns the `overrides` key (added to
`KNOWN_TOP_LEVEL_KEYS`). Fatal errors (same philosophy as `rules` — a silently
dropped override would un-gate or over-gate CI):

- `overrides` not an array of plain objects,
- an entry whose `route`/`files` is present but not a string or non-empty
  string array, or an entry with neither; `rules` missing or not a plain
  object,
- a `rules` key that is neither a known rule id nor a category name,
- a `rules` value that is not `'off' | 'critical' | 'warning' | 'info'`.

`analyzeProject`'s per-field precedence merge passes `file.overrides` through;
no CLI flag is added (config-file only, like `metaComponents` in spirit —
route policy belongs in a committed file, not a flag).

### Out of scope

- Auto-relaxing SEO rules on routes that declare `noindex` (idea #4 from the
  discussion) — separate design if pursued.

## B. Report footer hint

`formatMarkdownReport` (core) appends, only when at least one finding row is
rendered, a final line:

> _Expected findings (e.g. routes behind auth)? See [Excluding routes or rules](https://oekazuma.github.io/svelte-vitals/guides/ci/#excluding-routes-or-rules)._

This lands in both the job summary and the sticky PR comment via the action
with no action change (dist rebuild only). Not added to console/HTML reporters:
the CI comment is where a blocked adopter is actually standing when they need
the pointer.

## A. Docs

- **`packages/action/README.md`** (new; shipped to npm): what the action does,
  the inputs table, and a Configuration section stating explicitly that the
  action loads the project's `svelte-vitals.config.*` and applies
  `svelte-vitals-suppressions.json` automatically — inputs are *not* the whole
  configuration surface. Links to the CI guide.
- **CI guide** (`guides/ci.md`, en/ja): new `## Excluding routes or rules`
  section near the inputs table covering the three mechanisms and when to use
  which: global `rules: { X: 'off' }` (never want the rule), `overrides`
  (rule/category off for a route subtree — durable policy), suppressions file
  (accept existing findings one-shot, gate only new ones).
- **Config guide** (`guides/configuration.mdx`, en/ja): `overrides` row in the
  options table + example.

## Testing

- Core unit tests (`packages/core/test`): glob matcher edge cases (`*` vs `**`,
  trailing `/**` matching the bare prefix, literal `(`/`[` in routes,
  anchoring), `'off'` removal of passing + failing entries, severity rewrite,
  entry-order precedence, rule-id-over-category precedence, no-`route` findings
  untouched, empty/absent `overrides` is a no-op identity.
- CLI config-file tests: valid shapes accepted, each fatal-validation case
  throws with an actionable message, unknown-key warning unaffected.
- Reporter test: footer present with findings, absent on a clean report.
- `packages/cli/test/docs-links.test.ts` guards rule docs only — unaffected.

## Release

Two changesets: (1) minor — `overrides` feature (core, cli, vite, action);
(2) minor — report footer hint (core, action). `packages/action/dist` is
committed, so it is rebuilt in the same PR (repo convention:
`chore(action): rebuild dist/`).
