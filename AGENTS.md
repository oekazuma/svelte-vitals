# AGENTS.md

Repository conventions for AI agent sessions. Read this before exploring the codebase — it exists so you don't have to rediscover (or guess) these facts every session.

## What this is

svelte-vitals is a static code-health checker for SvelteKit — not a runtime Web Vitals reporter. It statically analyzes source code (resolved `<head>` metadata and component bodies) across six categories: SEO, Performance, Correctness, Security, Architecture, Accessibility. The project is pre-1.0 (all packages are on `0.x` versions).

## Verify commands

| Purpose        | Command              | Notes                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build          | `pnpm build`         | `pnpm -r build`                                                                                                                                                                                                                                                                                                                                                                     |
| Typecheck      | `pnpm typecheck`     | `pnpm -r typecheck`                                                                                                                                                                                                                                                                                                                                                                 |
| Test           | `pnpm test`          | `pnpm build && pnpm -r test` (vitest) — builds first because packages/cli's tests import @svelte-vitals/core from its built dist                                                                                                                                                                                                                                                    |
| Floor smoke    | `pnpm smoke`         | needs `pnpm build` first — it runs the built `dist` under a bare `node`; locally that is the devEngines Node, not the floor, so the floor claim is what CI's `floor-smoke` job (pinned to 24.16.0) adds                                                                                                                                                                             |
| Ecosystem      | `pnpm ecosystem`     | needs `pnpm build` first — clones the third-party SvelteKit apps listed in `scripts/ecosystem-smoke.js` and asserts only "no crash, exit ∈ {0,1}, report parses"; scheduled weekly, never PR-blocking                                                                                                                                                                               |
| Lint           | `pnpm lint`          | `oxlint .` + `oxfmt --check .` + `pnpm lint:docs` (textlint `@textlint-ja/preset-ai-writing` plus a curated `preset-ja-technical-writing` over READMEs, `packages/cli/docs/`, and the docs site's `.md` pages — `.mdx` pages are not linted. Config in `.textlintrc.json`; its disabled rules were each measured noisy on this corpus, so don't re-enable one without re-measuring) |
| Format         | `pnpm format`        | `oxfmt --write .`                                                                                                                                                                                                                                                                                                                                                                   |
| Publish checks | `pnpm check:publish` | publint + attw (`--profile esm-only`)                                                                                                                                                                                                                                                                                                                                               |

CI (`.github/workflows/ci.yml`) runs five jobs: `lint`, `check` (build + typecheck + check:publish), `test`, `floor-smoke`, `docs`. A separate `.github/workflows/ecosystem.yml` runs the ecosystem smoke weekly. Run the relevant verify commands yourself and confirm they pass **before** claiming a task is complete.

## Package map

- `packages/core` — runtime-agnostic rule engine, scorer, and reporter (types + logic only). Two
  entry points: `.` (`src/index.ts`) is the semver-stable surface — config authoring and reading a
  JSON report, nothing else, and it must stay **type-closed** (no export may reference a type only
  `./internal` exports). `./internal` (`src/internal.ts`) is everything cli and vite share and
  carries no semver guarantee. New cross-package exports go in `internal.ts`; adding to `index.ts`
  is a decision, not a default. See `docs/superpowers/specs/2026-08-16-v1-public-surface.md`.
- `packages/cli` — the `svelte-vitals` CLI.
- `packages/vite` — Vite/SvelteKit plugin + live dashboard; analyzes prerendered HTML during `vite build`.
- `docs` — Blume docs site (`docs/blume.config.ts`), English + Japanese (`docs/src/content/docs/` and `docs/src/content/docs/ja/`).
- `examples/kitchen-sink` — real SvelteKit app used as an e2e defect gallery, false-positive
  canary, and live-dashboard dogfood; every new rule needs a planted sample here — the meta-test
  in `examples/kitchen-sink/test/e2e-static.test.ts` enforces coverage against `allRules`. See
  `examples/kitchen-sink/README.md`.
- `packages/cli/docs` — the handful of topics `svelte-vitals docs show <name>` prints. Edit the
  markdown, then `pnpm --filter svelte-vitals run gen:docs && pnpm format`; `packages/cli/test/docs-embed.test.ts`
  fails the build if the committed `src/docs/generated.ts` drifts. Keep them terse and terminal-first —
  the site is the complete reference, this set is what a reader needs mid-run.
- The docs site's CLI flag-reference tables (`guides/(setup)/cli.md` and `install.md`, en+ja, between
  `<!-- cli-reference:start/end -->` markers) are generated from the gunshi arg declarations: after
  changing any flag or its description, run `pnpm --filter svelte-vitals run gen:cli-reference && pnpm format`;
  `packages/cli/test/cli-reference.test.ts` fails the build on drift. Never edit inside the markers by hand.

The first-party GitHub Action is **not** part of this monorepo — it lives in its own repository,
[oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action), depending on
the published `svelte-vitals`/`@svelte-vitals/core` npm packages like any other consumer (regular
semver ranges, not workspace links). See `docs/superpowers/specs/2026-07-22-action-dist-post-merge-only.md`
for why it was split out. `packages/cli/scripts/gen-action-pin.js` (run manually via
`pnpm --filter svelte-vitals run update-action-pin`, not on every build) fetches that repo's
latest release into the committed `packages/cli/src/ci/action-pin.generated.ts`, which `ci
install`/`ci upgrade` bundle into scaffolded workflows.

## Hard rules

- **Core purity**: `packages/core/src/index.ts` states verbatim: "runtime-agnostic core (design §8). No `node:` imports, no I/O, no runtime-specific globals." All I/O is injected through the `Runtime` interface (`packages/core/src/runtime.ts`). Never add a `node:` import or direct I/O call inside `packages/core`.
- **Two Node floors, both jobs run the smoke**: the published packages promise
  `engines.node: >=24.16.0` (end users); the dev toolchain is pinned by
  `devEngines.runtime` and is free to require more. CI keeps these apart —
  `test` runs the vitest suite on the release lines the toolchain supports
  (`24` / `26`), then runs the built `dist` under a bare `node` on that same
  matrix Node (`scripts/floor-smoke.js`); `floor-smoke` runs that same script
  the same way, but pinned to 24.16.0. The smoke includes the raw-Node `.ts`
  config check, which vitest can never pin — its module runner transforms
  in-process `import()` — and every supported Node strips TypeScript types
  natively, so the check is a single branch. A dev dependency raising its Node
  floor is not a problem _for dependencies the smoke actually executes_,
  because `floor-smoke` runs the dist under bare `node` and never loads them.
  pnpm itself, and the build toolchain (tsdown et al.), are not exempt —
  `floor-smoke` still runs `pnpm install`/`pnpm build` on 24.16.0, so those
  stay floor-bound. Never pin the `test` matrix back to the floor, and never
  add a dev dependency to the smoke — it must stay Node-builtins-only. Design
  doc: `docs/superpowers/specs/2026-07-31-floor-smoke-design.md`. **Changing the
  `test` matrix means updating the `main` ruleset's required status checks in the
  same change** — they are matched by job name (`test (24)`), a stale name waits
  forever as "Expected", and merges then only go through by admin bypass. Read them
  with `gh api repos/oekazuma/svelte-vitals/rules/branches/main`.
- **Vendored spec data is generated, never edited.** `packages/core/src/html-spec/generated.ts` (a
  projection of `@markuplint/html-spec`) and `packages/core/src/rules/seo/schema-vocabulary.generated.ts`
  (from `schema-dts`) are written by `pnpm --filter @svelte-vitals/core run gen:html-spec` /
  `gen:schema-vocab` from the **installed** package — the data package is a pinned catalog
  devDependency, so a version bump makes the drift test (`packages/core/test/html-spec.test.ts`,
  `schema-vocabulary.test.ts`) fail until regenerated, offline, with the data diff in the PR. The
  html-spec projection is the single source for per-element HTML facts and per-role ARIA property
  tables; `aria-query` stays the single source for the ARIA vocabulary and required properties, and
  the projection deliberately carries no `required` field so the two cannot answer the same
  question. Design: `docs/superpowers/specs/2026-08-18-html-spec-data-source.md`.
- **Dependencies via catalog**: root `package.json` devDependencies are all pinned as `catalog:`; actual versions live in `pnpm-workspace.yaml`. Add/bump shared devDependencies there, not as literal versions in a package's `package.json`.
- **Changesets required**: any user-facing change needs `pnpm changeset`. Merging to `main` opens a release PR (Changesets bot). Internal-only / doc-only changes don't need one.
- **en/ja docs stay in sync**: `docs/src/content/docs/` (English) and `docs/src/content/docs/ja/` (Japanese) are updated together, and CI enforces it — the `docs` job runs `blume translate --check` against the committed `docs/blume.translations.json` ledger and fails when an English page changed without its stamp. After editing an English page, update the Japanese page too, then run `pnpm --filter docs run translate:stamp <en-file...>` to record that the pair matches. Never re-stamp a page whose Japanese half you did not actually update, and never regenerate the whole ledger to silence the gate — a stamp is an assertion, not a formality. (A brand-new page pair starts untracked, which the gate ignores; stamp it so future drift is caught.)

## Conventions

- **Comments and docs are for the next reader, not the reviewer.** A comment earns its place only
  when it says something the code cannot: a constraint, a rejected alternative and why, a
  non-local dependency. Why a change was made belongs in the commit message and the PR, which are
  read once — not in a file read every time. Test names state the behaviour, not the reasoning.
  Prefer one line over three; delete anything that restates the code beneath it.
- **Conventional commits**, scoped by package, e.g.:
  - `fix(cli): make --diff/--staged work when the project is not at the git repo root`
  - `test(cli): pin behavior for malformed .svelte files in both passes`
  - Other prefixes in use: `feat(vite):`, `docs:`, `chore:`.
- **Adding a rule**: create `packages/core/src/rules/<dir>/<slug>.ts` (the Performance directory is `perf/`, not `performance/`), then register it in **three** places, all in `packages/core/src/rules/index.ts`: the import, the `allRules` array, and the re-export block. (`packages/core/src/internal.ts` picks the rule up through `export * from './rules/index.js'`; `allRules` is the only registry.) Add rule docs under `docs/src/content/docs/rules/<id>.md` (en) and `docs/src/content/docs/ja/rules/<id>.md` (ja) — `packages/cli/test/docs-links.test.ts` fails the build if either is missing. (`<id>` already includes the category, e.g. `docs/src/content/docs/rules/performance/heavy-import.md` — note the docs tree uses `performance/` here, not the source tree's `perf/`.) Then regenerate the index pages with `pnpm --filter svelte-vitals run gen:rules-index && pnpm format` and commit them; `packages/cli/test/rules-index.test.ts` fails the build if they are stale. Also regenerate the repo-root `skills/` copies (the skills.sh install source, `npx skills add oekazuma/svelte-vitals`) with `pnpm --filter svelte-vitals run gen:skills` — their rule digest embeds the registry, and `packages/cli/test/skills-repo.test.ts` fails the build if they drift; never edit `skills/` by hand (oxfmt ignores it so the files stay byte-identical to the generator's output). **Never hard-code rule counts or ID ranges in READMEs/guides** (e.g. "CORRECT001–009" or "the two Performance rules") — such text rots on every new rule; refer to rule _categories_ instead. Rule IDs in guides are fine only as examples or sample output. Adding a new arm to an existing rule (rather than a new rule) inherits that rule's committed suppressions — the `id::route::location` key doesn't change, so existing entries keep matching the new arm's findings too — so the arm's changeset must call out that its findings can already be pre-suppressed in projects with recorded entries for that rule.
- **Tests**: vitest, per-package `test/` directories; fixtures live under `test/fixtures/`.
- **I/O budget**: `packages/cli/test/io-budget.test.ts` holds the collection phase
  (`packages/cli/src/collect-all.ts`) to a fixed number of `Runtime` calls. This is how
  analysis speed is defended in CI — wall-clock timings are far too noisy on shared
  runners to gate on. Adding a collector or a glob means checking that test. Lowering a
  budget is welcome; raising one is a design decision needing a recorded reason, not a
  number edit. The two regressions that counts cannot catch — a widened analysis, and lost
  parallelism — are measured manually with `pnpm bench` (never in CI).
- **Dependency budget**: `packages/cli/test/dep-budget.test.ts` caps the production dependency
  closure (unique `name@version` reachable through `dependencies` / `optionalDependencies`) of each published package at its
  measured size. Adding or bumping a runtime dependency means checking that test. Lowering a ceiling
  is welcome; raising one is a design decision needing a recorded reason in the PR, not a number edit.
- **User-facing levers ship with two guards.** A lever is anything a user sets to change what the
  run does — a CLI flag, a config key, an inline directive, a suppressions entry, an override. Each
  needs (1) a case in the kitchen-sink e2e suite asserting an **observable effect** on the real
  gallery, so it fails if the lever becomes a no-op, and (2) a runtime warning when the lever
  selects nothing on a full run **and selecting nothing is never a legitimate state**. Where it can
  be legitimate — an inline directive left behind after the code was fixed is the worked example —
  the warning is deferred to an opt-in follow-up, and the design records why. Guard (1) has no exception. The class
  this prevents is a lever that silently does nothing while the run reports success — a `--route
"/blog/**"` that matches zero routes and exits 0, passing a canary that asserts only that a
  report came back. Guard (2)'s "on a full run" is about where the warning
  would be noise, not a blanket rule: an unmatched `--route`, and a `--rules` id whose facts
  `--route` skips, are reported in the scoped run itself, since that is the only run they can be
  wrong in — while unknown directive ids and unmatched `overrides` are full-run-only because a
  scoped run legitimately reaches neither. `packages/cli/test/flag-coverage.test.ts` checks only
  that each CLI flag is **named** by some test: it cannot tell an assertion from a mention, so it
  narrows what review has to look for rather than discharging guard (1). Design record:
  `docs/superpowers/specs/2026-08-17-route-inline-suppression.md`.

## Design docs

`docs/superpowers/specs/` holds design docs, `docs/superpowers/plans/` holds implementation plans, both accumulated with date-prefixed filenames. Before assuming a tradeoff is undecided or reintroducing something that was deliberately removed, check here first — e.g. the a11y category went through an initial design (`2026-06-22-a11y-v0.5-design.md`), a removal (`docs/superpowers/specs/2026-06-23-remove-a11y-design.md`, `docs/superpowers/plans/2026-06-23-remove-a11y.md`), and a later redesign that shipped it (`docs/superpowers/specs/2026-08-14-a11y-category-design.md`, `docs/superpowers/plans/2026-08-14-a11y-category-phase1.md`) — read the redesign doc for why the second attempt succeeded where the first was pulled. The MCP server was designed (`2026-06-22-mcp-server-design.md`) and later removed in favour of CLI + Agent Skills (`docs/superpowers/specs/2026-08-01-remove-mcp-design.md`) — the agent story is deliberately "the skill knows the rules, the CLI runs them", so do not reintroduce an MCP surface without revisiting that doc. The `--fix` autofix idea was closed as agent-delegated — the only mechanically-safe fixes are trivial for an agent, and the valuable ones need page content the agent already has — recorded in `docs/superpowers/specs/2026-06-22-mcp-server-design.md` so it doesn't need re-litigating from scratch.

## Exit codes

The CLI's contract (`packages/cli/src/bin.ts`):

- `0` — no failing findings
- `1` — critical finding present (or `--fail-on`/`--min-health` threshold reached)
- `2` — execution error (not a SvelteKit project / internal error)

## Svelte MCP server

The Svelte MCP server (configured in `.mcp.json`) provides Svelte 5 / SvelteKit documentation and code validation. Use it whenever the task involves Svelte/SvelteKit topics or writing `.svelte` code:

- `list-sections` — call this first to discover the available documentation sections (returns titles, `use_cases`, and paths).
- `get-documentation` — after `list-sections`, fetch every section relevant to the task (accepts single or multiple sections; judge relevance by the `use_cases` field).
- `svelte-autofixer` — run on any Svelte code before presenting it; keep re-running until it returns no issues or suggestions.
- `playground-link` — generates a Svelte Playground link. Only after the user confirms they want one, and never for code already written to files in the project.
