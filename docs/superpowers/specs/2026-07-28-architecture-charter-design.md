# Architecture charter — Design

Date: 2026-07-28
Status: Approved

## Problem

`docs/superpowers/specs/2026-07-26-rule-options-design.md` introduced a three-layer framing for
Architecture rules (L1 framework mechanics, L2 project-pattern deviation, L3 declared preference)
and deferred the criteria themselves:

> The Architecture charter itself (which layer a proposed rule belongs to, and what evidence admits
> it) is a separate follow-up document.

This is that document. It exists because Architecture is the category with the least settled
admission standard and the least coverage. Measured 2026-07-28 over `allRules` (66 rules):

| Category     | Rules |
| ------------ | ----: |
| seo          |    31 |
| performance  |    14 |
| correctness  |    14 |
| security     |     5 |
| architecture |     2 |

Both Architecture rules (`architecture/prop-count`, `architecture/component-size`) are single-file
counting metrics at `info`. The last two changes to the category — the threshold recalibration
(`2026-07-25`) and per-rule options (`2026-07-26`) — both improved the _precision_ of those two
rules; neither widened the category. Proposals to widen it have no standard to be judged against,
which is what this charter supplies.

The charter is a long-lived decision instrument. It contains no implementation work.

## Scope

The charter governs **admission of Architecture rules only**. Project-wide principles (no false
positives, I/O only through `Runtime`, `packages/core` stays dependency-free) live in their own
documents and are not re-litigated here.

### Superseded: the no-overlap condition

`2026-06-30-architecture-category-design.md` admitted rules on the condition of "no overlap with
the compiler / svelte-check / eslint". **That condition is withdrawn** (maintainer decision,
2026-07-28): if svelte-vitals should have a rule, overlap with another tool does not disqualify it.

Whether the compiler, svelte-check, or a linter reports the same thing no longer appears in the
charter's verdict. It may still appear inside a _specific_ rejection — not as "this overlaps" but as
"the value this adds over what the user already gets is too small to pass the mission-fit gate"
(see the server-only-modules rejection in the inventory).

The filter that the withdrawn condition used to provide is replaced by the four gates below.

## The four gates

A proposed Architecture rule passes all four gates **before** its layer is decided. A proposal that
fails one is rejected, or redesigned until it passes.

| Gate               | Requirement                                                                                                                                                                                                                                                                                                                                                         | How it is evidenced                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Mission fit**    | Requires **Svelte/SvelteKit semantics or project-structure knowledge** that a file-local, framework-agnostic tool cannot have — `$props()` semantics, route ids, the role of `$lib`, the `+page`/`+layout`/`+server` distinction, prerenderability, adapter, whether the project is packaged — or fills a structural hole none of the other four categories covers. | Name the facts it depends on, and where each comes from (`Project`, `ComponentFacts`, `KitModuleFacts`, `ctx.heads`). |
| **Precision**      | Zero false positives. When a fact needed for the verdict is missing, the rule **stays silent** — the same stance as never flagging `propCount: 0`.                                                                                                                                                                                                                  | Enumerate the undecidable inputs and prove silence for each in tests.                                                 |
| **Actionability**  | **The reported location must be the place to act.** A canonical `Fix` (description + snippet) is required when a canonical edit exists.                                                                                                                                                                                                                             | State the corrective direction; write the `Fix` text in the proposal when one applies.                                |
| **Default stance** | Either it can be on by default, or it is inert until the convention is declared — and which one is explicit.                                                                                                                                                                                                                                                        | Declare which stance in §"Default stance and release contract".                                                       |

### The precision gate has an inverse, and a configured rule must satisfy both

The gate's evidence column asks a proposal to prove **silence** where a verdict is undecidable. For a
rule whose scope is declared by globs, the opposite proof is needed too, because **zero findings reads
identically as "the project complies" and "the declaration matched nothing."** Added 2026-07-28 after
a rule's own documented example configuration was found, three times, to be checking far less than it
appeared to — once nothing at all, once only a fraction of the eligible directories — with zero
findings each time.

So a glob-configured rule owes two more things before it ships:

- **A count of what it examined**, checked against the tree's real population. Not the finding count —
  that is the number the failure hides behind.
- **A run against a tree that already complies** (expect zero findings) _and_ one against a tree that
  does not (expect a known non-zero count). Either alone is satisfiable by a rule that does nothing.

An inert-declaration finding — a key that matched **no** directory at all, as
`architecture/unit-entry-file` reports — is the shipped half of this. It does not cover the more common
shape, a declaration that matches some directories but far fewer than intended, which is why the count
belongs in the pre-ship evidence rather than only in the rule. **Exposing per-rule examined counts in
the CLI** (a `--stats`-style flag) would let a user keep checking this after ship rather than only the
author before it; recorded in "Out of scope" as its own spec.

Two notes on the actionability gate, which is the one that rejects most proposals.

It does **not** require a `Fix` snippet. `architecture/component-size`'s remedy is "split this
component"; no canonical snippet exists, and demanding one would be wrong. What it requires is that
the finding point at the file to change.

That is what closes the L2 layer. For `component-size`, the reported file _is_ the file to edit. For
a deviation-from-the-majority finding, the reported file **may be the correct one** and the rest of
the project the problem — the rule cannot say. Failing to name the place to act is the failure; not
having a snippet is not.

## The layers

The layer decides two things only: **what evidence admits the rule**, and **what its default stance
is**. The four gates have already decided whether it may exist.

| Layer                       | Definition                                                                                                                                            | Evidence required                                                                                                                                                                                       | Default                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **L0 — metric**             | A single-file count. Nothing breaks; the count is a symptom of structural debt. Carries a threshold.                                                  | **Measurement over a real corpus.** The per-repository p90 method established in `2026-07-25` (after ReactSniffer, Ferreira & Valente 2023). Reference points considered and rejected are recorded too. | On, **`info` permanently**, threshold configurable |
| **L1 — mechanics**          | A mechanical fact living in the **relations between files** or in project structure. A breakage contained within one file belongs to **Correctness**. | **A mechanism argument** — a reference to official documentation or an issue showing that written this way, it breaks. No measurement, because there is no threshold.                                   | On, landing at `info`, promotable in a major       |
| **L2 — inferred deviation** | **Closed.** Detecting deviation from the project's own dominant pattern.                                                                              | —                                                                                                                                                                                                       | Ships nothing                                      |
| **L3 — convention**         | Conformance to a convention the **user declares**.                                                                                                    | No evidence needed. Instead: proof that the **option schema can express the convention**.                                                                                                               | **Inert until declared**                           |

### Why L0 exists

The inherited three-layer table was written with directory rules in mind and has no home for the two
rules already shipped: `prop-count` and `component-size` are single-file counts that break nothing.
They are neither mechanics nor declared preference. L0 names that shape, and `2026-07-25` already
established its evidence standard.

L0 is pinned to `info`. A "nothing breaks, but this is debt" advisory must never fail a build for a
user who set `--fail-on warning`.

### Why L2 is closed

Two reasons, recorded so the argument is not repeated each time a proposal arrives:

1. **The corrective direction is not determined**, so it cannot pass the actionability gate — see
   above. This is structural, not a matter of better wording.
2. **It punishes deliberate migration.** A project moving from pattern A to B will always have one
   of the two sets reported as deviant. Noise is the fastest way to lose a user's trust; the same
   concern drove the a11y category's removal (`2026-06-23-remove-a11y-design.md`).

A cross-file **absolute fact** (a circular import; a title duplicated across routes) is **L1**, not
L2 — L1's boundary is precisely "lives in the relations between files". `uniquenessRule`
(`packages/core/src/rules/seo/uniqueness-rule.ts`) is the in-repo precedent that such verdicts are
acceptable, and it ships at `warning` — as a pre-existing SEO rule, which is no licence for a new
Architecture rule to land above `info` (see the release contract). `--diff` does not weaken such
verdicts either: it filters results after a whole-project analysis
(`packages/cli/src/changed-files.ts`), so cross-file rules always see the whole project.

**A proposal that looks like L2 is to be re-expressed as L3** — have the user declare the convention
instead of inferring it.

## Default stance and release contract

Three stances exist, and no others:

| Stance                            | Applies to                    | Meaning                                   |
| --------------------------------- | ----------------------------- | ----------------------------------------- |
| On, advisory (`info`)             | L0 permanently; L1 on landing | Reported, but never fails a build         |
| On, gating (`warning`/`critical`) | L1 only, after promotion      | Fails a build depending on `--fail-on`    |
| Inert until declared              | L3                            | Emits nothing until an option is supplied |

**A new rule always lands at `info`, and is promoted only in a major release.** Because `failOn`
defaults to `critical`, a rule that lands at `info` cannot break anyone's build on the release that
introduces it.

Severity and enablement are separate axes, so this says nothing about whether the rule runs. An L3
rule is inert until its convention is declared **and** reports at `info` once it is — the landing
severity governs the findings it emits, not whether it emits any. Promotion applies to L1 alone: L0
stays at `info` permanently, and an L3 rule reports a deviation from a convention the user chose, so
raising it above `info` on their behalf would be svelte-vitals asserting a stake in that choice.

The limit of that is stated honestly: it does **not** solve score comparability. An `info` finding
deducts 1 point (`DEDUCTION` in `packages/core/src/scoring/score.ts`), so every release that adds a
rule moves every project's Health score. With the Health Report as a headline surface, that is a real
problem — but the fix (a versioned default-set pin, e.g. `ruleSet: '1.0'`, so rules added after a
declared version stay inert until the user bumps it) touches the CLI, the config file, the scorer,
and the docs. **Recorded here as unsolved, to be settled at the 1.0 boundary in its own spec.**

### No distribution presets

svelte-vitals ships **no `recommended` / `all` presets**. The preset mechanism exists in linter
ecosystems for three reasons, none of which hold here:

1. **Mutually exclusive rules.** No two of the 66 rules contradict each other, so there is no set a
   user cannot enable wholesale.
2. **A third-party plugin ecosystem**, where no single party vets quality, making `recommended` the
   author's quality signal. Every svelte-vitals rule is first-party and admitted through a design doc.
3. **Being a framework** rather than a product with an opinion.

Shipping `recommended` under these conditions would mean shipping rules that are not recommended.
That is a failure of the admission decision, not a missing mechanism — and this project has resolved
such cases by removing the rules instead (the a11y category).

**Trigger condition:** if a third-party rule API is ever added, `recommended` becomes necessary,
because reason 2 starts to hold the moment curation authority disperses.

## Validation against the shipped rules

Running `architecture/prop-count` and `architecture/component-size` through the charter exposed two
defects in the gates. **The gates were corrected, not the rules.**

**Correction 1 — mission fit was too narrow.** `prop-count` needs `$props()` semantics, not
route/`$lib` structure knowledge. The gate now reads "Svelte/SvelteKit semantics **or**
project-structure knowledge". `2026-07-25`'s rejection of `max-params`' number — on the grounds that
named props carry different cognitive load from positional arguments — is itself evidence that
language semantics belong inside this gate.

**Correction 2 — actionability required a `Fix`, which neither rule has** (10 of the 21 `info` rules
have none, measured 2026-07-28). Requiring one was the error; the gate was reformulated as "the
reported location must be the place to act", with a `Fix` required only where a canonical edit
exists. The reformulation keeps the gate's power to close L2 (see above) while no longer rejecting
candidates like circular imports at the gate, which are better judged on precision and mission fit.

After the corrections, both rules pass all four gates and classify as **L0**, with
`2026-07-25`'s corpus measurement satisfying the evidence requirement.

## Inventory and adjudication

### Two constraints found while surveying

**Constraint 1 — path resolution already exists.** `resolveRepoLocalPath` in
`packages/core/src/kit-module-parse.ts` resolves `$lib/` to `src/lib/` and `./` / `../` against the
importing file, returning undefined for bare packages and for `..` segments that escape the root. It
was built for `security/shared-state-import` and already handles `src/lib/server/**`. **Path-based
L1 rules need no new parser work.**

**Constraint 2 — the option kinds cannot express most conventions.** `RuleOptionSpec`
(`packages/core/src/rule-options.ts`) offers `integer`, `string-list`, and `string-map` only.

| Shape an L3 convention needs                            | Expressible today                            |
| ------------------------------------------------------- | -------------------------------------------- |
| A flat list of globs (e.g. permitted directories)       | **Yes** — `string-list`, default `[]`, inert |
| Structured pairs (e.g. `{ from, disallow }` boundaries) | **No**                                       |
| A scalar enum (e.g. `'pascal' \| 'kebab'`)              | **No**                                       |

A rule whose convention needs the second or third shape is blocked on a second rule-options
iteration adding an enum kind and a structured-list kind. Recorded as a prerequisite spec, not as a
rejection.

### L3 revisited against a real convention document

The candidate list below was first drafted abstractly, which made "declared import boundaries" look
like the flagship L3 rule and made Constraint 2 look fatal to the whole layer. Decomposing an actual
project-wide structure document (a maintainer-authored `STRUCTURE.md` governing directory layout and
naming for a production SvelteKit app) into the **general mechanisms** svelte-vitals would ship — with
that document as the configuration, not as the rule — gives a different picture: most of it needs only
the flat kinds already available.

| Mechanism                                                                 | Conventions it expresses                                                        | Expressible today                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **M1** Unit directory ↔ same-named entry file                             | component units (`.svelte`), function units (`.ts`), store units (`.svelte.ts`) | **Yes** — `string-map` (glob → extension)            |
| **M2** Directory-name casing per location                                 | PascalCase units vs camelCase grouping; route segments; endpoint segments       | **Yes** — `string-map` (glob → case)                 |
| **M3** Closed vocabulary of reserved directory names                      | "a use these names cannot express requires updating the table first"            | **Yes** — `string-list`                              |
| **M4** Reserved name → the places it may appear                           | `parts/` only directly under a component unit, and so on                        | **Yes** — three `string-map`s (corrected 2026-08-06) |
| **M5** A unit inside a private scope must not be imported from outside it | the promotion ladder: a second importer forces the unit up                      | **Yes** — `string-list`                              |
| **M6** Nesting cap for component units                                    | flatten beyond N levels                                                         | **Yes** — `integer`                                  |
| **M7** Dynamic route segments must carry a matcher                        | `[id=integer]`, with exempt subtrees                                            | **Yes** — `string-list`                              |
| **M8** Test placement and naming                                          | tests adjacent in `tests/`; `.test.svelte.ts` vs `.svelte.test.ts`              | **Partly** — placement yes, the taxonomy no          |
| **M9** A path written in prose must resolve                               | doc and style-guide links inside component comments; a renamed unit's old name  | **Yes** — `string-list` of link shapes               |
| **M10** A filename forbidden in a location                                | `types/types.ts` and `types/index.ts`; a `.tests.ts` where `.test.ts` is meant  | **Yes** — `string-map` (location → forbidden shape)  |

Nine of the ten need no new option kind. So the sequencing claim in `2026-07-26` was **not** wrong in
the way the paragraph above first suggested: per-rule options did unblock L3, for every convention
expressible as a flat list or map. Only part of M8 waits on the second iteration.

**Corrected 2026-08-06.** This table originally recorded M4 as needing a structured-list kind. It does not:
`architecture/directory-naming`'s casing sets established that a `string-map` value carries a `|`-separated
list — the day after this charter — and M4 is expressible as such maps —
`2026-08-06-reserved-name-placement-design.md` writes a real project's whole convention table out in them to
show it. The judgement was correct on the day it was made and was not revisited when the encoding appeared.

M9 was added 2026-07-28 from field evidence rather than from reading the convention document, and its
evidence was the strongest of the mechanisms as they stood that day. (M4 later drew field evidence from
the **same** reorganisation — see `2026-08-06-reserved-name-placement-design.md` — so the superlative is
recorded as of 2026-07-28 rather than as a standing ranking.) A large reorganisation to comply with a
convention left three
kinds of dangling reference behind, all found by human review and by nothing else:

| Failure                                                                    |
| -------------------------------------------------------------------------- |
| Style-guide links in `.svelte` comments pointing at a moved path (404)     |
| A renamed unit's old name left in Markdown, comments, and `describe` names |
| Sample-code relative imports in Markdown that do not resolve               |

The first was by far the most common. None of the project's existing checks — a filename linter,
`svelte-check`, the test runner, the formatter — can see a path that exists only inside a comment or a
Markdown fence: there is no type and no module resolution to fail. Two comparisons found all of them:

- a style-guide link's path versus the `dirname` of the file holding it;
- every relative path reference in `.md` and `.svelte` resolved against the file inventory, with `.ts`
  / `.svelte.ts` extension completion.

**It needs no new collector.** `sourceFiles` (the fact M1 introduces) already carries every path under
`src/`, `.md` included. Only the shapes to treat as references — the link form, the import form — need
declaring, which is what keeps it L3. Its hard part is the precision gate: never mistaking an
arbitrary string for a path reference.

Where M1 closed "this file does not exist", M9 closes "this reference's target does not exist".

**M10** was added the same day, from the same reorganisation. It is the mechanism a filename linter
covers best, so it is listed for completeness of the inventory rather than as a gap svelte-vitals must
close: occurrences of `types/types.ts` and `types/index.ts` survived in a pre-convention tree, and a
filename linter's configuration already expresses exactly this. It is recorded
because M1's validation surfaced it and no other row covers it — its claim is "this filename may not
appear here", which is neither "a unit is missing its entry file" (M1) nor "a directory is named
wrongly" (M2).

**M1, M2 and M3 share one prerequisite**: they must see files that are not Svelte components.
Collection currently globs `src/**/*.svelte{,.ts,.js}` (`packages/core/src/component-collect.ts`), so a
plain `functions/foo/foo.ts` is invisible. `Runtime.glob` is general, so one file-inventory fact — a
collector plus a `RuleContext` field — unlocks all three at once. **M5 and M7 do not need it**: M5 works
from the existing `imports` plus `resolveRepoLocalPath`, M7 from route information already collected.

### Verdicts

| #   | Candidate                                                             | Layer | Verdict                                     | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------- | ----- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Importing a route component (`+page.svelte` / `+layout.svelte`)       | L1    | **Admit — second, after #8**                | Passes all four gates. A route entry is not a reusable unit: Kit hands it `data` / `params`, and it receives neither when imported from elsewhere — its own spec cites _Routing_ for that. Needs only the existing `imports` plus path classification — **no new facts, no new option kinds**. `Fix`: extract the shared part into `$lib`. Its spec must enumerate the exempt cases the precision gate demands.                                                                                                                    |
| 2   | Import fan-out per component (a coupling metric)                      | L0    | **Admit, pending measurement**              | Measurable over a corpus with the existing `imports` fact alone. Threshold by the per-repo p90 method. Same shape as the two shipped rules. Whether the count covers every specifier or only repo-local ones is for that rule's own spec — the two give different distributions, so it must be fixed **before** measuring.                                                                                                                                                                                                         |
| 3   | Template nesting depth                                                | L0    | **Admit, pending measurement + a new fact** | Deferred by `2026-06-30` as "needs a depth walk". Add the parser fact, then measure.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4   | A `$lib` component reading route state (`$app/state` / `$app/stores`) | L1    | **Admit, conditional on a `Project` fact**  | Official SvelteKit _Packaging → Best practices_ states it directly: avoid SvelteKit-specific modules in a package, and pass the current URL or a navigation action **as a prop** instead of depending on `$app/state`. That is both the mechanism argument and the `Fix`. But the same passage exempts packages meant only for SvelteKit consumers, and in an app `src/lib` is merely shared code — so precision requires knowing **whether the project is packaged** (`svelte-package`, `exports`). That fact does not exist yet. |
| 5   | Circular imports                                                      | L1    | **Hold**                                    | Passes the gates (the reported location is part of the cycle). Blocked on a full import graph: extension and index resolution beyond what `resolveRepoLocalPath` provides. A module-resolution spec of its own.                                                                                                                                                                                                                                                                                                                    |
| 6   | Server-only module reachable from client code                         | L1    | **Reject**                                  | SvelteKit already errors on the whole import chain, including indirect and dynamic imports (_Server-only modules_). svelte-vitals would add only earlier feedback — too little to pass mission fit. **Overlap is not the reason**; the withdrawn no-overlap condition plays no part.                                                                                                                                                                                                                                               |
| 7   | Imports between route directories                                     | L3    | **Hold**                                    | Sharing deliberately within a route group is legitimate, so this is preference, not mechanics. Expressible as a glob list, but #8 and #1 together already cover most of what it would report, leaving too little incremental value to clear the mission-fit gate on its own. Re-evaluate once both have shipped and the residue is visible. (Redundancy against another svelte-vitals rule, not against another tool — the withdrawn no-overlap condition is not in play.)                                                         |
| 8   | **M5** — a unit in a private scope imported from outside it           | L3    | **Admit — the first L3**                    | Supersedes the thinner "permitted directories for components" this row first held; M5 is the mechanism that row was reaching for. Expressible as a `string-list` of scope-marker globs defaulting to `[]`, inert until declared and consistent with additive merge semantics. Encodes the promotion principle rather than surface naming, needs no new fact, and is the one mechanism a file-local tool cannot implement at all.                                                                                                   |
| 9   | Declared import boundaries (`{ from, disallow }`)                     | L3    | **Blocked on a prerequisite**               | Constraint 2 — needs a structured-list option kind.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 10  | Component filename convention                                         | L3    | **Blocked on a prerequisite**               | Constraint 2 — needs an enum option kind.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 11  | `$effect` / `$state` counts per component                             | L0    | **Reject**                                  | No evidence that the count correlates with a problem, and no prior work to supply a reference point meeting L0's evidence standard.                                                                                                                                                                                                                                                                                                                                                                                                |

| 12 | **M9** — a path written in prose must resolve | L3 | **Admit** | Added 2026-07-28 on field evidence: style-guide links inside component comments went 404 after a convention-driven rename, invisible to every existing check and caught only by human review. Consumes the same file-inventory fact as M1/M2/M3. The link shapes must be declared, not guessed — that is the precision gate's whole weight here. |

## Sequencing

1. **#8 / M5 — private-scope import (L3).** ✅ shipped 2026-07-28. No new facts, no new option kinds.
   Gave Architecture its first between-files axis, and encodes the principle the rest of the convention
   family follows from.
2. **A file-inventory fact + M1** (`architecture/unit-entry-file`, its own spec) — the fact M1/M2/M3
   all depend on, delivered with the first rule that uses it.
3. **M2 / M3 / M4** on the same fact. M4 was listed under step 8 until 2026-08-06, on the belief that it
   needed a structured-list kind; it does not, and it belongs beside M3 whose vocabulary it constrains.
4. **#1 — route-component import (L1).** Needs nothing new; the default-on counterpart of #8.
5. **M9** — the highest-evidence mechanism, and the same fact again.
6. **#2 — import fan-out (L0).** Corpus measurement only; the fact already exists.
7. **#3 / #4** — each gated on one new fact (a parser depth walk; a packaged-project `Project` fact).
8. **Rule options, second iteration** (enum + structured-list kinds) → then the rest of M8,
   plus verdict rows 9 and 10 (declared import boundaries, component filename convention). Note the
   verdict table's row numbers and the mechanism labels are separate sequences — row 9 is not M9.

M9 sits ahead of the L0 metric work despite arriving last, because its evidence is field-measured harm
rather than a convention read off a document.

Each step is its own spec and plan.

## Out of scope (recorded, not fixed)

- **A versioned default-rule-set pin** (`ruleSet: '1.0'`). The unsolved half of the release contract
  — see above. To be settled at the 1.0 boundary.
- **Module resolution beyond `resolveRepoLocalPath`** (extensions, index files, `svelte.config.js`
  aliases). Prerequisite for candidate #5.
- **A second rule-options iteration** (enum and structured-list kinds). Prerequisite for candidates
  #9 and #10.
- **Charters for the other four categories.** Their admission standards are settled in practice; this
  charter deliberately does not generalise itself into a project-wide instrument.
- **Backfilling `Fix` on the `info` rules that lack one.** The corrected actionability gate does not
  require it, so this is an independent quality question.
- **Per-rule examined counts in the CLI** (a `--stats`-style flag). The pre-ship evidence above puts the
  count in the author's hands; this would put it in the user's, so a declaration that silently narrows
  after a tree change is visible without re-deriving it by hand. Touches the CLI surface and the
  reporters, so it is its own spec.
