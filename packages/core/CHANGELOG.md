# @svelte-vitals/core

## 0.50.0

### Minor Changes

- 4baf64c: Add the warning-level `a11y/aria-hidden-focus` rule: a keyboard-focusable element hidden from assistive technology by a literal `aria-hidden="true"` — on the element itself or an ancestor. A screen reader user can tab onto such a control while their reader announces nothing for it, and the author cannot see the defect because `aria-hidden` changes nothing visually; WAI-ARIA forbids hiding focusable content this way.
  
  Focusable uses the same element classification as `a11y/interactive-nesting`. An expression-valued `aria-hidden` is unknowable and stays silent, so the legitimate toggle pattern (`aria-hidden={!open}`) never triggers the rule. Consistently-hidden states are exempt as not focusable: a negative or expression `tabindex` (`<button tabindex="-1" aria-hidden="true">` is the documented remediation), a `disabled` form control, and anything at or under an `inert` element. The recommendation points at `inert` for hiding inactive regions such as modal backdrops.

## 0.49.0

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

## 0.48.0

### Minor Changes

- 29d620e: Add `correctness/autoplay-muted`: flags `<video autoplay>` without `muted`. Chrome and Safari block autoplay with audio, and a blocked autoplay does not error — the video silently never starts playing for real visitors while appearing to work in development. Only a literal `autoplay` is flagged; `muted` in any form (bare attribute, `muted={expr}`, `bind:muted`, or a spread) passes. The recommendation is to add `muted` (and typically `playsinline` for iOS).
- f986615: Add `performance/iframe-loading`: recommends `loading="lazy"` on `<iframe>` elements. An offscreen iframe typically loads an entire third-party document — scripts, fonts, media — so eager-loading one usually costs more than an offscreen image, and iframes rarely are the LCP element. Severity is `info`: an above-the-fold iframe is legitimately eager and position is statically unknowable. Any literal `loading` value passes (the author made a choice), as do an expression-valued `loading` and a spread attribute.
- e01d64a: Add `a11y/positive-tabindex`: flags elements with a literal `tabindex` whose value parses to a finite number above 0. A positive tabindex puts the element ahead of every naturally-ordered element on the page, so a single `tabindex="1"` reorders keyboard navigation globally — only `0` (join the natural order) and `-1` (programmatically focusable) are safe values. Expression-valued `tabindex` is unknowable and is skipped.

## 0.47.2

### Patch Changes

- 4b6a07b: Stop the agent reporter from asking for an acceptance it just said was unreachable. A rule like `security/raw-html` reports a construct that survives its own fix — a sanitized `{@html}` is still an `{@html}` — and its `Fix:` line says so, while the `Accept:` line underneath asked for the rule to pass on re-run, sending an agent round the same edit twice. Findings that carry a line now name the other exit too: a reviewed `svelte-vitals-disable-next-line` comment above them. That line is also rendered — on the finding's heading and again where the directive has to go — so two findings of one rule in one file are no longer told apart only by their message, and so the directive lands on the right construct. Findings with no line to annotate (the `<head>` metadata rules) are unchanged.
- 0283d20: Scoping notices now say what to do next: an unmatched `--route` or `overrides` glob names the glob form it expects and where the routes/files are listed, a `--rules` id that `--route` cannot examine says why and how to check it, an inline directive naming an unknown rule points at `svelte-vitals explain --list`, and the Vite plugin's warnings share the CLI's `svelte-vitals:` prefix.

## 0.47.1

### Patch Changes

- a6ee36a: Build the packages with tsdown instead of tsup. Public entry points and type surface are unchanged; only the internal chunk layout of `dist/` differs.

## 0.47.0

### Minor Changes

- a1aca37: `a11y/no-missing-id-ref` no longer skips silently. The JSON report gains an optional
  top-level `skipped` map (rule id → skipped routes, each with its literal id-reference count
  and the located causes — unresolved component, spread, `{@html}`, or dynamic id — that
  broke the route's closed world), and the CLI prints one warning line with the
  skipped/analyzed ratio whenever the rule is selected and at least one analyzed route was
  skipped. Scores and findings are unchanged: a skipped route still produces no result.
- eb8c568: `a11y/id-duplication` now detects a route id colliding with an id in the `src/app.html`
  shell in source mode (rendered mode always did): the finding sits on the route-side
  occurrence and its message names the shell line. This is a new arm of an existing rule:
  `findingKey` is `id::route::location` with no line component, so a project with an
  existing suppressed `a11y/id-duplication` entry for the same route and file already has
  the new finding pre-suppressed; projects without one will see new findings, and
  `--update-suppressions` adopts them in one run. Diff-scoped runs (`--diff`/`--staged`)
  only surface the finding when the route file changes — an edit to `src/app.html` alone
  shows up on full runs.
- 986e33a: New opt-in rule `a11y/unverified-id-ref`: on routes `a11y/no-missing-id-ref` must skip
  (composition not fully resolved), it reports id references that match no literal id
  anywhere analyzed as unverifiable — never as missing — naming the unresolved component,
  spread, `{@html}`, or dynamic id that blocks verification. Off by default: enable it via
  `rules: { 'a11y/unverified-id-ref': 'info' }` or `--rules a11y/unverified-id-ref`. Scores
  are unchanged for every project that does not enable it. In a nine-app measurement (`docs/superpowers/specs/2026-08-21-unverified-id-ref-precision-measured.md`), 8 of 31 sampled finding sites (49 of 72 findings) were real defects. Source mode only; the vite
  plugin prints a notice if it is enabled in rendered mode.

## 0.46.0

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

## 0.45.0

### Minor Changes

- 4cc8011: Promote report rendering and gating into the stable entry.

  `summarize`, `hasFailureAtOrAbove`, `formatGithubReport` and `formatMarkdownReport` are now exported
  from `@svelte-vitals/core` as well as `@svelte-vitals/core/internal`.

  The first-party GitHub Action draws an analysis onto three GitHub surfaces — diff annotations, the
  job summary, and a sticky PR comment — and gates its step on the result. `analyzeProject` and
  `applyScope` were already stable, so the analysis entry was covered while rendering and gating were
  not, and the Action's committed bundle depended on an entry that promises nothing across a patch.

  The promotion is a pure re-export. Every type these four reference — `Result`, `Config`, `Summary`,
  `Severity` — was already exported from the stable entry, so its type surface is unchanged.

  **What this freezes is each function's existence and signature, not the text it returns.** Markdown
  and workflow-command output stay human- and agent-readable: their prose, ordering and caps may
  change in any release. Call them to render; read `JsonReport` if you need to parse.

  One structural property is frozen alongside the signature, because asking "is there anything to
  show?" does not require parsing: **`formatGithubReport` returns the empty string when nothing is
  penalized**, so emitting its result unconditionally is safe.

  Both entries continue to export all four. Nothing is removed from `@svelte-vitals/core/internal`,
  so there is no migration deadline — moving an import is a free choice, not a deprecation.

## 0.44.0

### Minor Changes

- b778267: Raise the minimum supported Node.js to 24.16.0 (`engines.node: >=24.16.0`) and require ESM config files. Breaking:

  - Node 22/23 are no longer supported. Every supported Node loads `svelte-vitals.config.ts` natively, so the CLI's "this Node cannot load a .ts config" guidance error is gone.
  - The config loader now searches `svelte-vitals.config.{js,ts}` only — a `svelte-vitals.config.mjs` is **no longer loaded**; rename it to `.js` (or `.ts`). A leftover `.mjs` fails the run loudly with a rename hint (exit 2) rather than silently analyzing with defaults. `.js` configs are parsed as ESM, so the project must be `"type": "module"` (SvelteKit's default); CommonJS projects are not supported — a `.js` config that parses as CJS now fails with a guided "config files are ESM" error, and `install --force` no longer regenerates a `.js` config as `module.exports`.
  - `svelte-vitals install --client config-file` scaffolds `.ts` or `.js` (never `.mjs`), no longer consulting the running Node version.

- e7eec47: Demote `a11y/require-datetime` and `a11y/doctype` to `info`, so each rule's weight matches the
  evidence behind it.

  **Exit-code consequences, measured per rule on an isolated fixture.** Both movements loosen a gate;
  nothing tightens.

  | rule                    | `--fail-on critical` (default) | `--fail-on warning` | `--fail-on info` |
  | ----------------------- | ------------------------------ | ------------------- | ---------------- |
  | `a11y/require-datetime` | 0 → 0                          | **1 → 0**           | 1 → 1            |
  | `a11y/doctype`          | 0 → 0                          | **1 → 0**           | 1 → 1            |

  A project running the default gate is unaffected. A project running `--fail-on warning` whose only
  finding is one of these two goes from red to green.

  **Scores move too.** `a11y::component` drops from 46 to 42 points of severity weight, so every a11y
  component key is scored against a smaller denominator: measured on the repository's own example
  app, the a11y category reads **83 → 87** with no change in findings. `a11y::project` drops from 5 to
  1, which the floor of 25 absorbs — but a project-scope finding is an absolute deduction, so a
  missing doctype now costs its category 1 point rather than 5. The widest pair is unchanged at 100,
  so the floor's ordering invariant is untouched.

  **Why.** Severity tracks the strength of the evidence, the standard set when the SEO severities were
  aligned:

  - `a11y/require-datetime`'s requirement is HTML conformance, not an accessibility criterion. A
    screen reader reads "last Tuesday" exactly as a sighted reader does; what the element loses is its
    machine-readable value.
  - `a11y/doctype`'s accessibility premise has no source at all — quirks mode is documented as a
    layout difference, and the WCAG criterion that used to justify markup-validity checks is obsolete
    and removed. The layout claim stands, so the rule stands, at the weight that claim supports.

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

- 51c25c6: Correct three a11y rules' element and grammar tables.

  - **`a11y/interactive-nesting`** reused the whole interactive-role set for its container check, so
    `role="gridcell"` holding a button — the documented grid pattern — and the ARIA 1.1
    `role="combobox"` wrapping its own `<input>` were both reported as nesting defects. Containers
    are now the interactive members of ARIA's children-presentational set — whose descendants user
    agents should not expose through the accessibility API — plus `link`.
  - **`a11y/require-datetime`** implemented five of the ten `<time>` content syntaxes the HTML spec
    permits, so a week (`2026-W33`), a time-zone offset (`+09:00`, `Z`), the alternative duration
    spelling (`4h 18m 3s` — how recipes and media lengths are written), and years of four **or more**
    digits were reported as "not machine-readable".
  - **`a11y/use-list`** flagged text that merely follows an interpolation, so
    `<p>{count} - results found</p>` read as a bullet, and flagged a leading dash inside `<pre>`,
    `<code>`, `<kbd>`, `<samp>` and `<textarea>`, where it is content. The `<br>`-separated bullets
    WCAG H48 names are unchanged.

  Two narrower corrections ride along, both **widening** detection:

  - The `<time>` patterns are now anchored, so `<time>2026-08-14T14:30 invalid</time>` and
    `<time>P3D invalid</time>` no longer pass on a machine-readable prefix.
  - `a11y/interactive-nesting` resolved a `role` fallback list by its **first token** rather than the
    first token naming a concrete role, so `role="future-role button"` was not recognised as a
    button. It now uses the same resolution the role rules do.

  Everything else here narrows detection, and recorded suppressions keep matching in either
  direction.

- 57c0376: Stop three a11y ARIA rules reporting valid markup.

  - `a11y/invalid-role` treated a fallback list as invalid when any token was unknown. A user agent
    resolves the attribute to the first token naming a concrete role, so `role="button bogus"` and
    `role="widget checkbox"` are correct markup — the list form exists precisely so a value can name
    a role older user agents do not know. Only a value that resolves to nothing is reported now, and
    its message names that rather than echoing one token's verdict onto the whole literal.
  - `a11y/invalid-role` and `a11y/unknown-aria-attribute` rejected names ARIA 1.3 defines but that
    the pinned ARIA data snapshot predates: the roles `comment`, `image`,
    `sectionheader`, `sectionfooter`, `suggestion`, and the attributes `aria-colindextext`,
    `aria-rowindextext`. `image` is the sharpest — it is now the spec's preferred synonym for `img`.
  - `a11y/required-aria-props` demanded `aria-selected` on `role="option"` and `role="treeitem"`,
    an ARIA 1.1 requirement neither 1.2 nor the 1.3 draft carries, so idiomatic listbox and tree
    markup was flagged.

  `a11y/required-aria-props` also now checks the role a fallback list **resolves to**, instead of
  skipping every list. It shares one resolution with `a11y/invalid-role`, so the two rules cannot read
  one value differently — but this **widens** detection: `role="bogus checkbox"` with no
  `aria-checked` was silent and now reports, naming the resolved role in the message. Everything else
  here narrows detection, and recorded suppressions keep matching in either direction (the
  `id::route::location` key is unchanged).

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

- 9747d6e: Stop `a11y/accessible-name` and `a11y/label-has-control` reporting content they cannot see.

  Both rules already skip content they cannot resolve — an expression, a component, `{@render}`,
  `{@html}` — but four routes were read as _absent_ rather than _unknowable_:

  - **A `<slot>` or `<svelte:fragment>`** supplies content from the parent, so `<button><slot /></button>`
    and `<label>Name<slot name="control" /></label>` were flagged despite being named and associated
    by whoever renders them.
  - **A hyphenated custom element** may be form-associated (and so labelable) and may name its host
    from a shadow root, so `<label>Name <my-input></my-input></label>` was flagged.
  - **An expression-valued `alt`** was invisible while an expression `aria-label` was accepted, so
    the idiomatic `<a href="/about"><img src="/logo.png" alt={siteName} /></a>` was "unnamed".
  - **A `<label>` naming a `button` or `input type="image"`**, by wrapping it or by pointing `for` at
    its `id`, is a step in the name computation ahead of the element's own subtree. `<a>` has no such
    step, so links are unchanged. It counts only when the label itself contributes something — a
    provably empty label leaves the control unnamed and still reported — and a wrapping label reaches
    only the first labelable element inside it. The `for` route is same-file only.

  All four narrow detection, so recorded suppressions keep matching.

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

- c14ae17: Match the Svelte compiler on ARIA attribute casing.

  HTML attribute names are case-insensitive: `ARIA-LABEL` and `ROLE` become `aria-label` and `role`
  during HTML parsing, and Svelte's own compiler judges them lowercased. The **Svelte AST keeps the
  source spelling**, though, and the attribute lookup matched it exactly — so an attribute written in
  capitals was read as a different attribute from the one it becomes in the browser. Lookups are now
  case-insensitive, and ARIA names are reported lowercased, as the compiler reports them.

  This corrects findings in both directions. A capitalised typo (`ARIA-LABLE`, `ROLE="bogus"`) was
  invisible while the compiler warned about it, so a project may see new findings — the same ones
  `svelte-check` already reports. A **valid** capitalised attribute was equally invisible, which
  produced false findings: `<button ARIA-LABEL="Save">` was reported as having no accessible name,
  and `<time DATETIME="…">` as missing its `datetime`. Those go away.

  Recorded while here, with no behaviour change: this rule set deliberately follows the compiler over
  the letter of the ARIA spec where the two disagree. The spec lists `undefined` as a value for
  several boolean attributes and says a zero-length string should be treated as absent; the compiler
  rejects both, and so do we. A rule that disagreed with the build you run would be noise rather than
  a second opinion. The `a11y/invalid-aria-value` page now says so in both languages.

- 48e3144: Fix analysis aborting on any project that writes its component styles in a CSS dialect.

  Svelte parses a `<style>` body as CSS whatever its `lang` attribute says, so a single
  `<style lang="scss">` block made a component unparseable — and one unparseable route file
  fails the whole run with exit 2. Projects using SCSS, Less, or Stylus could not be analyzed
  at all. Style bodies with a `lang` attribute are now blanked before parsing, preserving every
  byte offset so reported lines are unchanged; nothing in the analysis reads CSS. Genuinely
  malformed components still fail as before.

  The rewrite is a retry, not a preprocessing step: a component that parses is never touched, so
  only sources that are already a hard failure can reach it.

- 14d271b: Correct four a11y rule texts that claimed more than their sources support.

  - `a11y/doctype` said quirks mode breaks "accessibility tree behavior". The sourceable claim is
    that quirks mode applies different layout and box-model rules than standards mode; no primary
    source ties it to the accessibility tree, and the WCAG criterion that used to justify
    markup-validity rules is obsolete and removed.
  - `a11y/require-datetime` said "last Tuesday" cannot be parsed by assistive technology "so its
    meaning is lost to anything that isn't a sighted reader". A screen reader reads it exactly as a
    sighted reader does. What the element loses is its _standardized_ value: the text is not a valid
    date/time string, so `<time>` exposes no date and a consumer that wants one is left guessing at
    the prose.
  - `a11y/interactive-nesting` said a nested control is "unreachable by keyboard" (no source found,
    and a nested `<button>` is Tab-focusable) and that the nesting "violates the HTML content model",
    which is false for its own role-based container arm, since a `<div>` may contain interactive
    descendants. The claim is now scoped to `<a href>` and `<button>`.
  - `a11y/accessible-name` recommended `title` as a way to name a control. It stays a _detected_
    name source, because the name computation uses it — but it fails touch users, keyboard users,
    and many screen-reader and magnifier users, so it is no longer advice.

## 0.43.1

### Patch Changes

- 4cdce87: Fix the inline `svelte-vitals-disable-next-line` directive silently ignoring `a11y/*` rule ids. The directive's rule-id pattern only allowed letters in the category segment, so `<!-- svelte-vitals-disable-next-line a11y/invalid-role -->` was not recognised at all and the finding stayed. Category segments may now contain digits.

## 0.43.0

### Minor Changes

- fd997bd: Add the **Accessibility** category (`a11y`): 15 native, Svelte-aware markup rules — ARIA role/attribute/value validity and required-props checks (`a11y/invalid-role`, `a11y/unknown-aria-attribute`, `a11y/invalid-aria-value`, `a11y/required-aria-props`), interactive-element nesting, accessible-name computability, label/control association, list-like text, `<select>` placeholder options, machine-readable `<time>`, an `app.html` doctype check, and — enabled by resolving the layout chain the way the SEO `<head>`/heading rules already do — landmark duplication/nesting and project-wide id/idref integrity across component boundaries, which no single-file linter can check. `aria-query` is a new runtime dependency, wrapped in a typed spec-data module.

  **Health score composition changes.** A sixth category enters the weighted average, so existing projects' Health numbers shift on upgrade with no code change on their side — see [Health score](https://oekazuma.github.io/svelte-vitals/guides/health-report/).

## 0.42.0

### Minor Changes

- ae80f05: `@svelte-vitals/core` now exports `formatFailedRuleWarning`, the "rule … failed and was skipped" message formatter shared by the CLI, build mode, and (now) the dev dashboard.

  `svelte-vitals`'s `analyzeProject` now also returns `failedRuleIds`, the ids of rules that crashed during the run (already folded into its returned `config` via `withFailedRulesOff`, exposed separately so a caller with its own base config can apply the same correction without adopting `analyzeProject`'s config).

  The dev dashboard now scores a crashed rule as not-run (matching the CLI and build mode) instead of silently inflating Health, without disturbing plugin-option `weights`/`overrides`; plugin warnings strip terminal escape sequences.

- 3edb4ff: `@svelte-vitals/core` now exports `terminalSafe`, the ANSI/OSC/C0 escape stripper already used by the console reporter, for sinks outside the reporters.

  `svelte-vitals`'s stderr diagnostics (skipped files, failed rules, app detection, and other errors) now strip terminal escape sequences from analyzed-repo-derived strings before printing, matching the console reporter's existing protection.

## 0.41.1

### Patch Changes

- 5c7dc63: Reporter output now neutralizes structural Markdown and terminal escape sequences in strings quoted from the analyzed project (file paths, route ids, and rule messages that embed page content such as `<title>` text or JSON-LD values). The agent and Markdown reporters render an embedded newline, code fence, heading, `[text](url)` link, or bare `<tag>` as inert quoted text instead of live structure — so an analyzed repo can no longer forge report sections or smuggle instruction-looking text into an AI agent's context. The console reporter strips C0 control characters and ANSI/OSC escape sequences from the same analyzed-derived strings, so a hostile route or file name can no longer rewrite the terminal title bar or move the cursor. The GitHub Actions reporter already escaped embedded newlines in workflow-command data; that's unchanged, just verified.

  Reports over well-behaved projects are unchanged except for one visible class: a rule message or location containing a literal `<tag>` (e.g. `Missing <title>`) now renders as inline code (`` `<title>` ``) in the Markdown reporter, matching what the agent reporter already did — this also fixes Markdown table cells silently dropping such tags as unrecognized HTML.

- 6cfef97: seo/json-ld-validity's unknown-`@type` hint now also catches small typos, not just casing: a bare `@type` within edit distance 2 of a real schema.org type gets a `Did you mean 'X'?` suggestion (e.g. `Unknown @type 'Artcle'` now suggests `'Article'`). The free case-insensitive exact match still runs first; the typo scan only runs when that misses. Message-text-only change — finding keys, severities, and gates are untouched.
- 27e3b71: The CLI's transitive `<head>`/heading resolution (the layer-3 walk that follows a component import to find the `<title>`/meta/JSON-LD/`<h1>` it contributes) now honours a project's `kit.alias`/`kit.files.lib` declared in `svelte.config`, matching the resolution already used by `architecture/private-scope-import`, `architecture/route-component-import`, `security/handler-state-write`, and `security/shared-state-import`. Previously only `$lib/…` (hard-coded to `src/lib/…`) and relative imports were followed; a component imported through a custom alias (`$components`, `$ui`, …) was invisible to this walk.

  Gate movement, both directions: a route whose `<title>`/meta/JSON-LD/`<h1>` lives in an alias-imported component no longer reports a false "Missing" finding, so Health can rise on projects using a custom alias. Conversely, content in those components — including defects (an empty `<title>`, multiple `<h1>`s, invalid JSON-LD) — is now analyzed by every consumer of the head/headings channels, so new findings can appear and a `--fail-on warning` run that was green can turn red on upgrade. Aliases are resolved with the same first-match, segment-boundary semantics the bundler uses (see the kit-alias-resolution design doc); an alias whose target file doesn't exist is skipped silently, same as an unresolvable `$lib` guess today. A bare custom-alias specifier (`import X from '$comp'`) now also gets the walk's existing `.svelte` extension guess (following `src/compdir.svelte` when it exists), matching Vite's `resolve.extensions` behaviour — bare `$lib` alone stays unfollowed as before. The vite plugin's rendered-HTML mode is unaffected — it already sees every component's contribution in the built output, which is what this change aligns the CLI's static mode with (same precedent as issue #425/#443).

- ddcf62d: A rule that throws no longer kills the analysis: the run completes without it, its id and error surface as a warning, and its weight is removed from that run's Health denominator so the score is not silently inflated — in both the CLI and the vite plugin's build mode. Previously the CLI died with exit 2 and the vite plugin skipped the entire analysis (and its build gate) with a single "analysis failed" warning; both now finish with real results for every other rule.

## 0.41.0

### Minor Changes

- 3beca66: seo/json-ld-validity now validates `@type` names against the schema.org vocabulary (generated from schema-dts and updated with its releases): a bare type name that is not an exact, case-sensitive schema.org type — including in nested entities and `@graph` members — produces a warning-level finding, with a did-you-mean hint when only the casing is wrong. IRI (`https://schema.org/Article`) and prefixed (`schema:Article`) forms are never flagged, and any document whose `@context` mentions a non-schema.org vocabulary (or uses an object context) is exempt from this check. Gate movement: projects with a typo'd `@type` that previously passed silently will see new warning findings, so a `--fail-on warning` (or equivalent `--min-health`) run that was green can turn red on upgrade. The default `--fail-on critical` gate is unaffected, and the rule's registered severity and scoring weight are unchanged.

### Patch Changes

- c550db7: The CLI's static mode now analyzes every `application/ld+json` script on a route — multiple tags in one head, tags split across the layout chain, and tags contributed by imported components — instead of silently keeping only the last one, matching what the vite plugin already does with rendered HTML. Gate movement: JSON-LD documents that were previously dropped are now checked by the whole json-ld rule family, so projects with defects in those documents will see new findings (warnings can turn a `--fail-on warning` run red, and Health can drop). Documents that were already the sole survivor are analyzed exactly as before.

  One movement in the head-tag presence rules: when multiple tags of the same kind match on a route — JSON-LD always can now, and rendered HTML can carry duplicate metas — the rule reports the strongest one (a satisfying tag beats an empty one, own beats inherited) instead of an arbitrary first/last survivor. A route with a valid document alongside an empty script now passes where it could (order-dependently) report 'Empty' before, so a previously-reported Empty finding can disappear; routes whose every script is empty still report Empty. Findings from layout- or component-contributed documents are attributed to the contributing file.

## 0.40.1

### Patch Changes

- 8c256e3: Files that fail to parse are no longer silently invisible: collectors mark them (`parseFailed` on the fact) and the CLI prints a stderr warning listing the skipped files. No finding, score, or exit-code movement — stderr diagnostics only; reporter stdout (json/sarif) is unchanged and still machine-parseable.

## 0.40.0

### Minor Changes

- 20d6f16: The CLI's default gate is `--fail-on critical`: a project failing only on a missing
  `<meta name="description">` now exits `0` instead of `1` (a deliberate loosening). Three more gate
  movements only surface under a non-default `--fail-on warning` (or an equivalent `--min-health`):
  a project failing only on a missing `og:url` now exits **`1` instead of `0` — a tightening, and the
  only one of the four that can turn a previously-green CI red on upgrade.** A project failing only
  on a missing `og:description` now exits `0` instead of `1`. A project failing only on a
  multi-`<h1>` page now also exits `0` instead of `1`. No other rule's severity changed, so no other
  gate behavior changes. Realigned four SEO rule severities with their underlying evidence,
  following the 2026-08-09 rule-validity review's Priority-2 findings.

  Two of the four changes shrink the `seo::route` scoring pair's total weight from 110 to 100
  (description-presence −10, og-url +4, og-description −4, net −10) — so a project's SEO/Health
  score can shift by a point or two even with no finding changes at all, simply because the
  denominator moved. `single-h1` and `hreflang` don't affect the pair's weight (see below).

  - `seo/description-presence`: `critical` → `warning`. `critical` now uniformly means
    deploy-blocking (the four crash/security rules — `correctness/orphan-effect`,
    `correctness/orphan-lifecycle`, `correctness/server-browser-global`,
    `security/handler-state-write` — plus `seo/title-presence`) — Google only "sometimes" uses the
    provided meta description for the search snippet, generating one from page content the rest of
    the time, so a missing one is real but non-blocking.
  - `seo/og-url`: `info` → `warning`, and `seo/og-description`: `warning` → `info` — swapped to match
    the [Open Graph protocol](https://ogp.me/)'s own required/optional split (`og:url` is Basic/required
    metadata; `og:description` is Optional). The previous ordering's "og:url is covered by canonical"
    rationale conflated two different jobs (canonical targets search engines, og:url targets social
    platforms) and is now recorded as historical context in the `og:url` docs page.
  - `seo/single-h1`: severity split — a page with zero `<h1>` stays `warning` (a real primary-heading
    gap); two or more `<h1>` is demoted to `info` (a single `<h1>` is the conventional signal, but no
    official source documents a ranking penalty for several, so it's a style nit, not a defect). The
    rule's own registered severity (read by scoring's inventory and the rules index) stays `warning`
    — only the per-finding severity is split, so the `seo::route` pair's total weight is unaffected.
    A global `rules: { 'seo/single-h1': <severity> }` override flattens both arms back to one
    severity, same as any other rule.
  - `seo/hreflang`: wording only, severity unchanged (`warning`). The "2+ alternates without
    x-default" message and recommendation no longer imply a defect — Google's guidance frames
    `x-default` as something to "consider," specifically for language-selector or auto-redirecting
    pages, not a requirement for every multilingual site. The malformed-hreflang-code arm is
    unchanged.

### Patch Changes

- 578f4c8: Corrected the failure-mechanism claims in three correctness rules' messages, rationale, and docs (severities unchanged):

  - `correctness/checkable-bind-value`: `bind:value` on a **checkbox** throws `bind_invalid_checkbox_value` only in a development build — the rule text claimed it silently "freezes," which is only true in production (where the binding falls back to tracking the `value` attribute). The radio message was already correct and is unchanged.
  - `correctness/orphan-effect`: the rule claimed a `production 500`. The server compiler deletes `$effect`/`$effect.pre` calls entirely, so SSR renders without error — the `effect_orphan` crash actually happens client-side, at module evaluation, breaking hydration.
  - `correctness/orphan-lifecycle`: `onMount`/`beforeUpdate`/`afterUpdate`/`createEventDispatcher` are silent no-ops on the server (and `onDestroy` throws a plain `TypeError`, not `lifecycle_outside_component`) — so "throws `lifecycle_outside_component`" was wrong for a Kit module that only ever runs on the server (`+page.server.ts`, `+server.ts`, `hooks.server.ts`). The context functions (`getContext`/`setContext`/`hasContext`/`getAllContexts`) do still throw there, and every name is unchanged for universal Kit modules (`+page.ts`/`+layout.ts`) and component-scoped code, since those also run in the browser.

- 090f5d7: `docs show <rule-id>` now tells you the id is a rule and points at `svelte-vitals explain <rule-id>` (which already prints a rule's rationale, options, and docs URL offline) instead of only listing the workflow guide topics. The agent report's intro now mentions `explain` too, so agents can reach rule semantics without the network.
- 72d908d: Two `correctness/effect-*` rule content fixes from the v1.0 rule-validity review:

  - `correctness/effect-as-onmount` no longer flags an `$effect` that reads a reactive value through
    a member expression on an imported binding or a local declared with a `new …()` initializer — a
    class instance with `$state` fields, a `SvelteMap`/`SvelteSet`, an imported runes-module state
    object, and `svelte/reactivity/window` were all indistinguishable from the true mount-only
    positive, and the rule's "use `onMount` instead" advice would have converted a re-running effect
    into run-once. The change is strictly narrowing (only removes findings, never adds one); the
    rule's message, recommendation, and docs now name `{@attach}` and event handlers alongside
    `onMount` instead of presenting `onMount` as the sole fix, and the docs admit the remaining blind
    spots (a reactive value reached only through a plain function's return value, or through a local
    assigned `new …()` after its declaration instead of at it) plus a pre-existing shadowing
    granularity note: matching is by identifier text, not lexical scope, so a callback-local binding
    that shadows an imported or `new`-declared name is still treated as reactive — that can only
    suppress a finding, never wrongly flag one.
  - The documented fix snippets for `correctness/server-browser-global` and
    `correctness/instance-browser-global` now use `onMount` (and, for the latter,
    `svelte/reactivity/window` as the preferred modern form) instead of an `$effect` that assigns a
    browser global to `$state` — that snippet was itself flagged by `correctness/effect-as-derived`,
    whose "use `$derived`" advice would reintroduce the SSR `ReferenceError` those two rules exist to
    prevent. `correctness/effect-as-derived`'s docs gain this as a second known limitation, and drop
    an inaccurate "$derived updates synchronously" claim in favor of describing its actual push-pull,
    lazy-recompute behavior.

- f09c015: `seo/json-ld-required-props`'s `REQUIRED_PROPS` table was stale against Google's current
  structured-data requirements, producing warning-level false positives on valid markup. Re-verified
  against developers.google.com:

  - `Article`/`BlogPosting`/`NewsArticle`: row removed. Google lists no required properties for these
    types (`headline` is Recommended) — valid markup without a `headline` is no longer flagged.
  - `Organization`: row removed. Google lists no required properties.
  - `Product`: now `name` plus **at least one of** `review`, `aggregateRating`, or `offers` (was
    `name` + `offers` unconditionally). A `Product` with only `aggregateRating` or only `review` no
    longer flags a missing `offers`; a `Product` missing all three now names the group in the message
    ("missing … one of review, aggregateRating or offers").
  - `Recipe`: now `name` + `image` only (was also requiring `recipeIngredient`/`recipeInstructions`,
    which Google does not require).
  - `VideoObject`: `description` dropped (Google: Recommended, not Required); still requires `name`,
    `thumbnailUrl`, `uploadDate`.
  - `Person`: row removed (was `name` required unconditionally). Google has no standalone Person rich
    result — the only documented requirement (`name` or `alternateName`) applies to a Person filling
    `ProfilePage.mainEntity`, a relationship this rule's per-`@type`, per-node model doesn't track, so
    a global row overclaimed "ineligible for the rich result" for every generic Person block (e.g. an
    Article's `author`). A generic `Person` node no longer produces a finding at all.
  - `Event`, `LocalBusiness`, `WebSite`, `BreadcrumbList` verified unchanged.

  No detection or message changes for any other JSON-LD rule.

- 59869b4: `performance/minify-disabled`: the rule's rationale claimed "Vite minifies with esbuild by default" — false since Vite 8, which defaults to its own Oxc minifier and made `esbuild` an optional peer dependency. The machine `fix.snippet` wrote `minify: 'esbuild'`, which an agent applying it verbatim would ship as a build newly requiring an undeclared dependency. The description and snippet now describe removing/scoping the override without naming a minifier; docs (en/ja) drop the stale esbuild-default claim and add `'oxc'` to the not-flagged list.

  `performance/preconnect`: the machine `fix.snippet` preconnected only `fonts.googleapis.com`. Google Fonts serves the actual font files from `fonts.gstatic.com` under anonymous CORS, so the canonical fix — already shown in the rule's own docs — is the two-link pair, the second carrying `crossorigin`. The snippet now matches the docs.

  `performance/render-blocking-script`: both collectors (`svelte-vitals`'s static parse and `@svelte-vitals/vite`'s rendered-HTML parse) marked a `<script src>` render-blocking whenever it lacked `defer`/`async`/`type="module"`, which false-positived on non-executing script types — most notably `type="text/partytown"`, SvelteKit's own recommended way to offload third-party scripts off the main thread, plus `type="importmap"` and `type="speculationrules"`. None of these execute as a classic script, so none can block HTML parsing. Both collectors now flag only a script whose `type` is absent, empty, or a JavaScript MIME type (a classic script) and that lacks `defer`/`async` — a strict narrowing of detection, removing this false positive without adding any new one.

- 369f0b1: Three `security/*` rule content fixes from the v1.0 rule-validity review:

  - `security/handler-state-write` and `security/shared-state-import` no longer fire on a universal
    `+page.ts`/`+layout.ts` file that itself exports `ssr = false` — that load never runs on the
    server, so there's no shared-process instance to leak through, and SvelteKit's own docs bless
    this configuration ("If you're not using SSR, then there's no risk of accidentally exposing one
    user's data to another"). The exemption is same-file only: a `+page.server.ts` still runs
    server-side regardless of `ssr` and keeps firing. A false positive removed on the one
    configuration the framework docs call safe.
  - `security/handler-state-write`'s message and recommendation now condition the cross-user-leak
    claim instead of asserting it unconditionally — rate limiters and memoization caches keyed by
    non-personal data are the common benign shape for this same call pattern, and the wording now
    says so instead of implying every promoted write is a leak. Severity is unchanged (`critical`).
  - `security/handler-state-write` and `security/raw-html` recommendations now mention the inline
    suppression directive, matching their SSR sibling rules (`security/server-module-state`,
    `security/shared-state-import`) which already had it. `raw-html`'s docs also spell out that a
    sanitizer keeps `{@html}` in the source — the finding is expected to persist after sanitizing,
    and suppression (not a further code change) is how a reviewed call clears it.

- 5e89a45: seo/single-h1 in the CLI's static mode now counts headings rendered by imported local components (followed transitively through the same depth-limited traversal head resolution already uses — no additional file reads). Extracting a page's `<h1>` into a `$lib` component no longer produces a false "Missing <h1>" warning, aligning the CLI with the vite plugin's rendered-HTML result. Two finding movements: false "Missing <h1>" warnings on such routes disappear (Health can rise), and routes whose chain plus components render more than one `<h1>` may gain a new info-level multiple-h1 finding (fails only under `--fail-on info`). Headings inside node_modules or dynamically chosen components remain invisible to static mode; the vite plugin stays the authoritative check there. seo/heading-level-skip is unchanged — component headings have no reliable document-order position, so the outline walk deliberately ignores them.
- fe4e575: Softened overstated or stale claims in several rules' rationale text (and one fix snippet), following the 2026-08-09 rule-validity review's Priority-3 findings. Wording only — no detection, severity, or message changes.

  - `performance/image-dimensions`: "triggers CLS" → "can trigger … unless the box is reserved another way (e.g. CSS `aspect-ratio`)".
  - `security/javascript-url`: leads with the CSP violation and unsafe navigation instead of XSS, demotes XSS to a parenthetical (detection is literal-only, so every flagged URL is author-written), and adds `formaction` to the attribute list already covered by detection.
  - `seo/canonical-url`: drops the trailing-slash example — SvelteKit normalizes those by default.
  - `seo/heading-level-skip`: assistive tech "relies on" the document outline; search engines now only "use it as a structural signal" rather than "rely on" it.
  - `seo/html-lang`: drops the "for search engines" framing — Google has said it does not use `lang` for ranking — in favor of screen readers, translation, and other assistive handling.
  - `seo/image-alt`: the fix snippet's placeholder alt text (`"Description of the image"`) tripped Svelte's own `a11y_img_redundant_alt` check; replaced with a concrete example.
  - `seo/viewport`: drops the unsupported "Google penalizes" claim for the documented ~980px layout-viewport rendering behavior mobile browsers fall back to.

- 2d0bae3: Fix a parse crash on argument-less `$state()` that made the whole component invisible to every rule. `let el = $state();` (the idiomatic `bind:this` declaration) threw inside fact extraction; the error was swallowed and the file silently contributed no findings at all. Such files are now analyzed normally. Note: projects using this pattern may see new findings on the next run — including critical ones (e.g. correctness/orphan-effect) in files that were previously skipped — so a previously green run can now fail the default `--fail-on critical` gate. That is the fix working, not a regression.

## 0.39.0

### Minor Changes

- a3dffb3: `architecture/prop-count` now counts named props destructured alongside a rest element (`let { a, b, ...rest } = $props()`) instead of treating the whole destructure as uncountable and staying silent. The named count is a lower bound on the true prop count, and the rule only flags a component whose named-prop count exceeds its `max` option (default 6), so this can only surface findings on previously invisible components — never a false positive. A bare rest element with no named props (`let { ...rest } = $props()`) and a non-destructured `$props()` are still not counted.

  Re-measured the per-repo p90 median across the same 10-repo corpus from the 2026-07-25 threshold recalibration with the fix applied: 6.5 (was 6). `MAX_PROPS` stays 6.

- 8e8bd5c: `architecture/reserved-directory-names`, `architecture/directory-naming` and `architecture/unit-entry-file`
  now report `examined` counts in the JSON report, the same mechanism `architecture/reserved-name-placement`
  already used: per declaration, how many places it judged, keyed by the same bare glob string its own
  diagnostic names. A run configuring all four rules previously got one `examined` entry and silence for the
  other three, even though all three already emit a project-scoped finding for a declaration that matched no
  directory — the count fills in the missing number for a key that governed a hundred directories versus one.

  No exported shape changes: `runRules`, `RuleContext.recordExamined` and `JsonReport.examined` already exist.
  This is JSON-only, matching the existing feature — no CLI or console output changes.

- ac41349: Every rule's PASS results now carry the same `location` a penalized result on the same route/file would — visible to library consumers reading `results` and in the `rules.*.passed` counts, not only the two rule ids (`seo/title-presence` and the `headTagRule`-backed family) that already did this. (The JSON report's `routes[].issues`/`siteIssues` arrays stay penalized-only, so this isn't visible there.) Fixes `files:`-scoped `severity: 'off'` overrides silently failing to remove a passing seed (issue #382): `overrideMatches` matches `files:` against a result's `location`, and a PASS with no `location` could never match, so `'off'` removed a rule's penalized findings but left its passing seed counted. `route:`-scoped overrides were unaffected.

  `architecture/unit-entry-file`'s per-declaration pass (deliberately route-less since #337) is unchanged — it never had this bug (`location` without `route` was never reachable by a `route:` glob to begin with, and `files:` already matched it via `location`).

  No rule's `id`, `severity`, or `detection` changes, and `score.ts` never reads `location` directly. Scores can still move in any mode through the fix itself: a `files:`-scoped `'off'` now removes the passing seeds it always claimed to (the issue's reproduction moves 98 → 96 once the seed is gone), where before it silently removed only the penalized findings. Benign display change: the console reporter's `--verbose` Passed listing prints `location ?? route`, so a rule newly carrying `location` on PASS now lists the file path there instead of the route id. See `docs/superpowers/specs/2026-08-08-pass-result-location-design.md` for the full design record and blast-radius enumeration.

- 65ce0c1: The HTML report and the dev dashboard now show each category's reach ("N of M keys affected") beside its score. The score floor design (2026-08-05) moved magnitude out of the score and into `categories[cat].affectedKeys`/`keys`, so a reader could no longer tell one affected file from forty-one — both surfaces received the fields and rendered nothing. Per-route category rendering (`routes[].categories`) remains a deferred, separate question.
- acee3c6: Add `anyCaseUnitScopes` to `architecture/reserved-directory-names`: a counterpart to `unitScopes` that
  governs units whose name does not begin A–Z.

  `unitScopes` identifies a unit with `isUnitDir`, which requires the directory name to begin A–Z as well
  as holding a same-stemmed child file — so a lowercase, `.ts`- or `.svelte.ts`-entry unit's children (measured
  at 129 of 299 units, 43%, on a real tree) were never governed by any declaration. `anyCaseUnitScopes` takes
  the same option shape against `isAnyCaseUnitDir`, the same test without the letter requirement. Declaring
  the identical glob in both maps is not a collision: `unitScopes` governs at capitalised units,
  `anyCaseUnitScopes` governs alone at the lowercase ones `unitScopes` never reaches.

  Default behavior is unchanged — `anyCaseUnitScopes` defaults to `{}`, so a project that does not declare it
  sees no new findings.

## 0.38.0

### Minor Changes

- 003e56c: Remove the unused `routeBadges` option from `buildHtmlDocument`. The parameter had no callers; badges in the HTML report now always start empty and are populated by the embedded snapshot as before. Also drops an internal `Intl.Segmenter` availability fallback — every supported runtime (Node >= 22.13, all target browsers) ships full ICU.

### Patch Changes

- 1859d24: Recognize rune declarations behind TS casts (`as`, `satisfies`, `!`) — `let count = $state(0) as number` now feeds the same facts as the uncast form — and collect imports for `.svelte.ts`/`.svelte.js` runes modules, so import-based rules (`performance/heavy-import`, `performance/namespace-import`, `architecture/private-scope-import`, `architecture/route-component-import`) now see them. Both were silent false negatives: TypeScript-heavy components and runes modules could pass checks they should have failed. New findings may appear in TypeScript-heavy projects — they were previously missed, not newly introduced.

## 0.37.0

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

## 0.36.1

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

## 0.36.0

### Minor Changes

- e25e890: Add architecture/reserved-name-placement: a reserved directory name may appear only in the places declared for it.

  Its sibling, `architecture/reserved-directory-names`, says which names a position allows; this rule says which
  positions a name allows, for names permitted in more than one kind of place at once — under a unit, under a
  grouping directory, under a route directory. It is off until you configure it: all three placement maps
  default to `{}`.

### Patch Changes

- 1020227: Document what a floored inventory is, and guard the margin the floor depends on.

  Five of the nine `(category, scope)` groups hold less than 25 points of checks, so `inventories` reports 25
  for all of them — a group with one rule and a group with eight look identical there. That number is the
  divisor a score used, not a count of what ran, and the reporters guide now says so. It also now says that
  `keys` counts per category rather than per project, so one run can show `seo` at 13 keys and `architecture`
  at 334.

  A test now fails if the floor stops ordering `info` below `warning`. That ordering holds only while the
  widest group stays under 125 points; the widest today is 110, so a few more `warning` rules there would
  re-invert them. The test turns that into a failing build rather than a silent change in what a score means.

## 0.35.0

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

## 0.34.0

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

## 0.33.0

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

## 0.32.0

### Minor Changes

- 091ec2f: `security/handler-state-write` now reports a hand-rolled in-memory store under `$lib/server`.

  The rule exempts `.set()`/`.update()` on imports resolving under the `$lib` server root, because
  that is where database and KV clients live and `db.set(…)` there is persistence, not shared state.
  The check was purely path-based, so a plain `new Map()` in the same directory — one shared
  instance, overwritten by every request — was exempt too:

  ```ts
  // src/lib/server/store.ts
  export const db = new Map();

  // src/routes/+page.server.ts
  import { db } from "$lib/server/store";
  export async function load({ locals }) {
    db.set("user", locals.user); // previously not reported
  }
  ```

  svelte-vitals now reads the target module and keeps the call exempt only when the export is not an
  in-memory container. An export initialized to `new Map`/`Set`/`WeakMap`/`WeakSet`, or to an object
  or array literal, is reported; anything else — a client constructed from a package, a re-export, an
  unreadable module — stays exempt. A wrapper the read cannot inspect therefore stays silent rather
  than becoming a false positive. Only the modules a handler actually writes to are read, so a project whose handlers never
  touch `$lib/server` does no extra I/O.

  Property writes (`store.user = …`) were already reported wherever they appear and are unchanged.

## 0.31.1

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

## 0.31.0

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

- ca2388b: Skip the three directory-shaped Architecture rules entirely when no config layer mentions them.
  `architecture/unit-entry-file`, `architecture/directory-naming` and
  `architecture/reserved-directory-names` read their options per directory, so an unconfigured project
  was resolving and discarding options once for every directory under `src/`, three times over — on
  every dev-server save. Measured over a synthetic tree of 1,523 directories, that cost 5.4 ms per
  analysis for rules that are off by default and produce nothing. It is now zero.

## 0.30.0

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

## 0.29.0

### Minor Changes

- 3389594: `correctness/stale-prop-derivation` and `correctness/prop-mutation` now also recognize legacy-mode (`export let`) props, not just runes-mode (`$props()`) ones — the same two bugs exist under Svelte's legacy reactivity, just with a different fix (`$:` instead of `$derived`; reassign-after-mutating instead of `$bindable`), and each rule's message is tailored to whichever mode the flagged component actually uses.
- 40a6dc6: Add `correctness/nonreactive-builtin-state`: flags plain `Map`/`Set`/`Date`/`URL`/`URLSearchParams` in `$state` whose mutations are observed — `$state`'s deep proxy covers plain objects and arrays only, so such mutations are untracked and the UI silently stops updating. Precision-first: only type-specific mutating operations count, and mutate-then-reassign usage (which works) is not flagged.

### Patch Changes

- 48f6d24: Scope resolution now treats `var` declarations and nested `function`/`class` declaration names as shadowing bindings, so writes to such locals are no longer misattributed to a same-named top-level `$state` (fewer false positives across the component-analysis rules).
- 2ed7450: `correctness/unmutated-state` no longer flags `$state` passed to a `use:`/`transition:`/`animate:` directive — the receiving code holds the proxy reference and may mutate it invisibly, so the previous `$state.raw` suggestion could break it.

## 0.28.0

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

## 0.27.0

### Minor Changes

- 840121a: The Markdown report (GitHub Actions job summary / sticky PR comment) now ends with a one-line pointer to the "Excluding routes or rules" docs whenever findings are shown, so adopters blocked by expected findings (e.g. auth-only routes flagged by SEO rules) can find `overrides` / the suppressions file from the report itself.
- 840121a: Add route-/file-scoped rule overrides via a new `overrides` option in `svelte-vitals.config.*` (also available as a Vite plugin option). Each entry scopes rule settings with `route` globs (matched against route ids) and/or `files` globs (matched against source paths — the way to target a `(group)` directory, since group segments are dropped from route ids): `overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]` turns all SEO rules off for an auth-only route group, durably — routes added under the glob later are excluded too, unlike the snapshot-style suppressions file. Keys in an entry's `rules` may be rule ids or category names; values are `'off'` (the finding is removed entirely) or a severity. Applied in `analyzeProject`, so the CLI, MCP server, GitHub Action, and Vite build gate all honor it.

## 0.26.0

### Minor Changes

- b10c26a: Add CORRECT006 (critical): flag orphan `$effect` calls that throw `effect_orphan` at runtime — a top-level `$effect` in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>`, and a module-scope `new` of a class whose constructor creates a bare `$effect`. `.svelte.ts`/`.svelte.js` runes modules are now analyzed by the component-facts pipeline.
- e38ea4d: Add CORRECT007 (critical): flag Svelte lifecycle/context calls (`onMount`, `getContext`, `setContext`, …) that run outside component initialisation and throw `lifecycle_outside_component` at runtime — at module scope in runes modules and `<script module>`, in constructors of module-scope-instantiated classes, and inside SvelteKit load/action/endpoint handlers (the classic `getContext`-in-`load` trap).
- b0c2040: Add CORRECT008 (critical) and CORRECT009 (warning): flag browser-only globals (`window`, `document`, `localStorage`, …) read in server-executed code — module scope of runes modules and `<script module>`, SvelteKit load/handler/`init` bodies and file top levels (CORRECT008), and component instance-script top levels that run during SSR (CORRECT009). Recognises `browser`/`typeof` guards, respects same-file `export const ssr = false`, and never descends into `onMount`/`$effect`/function bodies.
- d6511a7: Add SEC003–005: SSR shared-state leak detection for SvelteKit server/universal route files. SEC003 (critical) flags load/action/endpoint handlers writing to imported module state; SEC004 (warning) flags module-scope `let`/`var` reassigned from functions in Kit server files; SEC005 (warning) flags server-side imports of `.svelte.ts` modules holding module-scope `$state`. Kit route/hooks files are now analyzed via a new `KitModuleFacts` channel.

### Patch Changes

- 15f0b61: SEC003 no longer flags `.set()`/`.update()` calls on modules imported from `src/lib/server/**` via a relative path — the exemption now checks the resolved path, not just the `$lib/server/` alias form.

## 0.25.0

### Minor Changes

- 28e92c0: `svelte-vitals --reporter html` and the vite live dashboard now share one renderer (core's new `renderAppShell`), so the two surfaces can't drift apart again. The static HTML report gets the dashboard's full UI — master/detail layout with a searchable, sortable route list, severity/category filters, dark mode, and the per-finding copy-to-clipboard AI Prompt — while staying fully self-contained and offline; the only difference is that the live-update machinery (SSE connection, `measured` refinement, the connection/analyzing indicators) is absent when there is no dev server behind the page. `@svelte-vitals/core` gains `renderAppShell`/`AppSnapshot`/`RouteBadge`/`APP_SCRIPT`/`APP_STYLE` exports; `buildHtmlDocument`/`formatHtmlReport` keep their signatures but emit the new document. The dashboard itself is unchanged, now served from the shared shell.

## 0.24.0

### Minor Changes

- bf6932d: Fix PERF009 (heavy dependency import) always reporting `line: 0` for its findings. `ComponentFacts` gains `importSpans` (module specifiers with their real source line), and PERF009 now uses it instead of the line-less `imports`. Because `componentRule`'s suppression check only looks up an inline directive when a finding's `line > 0`, this also fixes `// svelte-vitals-disable-next-line PERF009` silently never suppressing a PERF009 finding.

### Patch Changes

- fda64dd: Console reporter: stop printing the "↯ = set dynamically (verified at runtime)." footnote in compact (default, non-`--verbose`) mode. The `↯` marker itself only ever appears in the verbose `Passed` listing — showing the footnote without it visible anywhere in the output was confusing.

## 0.23.0

### Minor Changes

- 7acad5a: Console output now groups findings by rule and caps what's shown by default (top 5 rules per severity, the Passed section collapsed to a count, `--by-route` capped to the worst 10 routes) — pass `--verbose` for the old uncapped listing. The Health score also gets a short pulse-line reveal animation on an interactive terminal (disable with `--no-animation`).

## 0.22.1

### Patch Changes

- 2652572: The Markdown reporter's findings table (used for the GitHub Actions job summary and sticky PR comment) now appends each finding's `recommendation` to its message, matching what the console/github/agent reporters already show. Previously the table only showed the terse `message` (e.g. "Missing robots.txt"), dropping the actionable "how to fix it" text.

## 0.22.0

### Minor Changes

- 7e3b423: The dev dashboard (`svelteVitals({ ui: true })`) now runs whole-project static analysis: from the moment `vite dev` starts it shows all routes across every category (SEO, Performance, Correctness, Security, Architecture) with a real project Health — no page visit required. Saving a source file triggers a debounced re-analysis, and visiting a page refines that route with live (rendered) results. Route headings show a `measured` (live) or `static` provenance badge. If the analysis fails, the dashboard falls back to the previous live-only behavior without breaking the dev server. To support the badges, core's `buildHtmlDocument` gains an optional third argument (`opts?: { routeBadges?: Record<string, 'measured' | 'static'> }`); output is unchanged when it is omitted.
- f0af627: Surface the resolved `@svelte-vitals/core` version so it's possible to tell whether the CLI and the Vite dev overlay are running the same rule engine. `svelte-vitals --version` now prints `<cli version> (core <core version>)`, and the dev overlay's dashboard footer (`/__svelte-vitals/`) shows `core v<version>` alongside its own version. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases (e.g. a package-manager cooldown like pnpm's `minimumReleaseAge` resolving `@latest` down to an older release) — previously there was no way to notice this without diffing lockfiles, so the two surfaces could silently disagree on findings. See the "Version drift" section in the dev overlay docs.

## 0.21.0

### Minor Changes

- 8dc631c: Add a `--reporter md` Markdown summary reporter (Health score, per-category scores, severity counts, and a findings table) and a `svelte-vitals ci install` command that scaffolds a GitHub Actions workflow gating pull requests on newly introduced findings — inline annotations, a job summary, and a sticky PR comment, using `--diff`/`--baseline`/`--reporter github`/`--reporter md` under the hood.

## 0.20.0

### Minor Changes

- 7f1697d: Add CORRECT005: flag mutation of a non-`$bindable` prop destructured from `$props()` (member writes, `delete`, or a mutating method call like `.push()`). Plain reassignment of the prop itself is not flagged — Svelte's docs explicitly sanction that pattern for ephemeral state; only mutation is prohibited. Catches a class of bug the compiler never reports: mutating a plain-object prop is a silent no-op, and mutating a reactive-state-proxy prop only warns at runtime if that code path is exercised.
- 3b33e4c: Raise the supported Node.js floor from 18.20.8 (EOL) to >=22.13.0 — the oldest maintained LTS line the pinned pnpm can run on. CI now exercises Node 22 (floor), 24, and 26.

### Patch Changes

- 18b11af: Fix CORRECT001 (keyed each block): stop flagging itemless `{#each}` blocks (the "render N times" pattern, e.g. a chess board) — there is no item identity to key on, so this was a false positive on an officially documented Svelte pattern. Also corrected the rule's rationale text, which described the unkeyed mechanism backwards.
- e476a2e: Deduplicate `collectComponentFacts` into `@svelte-vitals/core`; behavior is unchanged.
- 6b2d0a7: Fix PERF010 (namespace import) rationale: it previously claimed a namespace import always defeats tree-shaking, which over-states the real behavior — bundlers like Rollup/Vite do tree-shake statically-accessed namespace imports. The message now accurately describes when tree-shaking breaks (the namespace object escapes or is accessed dynamically). No detection or severity change.
- 4513f97: Fix a false-positive/false-negative source shared by CORRECT004 (unmutated `$state`) and CORRECT005 (mutated non-bindable prop): both matched writes by identifier name alone, so a local binding that reused a tracked `$state`/prop name — a function parameter, a block-scoped `let`/`const` redeclaration, a `for`/`for-of`/`for-in` loop variable, a `catch` clause's parameter, or an `{#each ... as x}` loop variable — was misattributed as a write to the outer binding. CORRECT005 now correctly skips flagging a mutation of such a shadowing local instead of raising a false positive; CORRECT004 now correctly still flags a `$state` as constable when only a shadowing local was ever written, instead of a false negative. `{#snippet}`/`{:then}`/`{:catch}` bindings are not yet tracked — a known, documented remaining gap.

## 0.19.0

### Minor Changes

- 19e304c: Add an inline `svelte-vitals-disable-next-line` comment to suppress a specific component-scoped rule's finding on the following line (`// ...` in `<script>`, `<!-- ... -->` in markup) — a targeted escape hatch for intentional patterns a rule can't infer statically, such as a mount-only `$effect` used to avoid a hydration mismatch. Covers CORRECT001–004, SEC001–002, ARCH001–002, and PERF009–010. Fixes #92.
- 2f94444: Export `parseComponentFacts` (and the Svelte-AST utilities it's built on — `attrValue`, `attrValueOf`, `attrTextOf`, `findAttr`, `lineOf`, `CHILD_NODE_KEYS`, `valueFromNodes`, `textFromNodes`, `attrText`) from the package root. This is the same `.svelte`-source parser the CLI has always used for Correctness/Security/Architecture/Bundle-Performance rules, relocated from `svelte-vitals` so `@svelte-vitals/vite` can use it too. `@svelte-vitals/core` gains a new `svelte` dependency (for `svelte/compiler`'s `parse`) — a pure parsing call, so this doesn't affect the package's runtime-agnostic status.

## 0.18.0

### Minor Changes

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

## 0.17.0

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

## 0.16.0

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

## 0.15.0

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

## 0.14.0

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

## 0.13.0

### Minor Changes

- e627343: Add six SEO checks decidable from the resolved `<head>` and project facts: SEO010 surfaces a
  route set to `noindex` (verify intentional), SEO011 Twitter Card, SEO012 Open Graph description,
  SEO013 Open Graph URL, SEO014 viewport, and SEO015 (robots.txt should reference your sitemap).
  SEO010 only fires on a statically-resolvable `noindex`/`none` (never a dynamic value); robots/
  viewport tags placed in `app.html` are covered in plugin/rendered mode.

## 0.12.0

### Minor Changes

- ef895c1: Add two static resource-hint Performance checks: PERF003 flags a `<link rel="preload">`
  with no `as` attribute (the browser ignores or double-fetches it), and PERF004 flags a
  `<link rel="preload" as="font">` with no `crossorigin` (the font preload is wasted and the
  file downloads twice). Both surface in the CLI, the static report, and the vite plugin /
  dev UI. Static mode evaluates hints in `<svelte:head>`; resource hints in `app.html` are
  covered in plugin/rendered mode.

## 0.11.0

### Minor Changes

- e6ee630: Add a visual HTML report: `svelte-vitals --reporter html` writes a self-contained,
  styled HTML page (Health score, per-category and per-route scores, findings with
  fixes) you can open in a browser. Output path defaults to `svelte-vitals-report.html`;
  override with `--out-file <path>` or `--out-file -` for stdout. The core gains
  `buildHtmlDocument` / `formatHtmlReport` for reuse by other surfaces.

## 0.10.1

### Patch Changes

- 0555127: Add a documentation site (Starlight, bilingual en/ja) at
  https://oekazuma.github.io/svelte-vitals/ with rule references and guides, and point every
  finding's `docsUrl` (and the SARIF `informationUri`) at it — previously these linked to an
  unpublished domain. Rule doc slugs are lowercased (e.g. `/rules/seo001`).

## 0.10.0

### Minor Changes

- d86ced5: **Remove the Accessibility (a11y) category.** svelte-vitals now focuses on SEO and
  Performance; accessibility is well covered by the Svelte compiler, eslint-plugin-svelte,
  and axe. This removes the a11y collector (the aggregated Svelte `a11y_*` compiler
  warnings), the `a11y` category from the score/Health breakdown and reporters, and the
  `--ignore a11y_*` / allow-list a11y handling. `Category` is now `'seo' | 'performance'`,
  and the Health score averages SEO + Performance. **Breaking:** a11y findings and the
  `categories.a11y` entry no longer appear in any reporter or the MCP `analyze` output.

## 0.9.0

### Minor Changes

- 31904f9: Add the combined **Health Report** (#10): a single weighted Health score across the
  SEO, Performance, and Accessibility categories (equal weights by default, overridable
  via `Config.weights`), surfaced as the headline in the console/agent reporters and the
  MCP `analyze` output, with an optional `--min-health <0-100>` CI gate.

  **Breaking (JSON report):** the top-level `score` is now the combined Health score (it
  was the SEO score); the top-level `scoreModel` is removed; a `weights` field is added.
  Per-category scores remain under `categories` (e.g. `categories.seo.score` /
  `categories.seo.scoreModel`).

## 0.8.0

### Minor Changes

- 2857e16: Add the Performance category (v0.4, #10): static `<img>` checks — **PERF001** (missing
  `width`/`height`, CLS risk; warning) and **PERF002** (missing `loading` attribute; info
  advisory) — with dynamically-bound attributes counting as present. Introduces the
  multi-category foundation: `Result.category`/`line`, the `ImageInfo`/`ResolvedImages` IR,
  `RuleContext.images`, `imageRule`, `scoresByCategory`, and category-aware reporters
  (per-category scores; JSON `categories` map). Existing SEO findings, scores, and output
  are unchanged.

## 0.7.0

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

## 0.6.0

### Minor Changes

- 396a783: Add `@svelte-vitals/mcp`, a Model Context Protocol server exposing `analyze` and `explain_rule` tools over stdio (#24). Core gains `buildJsonReport`, `explainRule`, `RuleInfo`, and `docsUrlFor`; the JSON report's per-finding objects now include `docsUrl`; the CLI gains `analyzeProject` for reuse.

## 0.5.0

### Minor Changes

- 762d4d1: Add SARIF 2.1.0 (`--reporter sarif`) and GitHub Actions workflow-command (`--reporter github`) reporters. The `github` reporter is auto-selected under GitHub Actions for inline PR annotations; SARIF can be uploaded to GitHub code scanning.

## 0.4.0

### Minor Changes

- e60d033: Agent-native output. Every rule now carries a structured `fix` (instruction + snippet), surfaced in the JSON report and in a new `--reporter agent` Markdown remediation document built for handing findings to an AI coding agent. The CLI auto-selects the agent reporter when run under a known AI-agent harness (`CLAUDECODE`), overridable via `SVELTE_VITALS_REPORTER` or `--reporter`.

### Patch Changes

- eb97f09: Agent reporter polish: an invalid `--reporter <value>` now fails fast with exit 2 instead of silently falling back to auto-detection; the agent Markdown report orders findings most-severe-first (critical-bearing files first, severity-sorted within each file) and tells the agent to prioritize critical issues; tag-like tokens (`<title>`, `<meta …>`, `<svelte:head>`) in the agent report are wrapped in inline code so Markdown renderers no longer strip them; rule `fix` templates are now copied per finding rather than shared by reference; and when the agent reporter is auto-selected from the environment (not requested explicitly), a one-line hint is printed to stderr explaining how to override.

## 0.3.0

### Minor Changes

- fcb0494: Plugin mode: `@svelte-vitals/vite` analyzes prerendered HTML during `vite build` and runs the full SEO rule set (library-agnostic), gating the build via `failOn`. Console/JSON reports with a per-route score; only prerendered routes are covered. `outFile` is resolved against the project root (parent directories are created), and an internal analysis failure is reported as a warning rather than failing the build (distinct from a real finding). The core console reporter gained an optional `mode` label for the header line, and now exports the shared `ROBOTS_SOURCE_PATHS` / `SITEMAP_SOURCE_PATHS` project-rule path lists used by both modes.

## 0.2.0

### Minor Changes

- 08b6d74: Static-mode finishing: scored SEO report.

  - New rules SEO002–SEO009 (description, canonical, og:image, og:title, robots.txt, sitemap.xml, JSON-LD, `<html lang>`).
  - Scoring model (§12): per-route scores, route average, site penalty, and a critical cap, surfaced in the console header and JSON.
  - JSON reporter (`--json` / `--reporter json`) and `--by-route` per-route tree.
  - New flags: `--fail-on`/`--fail-on-warning`, `--rules`/`--ignore`. `treatDynamicAs: 'warn'` now reports dynamic values as warnings.

## 0.1.0

### Minor Changes

- e3228ca: Detection layers 2–4: resolve head metadata set via components, not just literal `<svelte:head>`.

  - Built-in adapters for `svelte-meta-tags` (`MetaTags`) and `svelte-seo`.
  - Transitive resolution of custom `src/` components (depth-limited, cycle-guarded).
  - `--meta-components` flag to declare opaque meta components, plus `--treat-dynamic-as` and `--route` flags.
  - Components recognized as meta sources suppress false "missing" verdicts; unknown components do not.

## 0.0.1

### Patch Changes

- 4786248: Initial release: the static-mode SEO foundation.

  - `npx svelte-vitals` scans a SvelteKit project and checks `<title>` presence (SEO001) by statically parsing `<svelte:head>` with `svelte/compiler`, resolving the full layout chain (`+layout.svelte` → … → `+page.svelte`).
  - Two-axis detection (presence × value): a dynamic title such as `<title>{data.title}</title>` is recognized and never reported as missing; it passes with a `↯` marker. Only genuinely missing or empty metadata is flagged.
  - Runtime-agnostic `@svelte-vitals/core` (types, rule engine, reporter) with a `Runtime` I/O abstraction, plus a Node adapter in the CLI. Exit codes: `0` ok, `1` critical finding, `2` execution error.
