# @svelte-vitals/vite

## 0.54.5

### Patch Changes

- 4630838: Release all packages in lockstep. `svelte-vitals`, `@svelte-vitals/core` and `@svelte-vitals/vite` now always share one version number; this release only aligns them.
- Updated dependencies [4630838]
  - @svelte-vitals/core@0.54.5
  - svelte-vitals@0.54.5

## 0.36.4

### Patch Changes

- 0e20a04: Re-evaluate `svelte-vitals.config.{js,ts}` when it changes instead of serving Node's ESM module cache. In `vite dev` the dashboard re-analysis now runs with the edited config, and the dashboard's own scoring config (weights, overrides) follows the edit too; an edit that fails validation is warned about and the previous config is kept. Modules the config file imports are still cached until the dev server process restarts.
- 3d96e0c: `svelteVitalsHandle` now drops a route's ingest signature when the dashboard does not acknowledge the POST, so a route whose first ingest was lost (dev server restarting, a transient socket error, a rejected request) is retried on its next render instead of staying `static` for the rest of the session. POSTs for the same route are sent in render order, so a slow earlier ingest can no longer overwrite a newer one, and a render whose findings change back while an older POST is still in flight is sent rather than deduplicated. With `SVELTE_VITALS_DEBUG` set, a rejected or failed ingest is logged. An ingest the dashboard never answers is abandoned after 10 seconds so later renders of that route are not blocked behind it.
- 7e39487: `svelte-vitals` now exports `createNodeRuntime`, the Node adapter behind its own analysis, and `@svelte-vitals/vite` uses it instead of carrying a copy, so this `@svelte-vitals/vite` release requires this `svelte-vitals` release. `@svelte-vitals/core`'s `./internal` entry adds `isPlainObject`, which the CLI now imports. No findings change.
- ddfe6c8: The dev dashboard's whole-project runner now forwards `analyzeProject`'s warnings (for example an `overrides` glob that matched nothing, an unknown inline-directive id, a file that could not be read or parsed, a rule that crashed and was skipped, or a config-file validation notice) to the terminal, the same way `vite build` already does. An unchanged warning set is not repeated on the next re-analysis. Config-file warnings already printed when the file was loaded are not printed a second time by the runner. The build path's crashed-rule warning is now pinned by a test.
- Updated dependencies [0e20a04]
- Updated dependencies [7e39487]
- Updated dependencies [8be4aaf]
- Updated dependencies [49ab437]
- Updated dependencies [fe919d0]
  - svelte-vitals@0.54.4
  - @svelte-vitals/core@0.51.2

## 0.36.3

### Patch Changes

- d3828d9: The dev dashboard's `/__svelte-vitals/ingest` endpoint now rejects a request whose `Origin` header does not match the dashboard's own host and port (requests without an `Origin`, such as the server-side handle's own POSTs, are accepted as before), and answers 413 as soon as a body exceeds 4 MiB. Previously a page served from any other localhost port could inject findings — including fix snippets that reach "Copy AI prompt" — into the dashboard.
- Updated dependencies [4eb21d1]
  - @svelte-vitals/core@0.51.1
  - svelte-vitals@0.54.3

## 0.36.2

### Patch Changes

- 263d80c: Move the landmark-resolution and classic-script-type policies into core as a single implementation. The CLI's source provider and the Vite plugin's rendered provider now apply the same decision procedure instead of maintaining mirrored copies. Three narrow detection fixes land with the unification: mixed-case landmark tags (`<heaDer>`) are now matched case-insensitively like the rendered document, a `<svelte:element this="…">` with a literal tag now contributes its landmark instead of only demoting its children, and script-`type` matching now follows the HTML spec's ASCII-whitespace rules — a whitespace-only or U+00A0-wrapped `type` is a data block, no longer flagged as render-blocking.
- 55071ab: Replace `tinyglobby` with Node's built-in `fs.glob`, dropping three production dependencies (`tinyglobby`, `fdir`, `picomatch`) from both packages. Results are still files only, dotfile-free, and POSIX-separated on every platform, and symlinks to files still match. One behavior change: symlinked directories are no longer traversed.
- 52a9247: Add `runAnalysis` to core: rule execution plus the correction sequence (configured severities, overrides, inline directives, failed-rule weight correction) as one function. The CLI, the Vite build analysis, and the dev-server handle all run it instead of each replaying the sequence; findings do not change. `applyRuleSeverities`, `applyOverrides`, and `applyInlineDirectives` leave the `./internal` entry — no consumer imports them any more; each stays exported from its source module. `./internal` carries no semver guarantee, but the removals ship as a core minor so an already-installed plugin built against the old surface surfaces as a peer-dependency conflict at install time (a warning or resolution failure, depending on the package manager) instead of failing at import.
- Updated dependencies [3df0604]
- Updated dependencies [263d80c]
- Updated dependencies [55071ab]
- Updated dependencies [e9fd01e]
- Updated dependencies [88ebf6e]
- Updated dependencies [52a9247]
  - svelte-vitals@0.54.2
  - @svelte-vitals/core@0.51.0

## 0.36.1

### Patch Changes

- aca531d: Landmark collection now resolves ARIA fallback role lists (`role="section main"`) the way user agents do — the first token naming a concrete role — instead of taking the first token unconditionally. A list whose first token is abstract or unrecognized (`role="section main"`) now resolves to `main` in both the source and rendered providers, matching browser behavior, so `a11y/duplicate-landmark` and `a11y/top-level-landmark` no longer miss or misreport landmarks introduced through such lists.
- Updated dependencies [bfba619]
- Updated dependencies [7083231]
- Updated dependencies [b714e49]
- Updated dependencies [3acf640]
- Updated dependencies [aca531d]
- Updated dependencies [4a77313]
- Updated dependencies [32e066b]
  - @svelte-vitals/core@0.50.1
  - svelte-vitals@0.54.1

## 0.36.0

### Minor Changes

- 4baf64c: Add the warning-level `a11y/aria-hidden-focus` rule: a keyboard-focusable element hidden from assistive technology by a literal `aria-hidden="true"` — on the element itself or an ancestor. A screen reader user can tab onto such a control while their reader announces nothing for it, and the author cannot see the defect because `aria-hidden` changes nothing visually; WAI-ARIA forbids hiding focusable content this way.
  
  Focusable uses the same element classification as `a11y/interactive-nesting`. An expression-valued `aria-hidden` is unknowable and stays silent, so the legitimate toggle pattern (`aria-hidden={!open}`) never triggers the rule. Consistently-hidden states are exempt as not focusable: a negative or expression `tabindex` (`<button tabindex="-1" aria-hidden="true">` is the documented remediation), a `disabled` form control, and anything at or under an `inert` element. The recommendation points at `inert` for hiding inactive regions such as modal backdrops.

### Patch Changes

- Updated dependencies [4baf64c]
- Updated dependencies [7b7a446]
  - @svelte-vitals/core@0.50.0
  - svelte-vitals@0.54.0

## 0.35.0

### Minor Changes

- ebff12a: `a11y/accessible-name` now also checks `<iframe>`: a frame with none of `title`, `aria-label`, or `aria-labelledby` is announced by screen readers as an unnamed frame. A blank `title=""` computes no name and is reported; hidden or presentational frames (`aria-hidden="true"`, `hidden`, `role="presentation"`/`"none"`) and SVG-namespace iframes are skipped, and expression-valued attributes resolve to silence as everywhere in this rule.
  
  Because this is a new arm on an existing rule, its findings share the rule's `id::route::location` suppression keys — a committed suppressions entry already recorded for `a11y/accessible-name` at the same route and file keeps matching, so iframe findings there can be pre-suppressed in projects with existing entries.
  
  Also, the shared element-facts channel now records a blank literal attribute value (`title=""`) as an empty string instead of folding it into "expression": `a11y/no-autofocus` consequently reports `autofocus=""` (browsers treat it as set), which it previously skipped as unknowable.
- 8ba6790: Add two a11y rules for focus-hijacking global attributes.
  
  `a11y/no-accesskey` flags any element carrying an `accesskey` attribute — the actual shortcut combination varies by browser and OS, is undiscoverable, and conflicts with screen reader and browser keyboard bindings. Unlike most attribute rules, an expression-valued `accesskey` is also flagged: presence is the problem, the value never matters.
  
  `a11y/no-autofocus` flags a literal `autofocus` attribute unless the element is a `<dialog>`, or sits inside a `<dialog>` or a popover container in the same component template — their focusing steps run on show, not at page load, so autofocus there is the correct tool. Expression-valued `autofocus` is unknowable and passes. The dialog/popover carve-out cannot see through component boundaries, so an autofocus inside a component rendered into a dialog is a known false positive — the docs page names the inline-suppression escape hatch.
- 431ef7e: Add three info-level a11y rules for small markup-conformance gaps.
  
  `a11y/no-duplicate-dt` flags a `<dt>` whose static text duplicates an earlier `<dt>` in the same `<dl>` — the spec says one name should not appear twice, and a duplicate is usually a copy-paste error where two descriptions were meant to share one term. Names under logic blocks, with non-static content, or in nested lists' own scopes are exempt.
  
  `a11y/abbr-title` flags an `<abbr>` with no `title` (blank included) giving the expansion. This is a best-practice nudge, not a conformance check: an expansion given in the surrounding prose is correct markup this rule cannot see — that known false-positive class is silenced with the inline `svelte-vitals-disable-next-line` directive, which the docs page shows.
  
  `a11y/pattern-title` flags an `<input pattern>` with no `title` (blank included) describing the expected format — browsers surface the title in the validation error, so without it a failed submit says only that the value is wrong. Only judged where `pattern` is effective (no `type`, or a literal type in the spec's applies-to set).
  
  All three treat expression-valued attributes as unknowable and stay silent, matching the other element rules.

### Patch Changes

- Updated dependencies [ebff12a]
- Updated dependencies [8ba6790]
- Updated dependencies [431ef7e]
  - @svelte-vitals/core@0.49.0
  - svelte-vitals@0.53.0

## 0.34.0

### Minor Changes

- 29d620e: Add `correctness/autoplay-muted`: flags `<video autoplay>` without `muted`. Chrome and Safari block autoplay with audio, and a blocked autoplay does not error — the video silently never starts playing for real visitors while appearing to work in development. Only a literal `autoplay` is flagged; `muted` in any form (bare attribute, `muted={expr}`, `bind:muted`, or a spread) passes. The recommendation is to add `muted` (and typically `playsinline` for iOS).
- f986615: Add `performance/iframe-loading`: recommends `loading="lazy"` on `<iframe>` elements. An offscreen iframe typically loads an entire third-party document — scripts, fonts, media — so eager-loading one usually costs more than an offscreen image, and iframes rarely are the LCP element. Severity is `info`: an above-the-fold iframe is legitimately eager and position is statically unknowable. Any literal `loading` value passes (the author made a choice), as do an expression-valued `loading` and a spread attribute.
- e01d64a: Add `a11y/positive-tabindex`: flags elements with a literal `tabindex` whose value parses to a finite number above 0. A positive tabindex puts the element ahead of every naturally-ordered element on the page, so a single `tabindex="1"` reorders keyboard navigation globally — only `0` (join the natural order) and `-1` (programmatically focusable) are safe values. Expression-valued `tabindex` is unknowable and is skipped.

### Patch Changes

- Updated dependencies [29d620e]
- Updated dependencies [f986615]
- Updated dependencies [e01d64a]
  - @svelte-vitals/core@0.48.0
  - svelte-vitals@0.52.0

## 0.33.0

### Minor Changes

- a657d2f: `svelte-vitals` and `@svelte-vitals/core` are now peer dependencies instead of exact-pinned regular dependencies. Previously the plugin bundled its own copy of the rule engine, so a project that also installed the `svelte-vitals` CLI directly ran two independent cores — a config the newer CLI accepted could hard-fail `vite build` against the plugin's older registry, with no warning from any package manager.
  
  With peers, a compatible install resolves one shared copy: the plugin validates and analyzes with the same rule registry the CLI runs, and installing versions outside the plugin's supported range surfaces as an install-time peer warning. npm and pnpm auto-install missing peers; if you install with yarn, add both `svelte-vitals` and `@svelte-vitals/core` as devDependencies alongside `@svelte-vitals/vite` (classic yarn hoists core transitively, but Plug'n'Play resolves only declared packages).

### Patch Changes

- Updated dependencies [96847d4]
- Updated dependencies [a657d2f]
  - svelte-vitals@0.51.1

## 0.32.3

### Patch Changes

- 0283d20: Scoping notices now say what to do next: an unmatched `--route` or `overrides` glob names the glob form it expects and where the routes/files are listed, a `--rules` id that `--route` cannot examine says why and how to check it, an inline directive naming an unknown rule points at `svelte-vitals explain --list`, and the Vite plugin's warnings share the CLI's `svelte-vitals:` prefix.
- Updated dependencies [4b6a07b]
- Updated dependencies [1ff00b1]
- Updated dependencies [1ff00b1]
- Updated dependencies [5f7fd3f]
- Updated dependencies [0283d20]
- Updated dependencies [1ff00b1]
- Updated dependencies [94a77be]
  - @svelte-vitals/core@0.47.2
  - svelte-vitals@0.51.0

## 0.32.2

### Patch Changes

- a6ee36a: Build the packages with tsdown instead of tsup. Public entry points and type surface are unchanged; only the internal chunk layout of `dist/` differs.
- Updated dependencies [eb82bb4]
- Updated dependencies [a6ee36a]
  - svelte-vitals@0.50.1
  - @svelte-vitals/core@0.47.1

## 0.32.1

### Patch Changes

- Updated dependencies [a1aca37]
- Updated dependencies [eb8c568]
- Updated dependencies [986e33a]
  - @svelte-vitals/core@0.47.0
  - svelte-vitals@0.50.0

## 0.32.0

### Minor Changes

- d1f5916: Add `a11y/disallowed-aria-props` and `a11y/deprecated-aria`, judged against the ARIA 1.3 role tables in the vendored HTML spec data. `disallowed-aria-props` (warning) reports an `aria-*` attribute the element's role prohibits — most often `aria-label` on a bare `<div>`/`<span>`, which the Svelte compiler does not warn about — or does not own; for elements whose implicit role depends on context (`<a>`, `<img>`, `<input>`, …) it judges only what holds under every role the element could have. `deprecated-aria` (info) reports `role="directory"`, `aria-dropeffect`/`aria-grabbed`, and an attribute deprecated on its role (`aria-haspopup` on `checkbox`, `aria-disabled` on `generic`). Both overlap the compiler's `a11y_role_supports_aria_props` on explicit roles and never disagree with it: the ten (role, attribute) pairs where the ARIA 1.3 tables and the compiler's data differ are exempted, and `<address>`/`<hgroup>` follow the ARIA-in-HTML specification rather than the dataset.
  
  `a11y/deprecated-element` now reports `<marquee>` and `<blink>` as well — they were excluded because the compiler warns on them, which left the score blind to two of the 29 obsolete elements while it counted `<font>`. The two never disagree; the overlap is the same deliberate one every ARIA rule already has.
- 298e86f: Add two declaration-driven rules, `a11y/disallowed-element` and `a11y/required-element`. Both are inert until a project declares tag names in their `elements` option (`{ options: { elements: ['iframe'] } }`); an `overrides` entry adds to the list for the routes or files it matches. `disallowed-element` reports every occurrence of a declared tag in component source. `required-element` judges the composed route — layout chain, page, resolved components, and `app.html`'s `<body>` — so a layout's `<main>` counts; presence passes in any world, and a missing element is reported only where the route is closed for elements (build mode always; static mode where every component resolved and there is no `{@html}` or `<svelte:element>`).
  
  The `elements` declaration is a bare tag name — letters, digits, hyphens — and selector syntax is rejected when the config loads, so a later attribute-qualified form can be added without changing what today's configs mean. `string-list` rule options can now declare a `pattern` for this.
- 6c22500: New rule `a11y/permitted-contents`: every literal child element must be permitted content of its literal parent, per the HTML content models (membership only — order and count are unjudgeable statically). Severity is split by consequence: broken structure (a non-`<li>` child of `<ul>`, a heading inside a `<button>`, a `<li>` outside any list) is `warning`; category mismatches (`<button><div>`) are `info`. `<option>` rich content follows the compiler (allowed), and interactive nesting stays `a11y/interactive-nesting`'s verdict, so one defect is never two findings. Measured on eleven real apps before building: 351 adjudicated-true findings, 0 false positives.
  
  `ElementFact` (internal surface) gains `parent`, `attrs[*].value`, `hasSpread`, and `unknownContent`.
- 0cdf097: Add `a11y/deprecated-element` and `a11y/deprecated-attr`, the first two rules on the vendored HTML spec data. `deprecated-element` reports the elements in the HTML standard's obsolete-features list (`<center>`, `<font>`, `<strike>`, …), leaving `<marquee>`/`<blink>` to the Svelte compiler; `deprecated-attr` reports an attribute the spec data marks deprecated on that element (`iframe[frameborder]`, `td[width]`, `hr[size]`), consulting the element's own attribute table only, so SVG sprites' `xlink:href` are never reported. Both are `info`, skip the SVG namespace, and yield one finding per element — several deprecated attributes on one element are listed in a single finding anchored at the start tag, so one inline directive silences it.
  
  `@svelte-vitals/core` now embeds a projection of `@markuplint/html-spec` (MIT) as generated data; the notice ships in the built output. There is no new runtime dependency.
- 5c63cd8: Apply `svelte-vitals-disable-next-line` to every finding the report anchors to a file and a line, route-level ones included — a duplicate landmark, a second `<h1>`, an image missing dimensions. Previously the directive was read only by the file-scoped rules, so a comment above a route-level finding did nothing and said nothing.
  
  A suppressed finding becomes a pass for that rule and route rather than disappearing, so the route stays in the category average. A directive inside a component silences the finding on every route composing that component; per-route suppression remains the suppressions file's job.
  
  A directive naming a rule id that no rule declares is now reported as a warning instead of silently suppressing nothing — on full runs, gated like the stale-suppressions report, since a `--route` run parses files it never analyses.
  
  Report selections that matched nothing, so a run cannot look clean because it checked nothing: a `--route` glob matching no route, an `overrides` entry whose `route` or `files` glob matches nothing (full runs only), and a rule named by `--rules` whose facts a `--route` run does not collect.
- 1271aa6: Known-limitation sweep for the a11y rules:
  
  - `a11y/use-list` now needs **two or more** bullet items under one parent (sibling text nodes, or sibling elements each opening with a bullet) before it reports — a lone `- note` line is a dash, not a list (WCAG H48 is about sequences). Projects with a single planted bullet line lose that finding.
  - `a11y/unknown-aria-attribute` and `a11y/invalid-aria-value` anchor their findings at the element's start tag instead of the attribute's line, so one `svelte-vitals-disable-next-line` above a multi-line element now reaches them. Recorded suppressions-file entries are unaffected (the key carries no line).
  - `a11y/invalid-aria-value` rejects an empty token list (`aria-relevant=""`): a token list is one or more tokens.
  - `a11y/required-aria-props` no longer asks a native combobox for `aria-expanded`/`aria-controls` — the host supplies both (HTML-AAM). That is a `<select role="combobox">` without `multiple`/`size > 1` and an `<input list role="combobox">` whose type is omitted or text/search/tel/url/email; `<select multiple>`, `<select size="2">`, and other input types still owe them.
  - `a11y/no-missing-id-ref` now follows every ARIA id-reference property (`aria-owns`, `aria-details`, `aria-errormessage`, `aria-flowto`) and HTML's `list`, `headers`, `form`, `popovertarget`, `commandfor`, not only `for`/`aria-labelledby`/`aria-describedby`/`aria-controls`/`aria-activedescendant`.
  - `svelte-vitals explain` prints a `string-list` option's entry grammar where one is declared (`each entry a bare tag name …`).
  
  Two of these widen an existing rule rather than adding one, and a rule's findings are suppressed by `id::route::location` without a line — so a project with a recorded suppressions entry for `a11y/no-missing-id-ref` or `a11y/invalid-aria-value` at a location will find the new idref attributes and the empty-token-list case already silenced there.

### Patch Changes

- 805d30a: The dev dashboard's live layer (`svelteVitalsHandle`) now runs only the route-scoped rules a single rendered page can answer. `seo/duplicate-title` and `seo/duplicate-description` used to pass on every visited route — one page's head has nothing to collide with — and that pass replaced the static finding in the dashboard, hiding a real duplicate once both routes were visited. Project-scope rules (`seo/robots-txt`, `seo/sitemap-xml`, `seo/html-lang`) no longer run in the live layer either; they used to add a per-visited-route copy of a site-wide result. Core gains `Rule.crossRoute` (internal surface) for the uniqueness rules.
- Updated dependencies [d1f5916]
- Updated dependencies [298e86f]
- Updated dependencies [805d30a]
- Updated dependencies [6c22500]
- Updated dependencies [0cdf097]
- Updated dependencies [5c63cd8]
- Updated dependencies [1271aa6]
  - @svelte-vitals/core@0.46.0
  - svelte-vitals@0.49.0

## 0.31.1

### Patch Changes

- Updated dependencies [4cc8011]
  - @svelte-vitals/core@0.45.0
  - svelte-vitals@0.48.1

## 0.31.0

### Minor Changes

- b778267: Raise the minimum supported Node.js to 24.16.0 (`engines.node: >=24.16.0`) and require ESM config files. Breaking:

  - Node 22/23 are no longer supported. Every supported Node loads `svelte-vitals.config.ts` natively, so the CLI's "this Node cannot load a .ts config" guidance error is gone.
  - The config loader now searches `svelte-vitals.config.{js,ts}` only — a `svelte-vitals.config.mjs` is **no longer loaded**; rename it to `.js` (or `.ts`). A leftover `.mjs` fails the run loudly with a rename hint (exit 2) rather than silently analyzing with defaults. `.js` configs are parsed as ESM, so the project must be `"type": "module"` (SvelteKit's default); CommonJS projects are not supported — a `.js` config that parses as CJS now fails with a guided "config files are ESM" error, and `install --force` no longer regenerates a `.js` config as `module.exports`.
  - `svelte-vitals install --client config-file` scaffolds `.ts` or `.js` (never `.mjs`), no longer consulting the running Node version.

- 2bd7d37: Recognise `<aside>` as a `complementary` landmark, in both analysis modes.

  Only `main`, `header` and `footer` mapped to landmarks, so the scenario `a11y/top-level-landmark`
  exists for — a layout rendering its children inside `<main>` while the page contributes a
  complementary region — was undetectable in the markup people write. The docs even taught
  `<aside role="complementary">`, which Svelte's own compiler flags as a redundant role.

  Following the HTML accessibility mapping: an `<aside>` scoped to `<body>` or `<main>` is a
  `complementary` landmark; inside sectioning content (`<article>`, `<aside>`, `<nav>`, `<section>`)
  it is one only when it carries an `aria-label` or `aria-labelledby`.

  **This widens detection** — a route with a layout `<main>` and a page `<aside>` newly reports
  `a11y/top-level-landmark`. Projects with recorded suppressions for that rule may need a new entry;
  `--update-suppressions` records it.

  Also fixed while here: the per-file top-level approximation that decides whether a `<header>` or
  `<footer>` is a landmark was being applied to every non-`main` tag, so a landmark nested below the
  top level of its own file was dropped. It now applies to `<header>` and `<footer>` only, which is
  what it was always meant to mean.

### Patch Changes

- adf3283: Two more corrections from the a11y rule-validity review.

  - **`a11y/no-missing-id-ref` read a text fragment as an id reference.** `href="#:~:text=hello%20world"`
    is a shipped web-platform feature — everything from `:~:` on instructs the user agent to find
    text, and names no element — so the rule reported a missing id, printing the percent-decoded form
    and sending the reader to look for a string that is not in their source. The directive is now
    stripped in both modes, and any element fragment before it is still checked: `#section:~:text=hi`
    resolves against `id="section"` exactly as `#section` would.
  - **`a11y/interactive-nesting` did not say which element it meant.** A finding read
    `<button> is nested inside interactive <div>`, which is unactionable on a page with many divs.
    When the container is a container because of its `role`, the message now names it:
    `<button> is nested inside interactive <div role="button">`.

- 0aa48a4: Stop a low open-file limit from silently shrinking the analysis.

  Every `.svelte` file in a project was read in parallel with no bound, so on a large project the
  process ran out of descriptors. `EMFILE` was raised on `open`, but each read sits inside the
  per-file `try`/`catch` that exists for malformed components — so the file was recorded as a parse
  failure, dropped, and the run carried on. Measured on a real 1 681-route project:

  | `ulimit -n` | routes analysed | findings | files skipped | reported health |
  | ----------- | --------------- | -------- | ------------- | --------------- |
  | 256         | 232             | 93       | 1 450         | 94              |
  | 1 024       | 1 000           | 150      | 682           | 94              |
  | 4 096       | 1 681           | 191      | 0             | 94              |

  At 1 024 — a common container default — 40% of the project went unexamined, 41 findings vanished,
  and **the score did not move**. Nothing in the report said how much had been skipped.

  Reads are now capped at 64 in flight, in both the CLI and the Vite plugin. The same project at
  `ulimit -n 256` now analyses all 1 681 routes and reports all 191 findings, and the cap costs
  nothing measurable (1 000 routes: 406ms capped vs 403ms unbounded) because reads are ~3% of the
  work.

  A file that could not be **read** is also now distinguished from one that could not be **parsed**,
  for components and SvelteKit modules alike. The two shared a message, which is how a descriptor
  limit read as hundreds of broken components; an unreadable file now says so and points at
  permissions and `ulimit -n`.

  The Vite plugin reports skipped files too. It previously warned about config problems and crashed
  rules but never about files a collector dropped, so an `EACCES` during `vite build` was scored as
  empty facts in silence. Both packages now format the warning with one shared function.

- 202fda8: Split `@svelte-vitals/core` into two entry points.

  `@svelte-vitals/core` now exports only what an outside caller needs: `defineConfig` with the
  config types, and the `JsonReport` types for reading a report. Everything else — the engine,
  the rule set, fact collection, reporters, scoring — moved to `@svelte-vitals/core/internal`,
  which carries **no semver guarantee and may change in any release, including a patch**.

  The stable entry is deliberately type-closed: no export there may reference a type that only
  `/internal` exports, so internal reshaping can never break the promised surface. Nothing was
  deleted, and `svelte-vitals` / `@svelte-vitals/vite` behaviour is unchanged. Code importing
  engine internals from the package root should move those imports to `/internal`; if something
  there is what you actually need long-term, open an issue — promoting a name into the stable
  entry is an additive change.

- Updated dependencies [02e6b89]
- Updated dependencies [51c25c6]
- Updated dependencies [57c0376]
- Updated dependencies [adf3283]
- Updated dependencies [9747d6e]
- Updated dependencies [0aa48a4]
- Updated dependencies [b778267]
- Updated dependencies [b93b50a]
- Updated dependencies [e7eec47]
- Updated dependencies [6096a01]
- Updated dependencies [c14ae17]
- Updated dependencies [202fda8]
- Updated dependencies [2bd7d37]
- Updated dependencies [48e3144]
- Updated dependencies [14d271b]
  - svelte-vitals@0.48.0
  - @svelte-vitals/core@0.44.0

## 0.30.1

### Patch Changes

- 2a2cf37: Treat `<link>` `rel` and `as` keywords as case-insensitive, as the HTML spec does. `<link rel="Canonical">` is now recognised by seo/canonical-url (and overrides a layout canonical instead of being added alongside it), and `rel="Preload"` is now seen by the preload rules, in both source and rendered-HTML analysis.
- 048478f: Fix `performance/minify-disabled` never reporting during a real SvelteKit `vite build`. The plugin captured `build.minify` only from the client build's resolved config, but SvelteKit runs the client build as a separate `vite.build()` with a fresh plugin instance, so the instance that analyzes the prerendered output never saw it. The plugin now reads the user's `build.minify` in its `config` hook — the same value SvelteKit forwards to the client build — so a `minify: false` in `vite.config.*` is reported (and gated) in build mode again, including projects whose routes are all `csr: false`.
- Updated dependencies [4cdce87]
- Updated dependencies [2a2cf37]
- Updated dependencies [9ba4223]
- Updated dependencies [172377f]
  - @svelte-vitals/core@0.43.1
  - svelte-vitals@0.47.1

## 0.30.0

### Minor Changes

- fd997bd: Build mode and the dev dashboard now collect landmarks, ids, and id references from the actual **rendered HTML** for the cross-component Accessibility rules, mirroring how they already re-verify SEO/Performance against the shipped output rather than trusting source.

### Patch Changes

- Updated dependencies [fd997bd]
- Updated dependencies [fd997bd]
  - @svelte-vitals/core@0.43.0
  - svelte-vitals@0.47.0

## 0.29.7

### Patch Changes

- ae80f05: `@svelte-vitals/core` now exports `formatFailedRuleWarning`, the "rule … failed and was skipped" message formatter shared by the CLI, build mode, and (now) the dev dashboard.

  `svelte-vitals`'s `analyzeProject` now also returns `failedRuleIds`, the ids of rules that crashed during the run (already folded into its returned `config` via `withFailedRulesOff`, exposed separately so a caller with its own base config can apply the same correction without adopting `analyzeProject`'s config).

  The dev dashboard now scores a crashed rule as not-run (matching the CLI and build mode) instead of silently inflating Health, without disturbing plugin-option `weights`/`overrides`; plugin warnings strip terminal escape sequences.

- Updated dependencies [329de70]
- Updated dependencies [ae80f05]
- Updated dependencies [7ca8bd2]
- Updated dependencies [29f78c7]
- Updated dependencies [471d465]
- Updated dependencies [3edb4ff]
  - svelte-vitals@0.46.0
  - @svelte-vitals/core@0.42.0

## 0.29.6

### Patch Changes

- ddcf62d: A rule that throws no longer kills the analysis: the run completes without it, its id and error surface as a warning, and its weight is removed from that run's Health denominator so the score is not silently inflated — in both the CLI and the vite plugin's build mode. Previously the CLI died with exit 2 and the vite plugin skipped the entire analysis (and its build gate) with a single "analysis failed" warning; both now finish with real results for every other rule.
- Updated dependencies [5c7dc63]
- Updated dependencies [6cfef97]
- Updated dependencies [27e3b71]
- Updated dependencies [ddcf62d]
  - @svelte-vitals/core@0.41.1
  - svelte-vitals@0.45.1

## 0.29.5

### Patch Changes

- Updated dependencies [04df077]
- Updated dependencies [3965688]
- Updated dependencies [6d62572]
- Updated dependencies [d855a8c]
- Updated dependencies [f581398]
- Updated dependencies [117931b]
  - svelte-vitals@0.45.0

## 0.29.4

### Patch Changes

- Updated dependencies [c550db7]
- Updated dependencies [3beca66]
  - svelte-vitals@0.44.4
  - @svelte-vitals/core@0.41.0

## 0.29.3

### Patch Changes

- 38ed0fb: The independent collection passes (routes, components, Kit modules, source files) now run concurrently instead of sequentially, shortening analysis wall time on larger projects. Same file reads, same results — only the awaiting overlaps.
- Updated dependencies [417e7af]
- Updated dependencies [49fbb19]
- Updated dependencies [38ed0fb]
- Updated dependencies [8c256e3]
- Updated dependencies [ecd3192]
  - svelte-vitals@0.44.3
  - @svelte-vitals/core@0.40.1

## 0.29.2

### Patch Changes

- 59869b4: `performance/minify-disabled`: the rule's rationale claimed "Vite minifies with esbuild by default" — false since Vite 8, which defaults to its own Oxc minifier and made `esbuild` an optional peer dependency. The machine `fix.snippet` wrote `minify: 'esbuild'`, which an agent applying it verbatim would ship as a build newly requiring an undeclared dependency. The description and snippet now describe removing/scoping the override without naming a minifier; docs (en/ja) drop the stale esbuild-default claim and add `'oxc'` to the not-flagged list.

  `performance/preconnect`: the machine `fix.snippet` preconnected only `fonts.googleapis.com`. Google Fonts serves the actual font files from `fonts.gstatic.com` under anonymous CORS, so the canonical fix — already shown in the rule's own docs — is the two-link pair, the second carrying `crossorigin`. The snippet now matches the docs.

  `performance/render-blocking-script`: both collectors (`svelte-vitals`'s static parse and `@svelte-vitals/vite`'s rendered-HTML parse) marked a `<script src>` render-blocking whenever it lacked `defer`/`async`/`type="module"`, which false-positived on non-executing script types — most notably `type="text/partytown"`, SvelteKit's own recommended way to offload third-party scripts off the main thread, plus `type="importmap"` and `type="speculationrules"`. None of these execute as a classic script, so none can block HTML parsing. Both collectors now flag only a script whose `type` is absent, empty, or a JavaScript MIME type (a classic script) and that lacks `defer`/`async` — a strict narrowing of detection, removing this false positive without adding any new one.

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
  - svelte-vitals@0.44.2

## 0.29.1

### Patch Changes

- f0798b0: Update the registry-visible package descriptions and keywords, which still described svelte-vitals as an SEO-only checker. `svelte-vitals`'s description now matches its own `--help` text — a deterministic SvelteKit code-health scanner across SEO, performance, correctness, security, and architecture — and adds `performance`, `security`, `code-quality`, `static-analysis` keywords. `@svelte-vitals/vite`'s description now also mentions the live dev dashboard alongside the build-time prerendered-HTML analysis. No behavior change.
- Updated dependencies [a9fba45]
- Updated dependencies [ac41349]
- Updated dependencies [a3dffb3]
- Updated dependencies [8e8bd5c]
- Updated dependencies [bd946e2]
- Updated dependencies [ac41349]
- Updated dependencies [65ce0c1]
- Updated dependencies [acee3c6]
- Updated dependencies [7c5a11b]
- Updated dependencies [f0798b0]
- Updated dependencies [ab41e48]
- Updated dependencies [28d22ae]
  - svelte-vitals@0.44.1
  - @svelte-vitals/core@0.39.0

## 0.29.0

### Minor Changes

- ce5fdf7: An invalid `svelte-vitals.config.*` (unknown rule id, invalid `weights`, malformed `overrides[]`) now fails `vite build` instead of being caught and skipped with a `svelte-vitals: skipped — analysis failed` warning — matching the CLI's exit-2 stance on the same validation errors. In `vite dev`, the same invalid config no longer crashes the dev server at startup: the dashboard now warns and falls back to plugin options/defaults.

### Patch Changes

- Updated dependencies [87d5d62]
- Updated dependencies [d07739c]
- Updated dependencies [b80d133]
- Updated dependencies [003e56c]
- Updated dependencies [ca4ff54]
- Updated dependencies [1859d24]
  - svelte-vitals@0.44.0
  - @svelte-vitals/core@0.38.0

## 0.28.0

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
  - svelte-vitals@0.43.0

## 0.27.1

### Patch Changes

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

- Updated dependencies [cb394ce]
- Updated dependencies [298849d]
- Updated dependencies [767525a]
  - svelte-vitals@0.42.0
  - @svelte-vitals/core@0.36.1

## 0.27.0

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
  - svelte-vitals@0.41.0

## 0.26.0

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
  - svelte-vitals@0.40.0

## 0.25.0

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

- Updated dependencies [28d51e9]
- Updated dependencies [872cf85]
  - @svelte-vitals/core@0.34.0
  - svelte-vitals@0.39.0

## 0.24.0

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
  - svelte-vitals@0.38.0

## 0.23.3

### Patch Changes

- Updated dependencies [091ec2f]
  - @svelte-vitals/core@0.32.0
  - svelte-vitals@0.37.1

## 0.23.2

### Patch Changes

- Updated dependencies [4beaea9]
  - svelte-vitals@0.37.0

## 0.23.1

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

- Updated dependencies [2a16e62]
- Updated dependencies [47e025d]
  - svelte-vitals@0.36.0
  - @svelte-vitals/core@0.31.1

## 0.23.0

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
  - svelte-vitals@0.35.0

## 0.22.0

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
  - svelte-vitals@0.34.0

## 0.21.1

### Patch Changes

- Updated dependencies [77065e2]
  - svelte-vitals@0.33.0

## 0.21.0

### Minor Changes

- 40a6dc6: Add `correctness/nonreactive-builtin-state`: flags plain `Map`/`Set`/`Date`/`URL`/`URLSearchParams` in `$state` whose mutations are observed — `$state`'s deep proxy covers plain objects and arrays only, so such mutations are untracked and the UI silently stops updating. Precision-first: only type-specific mutating operations count, and mutate-then-reassign usage (which works) is not flagged.

### Patch Changes

- 48f6d24: Scope resolution now treats `var` declarations and nested `function`/`class` declaration names as shadowing bindings, so writes to such locals are no longer misattributed to a same-named top-level `$state` (fewer false positives across the component-analysis rules).
- 2ed7450: `correctness/unmutated-state` no longer flags `$state` passed to a `use:`/`transition:`/`animate:` directive — the receiving code holds the proxy reference and may mutate it invisibly, so the previous `$state.raw` suggestion could break it.
- Updated dependencies [3389594]
- Updated dependencies [40a6dc6]
- Updated dependencies [48f6d24]
- Updated dependencies [74d871f]
- Updated dependencies [2ed7450]
  - @svelte-vitals/core@0.29.0
  - svelte-vitals@0.32.0

## 0.20.1

### Patch Changes

- Updated dependencies [a8a8d4a]
  - svelte-vitals@0.31.1

## 0.20.0

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
  - svelte-vitals@0.31.0

## 0.19.0

### Minor Changes

- 840121a: Add route-/file-scoped rule overrides via a new `overrides` option in `svelte-vitals.config.*` (also available as a Vite plugin option). Each entry scopes rule settings with `route` globs (matched against route ids) and/or `files` globs (matched against source paths — the way to target a `(group)` directory, since group segments are dropped from route ids): `overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]` turns all SEO rules off for an auth-only route group, durably — routes added under the glob later are excluded too, unlike the snapshot-style suppressions file. Keys in an entry's `rules` may be rule ids or category names; values are `'off'` (the finding is removed entirely) or a severity. Applied in `analyzeProject`, so the CLI, MCP server, GitHub Action, and Vite build gate all honor it.

### Patch Changes

- Updated dependencies [840121a]
- Updated dependencies [840121a]
  - @svelte-vitals/core@0.27.0
  - svelte-vitals@0.30.0

## 0.18.0

### Minor Changes

- b10c26a: Add CORRECT006 (critical): flag orphan `$effect` calls that throw `effect_orphan` at runtime — a top-level `$effect` in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>`, and a module-scope `new` of a class whose constructor creates a bare `$effect`. `.svelte.ts`/`.svelte.js` runes modules are now analyzed by the component-facts pipeline.
- e38ea4d: Add CORRECT007 (critical): flag Svelte lifecycle/context calls (`onMount`, `getContext`, `setContext`, …) that run outside component initialisation and throw `lifecycle_outside_component` at runtime — at module scope in runes modules and `<script module>`, in constructors of module-scope-instantiated classes, and inside SvelteKit load/action/endpoint handlers (the classic `getContext`-in-`load` trap).
- b0c2040: Add CORRECT008 (critical) and CORRECT009 (warning): flag browser-only globals (`window`, `document`, `localStorage`, …) read in server-executed code — module scope of runes modules and `<script module>`, SvelteKit load/handler/`init` bodies and file top levels (CORRECT008), and component instance-script top levels that run during SSR (CORRECT009). Recognises `browser`/`typeof` guards, respects same-file `export const ssr = false`, and never descends into `onMount`/`$effect`/function bodies.
- d6511a7: Add SEC003–005: SSR shared-state leak detection for SvelteKit server/universal route files. SEC003 (critical) flags load/action/endpoint handlers writing to imported module state; SEC004 (warning) flags module-scope `let`/`var` reassigned from functions in Kit server files; SEC005 (warning) flags server-side imports of `.svelte.ts` modules holding module-scope `$state`. Kit route/hooks files are now analyzed via a new `KitModuleFacts` channel.

### Patch Changes

- Updated dependencies [b10c26a]
- Updated dependencies [e38ea4d]
- Updated dependencies [b0c2040]
- Updated dependencies [c4ef9d8]
- Updated dependencies [76701e0]
- Updated dependencies [d6511a7]
- Updated dependencies [15f0b61]
  - @svelte-vitals/core@0.26.0
  - svelte-vitals@0.29.0

## 0.17.0

### Minor Changes

- 28e92c0: `svelte-vitals --reporter html` and the vite live dashboard now share one renderer (core's new `renderAppShell`), so the two surfaces can't drift apart again. The static HTML report gets the dashboard's full UI — master/detail layout with a searchable, sortable route list, severity/category filters, dark mode, and the per-finding copy-to-clipboard AI Prompt — while staying fully self-contained and offline; the only difference is that the live-update machinery (SSE connection, `measured` refinement, the connection/analyzing indicators) is absent when there is no dev server behind the page. `@svelte-vitals/core` gains `renderAppShell`/`AppSnapshot`/`RouteBadge`/`APP_SCRIPT`/`APP_STYLE` exports; `buildHtmlDocument`/`formatHtmlReport` keep their signatures but emit the new document. The dashboard itself is unchanged, now served from the shared shell.

### Patch Changes

- Updated dependencies [2cd25d8]
- Updated dependencies [28e92c0]
  - svelte-vitals@0.28.0
  - @svelte-vitals/core@0.25.0

## 0.16.0

### Minor Changes

- 02b4d98: The live dashboard's finding cards now have a collapsed **AI Prompt** disclosure. Expand it and hit **Copy** to get a ready-to-paste prompt for a coding agent, built instantly from that finding's rule id, location, recommendation, fix, and docs link — no AI call generates it, so it can't hallucinate a fix that isn't the rule's actual recommendation.

### Patch Changes

- Updated dependencies [d243f01]
- Updated dependencies [25efcde]
- Updated dependencies [0bb628d]
- Updated dependencies [f1cbfd0]
  - svelte-vitals@0.27.0

## 0.15.1

### Patch Changes

- Updated dependencies [7fb7d55]
  - svelte-vitals@0.26.0

## 0.15.0

### Minor Changes

- 8db0caa: The Vite plugin now reads `svelte-vitals.config.{mjs,js,ts}` automatically, in both build mode (`vite build`) and the dev-time live dashboard (`vite dev`) — matching the CLI/MCP server's per-field precedence (explicit `svelteVitals({ ... })` option > config file > built-in default). This includes a new `weights` plugin option, which now flows into the plugin's Health score the same way it already does for the CLI. Previously the plugin ignored `svelte-vitals.config.*` entirely, even though the file already existed as a recognized re-analysis trigger for the dev dashboard's file watcher — a project could set `weights`/`rules`/etc. once and have the CLI honor it while the Vite plugin silently used its own defaults. No action needed if you don't have a config file; if you do, double-check the plugin's effective config now matches what you expect (non-fatal config-file issues are logged to the console with a `svelte-vitals:` prefix).

### Patch Changes

- 43be9f2: `analyzeProject` accepts an optional `parseCache` (exported as `ParseCache`) that lets a caller re-analyzing the same project repeatedly reuse read+parse results across calls instead of starting fresh each time. The vite dev dashboard now keeps one `ParseCache` alive for the lifetime of the dev server and invalidates only the entry for the file that actually changed on each debounced re-analysis, so saving an unrelated file no longer re-reads and re-parses every route and layout in the project.
- Updated dependencies [4ebb756]
- Updated dependencies [43be9f2]
- Updated dependencies [fda64dd]
- Updated dependencies [58ccebc]
- Updated dependencies [ab55482]
- Updated dependencies [bf6932d]
- Updated dependencies [f14fc4e]
- Updated dependencies [9802586]
  - svelte-vitals@0.25.0
  - @svelte-vitals/core@0.24.0

## 0.14.0

### Minor Changes

- 5d9f0d1: Live dashboard: `svelteVitals()`'s `ui` option now defaults to `true` — the dashboard at `/__svelte-vitals/` is on during `vite dev` unless you pass `ui: false`. `svelteVitalsHandle` no longer prints findings to the terminal (the dashboard supersedes that output); it still feeds the dashboard's per-route accuracy when enabled.

  CLI: the `install` wizard's `vite-dev-overlay` target is renamed `vite-hooks`, with copy describing its real effect (dashboard accuracy) instead of terminal warnings.

### Patch Changes

- c2ee668: Live dashboard: the "Overview" pane now lists every finding across the whole project (all routes plus site-wide checks) instead of only site-wide checks, and the severity/category filter chips actually filter that list. Previously the chips rendered on Overview but had nothing to act on for most projects (no site-wide findings), which made them look broken. Each finding now shows its route, clickable to jump straight to that route's detail pane.
- c2ee668: Live dashboard: replace the plain bolt-glyph brand mark with the same wordmark used on the docs site, for visual consistency.

  CLI mascot: give the `happy`/`ecstatic` reaction faces a cleaner rounded-bracket smile (`╰──╯`/`╰───╯`) instead of a repeated `◡` arc, which read as a wavy scallop rather than one smile.

- Updated dependencies [ca6d1af]
- Updated dependencies [c2ee668]
- Updated dependencies [7da8bb7]
- Updated dependencies [085c622]
- Updated dependencies [08aa27e]
- Updated dependencies [5d9f0d1]
  - svelte-vitals@0.24.0

## 0.13.1

### Patch Changes

- Updated dependencies [7acad5a]
  - @svelte-vitals/core@0.23.0
  - svelte-vitals@0.23.0

## 0.13.0

### Minor Changes

- a3b4eff: Redesign the live UI dashboard (`ui: true`) into a searchable, sortable master/detail layout with dark mode, syntax-highlighted fix snippets, and a live analysis-in-progress indicator.
- 45ec323: `svelteVitals({ ui: true })` now prints the live dashboard's URL right after Vite's own `Local:`/`Network:` lines every time `vite dev` starts, so the dashboard is discoverable without knowing the `/__svelte-vitals/` path in advance.

## 0.12.2

### Patch Changes

- Updated dependencies [2652572]
- Updated dependencies [2652572]
  - svelte-vitals@0.22.1
  - @svelte-vitals/core@0.22.1

## 0.12.1

### Patch Changes

- Updated dependencies [d9efc77]
  - svelte-vitals@0.22.0

## 0.12.0

### Minor Changes

- 7e3b423: The dev dashboard (`svelteVitals({ ui: true })`) now runs whole-project static analysis: from the moment `vite dev` starts it shows all routes across every category (SEO, Performance, Correctness, Security, Architecture) with a real project Health — no page visit required. Saving a source file triggers a debounced re-analysis, and visiting a page refines that route with live (rendered) results. Route headings show a `measured` (live) or `static` provenance badge. If the analysis fails, the dashboard falls back to the previous live-only behavior without breaking the dev server. To support the badges, core's `buildHtmlDocument` gains an optional third argument (`opts?: { routeBadges?: Record<string, 'measured' | 'static'> }`); output is unchanged when it is omitted.
- f0af627: Surface the resolved `@svelte-vitals/core` version so it's possible to tell whether the CLI and the Vite dev overlay are running the same rule engine. `svelte-vitals --version` now prints `<cli version> (core <core version>)`, and the dev overlay's dashboard footer (`/__svelte-vitals/`) shows `core v<version>` alongside its own version. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases (e.g. a package-manager cooldown like pnpm's `minimumReleaseAge` resolving `@latest` down to an older release) — previously there was no way to notice this without diffing lockfiles, so the two surfaces could silently disagree on findings. See the "Version drift" section in the dev overlay docs.

### Patch Changes

- Updated dependencies [7e3b423]
- Updated dependencies [f0af627]
- Updated dependencies [ea90a6d]
  - @svelte-vitals/core@0.22.0
  - svelte-vitals@0.21.0

## 0.11.1

### Patch Changes

- Updated dependencies [8dc631c]
  - @svelte-vitals/core@0.21.0

## 0.11.0

### Minor Changes

- 3b33e4c: Raise the supported Node.js floor from 18.20.8 (EOL) to >=22.13.0 — the oldest maintained LTS line the pinned pnpm can run on. CI now exercises Node 22 (floor), 24, and 26.

### Patch Changes

- e476a2e: Deduplicate `collectComponentFacts` into `@svelte-vitals/core`; behavior is unchanged.
- aa1e0a4: Harden the dev UI middleware: reject non-loopback origins/hosts, fully validate ingested findings against what the dashboard renderer dereferences, and never let a malformed payload crash the dashboard.
- Updated dependencies [18b11af]
- Updated dependencies [7f1697d]
- Updated dependencies [e476a2e]
- Updated dependencies [6b2d0a7]
- Updated dependencies [3b33e4c]
- Updated dependencies [4513f97]
  - @svelte-vitals/core@0.20.0

## 0.10.0

### Minor Changes

- 2f94444: Build mode now additionally scans `.svelte` source under `src/` and runs Correctness, Security, Architecture, and the two component-scoped Performance rules (PERF009/PERF010) — the same rules the CLI and MCP already run — enabled by default alongside the existing rendered-HTML SEO/Performance checks. The dev overlay is unchanged (still SEO/Performance-only, rendered-HTML-based). Use the existing `rules` option to opt individual rules out, e.g. `{ CORRECT002: 'off' }`.

### Patch Changes

- Updated dependencies [19e304c]
- Updated dependencies [2f94444]
  - @svelte-vitals/core@0.19.0

## 0.9.2

### Patch Changes

- Updated dependencies [32712e2]
- Updated dependencies [54c77d8]
- Updated dependencies [bc6fa86]
  - @svelte-vitals/core@0.18.0

## 0.9.1

### Patch Changes

- Updated dependencies [90e3e7e]
- Updated dependencies [32698e0]
- Updated dependencies [382c397]
  - @svelte-vitals/core@0.17.0

## 0.9.0

### Minor Changes

- 660f040: Collect `<img>` elements in rendered (vite) mode so the image rules — PERF001,
  PERF002, PERF005, PERF006, and SEO025 — now run during build analysis and in the
  dev hook, not only in static (CLI) mode (#61). Previously the vite plugin
  silently skipped every image/alt check.
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

## 0.8.0

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

## 0.7.0

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

- 67a5a0e: Refine the JSON-LD rules to cut false positives: SEO018 no longer flags `@id`
  (a node identifier, often a relative fragment) and now accepts any URI scheme
  (`data:`/`mailto:`/`urn:`) and protocol-relative URLs; SEO019 accepts schema.org
  reduced-precision dates (`2026`, `2026-06`); SEO021 treats empty/blank required
  values as missing. Rendered-mode capture reads `<script>` via `rawText` so HTML
  entities (e.g. `&quot;`) are no longer decoded and the JSON stays intact.
- Updated dependencies [67a5a0e]
- Updated dependencies [0fbc25d]
- Updated dependencies [069e0db]
- Updated dependencies [8aeeabb]
  - @svelte-vitals/core@0.14.0

## 0.6.0

### Minor Changes

- e627343: Add six SEO checks decidable from the resolved `<head>` and project facts: SEO010 surfaces a
  route set to `noindex` (verify intentional), SEO011 Twitter Card, SEO012 Open Graph description,
  SEO013 Open Graph URL, SEO014 viewport, and SEO015 (robots.txt should reference your sitemap).
  SEO010 only fires on a statically-resolvable `noindex`/`none` (never a dynamic value); robots/
  viewport tags placed in `app.html` are covered in plugin/rendered mode.

### Patch Changes

- Updated dependencies [e627343]
  - @svelte-vitals/core@0.13.0

## 0.5.0

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

## 0.4.0

### Minor Changes

- 22127fc: Add a live UI dashboard: `svelteVitals({ ui: true })` serves a svelte-vitals report at
  `/__svelte-vitals/` during `vite dev`, fed by `svelteVitalsHandle`, that updates live as you
  navigate. It reuses the same renderer as the CLI's `--reporter html`. Dev-only and
  rendered-based (SEO `<head>` rules for visited routes); the dev overlay's behavior is
  unchanged when the UI is not enabled.

## 0.3.5

### Patch Changes

- Updated dependencies [e6ee630]
  - @svelte-vitals/core@0.11.0

## 0.3.4

### Patch Changes

- Updated dependencies [0555127]
  - @svelte-vitals/core@0.10.1

## 0.3.3

### Patch Changes

- Updated dependencies [d86ced5]
  - @svelte-vitals/core@0.10.0

## 0.3.2

### Patch Changes

- Updated dependencies [31904f9]
  - @svelte-vitals/core@0.9.0

## 0.3.1

### Patch Changes

- Updated dependencies [2857e16]
  - @svelte-vitals/core@0.8.0

## 0.3.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [6f3aeec]
  - @svelte-vitals/core@0.7.0

## 0.2.1

### Patch Changes

- Updated dependencies [396a783]
  - @svelte-vitals/core@0.6.0

## 0.2.0

### Minor Changes

- 3c7c36e: Add a dev-time SvelteKit handle, `svelteVitalsHandle` (exported from `@svelte-vitals/vite/hooks`). Added to `src/hooks.server.ts`, it analyzes each visited page's rendered `<head>` in dev and prints SEO warnings for the current route to the terminal — request-driven, dev-only, and never mutates the response.

## 0.1.2

### Patch Changes

- Updated dependencies [762d4d1]
  - @svelte-vitals/core@0.5.0

## 0.1.1

### Patch Changes

- Updated dependencies [eb97f09]
- Updated dependencies [e60d033]
  - @svelte-vitals/core@0.4.0

## 0.1.0

### Minor Changes

- fcb0494: Plugin mode: `@svelte-vitals/vite` analyzes prerendered HTML during `vite build` and runs the full SEO rule set (library-agnostic), gating the build via `failOn`. Console/JSON reports with a per-route score; only prerendered routes are covered. `outFile` is resolved against the project root (parent directories are created), and an internal analysis failure is reported as a warning rather than failing the build (distinct from a real finding). The core console reporter gained an optional `mode` label for the header line, and now exports the shared `ROBOTS_SOURCE_PATHS` / `SITEMAP_SOURCE_PATHS` project-rule path lists used by both modes.

### Patch Changes

- Updated dependencies [fcb0494]
  - @svelte-vitals/core@0.3.0
