# svelte-vitals

## 0.46.0

### Minor Changes

- ae80f05: `@svelte-vitals/core` now exports `formatFailedRuleWarning`, the "rule … failed and was skipped" message formatter shared by the CLI, build mode, and (now) the dev dashboard.

  `svelte-vitals`'s `analyzeProject` now also returns `failedRuleIds`, the ids of rules that crashed during the run (already folded into its returned `config` via `withFailedRulesOff`, exposed separately so a caller with its own base config can apply the same correction without adopting `analyzeProject`'s config).

  The dev dashboard now scores a crashed rule as not-run (matching the CLI and build mode) instead of silently inflating Health, without disturbing plugin-option `weights`/`overrides`; plugin warnings strip terminal escape sequences.

### Patch Changes

- 329de70: fix: shell completion now emits exactly one candidate per flag. Multi-line flag descriptions (e.g. `install --client`) no longer leak their continuation lines as bogus candidates, and `--no-color`/`--no-animation`/`--no-suppressions` now show their real descriptions instead of the bare stripped key.
- 7ca8bd2: fix: restore the terminal cursor when the analysis spinner stops. `--no-animation` runs (and error paths that lead into interactive prompts) previously left the cursor hidden until the process exited.
- 29f78c7: `ci install`'s scaffolded workflow now sets `persist-credentials: false` on checkout and uses the same `actions/checkout` release this repo pins (v7.0.1). Existing workflows: re-run `svelte-vitals ci install --force` to regenerate.
- 471d465: fix: an internal crash in the CLI's dispatch layer now exits 2 with a one-line `svelte-vitals:` diagnostic instead of exit 1 with a raw stack trace — exit 1 keeps meaning "a finding failed the gate".
- 3edb4ff: `@svelte-vitals/core` now exports `terminalSafe`, the ANSI/OSC/C0 escape stripper already used by the console reporter, for sinks outside the reporters.

  `svelte-vitals`'s stderr diagnostics (skipped files, failed rules, app detection, and other errors) now strip terminal escape sequences from analyzed-repo-derived strings before printing, matching the console reporter's existing protection.

- Updated dependencies [ae80f05]
- Updated dependencies [3edb4ff]
  - @svelte-vitals/core@0.42.0

## 0.45.1

### Patch Changes

- 27e3b71: The CLI's transitive `<head>`/heading resolution (the layer-3 walk that follows a component import to find the `<title>`/meta/JSON-LD/`<h1>` it contributes) now honours a project's `kit.alias`/`kit.files.lib` declared in `svelte.config`, matching the resolution already used by `architecture/private-scope-import`, `architecture/route-component-import`, `security/handler-state-write`, and `security/shared-state-import`. Previously only `$lib/…` (hard-coded to `src/lib/…`) and relative imports were followed; a component imported through a custom alias (`$components`, `$ui`, …) was invisible to this walk.

  Gate movement, both directions: a route whose `<title>`/meta/JSON-LD/`<h1>` lives in an alias-imported component no longer reports a false "Missing" finding, so Health can rise on projects using a custom alias. Conversely, content in those components — including defects (an empty `<title>`, multiple `<h1>`s, invalid JSON-LD) — is now analyzed by every consumer of the head/headings channels, so new findings can appear and a `--fail-on warning` run that was green can turn red on upgrade. Aliases are resolved with the same first-match, segment-boundary semantics the bundler uses (see the kit-alias-resolution design doc); an alias whose target file doesn't exist is skipped silently, same as an unresolvable `$lib` guess today. A bare custom-alias specifier (`import X from '$comp'`) now also gets the walk's existing `.svelte` extension guess (following `src/compdir.svelte` when it exists), matching Vite's `resolve.extensions` behaviour — bare `$lib` alone stays unfollowed as before. The vite plugin's rendered-HTML mode is unaffected — it already sees every component's contribution in the built output, which is what this change aligns the CLI's static mode with (same precedent as issue #425/#443).

- ddcf62d: A rule that throws no longer kills the analysis: the run completes without it, its id and error surface as a warning, and its weight is removed from that run's Health denominator so the score is not silently inflated — in both the CLI and the vite plugin's build mode. Previously the CLI died with exit 2 and the vite plugin skipped the entire analysis (and its build gate) with a single "analysis failed" warning; both now finish with real results for every other rule.
- Updated dependencies [5c7dc63]
- Updated dependencies [6cfef97]
- Updated dependencies [27e3b71]
- Updated dependencies [ddcf62d]
  - @svelte-vitals/core@0.41.1

## 0.45.0

### Minor Changes

- 04df077: The agent reporter's auto-selection now recognizes the major AI-agent harnesses (Cursor, Codex, Replit, and others alongside Claude Code) by delegating detection to gunshi's agent profile (std-env) instead of a two-entry allow-list. Agents that previously received console output will now get the agent reporter automatically; an explicit `--reporter` flag or `SVELTE_VITALS_REPORTER` still overrides, and `SVELTE_VITALS_AGENT=1` remains the universal opt-in for unrecognized harnesses. The recognized-agent list evolves with gunshi updates.
- 3965688: A mistyped sub-command or rule id now gets a `did you mean …?` hint appended after the existing error message, on four surfaces: `svelte-vitals <mistyped-subcommand>` falling through to the root analyzer as a path that doesn't exist on disk (e.g. `svelte-vitals isntall`), `docs <unknown-subcommand>`, `ci <unknown-subcommand>`, and `explain <unknown-rule-id>`. The hint only appears when the typed token is close to a real name and, for the root analyzer, when the explicit path does not exist on disk — an existing path is always analyzed as asked, never redirected. Nothing about the existing error wording, exit codes, or stdout/stderr split changes; the hint is a new, additional line.
- 6d62572: The CLI's argument parsing and dispatch now run on gunshi (the root analyzer joins `docs` and `explain`), and the root `--help` output's options section is generated from the argument declarations instead of hand-maintained — its formatting changes shape once. Everything else is pinned unchanged by the characterization suite: flags and their meanings, exit codes, error wording, `--version` output, and reporter stdout are all byte-identical.
- d855a8c: The CLI migration to gunshi is complete: `install` and `ci` join the analyzer, `docs`, and `explain`, and the legacy argument-parsing layer is removed. Two declared movements: the `--help` output of `docs`/`explain`/`install`/`ci` now generates its options section from the argument declarations (same hybrid format the root command adopted), and `ci <unknown-subcommand>` prints its guidance to stderr instead of stdout before exiting 2 — stdout is now empty on every exit-2 path without exceptions. All flags, exit codes, error wording, and reporter outputs are otherwise byte-identical, pinned by the characterization suite.
- f581398: `--help` (all five surfaces: the root analyzer, `docs`, `explain`, `install`, `ci`) now renders in Japanese when the resolved locale is `ja` — POSIX first-non-empty-wins across `SVELTE_VITALS_LANG` > `LC_ALL` > `LC_MESSAGES` > `LANG` (`ja`, `ja-JP`, and `ja_JP.UTF-8` all canonicalize to `ja`; anything else, including unset, stays English). Everything else is byte-identical to today when no ja locale applies: English output, error messages, warnings, reporter output, and shell completion are all unaffected by this env, pinned by the existing help goldens and new boundary-regression tests. There is no `--lang` flag — the environment already expresses this on every terminal.
- 117931b: Shell completion: `svelte-vitals complete <bash|zsh|fish|powershell>` prints a completion script — sub-command names, every flag, and values for the enum-ish flags (`--reporter`, `--fail-on`, `--category`, `--treat-dynamic-as`). Completions are generated from the same argument declarations that drive parsing and `--help`, so they stay in sync with the CLI automatically. `complete` is a new reserved top-level token, alongside `docs`/`explain`/`install`/`ci` — it wins over a same-named directory, same as those four. No existing command, flag, or output changes, except the root `--help` Usage block, which now lists the new sub-command.

## 0.44.4

### Patch Changes

- c550db7: The CLI's static mode now analyzes every `application/ld+json` script on a route — multiple tags in one head, tags split across the layout chain, and tags contributed by imported components — instead of silently keeping only the last one, matching what the vite plugin already does with rendered HTML. Gate movement: JSON-LD documents that were previously dropped are now checked by the whole json-ld rule family, so projects with defects in those documents will see new findings (warnings can turn a `--fail-on warning` run red, and Health can drop). Documents that were already the sole survivor are analyzed exactly as before.

  One movement in the head-tag presence rules: when multiple tags of the same kind match on a route — JSON-LD always can now, and rendered HTML can carry duplicate metas — the rule reports the strongest one (a satisfying tag beats an empty one, own beats inherited) instead of an arbitrary first/last survivor. A route with a valid document alongside an empty script now passes where it could (order-dependently) report 'Empty' before, so a previously-reported Empty finding can disappear; routes whose every script is empty still report Empty. Findings from layout- or component-contributed documents are attributed to the contributing file.

- Updated dependencies [c550db7]
- Updated dependencies [3beca66]
  - @svelte-vitals/core@0.41.0

## 0.44.3

### Patch Changes

- 417e7af: `--update-suppressions` now writes the suppressions file atomically (temp file + rename), so an interrupted run can no longer leave a corrupt `svelte-vitals-suppressions.json` that fails every later run.
- 49fbb19: `install` no longer hangs waiting for input when stdin is piped while stdout is a terminal — interactive prompts now require both stdin and stdout to be TTYs, matching the analyzer's existing gate.
- 38ed0fb: The independent collection passes (routes, components, Kit modules, source files) now run concurrently instead of sequentially, shortening analysis wall time on larger projects. Same file reads, same results — only the awaiting overlaps.
- 8c256e3: Files that fail to parse are no longer silently invisible: collectors mark them (`parseFailed` on the fact) and the CLI prints a stderr warning listing the skipped files. No finding, score, or exit-code movement — stderr diagnostics only; reporter stdout (json/sarif) is unchanged and still machine-parseable.
- ecd3192: Route globs (`--route`, config `routes`) containing a literal space now match that space literally. Previously an internal placeholder collision silently turned each space into `.*`, over-matching (e.g. `blog/my post` matched `/blog/my-post`).
- Updated dependencies [8c256e3]
  - @svelte-vitals/core@0.40.1

## 0.44.2

### Patch Changes

- 090f5d7: `docs show <rule-id>` now tells you the id is a rule and points at `svelte-vitals explain <rule-id>` (which already prints a rule's rationale, options, and docs URL offline) instead of only listing the workflow guide topics. The agent report's intro now mentions `explain` too, so agents can reach rule semantics without the network.
- 59869b4: `performance/minify-disabled`: the rule's rationale claimed "Vite minifies with esbuild by default" — false since Vite 8, which defaults to its own Oxc minifier and made `esbuild` an optional peer dependency. The machine `fix.snippet` wrote `minify: 'esbuild'`, which an agent applying it verbatim would ship as a build newly requiring an undeclared dependency. The description and snippet now describe removing/scoping the override without naming a minifier; docs (en/ja) drop the stale esbuild-default claim and add `'oxc'` to the not-flagged list.

  `performance/preconnect`: the machine `fix.snippet` preconnected only `fonts.googleapis.com`. Google Fonts serves the actual font files from `fonts.gstatic.com` under anonymous CORS, so the canonical fix — already shown in the rule's own docs — is the two-link pair, the second carrying `crossorigin`. The snippet now matches the docs.

  `performance/render-blocking-script`: both collectors (`svelte-vitals`'s static parse and `@svelte-vitals/vite`'s rendered-HTML parse) marked a `<script src>` render-blocking whenever it lacked `defer`/`async`/`type="module"`, which false-positived on non-executing script types — most notably `type="text/partytown"`, SvelteKit's own recommended way to offload third-party scripts off the main thread, plus `type="importmap"` and `type="speculationrules"`. None of these execute as a classic script, so none can block HTML parsing. Both collectors now flag only a script whose `type` is absent, empty, or a JavaScript MIME type (a classic script) and that lacks `defer`/`async` — a strict narrowing of detection, removing this false positive without adding any new one.

- 5e89a45: seo/single-h1 in the CLI's static mode now counts headings rendered by imported local components (followed transitively through the same depth-limited traversal head resolution already uses — no additional file reads). Extracting a page's `<h1>` into a `$lib` component no longer produces a false "Missing <h1>" warning, aligning the CLI with the vite plugin's rendered-HTML result. Two finding movements: false "Missing <h1>" warnings on such routes disappear (Health can rise), and routes whose chain plus components render more than one `<h1>` may gain a new info-level multiple-h1 finding (fails only under `--fail-on info`). Headings inside node_modules or dynamically chosen components remain invisible to static mode; the vite plugin stays the authoritative check there. seo/heading-level-skip is unchanged — component headings have no reliable document-order position, so the outline walk deliberately ignores them.
- Updated dependencies [578f4c8]
- Updated dependencies [090f5d7]
- Updated dependencies [72d908d]
- Updated dependencies [f09c015]
- Updated dependencies [59869b4]
- Updated dependencies [369f0b1]
- Updated dependencies [20d6f16]
- Updated dependencies [5e89a45]
- Updated dependencies [fe4e575]
- Updated dependencies [2d0bae3]
  - @svelte-vitals/core@0.40.0

## 0.44.1

### Patch Changes

- a9fba45: Fix `--baseline` silently masking a genuine regression: for the SEO rules whose passing results already carry a file `location` (`seo/title-presence` and the ten `headTagRule`-backed ids — `canonical-url`, `og-title`, `og-image`, `charset`, `viewport`, `twitter-card`, `description-presence`, `og-description`, `json-ld`, `og-url`), a route that passed at the baseline ref and then regressed (e.g. a `<title>` deleted) produced identical comparison keys on both sides and was dropped as "not new" instead of being reported. `findingKey` comparison is now penalized-findings-only on both the current and baseline sides (matching the pattern `suppressions.ts` already uses), so a passing result can never key-collide with a penalized one.

  Behavior change as a result: passing results no longer appear in `--baseline` output at all — previously, a route that was penalized at the baseline and now passes could still surface its passing result. Under `--baseline --score`, Health is now computed over the new penalized findings only — pass-seeded routes and categories no longer raise it — so a `--baseline` run's Health/`--min-health` can report a lower (stricter) score than before. See `docs/superpowers/specs/2026-08-08-pass-result-location-design.md` ("`findingKey` / `filterToNewFindings`" section) for the design record.

- ac41349: Fix `files:`-scoped `severity: 'off'` overrides silently failing to remove a passing seed (issue #382), now that `@svelte-vitals/core` gives every rule's PASS result the same `location` its penalized counterpart would (see the linked design doc). Without a matching CLI-side fix, that alone would have broken `--diff`/`--staged`: `filterToChangedFiles` used to keep a result whenever it had _any_ `location` in the changed set, so once passing results uniformly carried one, an incidental pass on a changed file could survive scoping.

  `filterToChangedFiles` (and its one call site, `applyScope`) now takes the resolved `Config` (optional, defaulting like `filterToNewFindings` in `baseline.ts` already does) and keeps a result only when it's penalized, or is `architecture/unit-entry-file`'s deliberately route-less pass seed (PR #337) — every other route-carrying PASS is dropped even when its `location` is in the changed set.

  Behavior change as a result: for `seo/title-presence` and the ten `headTagRule`-backed rule ids (`canonical-url`, `og-title`, `og-image`, `charset`, `viewport`, `twitter-card`, `description-presence`, `og-description`, `json-ld`, `og-url`) — which already carried `location` on PASS before this change — a passing result on a changed file no longer survives `--diff`/`--staged` filtering. This was a live, undetected leak: a single incidental passing check on a changed file could promote its whole category from _absent_ to a fabricated 100, pulling `--diff` Health upward. Measured on the reference shape (one critical `correctness` finding plus one such SEO PASS, both on changed files, default config): Health moves from **89 to 79** — 79 is correct; 89 was the bug. A `--min-health` gate can now fail a run that previously passed only because of this leak. The three rules named in the design doc (`seo/title-length`, `seo/description-length`, `performance/preconnect`) newly gain `location` in this release too, but their PASS results are penalized-gated the same way, so they contribute no net `--diff` Health movement of their own — their `location` addition only matters for the `files:`-override fix above.

  `architecture/unit-entry-file`'s route-less pass seed is exempt from the drop above (PR #337) — this preserves pre-existing behavior, not a new exception: `main`'s `filterToChangedFiles` already kept this pass unconditionally (no `isPenalized` gate at all), so a changed conforming unit already promoted `architecture` to a fabricated 100 in `--diff` Health before this release, and still does after — the tradeoff (that pass staying visible under `--diff`, at that cost) is #337's, kept as-is, not something this PR introduces or removes.

  See `docs/superpowers/specs/2026-08-08-pass-result-location-design.md` for the full design record. The `svelte-vitals-action` repo bundles `applyScope`, so its `--diff` Health inherits this change on its next dependency bump — its own release notes should carry the same warning.

- bd946e2: Let `--out-file -` (space-separated) and `--out-file=-` stream to stdout again, matching the documented contract (`--help`, the reporters guide, and `svelte-vitals docs show output`). The flag-shaped/empty-value guard added in the previous release rejected the literal `-` along with every other dash-prefixed value; `-` is now the one allowed exception, exempted only for `--out-file`. Regular file paths (e.g. `--out-file report.html`) were never affected and remain valid; dash-prefixed values for every other flag — and any dash-prefixed `--out-file` value other than exactly `-` — still exit 2 as before.
- 7c5a11b: Exit 2 when `--rules` and `--category` are both passed and `--category` excludes every rule named in `--rules`. Previously `analyzeProject`'s category filter ran after rule selection, so a `--rules` id whose category wasn't in `--category` was dropped silently — the run exited 0 with zero rules examined and nothing on stderr (issue #384). The check mirrors the existing unknown-rule-id error: fatal, naming the excluded rule id(s) and the `--category` list. `--ignore` is unaffected — ignoring a rule that `--category` already excludes is harmless, not a conflict.
- f0798b0: Update the registry-visible package descriptions and keywords, which still described svelte-vitals as an SEO-only checker. `svelte-vitals`'s description now matches its own `--help` text — a deterministic SvelteKit code-health scanner across SEO, performance, correctness, security, and architecture — and adds `performance`, `security`, `code-quality`, `static-analysis` keywords. `@svelte-vitals/vite`'s description now also mentions the live dev dashboard alongside the build-time prerendered-HTML analysis. No behavior change.
- ab41e48: Scoped runs (`--diff`/`--staged`/`--baseline`) no longer report `svelte-vitals-suppressions.json` entries as stale just because the scope excluded their findings — staleness is now judged against the project-wide result set, so the documented CI recipe (`--diff origin/main --baseline origin/main`) no longer prints a misleading "N stale entries — re-run --update-suppressions to prune" on every run. `--route` runs, where even the project-wide set is collected route-narrowed, omit the stale count entirely rather than report an unreliable one. `--update-suppressions` combined with `--route` now refuses (exit 2) instead of silently pruning suppression entries outside that route.
- 28d22ae: Naming a rule in `--rules` that a config `overrides` entry scopes `'off'` (directly by rule id, or via its category key) now prints a startup warning naming the rule and the overrides entry's `files`/`route` scope, instead of silently reporting a compliant tree. The semantics — whether `--rules` should force-enable through a scoped `'off'` — are deliberately unchanged; only the silence is fixed (#385).
- Updated dependencies [a3dffb3]
- Updated dependencies [8e8bd5c]
- Updated dependencies [ac41349]
- Updated dependencies [65ce0c1]
- Updated dependencies [acee3c6]
  - @svelte-vitals/core@0.39.0

## 0.44.0

### Minor Changes

- b80d133: Replace the `mri` argument parser with Node's built-in `util.parseArgs` and remove the unused `buildRulesConfig` export (superseded by the rule-selection resolver).

  Flag names, aliases, boolean `--flag=false` handling, and unknown-flag passthrough are unchanged. Edge cases on malformed input differ slightly: a repeated string flag now takes the last value instead of being ignored, a string flag passed without a value now falls back to its default (or exits with a clear error for `--min-health`/`--baseline`) instead of being treated as an empty string, and a value following an unknown flag is now treated as a positional argument instead of being swallowed by that flag. `--baseline` additionally rejects values that start with `-`, so a following flag (e.g. `--baseline --force`) can never be silently consumed as the ref.

### Patch Changes

- 87d5d62: `--baseline` now analyzes the baseline ref under the current checkout's `svelte-vitals.config.*` instead of re-loading the config inside the temporary worktree. This fixes the gate reporting every finding as new when the config imports `svelte-vitals` (as the `install` wizard's `.ts` scaffold does) — the worktree has no `node_modules` in its ancestry, so the import used to throw and the baseline comparison silently degraded to "report everything". It also makes a config-only edit not count as an "introduced" finding, since both sides of the comparison now run under the same rules.
- d07739c: Fix `--diff`/`--staged` silently dropping findings in files whose paths contain non-ASCII characters (e.g. Japanese route directories). Git's default `core.quotePath=true` octal-escapes such paths in `--name-only` output, which never matched the raw UTF-8 `Result.location`; changed-file detection now reads NUL-separated (`-z`) output instead.
- ca4ff54: Reject flag-shaped and empty values on every CLI string flag (`--meta-components`, `--treat-dynamic-as`, `--route`, `--fail-on`, `--reporter`, `--rules`, `--ignore`, `--min-health`, `--out-file`, `--weights`, `--category`), matching the existing `--baseline` guard. Previously `--route --staged` silently consumed `--staged` as the route value (dropping it from the run), and `--min-health=` (e.g. from an unset CI environment variable) coerced to `0`, turning a health gate into one that could never fail. Both shapes now exit 2 with a clear error instead of silently proceeding. `--min-health` validation moved from `bin.ts` into `resolveArgs` alongside every other flag; `--diff` keeps its existing bare/empty-defaults-to-`HEAD` behavior.
- Updated dependencies [003e56c]
- Updated dependencies [1859d24]
  - @svelte-vitals/core@0.38.0

## 0.43.0

### Minor Changes

- cd79b62: The JSON report gains a top-level `examined` map: per rule, per declaration, how many places that declaration
  judged.

  A glob-configured rule reporting zero findings could not be told apart from one whose declarations matched
  nothing, and verifying a real project meant planting a deliberate violation to see whether anything fired.
  `architecture/reserved-name-placement` now reports this count for each of its declarations, keyed by the same
  label its own diagnostic uses, so the two can be read together.

  Four exported shapes change. `runRules` now returns `{ results, examined }` instead of a bare `Result[]`.
  `RuleContext` gains an optional `recordExamined(counts)`, which the engine supplies so a rule can report its
  counts without every caller having to thread a sink through by hand. `JsonReport` gains an optional top-level
  `examined: Record<string, Record<string, number>>`. `AnalyzeResult`, the return type of `svelte-vitals`'s
  `analyzeProject`, gains a required `examined` member of the same shape, carrying the counts unfiltered by
  `--diff`, `--baseline` or suppressions.

  The map has three states. A rule that reports no counts has no entry — which is every rule but
  `architecture/reserved-name-placement` today, so a consumer that does not know the field sees an unchanged
  report. A rule that counts but whose configuration declares nothing has an empty entry. A declaration that
  judged nothing is present with `0`.

  `RuleEvidence` — the shape of `rules[id]` — is unchanged. The count deliberately does not go there: `rules`
  describes what survived into the report (baseline, suppression and `--diff` narrow it), while `examined`
  describes what the analysis looked at, unaffected by any of that filtering. Putting both under one key would
  give one object two different scopes with nothing marking the difference.

### Patch Changes

- Updated dependencies [cd79b62]
  - @svelte-vitals/core@0.37.0

## 0.42.0

### Minor Changes

- 298849d: Fix `--rules` discarding a named rule's own severity and options from the config file. `--rules
<id>` previously ran the named rules at built-in defaults, so an option-configured rule (an integer
  `max`, a `packages`/`origins` list, a `directories` map, ...) could not be run alone — its
  configured thresholds and globs were gone for the run. For a rule that is inert until its
  convention is declared, this meant no convention at all: the rule reported nothing, at exit 0, with
  no warning.

  `--rules` now inherits that configuration while still narrowing the run to the rule ids it names,
  and still overriding a config-file `'off'` for those ids — turning a rule off is itself selection,
  so `--rules <that rule>` still force-enables it, only now under its declared severity and options
  instead of the built-in ones.

### Patch Changes

- cb394ce: Fix `--ignore` silently discarding a config file's per-rule settings and options for every other
  rule. `--ignore` was translated into a partial `rules` map containing nothing but `'off'` entries
  for the ids it named, and that map replaced the config file's `rules` field outright instead of
  layering on top of it — so `--ignore some/unrelated-rule-id` dropped severities and options (e.g.
  a configured `max` or `directories`) declared for every rule not named, and those rules ran with
  their built-in defaults instead.

  The failure was silent: exit 0, no warning, and the flag didn't even have to name the affected
  rule — ignoring one unrelated rule was enough to reset every other rule's options. A run narrowed
  with `--ignore` could report clean indefinitely while the config file's intent was being ignored.

  `--ignore` now only ever adds `'off'` entries for the rule ids it names, layered on top of
  whatever the config file (or `--rules`) already resolved `rules` to. `--rules` still means "run
  only these rules" and still overrides a config-file `'off'` for the ids it names, and it now
  inherits their severity and options instead of discarding them.

- 767525a: Fix `architecture/reserved-name-placement`'s dead-declaration diagnostic naming a correct
  declaration while staying silent about a broken one. Its unit-map reason judged a declaration by
  whether its glob had happened to govern a directory, not by whether the glob could reach one: a
  convention permitting a position no directory occupies yet was reported as dead even though it was
  correct, while a unit-map glob that could never match anything (a bare glob such as
  `capitalisedUnitPlacements: { parts: 'src/lib' }`, matched against the unit itself rather than an
  ancestor of it) reported nothing at all. The excluded-directory reason had the same defect for the
  same reason: it fired on any declaration whose glob matched at least one excluded directory, even
  one that also reached a live, correctly-placed unit.

  All three reasons now ask what a declaration's glob can reach, against the same live-directory and
  live-unit sets: `matched no directory`, `matched only excluded directories`, and the unit reason —
  now `reaches no unit` — are unaffected when a glob's only matches are directories that don't yet
  exist for that name, but fire when a glob structurally cannot reach a unit of the required case or
  a directory `exclude` leaves live. The rule's findings do not change; only which declarations the
  aggregated diagnostic names.

- Updated dependencies [767525a]
  - @svelte-vitals/core@0.36.1

## 0.41.0

### Minor Changes

- e25e890: Add architecture/reserved-name-placement: a reserved directory name may appear only in the places declared for it.

  Its sibling, `architecture/reserved-directory-names`, says which names a position allows; this rule says which
  positions a name allows, for names permitted in more than one kind of place at once — under a unit, under a
  grouping directory, under a route directory. It is off until you configure it: all three placement maps
  default to `{}`.

### Patch Changes

- Updated dependencies [e25e890]
- Updated dependencies [1020227]
  - @svelte-vitals/core@0.36.0

## 0.40.0

### Minor Changes

- 8f4da14: A less severe finding now costs less than a more severe one **within the same (category, scope) pair**, and
  the report says how much of a project each category touched.

  A key's category score is the share of that category's severity weight that survived, checks grouped by
  category and scope — the keys of the new `inventories` map, like `seo::route`. **Within one pair** a
  `warning` costs five times an `info` and a `critical` fifteen times, so a more severe finding always costs
  more, there. **Across pairs it does not**: a pair that checks very little is scored against a floor of 25, so
  a `warning` there can cost more than a `critical` in a large pair — a `warning` in a floored pair costs 20
  while a `critical` in `seo::route` costs 13.64. A key is now never scored against less than 25 points of
  checks: in a one-rule pair the three severities give **96** (`info`), **80** (`warning`) and **40**
  (`critical`), where a lone `warning` used to score **0**.

  Scores rise wherever a category checks few things. **A `--min-health` gate calibrated on the previous release
  will pass more easily; recalibrate it.**

  Because a score is a mean over every key, forty affected keys and one affected key can display alike. Each
  category in the JSON report now carries `keys` and `affectedKeys`, which distinguish them exactly, and
  an `inventories` map giving the divisor behind every key of a pair, so a route's per-category score can be
  checked by hand (a route's own `score`, which can span more than one pair, cannot).

### Patch Changes

- Updated dependencies [8f4da14]
  - @svelte-vitals/core@0.35.0

## 0.39.0

### Minor Changes

- 28d51e9: Each entry in the JSON report's `routes` array now carries a `categories` map of category name to score.

  A category's score is an average over its keys, so a category that looks wrong gives no clue which routes
  produced it. The report listed each route's findings but not what each route scored per category, and since a
  key's score became a ratio against the severity-weighted inventory of the checks it was measured against, that
  number is no longer something a reader can reconstruct by hand.

  Only the categories that produced a result on a route appear, so an absent category means "not measured here"
  rather than "perfect here". A route's `categories` values are **not guaranteed** to average to its `score`:
  `score` is one ratio over everything the route was measured against, while each category score uses that
  category's own inventory. They agree whenever every category on the route scores the same ratio — including
  every route with no findings — and can differ by several points otherwise.

### Patch Changes

- 872cf85: A large report is no longer truncated when the CLI's output is piped.

  `svelte-vitals --reporter json` writes the report and then exits, and a write to a pipe is asynchronous — so
  anything past the first buffer, 65,536 bytes on Linux and macOS, was discarded. The exit code was unaffected —
  it still reported the findings status the run warranted — so nothing distinguished a complete report from one
  cut mid-string. Any project whose report exceeds that size
  was affected, and `--reporter html` written to stdout the same way.

  The CLI now waits for stdout to drain before exiting. Piping to `jq`, to a file through a shell, or into
  another process delivers the whole report.

- Updated dependencies [28d51e9]
  - @svelte-vitals/core@0.34.0

## 0.38.0

### Minor Changes

- 6174836: Add `architecture/doc-link-target`, which reports a documentation link inside a component comment whose
  target no longer exists.

  Such a link has nothing to resolve it — no type refers to it, no module imports it, no test renders it — so
  a rename leaves it silently broken and only human review notices. A reorganisation that renames many units
  can break every one of them at once.

  **Off until configured.** Declare `urlRoots` with the URL prefixes that stand for your project's root; a
  link under one of them has that prefix stripped and the remainder looked up among the files under `src/`. A
  URL under no declared prefix is ignored, which is what keeps external links and documentation slugs out of
  the results — as is a remainder that lands outside `src/` (a root-level `CONTRIBUTING.md`, a `static/`
  asset), since the file inventory has no opinion there. A directory link written with its ordinary trailing
  slash resolves the same as one without.

  `ComponentFacts` gains a required `commentLinks` array carrying these links; anyone constructing a
  `ComponentFacts` directly (custom tooling, tests) needs to supply it.

- 3e3234b: `--reporter json` gains a top-level `rules` map of rule id to `{ findings, passed }`, listing every rule
  that ran.

  It answers a question the report could not: `issues` lists only failing findings, so a rule that found
  nothing left no trace — indistinguishable from a rule that was never selected. A rule present in `rules`
  ran; a rule missing from it was not selected. `passed` is also unavailable elsewhere, since `summary` is
  project-wide.

  The counts describe the report rather than the tree: baseline, suppression and `--diff` filtering are
  applied first, so a rule whose findings were all suppressed shows `findings: 0` and stays present.

- f9390f0: Category scores now reflect **how much** is wrong, not merely whether anything is.

  A key — a route or a source file — used to start at 100 and lose a fixed number of points per failing rule.
  That capped what a category could express: `architecture` is eight `info` rules, so no amount of bad code
  moved it below 92, and three more scopes bottomed out above 90. It also erased magnitude, because one
  finding moves a mean of N keys by `1/N`: on a large project, one finding and several hundred displayed the
  same score.

  A key now scores the share of what it was measured against that is intact, weighted by severity. Every
  category can reach 0, and the score moves with the number of findings.

  **Any category carrying a finding changes, most of them downward and by more than a point; a clean 100 stays 100.** `seo` and `correctness` stay within a point of their old values; `architecture`, `security` and
  `performance` move further, because their scales were the most compressed. A `--min-health` gate calibrated
  against the old numbers will start failing — recalibrate it against the new scale. `routes[].score` in the
  JSON report changes meaning the same way. Stored baselines are unaffected, since they key on findings rather
  than scores.

  Unchanged: the site-wide penalty stays in absolute points, a `critical` still caps a category at 79, and a
  displayed 100 still means no finding among the checks that ran.

### Patch Changes

- Updated dependencies [6174836]
- Updated dependencies [3e3234b]
- Updated dependencies [f9390f0]
  - @svelte-vitals/core@0.33.0

## 0.37.1

### Patch Changes

- Updated dependencies [091ec2f]
  - @svelte-vitals/core@0.32.0

## 0.37.0

### Minor Changes

- 4beaea9: **The CLI now answers its own questions.** Two new read-only commands, and a pointer to them from
  everywhere an agent is likely to look. Nothing about analysis changes.

  ### `svelte-vitals docs list` / `docs show <name>`

  A curated set of guides is bundled **inside the CLI**. `docs list` prints each with a one-line description, `docs show <name>` prints one, and
  `--json` gives the listing in machine-readable form.

  ```bash
  npx svelte-vitals docs list
  npx svelte-vitals docs show scoping
  ```

  Because they ship with the binary, what you read always matches the version you are running and
  works offline. The docs site remains the complete reference; this set is deliberately small and
  written for a terminal.

  ### `svelte-vitals explain --list`

  Prints every rule grouped by category, with its default severity and title. Previously the only
  way to discover a rule id was to pass a wrong one and read the error — an accident, not an
  affordance. `--list --json` gives `id`/`category`/`severity`/`title` per rule.

  ### Discovery pointers

  - `--version` now prints a one-line pointer to `docs list` **on stderr**. stdout is unchanged —
    still exactly `<cli-version> (core <core-version>)` — so anything parsing it keeps working.
  - `--help` gains an "If you are an AI agent" section naming the bundled docs, `--reporter agent`
    and `--reporter json`, `--diff`/`--staged`, `explain`, and the fact that exit `2` is never a
    pass and that the CLI never prompts when stdout is not a TTY.
  - The generated Agent Skill's playbook now sends the agent to `docs list` for anything outside the
    rule catalog it already embeds. Re-run `npx svelte-vitals@latest install --refresh` to pick this
    up in an already-generated skill.

  An agent is probabilistic about which surface it looks at, so the same route to the documentation
  is worth repeating at every one of them.

## 0.36.0

### Minor Changes

- 2a16e62: **`@svelte-vitals/mcp` is removed.** The agent story is now two pieces instead of three: the generated
  Agent Skill carries the rule knowledge, and the CLI runs the analysis. Nothing that the MCP server could
  do is lost — but one thing it could do had no CLI equivalent, so this release adds it first.

  **New: `svelte-vitals explain <rule-id>`.** Prints a single rule's title, category, default severity,
  rationale, docs URL and fix template — plus, for a configurable rule, every option's default, bounds, and
  **how a configured value merges with the built-in default** (`integer` replaces it, `string-list` appends
  to it, `string-map` is spread over it, so a built-in key's value is overridden rather than duplicated).
  `--json` emits the same object the `explain_rule` tool returned as `structuredContent`. An unknown id
  lists every known id and exits `2`.

  ```bash
  npx svelte-vitals explain performance/heavy-import
  ```

  ### Why the server is going away

  - **`analyze` duplicated the CLI without reaching anywhere new.** Its input schema was a hand-maintained
    mirror of the CLI flags, and its transport was stdio-only — any host that can spawn
    `npx -y @svelte-vitals/mcp` can equally run `npx svelte-vitals`.
  - **A remote server would not have changed that.** svelte-vitals analyzes a whole route tree plus config
    and `package.json` on disk, so a hosted version would have to receive the source or clone the repo —
    which is the GitHub Action's job, not an MCP server's.
  - **Version skew.** `npx -y @svelte-vitals/mcp` resolved independently of the `svelte-vitals` your project
    pins; running the CLI from the project does not.
  - **The skill already knew the rules.** The generated `SKILL.md` embeds the full rule catalog. `explain`
    now covers the only part it didn't.

  ### Migration

  | Was                                           | Now                                                                                    |
  | --------------------------------------------- | -------------------------------------------------------------------------------------- |
  | `analyze` tool                                | `npx svelte-vitals . --reporter agent` (Markdown for agents) or `--reporter json`      |
  | `explain_rule` tool                           | `npx svelte-vitals explain <rule-id>` (`--json` for the same object)                   |
  | `install --client claude-code\|cursor\|codex` | `install --client claude-skill` — one skill file read by Claude Code, Codex and Cursor |

  `svelte-vitals install` no longer offers the MCP client targets, and `--scope` (which only ever chose
  between a project and a global client config) is gone with them. `--scope` is now only warned about and
  ignored. Each removed client id is warned about and skipped, so a `--client` list that also names a live
  target still installs that target — but a list of **only** removed ids leaves nothing to install and still
  exits `2`, so a script pinned to `--client claude-code,cursor,codex` needs updating to `claude-skill`.

  **Removing the leftover server entry is manual, by design:** `.mcp.json`, `.cursor/mcp.json` and
  `~/.codex/config.toml` are your files, shared with your other servers, so nothing rewrites them on your
  behalf. Delete the `svelte-vitals` key under `mcpServers` (or `[mcp_servers.svelte-vitals]` for Codex).

  If you generated an Agent Skill from an older release, re-run `npx svelte-vitals@latest install --refresh`
  — the old copy still tells your agent to call `explain_rule`.

### Patch Changes

- 47e025d: Scores are now floored rather than rounded to nearest, so a displayed 100 means the deduction was exactly
  zero. Previously a category could print a perfect 100 while carrying hundreds of findings: with 585 score
  keys it took 293 `info` findings to move the number off 100, and a finding on every single key still showed 99.

  **Every score moves down by 0 or 1 point.** If you gate CI with `--min-health` at or just above your
  current score, lower the threshold by one. `--min-health 100` now fails on any finding at all, which is the
  honest reading of 100.

  Health is also computed differently, though the change is invisible on most projects: it averages the
  unrounded category scores and floors once, instead of averaging scores that had each already been rounded.
  The old double rounding could move Health two points where the parts moved one.

  `architecture/unit-entry-file` no longer adds a score key for each conforming unit. Its pass is still
  reported — it is the only evidence the rule ran at all — but it no longer inflates the denominator that
  every other finding is averaged against.

- Updated dependencies [47e025d]
  - @svelte-vitals/core@0.31.1

## 0.35.0

### Minor Changes

- d12fd54: Add `architecture/directory-naming`, which checks that a directory is named in the casing its
  location declares. Like the other Architecture convention rules it is off until configured: set
  `directories` to a map of directory glob to casing set (`camelCase`, `PascalCase`, `kebab-case`,
  `snake_case`, or several joined by `|`). SvelteKit route syntax is decoded before the check, so
  `[itemId=integer]` is judged as `itemId` and `(app)` as `app`.
- 2e60244: Add `architecture/reserved-directory-names`, which holds a directory's immediate subdirectories to a
  closed set of names you declare for that position. Like the other Architecture convention rules it is
  off until configured: `scopes` maps a directory glob to the names its children may take, and
  `unitScopes` maps a root glob to the names a unit's children may take — a unit being a directory whose
  name begins with a capital and which holds a file named after it.

  Where `architecture/directory-naming` checks a directory's casing, this checks its name, so it reports
  the correctly-cased `helpers/` that no casing declaration objects to.

- 67f5035: Add `architecture/route-component-import`, which reports a component importing a SvelteKit route entry
  (`+page.svelte`, `+layout.svelte`, `+error.svelte`, and their `@` breakout forms).

  This is the first Architecture rule that is **on by default**, so a project that changes nothing may see
  new findings at `info`. Kit renders a route entry with the data it supplies; imported elsewhere the
  component renders without it. Stories, tests and specs are exempt by default, and `exemptImporters`
  extends that list for a project whose satellite files are named another way.

- 2ce2288: New rule `architecture/unit-entry-file`: a directory you have declared to be a unit must contain a
  file named after it — `Card/` without `Card.svelte`, `getFoo/` without `getFoo.ts`. It is **inert
  until configured**, so nothing changes for projects that do not set it.

  Declare units by position with `units` (directory glob → the entry file's extension), by name with
  `pascalCaseUnits` (root glob → extension, applying to every directory under it whose name begins with
  an uppercase letter), and declare what is never a unit with `exclude`. Both identification styles
  exist because a camelCase directory may be a unit or a grouping — only position tells them apart —
  while a PascalCase unit nests to arbitrary depth, where no path glob reaches it.

  A filename-pattern check cannot express this: a file that does not exist has no path to validate. For
  the same reason, a declaration that matches no directory at all is reported, so a glob typo cannot
  leave the rule silently checking nothing — and so is a declaration whose every match is removed by
  `exclude`, with the message saying which of the two it was.

### Patch Changes

- 1a8d6ac: `performance/heavy-import` no longer reports a type-only import. The rule's claim is bundle weight, and
  `import type { Moment } from 'moment'` — or a declaration whose every specifier is inline-typed — is
  erased at build and adds nothing, so reporting it was a false positive.

  Projects using type-only imports of a configured heavy package will see **fewer** findings, and a health
  score that rises accordingly. No configuration change is needed.

  `architecture/private-scope-import` deliberately keeps reporting type-only imports: that rule is about
  coupling between parts of a tree, which a type import creates just the same.

- 19de7e0: Resolve import specifiers through the aliases a project declares in `svelte.config.{js,ts}` (`kit.alias`,
  and `kit.files.lib` when `$lib` has been moved), in SvelteKit's own order and with its first-match-wins
  semantics.

  Projects that import through their own aliases will see findings that were previously invisible —
  `security/shared-state-import` in particular was inert for them, since every import it examines has to
  resolve to a project-local path first. `$lib` now honours `kit.files.lib` instead of assuming `src/lib`.

  An alias whose value is not a plain string, and a project whose SvelteKit options are passed to the
  `sveltekit()` Vite plugin, are left unresolved rather than guessed at.

- Updated dependencies [d12fd54]
- Updated dependencies [1a8d6ac]
- Updated dependencies [19de7e0]
- Updated dependencies [2e60244]
- Updated dependencies [67f5035]
- Updated dependencies [ca2388b]
- Updated dependencies [2ce2288]
  - @svelte-vitals/core@0.31.0

## 0.34.0

### Minor Changes

- 0b2fd98: Recalibrate the Architecture thresholds against real Svelte code: `architecture/prop-count` now flags more than 6 props (was 10) and `architecture/component-size` flags components longer than 200 lines (was 400).

  Both numbers were previously guesses. They now come from surveying real Svelte 5 codebases with the same benchmark-based method ReactSniffer uses for React. `prop-count`'s 6 is the median per-repository 90th percentile; `component-size`'s 200 is set deliberately above the measured 90th and 95th percentiles, because length is a weaker signal than a wide prop surface. Both held when the survey was widened. At the old values these rules almost never fired on a typical Svelte project.

  Expect new `info` findings on existing projects. The Architecture score itself will barely move: component-scoped rules score per file (each flagged file loses 1 point for an `info` finding, then per-file scores are averaged across the project), so more than half of a project's components would have to be flagged before the Architecture score drops by even a single point. Nothing fails by default, since `failOn` defaults to `'critical'` — but if you run with `--fail-on info` or `failOn: 'info'` in `svelte-vitals.config.mjs` (including the Vite plugin's build mode, where it fails the `vite build`), components that passed before this change will now fail. Turn a rule off in `svelte-vitals.config.mjs` (`rules: { 'architecture/prop-count': 'off' }`) if its default does not suit your codebase — per-rule thresholds are not configurable yet.

- b1c6f80: Add `correctness/base-path-navigation`: in projects that configure `kit.paths.base`, flags hardcoded root-relative navigation — `<a href="/about">`, `goto('/about')`, `redirect(303, '/login')` — which resolves against the domain root, lands outside the app, and 404s in production while working fine locally. The base path is read from the `sveltekit()` Vite plugin config, else `svelte.config.{js,ts}`, following SvelteKit's own precedence; projects without a base path are never flagged. Detection is literal-only, so `resolve()`-wrapped and `base`-prefixed paths are never reported.
- 15e0874: Add `correctness/checkable-bind-value`: flags `<input type="checkbox" bind:value={x}>` and `<input type="radio" bind:value={x}>` — `bind:value` binds the DOM `value` property, which checkbox/radio interaction never changes, so the bound state silently never updates. Verified against Svelte 5 directly: the compiler accepts this pattern with zero warnings. Use `bind:checked` (single checkbox) or `bind:group` (checkbox list / radio group) instead.
- 314a19a: Rule settings now accept an object form, `{ severity?, options? }`, alongside the existing
  `'off' | Severity` strings. Options let a project move a rule's thresholds or extend its
  built-in lists, globally or per path via `overrides`.

  Configurable rules: `architecture/prop-count` and `architecture/component-size` (`max`),
  `seo/title-length` and `seo/description-length` (`min`, `max`), `performance/heavy-import`
  (`packages`), `performance/preconnect` (`origins`). List and map options are **added** to the
  built-in set rather than discarding it, so new built-in entries keep reaching every project; in a
  map, a key that already exists built-in keeps its entry and takes the configured value.

  Two notes for existing setups. Values in the config file's `rules` map are now validated —
  an invalid severity that was previously passed through unchecked is now a fatal config error.
  And the `RuleSetting` union has gained a member, which can make an exhaustive `switch` over it
  in external TypeScript code non-exhaustive.

  The `svelteVitals()` Vite plugin's `rules` and `overrides` options get the same validation as
  the config file — both funnel through core's `validateRuleSetting`: an unknown rule id, an
  invalid `severity`, an unrecognized key in the object form, an unknown option key, or an option
  value outside its declared type/bounds is now a fatal, synchronous error at plugin construction,
  instead of being silently ignored (an unknown id) or silently dropped (an invalid option). A
  `vite.config.js` gets no help from TypeScript, so a typo there previously left the rule at its
  built-in severity with no signal at all.

  `explain_rule` (`@svelte-vitals/mcp`) now reports a rule's configurable options — name, kind,
  default, bounds, and whether the value replaces or extends the default — in both its text and
  `structuredContent`. An agent that reads a finding as a threshold disagreement rather than a
  defect can name the knob without leaving the tool loop.

  In an `overrides[].rules` entry, a rule-id key and a category key are resolved independently:
  a rule-id key that carries no `severity` (an options-only object, e.g.
  `'architecture/prop-count': { options: { max: 4 } }`) does not shadow a category key's
  severity in the same entry — the category's severity still applies, alongside the rule's
  options. Only a rule-id key that _does_ specify a `severity` beats the category key, as before.

- 0603539: New rule `architecture/private-scope-import`: a unit inside a directory you have declared private
  must not be imported from outside that directory's owner. It is **inert until configured** — set
  `scopes` to a list of globs naming your private directories, and nothing changes for projects that
  do not.

  Each glob matches a private directory and its parent becomes the boundary, so the same directory
  name can mean different things in different places: with `scopes: ['src/routes/**/components']`, a
  route's `components/` is private to that route while `src/lib/components` stays shared. When private
  directories nest, the innermost one wins.

  Only imports written in a `.svelte` component are checked, and only when the specifier is `$lib/` or
  relative. An import resolved through a custom `svelte.config.js` alias, one written in a
  `.svelte.ts` / `.svelte.js` module or a Kit module (`+page.ts`, `+server.ts`, `hooks.*.ts`), and one
  naming a directory rather than a file are all unchecked for now. Each rule page lists the same set.
  Type-only imports **are** checked — the coupling they create survives into source even though the
  import is erased at build.

### Patch Changes

- 59bd0d6: Scope resolution now treats template declaration tags — `{@const ...}` and the newer `{let ...}` / `{const ...}` — as shadowing bindings for their enclosing fragment, so a write to such a template-local alias is no longer misattributed to a same-named top-level `$state` (fewer false positives across the component-analysis rules).
- Updated dependencies [0b2fd98]
- Updated dependencies [b1c6f80]
- Updated dependencies [15e0874]
- Updated dependencies [59bd0d6]
- Updated dependencies [314a19a]
- Updated dependencies [0603539]
  - @svelte-vitals/core@0.30.0

## 0.33.0

### Minor Changes

- 77065e2: `ci install`/`ci upgrade` now scaffold and upgrade a reference to [oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action) instead of `oekazuma/svelte-vitals/packages/action` — the first-party GitHub Action moved out of this monorepo into its own dedicated repository (following the same pattern as `changesets/action`, `pnpm/action-setup`, and `renovatebot/github-action`). This fixes two structural problems: `packages/action/dist` no longer drifts on every unrelated core/cli commit, and Renovate can now discover and propose updates to the action's pin automatically (verified empirically — the monorepo's shared git-tag namespace previously made this impossible regardless of comment format).

  **Breaking:** if you have an existing generated workflow, run `npx svelte-vitals@latest ci upgrade` (or `ci install --force`) to rewrite the `uses:` line to the new repository — `ci upgrade` recognizes the old reference and migrates it automatically.

## 0.32.0

### Minor Changes

- 40a6dc6: Add `correctness/nonreactive-builtin-state`: flags plain `Map`/`Set`/`Date`/`URL`/`URLSearchParams` in `$state` whose mutations are observed — `$state`'s deep proxy covers plain objects and arrays only, so such mutations are untracked and the UI silently stops updating. Precision-first: only type-specific mutating operations count, and mutate-then-reassign usage (which works) is not flagged.
- 74d871f: Warn (stderr, non-blocking) when the analyzed project declares a `svelte` or `@sveltejs/kit` version below what rules assume (Svelte 5+ runes, SvelteKit 2+) — rules that key off runes syntax can't recognize the legacy (`export let` / `$:`) equivalent of the same bugs, so findings may be incomplete for components that haven't migrated to runes yet.

### Patch Changes

- 48f6d24: Scope resolution now treats `var` declarations and nested `function`/`class` declaration names as shadowing bindings, so writes to such locals are no longer misattributed to a same-named top-level `$state` (fewer false positives across the component-analysis rules).
- 2ed7450: `correctness/unmutated-state` no longer flags `$state` passed to a `use:`/`transition:`/`animate:` directive — the receiving code holds the proxy reference and may mutate it invisibly, so the previous `$state.raw` suggestion could break it.
- Updated dependencies [3389594]
- Updated dependencies [40a6dc6]
- Updated dependencies [48f6d24]
- Updated dependencies [2ed7450]
  - @svelte-vitals/core@0.29.0

## 0.31.1

### Patch Changes

- a8a8d4a: Fix `ci install`/`ci upgrade` generating a same-line version comment (`# @svelte-vitals/action@X.Y.Z`) that Renovate's github-actions manager can't parse as a version, silently hiding the pinned action from update PRs. The comment (and this repo's own release tag for `@svelte-vitals/action`) now use a Renovate-parseable `action-vX.Y.Z` format instead. `ci upgrade` still recognizes and rewrites the old format from existing installs, even when the pinned commit is already current.

## 0.31.0

### Minor Changes

- 4c58609: Add `correctness/each-index-key`: flags `{#each}` blocks keyed by their own index (`{#each items as item, i (i)}`) — position-based identity, the same failure mode as an unkeyed block, masked by the visible key.

  Also widens the no-identity exemption shared with correctness/each-key: length-only placeholder lists (Array(n), [...Array(n)], Array.from({length: n})) are no longer flagged by either rule.

- e41512f: Add PERF011 (Load waterfall) and PERF013 (Sequential independent awaits): a forward-taint analysis of `load` functions flags dependent await chains in universal loads (move them to a server load) and independent sequential awaits in any load (parallelize with `Promise.all`).
- da8ff85: Add PERF012 (Minification disabled): flags a `build.minify: false` left in `vite.config.*`. The CLI detects the literal form statically; the Vite plugin reads the resolved config during `vite build`, catching conditional configs exactly.
- b05fe4f: Rule IDs now use an ESLint-style `category/kebab-case` form (e.g. `seo/ssr-disabled`) instead of `CATEGORY123` (e.g. `SEO031`), so the id itself tells you what a rule checks when disabling it in config or a suppression comment.

  This is a breaking change with no backward-compat aliasing:

  - Update `svelte-vitals.config.mjs`/`.js`/`.json` `rules` overrides to the new ids (keys now contain a slash, so they must be quoted: `rules: { 'seo/ssr-disabled': 'off' }`).
  - Update `// svelte-vitals-disable-next-line <ID>` suppression comments to the new lowercase ids.
  - If you have a `.svelte-vitals-suppressions.json` baseline file, every entry is keyed by the old id and will no longer match after upgrading — regenerate it (re-run your suppression-baseline command, e.g. `svelte-vitals --update-suppressions`, after upgrading) rather than hand-editing the old ids.
  - The `explain_rule` MCP tool and the `--rules`/`--ignore` CLI/MCP options now expect the new ids.
  - The per-rule exports of `@svelte-vitals/core` are renamed to the camelCase form of the new id (e.g. `seo031SsrDisabled` → `seoSsrDisabled`, `sec003LoadStateWrite` → `securityHandlerStateWrite`).

  See the full old-id → new-id mapping in [docs/superpowers/specs/2026-07-22-rule-id-eslint-style-design.md](../docs/superpowers/specs/2026-07-22-rule-id-eslint-style-design.md).

- edaaa94: Add SEO031 (warning): flag SvelteKit route files that disable server-side rendering with `export const ssr = false` — per the official SEO guidance, server-rendered content indexes more reliably, and SPA mode adds a round trip before first paint. The root-layout (app-wide) case gets a dedicated message; deliberate SPAs can turn the rule off or suppress inline.
- cfbaa49: Add `correctness/stale-prop-derivation`: flags top-level values computed from `$props()` props without `$derived` and rendered in the template — they evaluate once at init and silently stop tracking the parent. Conservative by design: eager references only, call-free initializers, never-reassigned bindings, template-rendered. Also tweaks `correctness/unmutated-state`'s recommendation to point at `$derived` for prop-computed state.
- 68e7923: Add `performance/state-raw` (info): suggests `$state.raw` for object/array-literal `$state` bindings that are reassigned but never mutated, escaped, aliased, or item-edited — deep-proxy overhead with no consumer. Conservative by design; editable `{#each}` lists and any aliasing disqualify.

### Patch Changes

- df5ac18: Fix a false negative in `performance/minify-disabled` (`findMinifyDisabled`): a `satisfies`/`as`-wrapped object literal reached only on the 4th (final) identifier/call-argument resolution hop was left unwrapped and silently treated as unresolvable.
- Updated dependencies [4c58609]
- Updated dependencies [e41512f]
- Updated dependencies [da8ff85]
- Updated dependencies [b05fe4f]
- Updated dependencies [edaaa94]
- Updated dependencies [cfbaa49]
- Updated dependencies [68e7923]
- Updated dependencies [df5ac18]
  - @svelte-vitals/core@0.28.0

## 0.30.0

### Minor Changes

- 840121a: Add route-/file-scoped rule overrides via a new `overrides` option in `svelte-vitals.config.*` (also available as a Vite plugin option). Each entry scopes rule settings with `route` globs (matched against route ids) and/or `files` globs (matched against source paths — the way to target a `(group)` directory, since group segments are dropped from route ids): `overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]` turns all SEO rules off for an auth-only route group, durably — routes added under the glob later are excluded too, unlike the snapshot-style suppressions file. Keys in an entry's `rules` may be rule ids or category names; values are `'off'` (the finding is removed entirely) or a severity. Applied in `analyzeProject`, so the CLI, MCP server, GitHub Action, and Vite build gate all honor it.

### Patch Changes

- Updated dependencies [840121a]
- Updated dependencies [840121a]
  - @svelte-vitals/core@0.27.0

## 0.29.0

### Minor Changes

- b10c26a: Add CORRECT006 (critical): flag orphan `$effect` calls that throw `effect_orphan` at runtime — a top-level `$effect` in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>`, and a module-scope `new` of a class whose constructor creates a bare `$effect`. `.svelte.ts`/`.svelte.js` runes modules are now analyzed by the component-facts pipeline.
- e38ea4d: Add CORRECT007 (critical): flag Svelte lifecycle/context calls (`onMount`, `getContext`, `setContext`, …) that run outside component initialisation and throw `lifecycle_outside_component` at runtime — at module scope in runes modules and `<script module>`, in constructors of module-scope-instantiated classes, and inside SvelteKit load/action/endpoint handlers (the classic `getContext`-in-`load` trap).
- b0c2040: Add CORRECT008 (critical) and CORRECT009 (warning): flag browser-only globals (`window`, `document`, `localStorage`, …) read in server-executed code — module scope of runes modules and `<script module>`, SvelteKit load/handler/`init` bodies and file top levels (CORRECT008), and component instance-script top levels that run during SSR (CORRECT009). Recognises `browser`/`typeof` guards, respects same-file `export const ssr = false`, and never descends into `onMount`/`$effect`/function bodies.
- d6511a7: Add SEC003–005: SSR shared-state leak detection for SvelteKit server/universal route files. SEC003 (critical) flags load/action/endpoint handlers writing to imported module state; SEC004 (warning) flags module-scope `let`/`var` reassigned from functions in Kit server files; SEC005 (warning) flags server-side imports of `.svelte.ts` modules holding module-scope `$state`. Kit route/hooks files are now analyzed via a new `KitModuleFacts` channel.

### Patch Changes

- c4ef9d8: Fix `ci install`/`ci upgrade` to never pin `@svelte-vitals/action` to a commit SHA that isn't actually on `origin/main` yet. The pin is generated at build time from `git rev-parse HEAD`; if a local build runs before that commit is pushed (e.g. testing against a `pnpm link`ed checkout), the generated GitHub Actions workflow referenced an unresolvable action and every PR's CI job failed. The generator now falls back to the nearest ancestor commit that is on `origin/main` when HEAD itself isn't reachable there.
- 76701e0: Fix monorepo app detection (`discoverApps`, and `install --app`) to recognize a SvelteKit app that has no `svelte.config.{js,ts}` — current `sv create` output folds SvelteKit's adapter/compiler config directly into the `sveltekit()` plugin call in `vite.config.ts` and no longer emits a separate `svelte.config` file. Detection now also accepts a `package.json` declaring `@sveltejs/kit`, mirroring `detectProject`'s existing rule. Previously such an app was silently invisible to `svelte-vitals` (from a monorepo root) or `svelte-vitals install --app <dir>` (explicit `--app` failed with "not a SvelteKit app").
- Updated dependencies [b10c26a]
- Updated dependencies [e38ea4d]
- Updated dependencies [b0c2040]
- Updated dependencies [d6511a7]
- Updated dependencies [15f0b61]
  - @svelte-vitals/core@0.26.0

## 0.28.0

### Minor Changes

- 2cd25d8: `svelte-vitals install` now understands monorepos. The app-scoped targets — `vite-plugin`, `vite-hooks`, and `config-file` — resolve the SvelteKit app directory the same way the analyzer does: an explicit `--app apps/web` wins, a cwd that is itself an app is used as-is, one detected app is used automatically with a notice, several prompt a picker on a TTY, and non-interactive runs exit 2 asking for `--app`. The `@svelte-vitals/vite` auto-install also runs inside the chosen app (with the package manager still detected from the workspace root's lockfile). Root-scoped targets (MCP client configs, agent skills/rules, `ci-workflow`) keep writing at the current directory, which is their correct home in a monorepo.
- 28e92c0: `svelte-vitals --reporter html` and the vite live dashboard now share one renderer (core's new `renderAppShell`), so the two surfaces can't drift apart again. The static HTML report gets the dashboard's full UI — master/detail layout with a searchable, sortable route list, severity/category filters, dark mode, and the per-finding copy-to-clipboard AI Prompt — while staying fully self-contained and offline; the only difference is that the live-update machinery (SSE connection, `measured` refinement, the connection/analyzing indicators) is absent when there is no dev server behind the page. `@svelte-vitals/core` gains `renderAppShell`/`AppSnapshot`/`RouteBadge`/`APP_SCRIPT`/`APP_STYLE` exports; `buildHtmlDocument`/`formatHtmlReport` keep their signatures but emit the new document. The dashboard itself is unchanged, now served from the shared shell.

### Patch Changes

- Updated dependencies [28e92c0]
  - @svelte-vitals/core@0.25.0

## 0.27.0

### Minor Changes

- d243f01: `svelte-vitals install --client config-file` now auto-picks the best extension for the environment instead of always scaffolding `.mjs`: `.ts` (using `defineConfig` for real type-checking/autocomplete) when the current Node supports loading it natively, the project looks TypeScript-oriented (a `tsconfig.json` or `vite.config.ts` present), and `svelte-vitals` is a declared dependency (the `defineConfig` import resolves at load time, so npx-only projects keep getting the dependency-free default); otherwise the safe `.mjs`. Detecting whether a config file already exists now checks all three candidate extensions (`.mjs`/`.js`/`.ts`), not just `.mjs` — a project with an existing `svelte-vitals.config.ts` no longer gets a redundant `.mjs` created alongside it. `--force` always regenerates whichever file is already there, never switching its extension or module syntax (a `.js` config in a CommonJS project is regenerated as `module.exports`, not ESM).
- 0bb628d: `svelte-vitals install`'s interactive picker now groups targets by category — MCP server, Vite integration, Agent Skills & rules, CI (GitHub Actions), Config file — instead of one flat list, making it easier to tell what each of the ten targets is for. The GitHub Actions workflow (previously only available via the standalone `svelte-vitals ci install`) is now also a selectable `ci-workflow` target inside `install`, so CI can be set up in the same pass as the MCP server/Vite/skills instead of a separate command. `svelte-vitals ci install`/`ci upgrade` remain available standalone.
- f1cbfd0: `svelte-vitals install --client claude-skill` and `claude-skill-improve` now write the same generated skill content to three conventional locations at once — `.claude/skills/`, `.agents/skills/`, and `.cursor/skills/` — instead of just `.claude/skills/`. Claude Code, Codex, and Cursor all read the same frontmatter-driven `SKILL.md` convention (directory name decides the invocable command), so a project that picks `claude-skill`/`claude-skill-improve` now gets a working skill in all three tools with no extra action. `--force` and `--refresh` apply per-file, so a project with only the old single-path install gets the two new destinations created without disturbing the existing one. `cursor-rules` (`.cursor/rules/*.mdc`) is unchanged.

### Patch Changes

- 25efcde: Fix `svelte-vitals install --client config-file`, which was rejected with "unknown --client 'config-file'" despite being documented in `--help` and `svelte-vitals install --help` — the CLI argument parser's list of valid `--client` ids never included the config-file target.

## 0.26.0

### Minor Changes

- 7fb7d55: Add a `claude-skill-improve` install target: `svelte-vitals install --client claude-skill-improve` writes a second, read-only Claude Code skill (`.claude/skills/improve-svelte/SKILL.md`). Where the existing `claude-skill` target is the every-edit regression-check playbook, this new skill audits the whole codebase as a senior Svelte/SvelteKit engineer — using svelte-vitals' own scan as evidence — and writes prioritized, self-contained implementation plans under `plans/` for another agent (or cheaper model) to execute later; it never edits source itself. It reuses the same rule-catalog generator the existing skill already renders, so every rule's canonical fix is inlined with no network fetch required. Supports `--force`/`--refresh` like the other agent targets.

## 0.25.0

### Minor Changes

- 4ebb756: Add `svelte-vitals ci upgrade`: rewrites only the pinned `@svelte-vitals/action` reference line(s) in an existing generated workflow to the pin bundled with the CLI, leaving everything else (other pins like `actions/checkout`, custom triggers/steps) untouched. Use `ci install --force` if you want to regenerate the whole file instead.
- ab55482: `install --refresh` regenerates whichever generated agent instruction files (`claude-skill`, `cursor-rules`) already exist on disk with the current rule set, without needing to remember which `--client` ids were originally installed. It never creates a file that isn't already there, ignores `--scope`/`--yes`/`--force`, and cannot be combined with `--client`.
- f14fc4e: Add a `config-file` install target: `svelte-vitals install --client config-file` scaffolds `svelte-vitals.config.mjs` with every option commented out. Previously the only way to adopt a config file was to hand-write it from the docs example — `install` already generates the other four onboarding artifacts (MCP client config, Vite plugin/hooks wiring, agent skill/rules files) but left the config file out of that flow. Supports `--force` to regenerate.
- 9802586: Add a `svelte-vitals-suppressions.json` file: `--update-suppressions` records every currently-penalized finding once (a persistent adoption ramp, unlike the transient `--baseline <ref>` git-ref comparison), and the file is then applied automatically on every run — after `--diff`/`--staged` and `--baseline` — so gating (`--fail-on`, `--min-health`) can be turned on for an existing project without first fixing its whole backlog. `--no-suppressions` disables it for one run.

### Patch Changes

- 43be9f2: `analyzeProject` accepts an optional `parseCache` (exported as `ParseCache`) that lets a caller re-analyzing the same project repeatedly reuse read+parse results across calls instead of starting fresh each time. The vite dev dashboard now keeps one `ParseCache` alive for the lifetime of the dev server and invalidates only the entry for the file that actually changed on each debounced re-analysis, so saving an unrelated file no longer re-reads and re-parses every route and layout in the project.
- 58ccebc: CLI mascot: fix the ecstatic (100/100) face's mouth being off-center under the eyes — switched to the same 4-column mouth width the happy face already centers correctly (a 5-column mouth can never land exactly on the eyes' midpoint).
- Updated dependencies [fda64dd]
- Updated dependencies [bf6932d]
  - @svelte-vitals/core@0.24.0

## 0.24.0

### Minor Changes

- ca6d1af: Add a small mascot to the CLI's interactive terminal output: it replaces the analysis spinner with an idle loop, then reacts to the Health-score reveal (a perfect 100 gets a confetti bonus). A minimal, single-color line-art face in Svelte's brand orange, shown on terminals 20+ columns wide. Disable with `--no-animation`, same as the existing score-reveal animation.
- 085c622: Give the CLI's mascot a speech bubble: a random greeting line at startup, and a reaction line matching the Health-score band at the score reveal (on terminals wide enough for both, 55+ columns). Falls back to the mascot alone on narrower terminals, same as before. The Health-score reveal's pulse waveform is now colored in the same Svelte orange as the mascot — dim while counting, solid once the score settles.
- 08aa27e: Remove the `--json` and `--fail-on-warning` CLI flags. Both were pure aliases for `--reporter=json` and `--fail-on=warning` respectively — use those instead. No deprecation period (pre-1.0).
- 5d9f0d1: Live dashboard: `svelteVitals()`'s `ui` option now defaults to `true` — the dashboard at `/__svelte-vitals/` is on during `vite dev` unless you pass `ui: false`. `svelteVitalsHandle` no longer prints findings to the terminal (the dashboard supersedes that output); it still feeds the dashboard's per-route accuracy when enabled.

  CLI: the `install` wizard's `vite-dev-overlay` target is renamed `vite-hooks`, with copy describing its real effect (dashboard accuracy) instead of terminal warnings.

### Patch Changes

- c2ee668: Live dashboard: replace the plain bolt-glyph brand mark with the same wordmark used on the docs site, for visual consistency.

  CLI mascot: give the `happy`/`ecstatic` reaction faces a cleaner rounded-bracket smile (`╰──╯`/`╰───╯`) instead of a repeated `◡` arc, which read as a wavy scallop rather than one smile.

- 7da8bb7: Fix `--no-color` and `--no-animation`, which silently had no effect regardless of whether they were passed — the CLI's argument parser (`mri`) auto-negates `--no-X` flags into `{X: false}`, not a `'no-X'` key, so the code reading `argv['no-color']`/`argv['no-animation']` was always reading `undefined`.

## 0.23.0

### Minor Changes

- 7acad5a: Console output now groups findings by rule and caps what's shown by default (top 5 rules per severity, the Passed section collapsed to a count, `--by-route` capped to the worst 10 routes) — pass `--verbose` for the old uncapped listing. The Health score also gets a short pulse-line reveal animation on an interactive terminal (disable with `--no-animation`).

### Patch Changes

- Updated dependencies [7acad5a]
  - @svelte-vitals/core@0.23.0

## 0.22.1

### Patch Changes

- 2652572: `ci install`'s generated workflow now pins `actions/checkout` to a commit SHA with a same-line version comment (`actions/checkout@<sha> # v7.0.0`), matching this repo's own convention, instead of a floating `@v4` tag.
- Updated dependencies [2652572]
  - @svelte-vitals/core@0.22.1

## 0.22.0

### Minor Changes

- d9efc77: `svelte-vitals ci install` now scaffolds a short workflow that calls the new `@svelte-vitals/action` GitHub Action instead of generating a ~60-line inline template. The generated workflow no longer includes a `setup-node` step, a duplicate scan pass, or an inline sticky-comment script — the Action owns annotations, the job summary, and the sticky PR comment internally. The Action reference is pinned to a commit SHA with a version comment, matching this repo's own pinning convention. Already-installed workflows are untouched until `ci install --force` is re-run.

## 0.21.0

### Minor Changes

- f0af627: Surface the resolved `@svelte-vitals/core` version so it's possible to tell whether the CLI and the Vite dev overlay are running the same rule engine. `svelte-vitals --version` now prints `<cli version> (core <core version>)`, and the dev overlay's dashboard footer (`/__svelte-vitals/`) shows `core v<version>` alongside its own version. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases (e.g. a package-manager cooldown like pnpm's `minimumReleaseAge` resolving `@latest` down to an older release) — previously there was no way to notice this without diffing lockfiles, so the two surfaces could silently disagree on findings. See the "Version drift" section in the dev overlay docs.

### Patch Changes

- ea90a6d: `svelte-vitals install` now logs the actually-resolved `@svelte-vitals/vite` version after auto-installing it (e.g. `installed @svelte-vitals/vite@0.11.1`), so a lockfile/registry cooldown (e.g. pnpm's `minimumReleaseAge`) silently resolving the install to an older release than expected is visible instead of hidden.
- Updated dependencies [7e3b423]
- Updated dependencies [f0af627]
  - @svelte-vitals/core@0.22.0

## 0.20.0

### Minor Changes

- fa0bd8a: Add `claude-skill` and `cursor-rules` targets to `svelte-vitals install`, generating a Claude Code skill (`.claude/skills/svelte-vitals/SKILL.md`) and a Cursor rules file (`.cursor/rules/svelte-vitals.mdc`) from the current rule set (ids, titles, severities, and rationale grouped by category) so an agent has the rule knowledge and a run playbook before it writes code. Unlike the Vite targets, these files are fully regenerated, so `--force` overwrites them with a fresh copy.
- afd31ce: Add `--baseline <ref>` to report only findings newly introduced compared to a git ref (e.g. `--baseline origin/main`), unlike `--diff`/`--staged` which scope by changed file but still surface pre-existing findings in those files. Combine with `--diff origin/main --baseline origin/main` for a PR gate that fails only on issues the change actually introduced.
- 8dc631c: Add a `--reporter md` Markdown summary reporter (Health score, per-category scores, severity counts, and a findings table) and a `svelte-vitals ci install` command that scaffolds a GitHub Actions workflow gating pull requests on newly introduced findings — inline annotations, a job summary, and a sticky PR comment, using `--diff`/`--baseline`/`--reporter github`/`--reporter md` under the hood.
- d9cb3ba: Add `--category <cats>` to restrict analysis to rules in the given categories (intersects with `--rules`/`--ignore`/config-file selection), and `--score` to print only the combined Health score to stdout, suppressing reporter output — handy for shell prompts or scripts that just want the number, especially combined with `--min-health` for gating.
- 44c0384: Running `npx svelte-vitals` at a monorepo root with no path argument no longer dead-ends on "No SvelteKit project found": it detects SvelteKit apps underneath and either analyzes the only one found (with a stderr notice) or, in an interactive terminal, offers a single-select prompt to pick one. Non-interactive environments (CI, agents) still never prompt — they get exit `2` with the detected app list and a hint to pass a path explicitly. Passing an explicit path always skips detection, so existing invocations are unaffected.

### Patch Changes

- Updated dependencies [8dc631c]
  - @svelte-vitals/core@0.21.0

## 0.19.0

### Minor Changes

- 94ea510: Load `svelte-vitals.config.{mjs,js,ts}` from the analyzed directory (flags > config file > defaults, per field) and add `--weights` (e.g. `--weights seo=2,performance=1`) plus a `weights` argument on the MCP analyze tool. `.ts` configs work unflagged on Node 22.18+/23.6+; on older Node the CLI explains the upgrade / `--experimental-strip-types` / rename-to-`.mjs` options.
- 7f1697d: Add CORRECT005: flag mutation of a non-`$bindable` prop destructured from `$props()` (member writes, `delete`, or a mutating method call like `.push()`). Plain reassignment of the prop itself is not flagged — Svelte's docs explicitly sanction that pattern for ephemeral state; only mutation is prohibited. Catches a class of bug the compiler never reports: mutating a plain-object prop is a silent no-op, and mutating a reactive-state-proxy prop only warns at runtime if that code path is exercised.
- 3b33e4c: Raise the supported Node.js floor from 18.20.8 (EOL) to >=22.13.0 — the oldest maintained LTS line the pinned pnpm can run on. CI now exercises Node 22 (floor), 24, and 26.

### Patch Changes

- 18b11af: Fix CORRECT001 (keyed each block): stop flagging itemless `{#each}` blocks (the "render N times" pattern, e.g. a chess board) — there is no item identity to key on, so this was a false positive on an officially documented Svelte pattern. Also corrected the rule's rationale text, which described the unkeyed mechanism backwards.
- e476a2e: Deduplicate `collectComponentFacts` into `@svelte-vitals/core`; behavior is unchanged.
- 0be8d49: Fix `--diff`/`--staged` silently reporting zero findings when the analyzed project is not at the git repository root (monorepos): git paths are now resolved relative to the analyzed directory.
- b1f85ba: Detect Open Graph (`og:description`, `og:url`), `twitter:card`, and JSON-LD tags emitted by `svelte-meta-tags` (`MetaTags` / `JsonLd`) in static mode. Inline `openGraph` / `twitter` object literals are now introspected key-by-key, non-literal configs fall back to broad coverage, and the `JsonLd` component is recognized — resolving SEO008/011/012/013 false positives (#91). The same `openGraph`/`twitter` introspection applies to `svelte-seo`.
- 86aa6d6: Parse each source file at most once per static-mode run: shared layouts and components imported by many routes were previously re-parsed per route.
- 6b2d0a7: Fix PERF010 (namespace import) rationale: it previously claimed a namespace import always defeats tree-shaking, which over-states the real behavior — bundlers like Rollup/Vite do tree-shake statically-accessed namespace imports. The message now accurately describes when tree-shaking breaks (the namespace object escapes or is accessed dynamically). No detection or severity change.
- 4513f97: Fix a false-positive/false-negative source shared by CORRECT004 (unmutated `$state`) and CORRECT005 (mutated non-bindable prop): both matched writes by identifier name alone, so a local binding that reused a tracked `$state`/prop name — a function parameter, a block-scoped `let`/`const` redeclaration, a `for`/`for-of`/`for-in` loop variable, a `catch` clause's parameter, or an `{#each ... as x}` loop variable — was misattributed as a write to the outer binding. CORRECT005 now correctly skips flagging a mutation of such a shadowing local instead of raising a false positive; CORRECT004 now correctly still flags a `$state` as constable when only a shadowing local was ever written, instead of a false negative. `{#snippet}`/`{:then}`/`{:catch}` bindings are not yet tracked — a known, documented remaining gap.
- Updated dependencies [18b11af]
- Updated dependencies [7f1697d]
- Updated dependencies [e476a2e]
- Updated dependencies [6b2d0a7]
- Updated dependencies [3b33e4c]
- Updated dependencies [4513f97]
  - @svelte-vitals/core@0.20.0

## 0.18.0

### Minor Changes

- 19e304c: Add an inline `svelte-vitals-disable-next-line` comment to suppress a specific component-scoped rule's finding on the following line (`// ...` in `<script>`, `<!-- ... -->` in markup) — a targeted escape hatch for intentional patterns a rule can't infer statically, such as a mount-only `$effect` used to avoid a hydration mismatch. Covers CORRECT001–004, SEC001–002, ARCH001–002, and PERF009–010. Fixes #92.
- c16e7f9: `npx svelte-vitals install` can now also set up `@svelte-vitals/vite`: `--client vite-plugin` registers the build-mode plugin in `vite.config.{ts,js,mjs}`, and `--client vite-dev-overlay` wires the dev-overlay hook into `src/hooks.server.{ts,js}`. Both use a `magicast` codemod that only edits a file whose shape it confidently recognizes — anything else is left untouched and a snippet is printed instead. When either target is written and `@svelte-vitals/vite` isn't already a dependency, it's installed automatically via the detected package manager. `--force` does not apply to these two targets — an existing registration is always left as-is.

### Patch Changes

- 2f94444: Internal refactor: component-facts source parsing (`parseComponentFacts` and its shared AST utilities) moved to `@svelte-vitals/core` so `@svelte-vitals/vite` can reuse it. No user-facing behavior change.
- Updated dependencies [19e304c]
- Updated dependencies [2f94444]
  - @svelte-vitals/core@0.19.0

## 0.17.0

### Minor Changes

- a328974: Add an interactive `svelte-vitals install` command that sets up the svelte-vitals
  MCP server for Claude Code, Cursor, and Codex. It merges into your existing client
  config without touching other servers, prompts for the clients and scope
  (project/global) interactively, and supports `--client`, `--scope`, `--yes`,
  `--dry-run`, and `--force` for non-interactive use.
- 32712e2: Rich console output: the default `console` reporter now colorizes the Health/category
  scores, severity sections, and pass/fail markers, and shows an "Analyzing…" spinner
  during the scan. All of it auto-disables under `NO_COLOR`, a non-TTY stdout, a
  non-`console` reporter, or `--no-color` (and honors `FORCE_COLOR`). Color is an
  injected `Palette` (identity by default), so `@svelte-vitals/core` stays
  dependency-free and other reporters are unchanged.
- 54c77d8: Add **CORRECT003 (effect used as onMount)** — the Correctness/reactivity slice of
  #69. Flags an `$effect`/`$effect.pre` whose non-empty body reads no reactive value
  (no `$state`/`$derived`/`$props`, no store subscription, no bare function call), so
  it never re-runs and should be `onMount`. Reported under `correctness` (warning).
  `EffectFact` gains `mountOnly`.
- bc6fa86: Add **CORRECT004 (unmutated $state)** — a Correctness/reactivity rule from #69.
  Flags a `let x = $state(...)`that is never written or escaped anywhere in the
  component (no reassignment, member/method mutation, bind, call-arg, or
  component-prop pass), so its reactivity is unused — use`const`(or`$state.raw`if only reassigned wholesale). Reported under`correctness`(info).`ComponentFacts`gains`constableStates`.

### Patch Changes

- Updated dependencies [32712e2]
- Updated dependencies [54c77d8]
- Updated dependencies [bc6fa86]
  - @svelte-vitals/core@0.18.0

## 0.16.0

### Minor Changes

- 90e3e7e: Add an **Architecture** category — the third "Svelte Doctor" code-health category,
  reusing the component-body scan (CLI/static mode). Deterministic, high-precision
  size metrics that flag bloated "god components":

  - **ARCH001** Component size: flags a `.svelte` file over 400 lines (info).
  - **ARCH002** Prop count: flags a component destructuring more than 10 props from
    `$props()` (info).

  `ComponentFacts` gains `loc` and `propCount`; the console reporter shows an
  Architecture score line.

- 32698e0: Add **PERF009 (heavy dependency import)** — the Bundle slice of #69. Flags an
  `import` from a well-known heavy / non-tree-shakeable package (`lodash`, `moment`),
  matched by exact specifier so subpath imports like `lodash/debounce` pass.
  Reported under the `performance` category (info). `ComponentFacts` gains `imports`
  (module specifiers from the instance + module scripts).
- 382c397: Add **PERF010 (namespace import)** — the remaining Bundle slice of #69. Flags a
  value `import * as X from '<bare package>'`, which keeps the whole module in the
  bundle and defeats tree-shaking; named imports are preferred. Type-only and
  non-bare (relative / `$lib` / `$app` / `#…`) namespace imports are not flagged.
  Reported under `performance` (info). `ComponentFacts` gains `namespaceImports`.
- 0441cbb: Add `--diff` and `--staged` to scope findings to changed files (#69) — run
  svelte-vitals as a pre-commit hook or PR check that gates only what just changed:

  - `--staged` — report only findings in files staged for commit.
  - `--diff [ref]` — report only findings in files changed vs `ref` (default
    `HEAD`; e.g. `--diff main` for branch changes).

  Findings are filtered to those located in the changed files, then flow through
  scoring, the reporters, and the `--fail-on` / `--min-health` gates. If git can't
  answer (not a repo / unavailable), it warns and analyzes everything.

### Patch Changes

- Updated dependencies [90e3e7e]
- Updated dependencies [32698e0]
- Updated dependencies [382c397]
  - @svelte-vitals/core@0.17.0

## 0.15.0

### Minor Changes

- 4dc7773: Add a **Correctness** category — the first analysis of Svelte component bodies
  (not just `<head>`), broadening svelte-vitals toward a deterministic, agent-native
  code-health scanner. A new static (CLI) scan reads every `.svelte` under `src/`
  into a component-facts channel and adds two rules:

  - **CORRECT001** Keyed each block: flags an `{#each}` with no key (reordering an
    unkeyed list destroys/recreates DOM and loses element state).
  - **CORRECT002** Effect used to derive state: flags an `$effect` whose body only
    assigns to `$state` — the "useEffect → $effect" anti-pattern; use `$derived`.

  Correctness findings are scored per source file and surface under the new
  `correctness` category in the Health report. (CLI/static mode only.)

- d173e44: Resolve SvelteKit layout breakouts in static (CLI) mode (#12). `+page@.svelte` /
  `+page@segment.svelte` pages are now enumerated (previously skipped entirely),
  and the layout chain honors `+page@` / `+layout@` resets — so a route that breaks
  out inherits the correct layouts instead of the full ancestor chain. The route
  URL is unchanged (the `@segment` only affects layout inheritance).
- 7cabf35: Add a **Security** category — the second "Svelte Doctor" code-health category,
  reusing the component-body scan (CLI/static mode):

  - **SEC001** Raw HTML render: flags `{@html …}` (an unescaped-HTML XSS surface;
    sanitize the value).
  - **SEC002** javascript: URL: flags a literal `javascript:` URL in an
    `href`/`src`/`action`/`formaction` attribute.

  The component-rule factory is now shared between the Correctness and Security
  categories, and the console reporter shows a Security score line.

- 6ee3d04: Add SEO028–SEO030 (#61), reusing existing capture (no parser changes):

  - **SEO028** Duplicate title: flags routes that share an identical static `<title>`.
  - **SEO029** Duplicate description: flags routes that share an identical static
    meta description.
  - **SEO030** Heading order: flags a skipped heading level (e.g. `<h2>` straight
    to `<h4>`); single-`<h1>` presence stays SEO027.

### Patch Changes

- Updated dependencies [4dc7773]
- Updated dependencies [7cabf35]
- Updated dependencies [6ee3d04]
  - @svelte-vitals/core@0.16.0

## 0.14.0

### Minor Changes

- 9fb4622: Add PERF005–PERF008, four static Performance checks (#60):

  - **PERF005** LCP image eager loading: flags the first `<img>` (likely LCP) when
    it is `loading="lazy"` (static/CLI mode).
  - **PERF006** Responsive image: flags an `<img>` without `srcset` (info; static/CLI mode).
  - **PERF007** Render-blocking script: flags a `<head>` `<script src>` without
    `defer`/`async`/`type="module"`, in app.html (rendered) or `<svelte:head>` (static).
  - **PERF008** Preconnect third-party origin: flags a well-known third-party
    origin (Google Fonts) referenced without a `preconnect`/`dns-prefetch` (info).

  The head model gains `kind: 'script'`, `href`, and `blocking`; `<img>` capture
  gains `lazy` and `hasSrcset`.

### Patch Changes

- Updated dependencies [9fb4622]
  - @svelte-vitals/core@0.15.0

## 0.13.0

### Minor Changes

- 0fbc25d: Validate JSON-LD content, not just its presence (SEO008): SEO016 (valid JSON with @context/@type),
  SEO017 (deprecated/restricted rich-result type), SEO018 (relative URLs under known keys), SEO019
  (non-ISO-8601 dates under known keys), SEO020 (placeholder text), and SEO021 (required properties for
  recognized @types). Only static, parseable JSON-LD is checked — a dynamically-built script is skipped.
- 069e0db: Add SEO024–SEO027, the remaining statically-analyzable SEO checks:

  - **SEO024** — Character encoding: flags a rendered page with no `<meta charset>`
    (lives in app.html, so rendered-only, like the viewport rule).
  - **SEO025** — Image alt text: flags an `<img>` with no `alt` attribute (empty
    `alt=""` is valid decorative; static/CLI mode only, like the perf image rules).
  - **SEO026** — hreflang validity: opt-in check of `<link rel="alternate"
hreflang>` alternates — malformed codes, or 2+ alternates without an x-default.
  - **SEO027** — Heading hierarchy: flags zero or multiple `<h1>` per page (exactly
    one passes; layout-chain headings count). Introduces a page-body headings
    channel collected by both providers.

- 8aeeabb: Add SEO022 (title length, 30–60 chars) and SEO023 (meta description length,
  70–160 chars). Both check only static text — the literal title/description is now
  captured onto the head model — and flag both too-short and too-long values; a
  dynamic title/description is skipped (presence stays owned by SEO001/SEO002).
  Static literal `title`/`description` props on `svelte-meta-tags` and `svelte-seo`
  components are measured too (a `titleTemplate` correctly suppresses title
  measurement). Length is counted by grapheme cluster, so emoji (ZWJ/flag/skin-tone
  sequences) count as one character.

### Patch Changes

- Updated dependencies [67a5a0e]
- Updated dependencies [0fbc25d]
- Updated dependencies [069e0db]
- Updated dependencies [8aeeabb]
  - @svelte-vitals/core@0.14.0

## 0.12.0

### Minor Changes

- e627343: Add six SEO checks decidable from the resolved `<head>` and project facts: SEO010 surfaces a
  route set to `noindex` (verify intentional), SEO011 Twitter Card, SEO012 Open Graph description,
  SEO013 Open Graph URL, SEO014 viewport, and SEO015 (robots.txt should reference your sitemap).
  SEO010 only fires on a statically-resolvable `noindex`/`none` (never a dynamic value); robots/
  viewport tags placed in `app.html` are covered in plugin/rendered mode.

### Patch Changes

- Updated dependencies [e627343]
  - @svelte-vitals/core@0.13.0

## 0.11.0

### Minor Changes

- ef895c1: Add two static resource-hint Performance checks: PERF003 flags a `<link rel="preload">`
  with no `as` attribute (the browser ignores or double-fetches it), and PERF004 flags a
  `<link rel="preload" as="font">` with no `crossorigin` (the font preload is wasted and the
  file downloads twice). Both surface in the CLI, the static report, and the vite plugin /
  dev UI. Static mode evaluates hints in `<svelte:head>`; resource hints in `app.html` are
  covered in plugin/rendered mode.

### Patch Changes

- Updated dependencies [ef895c1]
  - @svelte-vitals/core@0.12.0

## 0.10.0

### Minor Changes

- e6ee630: Add a visual HTML report: `svelte-vitals --reporter html` writes a self-contained,
  styled HTML page (Health score, per-category and per-route scores, findings with
  fixes) you can open in a browser. Output path defaults to `svelte-vitals-report.html`;
  override with `--out-file <path>` or `--out-file -` for stdout. The core gains
  `buildHtmlDocument` / `formatHtmlReport` for reuse by other surfaces.

### Patch Changes

- Updated dependencies [e6ee630]
  - @svelte-vitals/core@0.11.0

## 0.9.1

### Patch Changes

- 0555127: Add a documentation site (Starlight, bilingual en/ja) at
  https://oekazuma.github.io/svelte-vitals/ with rule references and guides, and point every
  finding's `docsUrl` (and the SARIF `informationUri`) at it — previously these linked to an
  unpublished domain. Rule doc slugs are lowercased (e.g. `/rules/seo001`).
- Updated dependencies [0555127]
  - @svelte-vitals/core@0.10.1

## 0.9.0

### Minor Changes

- d86ced5: **Remove the Accessibility (a11y) category.** svelte-vitals now focuses on SEO and
  Performance; accessibility is well covered by the Svelte compiler, eslint-plugin-svelte,
  and axe. This removes the a11y collector (the aggregated Svelte `a11y_*` compiler
  warnings), the `a11y` category from the score/Health breakdown and reporters, and the
  `--ignore a11y_*` / allow-list a11y handling. `Category` is now `'seo' | 'performance'`,
  and the Health score averages SEO + Performance. **Breaking:** a11y findings and the
  `categories.a11y` entry no longer appear in any reporter or the MCP `analyze` output.

### Patch Changes

- Updated dependencies [d86ced5]
  - @svelte-vitals/core@0.10.0

## 0.8.0

### Minor Changes

- 31904f9: Add the combined **Health Report** (#10): a single weighted Health score across the
  SEO, Performance, and Accessibility categories (equal weights by default, overridable
  via `Config.weights`), surfaced as the headline in the console/agent reporters and the
  MCP `analyze` output, with an optional `--min-health <0-100>` CI gate.

  **Breaking (JSON report):** the top-level `score` is now the combined Health score (it
  was the SEO score); the top-level `scoreModel` is removed; a `weights` field is added.
  Per-category scores remain under `categories` (e.g. `categories.seo.score` /
  `categories.seo.scoreModel`).

### Patch Changes

- Updated dependencies [31904f9]
  - @svelte-vitals/core@0.9.0

## 0.7.0

### Minor Changes

- a7bc1e6: Add the Accessibility category (v0.5, #10): aggregates the Svelte compiler's `a11y_*`
  warnings (e.g. `a11y_missing_attribute`, `a11y_label_has_associated_control`) into the
  report as a scored `a11y` category, reusing the Performance v0.4 multi-category
  foundation. Findings use the Svelte code as the rule id and link to Svelte's docs;
  `--ignore <a11y_code>` disables a specific code. Per-file compile results are cached, and
  a file that fails to compile is skipped rather than failing the run.

## 0.6.0

### Minor Changes

- 2857e16: Add the Performance category (v0.4, #10): static `<img>` checks — **PERF001** (missing
  `width`/`height`, CLS risk; warning) and **PERF002** (missing `loading` attribute; info
  advisory) — with dynamically-bound attributes counting as present. Introduces the
  multi-category foundation: `Result.category`/`line`, the `ImageInfo`/`ResolvedImages` IR,
  `RuleContext.images`, `imageRule`, `scoresByCategory`, and category-aware reporters
  (per-category scores; JSON `categories` map). Existing SEO findings, scores, and output
  are unchanged.

### Patch Changes

- Updated dependencies [2857e16]
  - @svelte-vitals/core@0.8.0

## 0.5.2

### Patch Changes

- 337c29d: Slice 1 polish (#13): capture the imported name from string-literal import
  specifiers (`import { 'a-b' as c }`) instead of falling back to the local alias,
  and warn instead of silently defaulting when `--treat-dynamic-as` or `--fail-on`
  gets an unknown value. Adds direct unit coverage for `attrValueOf` and for
  component detection inside `{#if}` branches.

## 0.5.1

### Patch Changes

- 6f3aeec: Formalize the ESM-only stance (#20): drop the legacy top-level `main`/`types` from
  `@svelte-vitals/core` and `@svelte-vitals/vite` so every package is `exports`-only,
  add `sideEffects: false` across all packages for consistent tree-shaking, declare
  `"engines": { "node": ">=18" }` on every package so the documented runtime floor is
  machine-enforceable, and document the ESM-only (Node 18+, `require()` unsupported by
  design) requirement in each README. CI now guards type-resolution with
  `@arethetypeswrong/cli` (esm-only profile) alongside publint.

  `core` and `vite` get a `minor` bump because dropping top-level `main`/`types` can
  affect consumers/tools that resolve entry points without `exports` support (e.g.
  `moduleResolution: node`); `svelte-vitals` and `@svelte-vitals/mcp` only gain the
  additive `sideEffects: false` and `engines` declaration, so they stay `patch`.

- Updated dependencies [6f3aeec]
  - @svelte-vitals/core@0.7.0

## 0.5.0

### Minor Changes

- 396a783: Add `@svelte-vitals/mcp`, a Model Context Protocol server exposing `analyze` and `explain_rule` tools over stdio (#24). Core gains `buildJsonReport`, `explainRule`, `RuleInfo`, and `docsUrlFor`; the JSON report's per-finding objects now include `docsUrl`; the CLI gains `analyzeProject` for reuse.

### Patch Changes

- Updated dependencies [396a783]
  - @svelte-vitals/core@0.6.0

## 0.4.0

### Minor Changes

- 762d4d1: Add SARIF 2.1.0 (`--reporter sarif`) and GitHub Actions workflow-command (`--reporter github`) reporters. The `github` reporter is auto-selected under GitHub Actions for inline PR annotations; SARIF can be uploaded to GitHub code scanning.

### Patch Changes

- Updated dependencies [762d4d1]
  - @svelte-vitals/core@0.5.0

## 0.3.0

### Minor Changes

- e60d033: Agent-native output. Every rule now carries a structured `fix` (instruction + snippet), surfaced in the JSON report and in a new `--reporter agent` Markdown remediation document built for handing findings to an AI coding agent. The CLI auto-selects the agent reporter when run under a known AI-agent harness (`CLAUDECODE`), overridable via `SVELTE_VITALS_REPORTER` or `--reporter`.

### Patch Changes

- eb97f09: Agent reporter polish: an invalid `--reporter <value>` now fails fast with exit 2 instead of silently falling back to auto-detection; the agent Markdown report orders findings most-severe-first (critical-bearing files first, severity-sorted within each file) and tells the agent to prioritize critical issues; tag-like tokens (`<title>`, `<meta …>`, `<svelte:head>`) in the agent report are wrapped in inline code so Markdown renderers no longer strip them; rule `fix` templates are now copied per finding rather than shared by reference; and when the agent reporter is auto-selected from the environment (not requested explicitly), a one-line hint is printed to stderr explaining how to override.
- Updated dependencies [eb97f09]
- Updated dependencies [e60d033]
  - @svelte-vitals/core@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [fcb0494]
  - @svelte-vitals/core@0.3.0

## 0.2.0

### Minor Changes

- 08b6d74: Static-mode finishing: scored SEO report.

  - New rules SEO002–SEO009 (description, canonical, og:image, og:title, robots.txt, sitemap.xml, JSON-LD, `<html lang>`).
  - Scoring model (§12): per-route scores, route average, site penalty, and a critical cap, surfaced in the console header and JSON.
  - JSON reporter (`--json` / `--reporter json`) and `--by-route` per-route tree.
  - New flags: `--fail-on`/`--fail-on-warning`, `--rules`/`--ignore`. `treatDynamicAs: 'warn'` now reports dynamic values as warnings.

### Patch Changes

- Updated dependencies [08b6d74]
  - @svelte-vitals/core@0.2.0

## 0.1.0

### Minor Changes

- e3228ca: Detection layers 2–4: resolve head metadata set via components, not just literal `<svelte:head>`.

  - Built-in adapters for `svelte-meta-tags` (`MetaTags`) and `svelte-seo`.
  - Transitive resolution of custom `src/` components (depth-limited, cycle-guarded).
  - `--meta-components` flag to declare opaque meta components, plus `--treat-dynamic-as` and `--route` flags.
  - Components recognized as meta sources suppress false "missing" verdicts; unknown components do not.

### Patch Changes

- Updated dependencies [e3228ca]
  - @svelte-vitals/core@0.1.0

## 0.0.1

### Patch Changes

- 4786248: Initial release: the static-mode SEO foundation.

  - `npx svelte-vitals` scans a SvelteKit project and checks `<title>` presence (SEO001) by statically parsing `<svelte:head>` with `svelte/compiler`, resolving the full layout chain (`+layout.svelte` → … → `+page.svelte`).
  - Two-axis detection (presence × value): a dynamic title such as `<title>{data.title}</title>` is recognized and never reported as missing; it passes with a `↯` marker. Only genuinely missing or empty metadata is flagged.
  - Runtime-agnostic `@svelte-vitals/core` (types, rule engine, reporter) with a `Runtime` I/O abstraction, plus a Node adapter in the CLI. Exit codes: `0` ok, `1` critical finding, `2` execution error.

- Updated dependencies [4786248]
  - @svelte-vitals/core@0.0.1
