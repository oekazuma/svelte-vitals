# svelte-vitals

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
