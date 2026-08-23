# `setup-svelte-vitals` — a skill that derives the config, not another installer

**Date:** 2026-08-23
**Status:** Approved
**Packages:** `svelte-vitals` (new skill generator, new `--config` flag), repo-root `skills/`

## Problem

Some rules ship doing nothing. They declare options and every option defaults empty, so until a
project fills them in the rule examines nothing and reports nothing. Measured at `94a77be`:

```
architecture/directory-naming, unit-entry-file, reserved-directory-names,
reserved-name-placement, private-scope-import, doc-link-target
a11y/disallowed-element, required-element
```

Eight of them, and nothing in the product closes the gap. `svelte-vitals install`'s config target
writes a fixed template with every field commented out (`install/config-content.ts` says so in its
own doc comment) — it is a blank form, not an answer. So the likely state of these rules in the
wild is: installed, never configured, never run.

Filling the form is real work. `architecture/reserved-directory-names` alone takes `scopes`,
`unitScopes`, `anyCaseUnitScopes` and `exclude`, and the difference between the first three is
documented on the rule's page and nowhere else — `RuleOptionSpec` carries no description field.
A user has to read six rule pages and invent their own conventions in glob form before any of it
runs.

Two facts make this tractable for an agent rather than a form:

- A project already running **markuplint** or **eslint-plugin-check-file** has answered most of
  these questions in another file. The answers are sitting there.
- A project running neither has still answered them implicitly, in how its directories are
  actually named. That is measurable.

## Non-goals

- **Not a second installer.** File placement, the Vite plugin, hooks and the CI workflow stay with
  `svelte-vitals install`; the skill calls it and does not reimplement it.
- **Not a CLI feature.** Reading someone's markuplint config and deciding what it implies is
  judgment, not a transform. It belongs in a skill, where being wrong is a conversation rather
  than a silent bad write. The one CLI addition here (`--config`) exists so the skill can measure,
  not so the CLI can derive.
- **Not an autofixer.** The skill writes a config file. It never edits source to satisfy a rule it
  just enabled.

## Shape and shipping

```
packages/cli/src/install/setup-skill-content.ts   new generator
skills/setup-svelte-vitals/SKILL.md               gen:skills output, distributed via `npx skills add`
```

Third skill in the existing pipeline, covered by `test/skills-repo.test.ts` for drift like the
other two. Deliberately **not** an `install` target: installing the setup skill through the
installer is backwards.

The body is two layers.

**Generated from `allRules`** — for every rule that declares options: the rule id, each option's
name, `kind`, default, whether the rule is inert (every option empty), the docs URL, and for a
`string-list` its `pattern.describe` grammar where one exists (today `a11y/disallowed-element` and
`a11y/required-element` both reserve "a bare tag name"). This layer cannot state what an option
_means_, because that is not in the data — so it ends each entry at the docs URL, and the workflow
below requires opening it.

Also stated once, generated or not: collection options **add to** the rule's built-in default
rather than replacing it (`rule-options.ts`). Immaterial for the eight inert rules, wrong to
assume for the rest.

**Handwritten** — the workflow, the mapping tables, how to phrase the questions, how to read the
measurement.

## Workflow

### Phase 1 — Inspect

No questions yet. Read: the SvelteKit shape (adapter, prerender, SSR), `package.json`
dependencies, an existing `svelte-vitals.config.*` or `svelte-vitals-suppressions.json`,
`markuplint.config.*` / `.markuplintrc`, check-file settings inside `eslint.config.*`, and the
actual naming distribution under `src/lib` and `src/routes`.

### Phase 2 — Derive

Build a candidate config, keeping three provenances apart because they carry different confidence:

- **Copied** from a neighbouring config, through the tables below.
- **Inferred** from the tree, as a distribution: "`src/lib/components/` is 42/45 PascalCase, 3
  exceptions". Below roughly 80% agreement there is no convention to encode — do not propose one.
- **Asked**: `failOn`, `treatDynamicAs`, `weights`. Ask only where the default would be wrong for
  this project; a default that fits is not a question.

### Phase 3 — Measure, before writing

Write the candidate to a scratch path and run the real scanner against it with `--config`. Report
per rule, per candidate value:

```
architecture/directory-naming   kebab-case → 47   camelCase → 3
a11y/required-element ['main']  → 12 routes
```

Forty-seven findings is not a convention the project has; it is a wrong guess, visible before
anything is written.

### Phase 4 — Decide, per rule

Never one bulk question. Each rule gets its count and three options: adopt, skip, or adopt and
absorb today's findings with `--update-suppressions`. Different counts deserve different answers.

### Phase 5 — Write and confirm

Write `svelte-vitals.config.*`. An existing config is never overwritten — show the diff and let
the user apply it. Then run a full scan and report the Health score and the adopted rules' counts.

## Derivation sources

### markuplint

Most of it is a name match. These markuplint rules map to `a11y/<same name>`, verified against
`allRules`:

```
permitted-contents  required-element  disallowed-element  deprecated-element
deprecated-attr  id-duplication  label-has-control  use-list
placeholder-label-option  require-datetime  doctype  accessible-name
```

So the rule is "`a11y/<markuplint name>` when it exists in `allRules`", and only the exceptions
are written down:

| markuplint                                                                                                                                                                                                 | svelte-vitals                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `wai-aria` (umbrella)                                                                                                                                                                                      | `a11y/invalid-role`, `unknown-aria-attribute`, `required-aria-props`, `invalid-aria-value`, `disallowed-aria-props`, `deprecated-aria` |
| `landmark-roles`                                                                                                                                                                                           | `a11y/duplicate-landmark`, `a11y/top-level-landmark`                                                                                   |
| `no-refer-to-non-existent-id`                                                                                                                                                                              | `a11y/no-missing-id-ref`                                                                                                               |
| `required-h1`                                                                                                                                                                                              | `seo/single-h1` — SEO, not a11y                                                                                                        |
| `heading-levels`                                                                                                                                                                                           | `seo/heading-level-skip` — SEO, not a11y                                                                                               |
| `required-attr`, the img/alt part                                                                                                                                                                          | `seo/image-alt`                                                                                                                        |
| `attr-duplication`, `end-tag`, `case-sensitive-*`, `character-reference`, `attr-value-quotes`, `no-boolean-attr-value`, `no-default-value`, `class-naming`, `no-hard-code-id`, `no-use-event-handler-attr` | none, by design — the Svelte parser guarantees these or they are formatter territory. Ignore them whether set true or false            |

A rule set to `false` in markuplint maps to `'off'` in `rules`. `disallowed-element` and
`required-element` carry values rather than a boolean: their element lists become the `elements`
option, subject to the "bare tag name" grammar the option reserves.

`pretenders` (`{ selector: 'Link', as: 'a' }`) is not config to copy — it is markuplint
compensating for not resolving components. Read it as a hint about which local components stand in
for elements, and check whether any belong in `metaComponents`.

### eslint-plugin-check-file

Thin, honestly. One rule converts:

| check-file                                                | svelte-vitals                                                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `folder-naming-convention`                                | `architecture/directory-naming.directories` — same glob-keyed map shape, casing vocabulary converted |
| `filename-naming-convention`                              | none — svelte-vitals has no file-name casing rule                                                    |
| `filename-blocklist`, `folder-match-with-fex`, `no-index` | none                                                                                                 |

svelte-vitals accepts exactly four casings (`camelCase`, `PascalCase`, `kebab-case`,
`snake_case`), and a value may be a union (`'camelCase|PascalCase'`). check-file's
`SCREAMING_SNAKE_CASE`, `FLAT_CASE` and custom-glob conventions have no target: **report them as
unconvertible rather than dropping them silently.**

The consequence is that check-file corroborates one rule, and the tree inference carries the rest
of the architecture category.

### Dependencies and code

`svelte-seo`, `svelte-meta-tags` and local meta components (the source provider already has
adapters for the first two) determine `metaComponents`. The adapter and prerender configuration
inform the recommended `treatDynamicAs`.

## `--config <path>`

Config is loaded today only from the analyzed directory, by fixed filename (`config-file.ts`,
`CONFIG_FILENAMES`). There is no way to score a candidate without writing it into the project
first, which would make a setup skill mutate the thing it is still asking about.

`--config <path>` skips discovery and loads the given path. Missing, unreadable or malformed exits
`2`, matching how a broken config already behaves. Flags continue to override config values.

Per the user-facing-lever rule in AGENTS.md this needs guard (1): a kitchen-sink e2e case
asserting an observable effect — the same project scanned with two different config paths produces
different results, so the flag cannot become a no-op. Guard (2) does not apply: a config path
either loads or errors, so there is no "selected nothing" state to warn about.

Obligations that come with a flag: `gen:cli-reference` for the en/ja flag tables,
`packages/cli/docs/config.md` plus `gen:docs`, the config guide on the site in en and ja with
`translate:stamp`, and a changeset.

## Guards

- Drift of the generated skill file: `skills-repo.test.ts`, once `gen-skills.js` emits the third
  skill. No new mechanism.
- **New test** — every svelte-vitals rule id named in the handwritten mapping tables exists in
  `allRules`. A renamed or retired rule breaks the build instead of sending the skill to a dead id.
- **New test** — every option name the tables reference exists on that rule's options spec
  (`directories`, `elements`).
- `flag-coverage.test.ts` requires `--config` to be named by some test; the e2e case above covers
  it.
