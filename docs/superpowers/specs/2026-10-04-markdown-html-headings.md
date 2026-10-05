# An `<h1>` in markdown a page renders with `{@html}`

Status: the component form is handled (below); the `{@html}` forms are measured and not pursued. Revisit
them when a cheaper signal than resolving the markdown source exists.

## Problem

`seo/single-h1` reports "Missing `<h1>`" on a route whose only `<h1>` comes from markdown the page
renders as HTML: a load reads a committed `.md` file, converts it with marked, markdown-it, showdown or
an MDX renderer, and the page outputs the result with `{@html}`. Source analysis cannot see a heading
inside `{@html}`, so the claim is false wherever the markdown opens with `# `.

The class recurs. Holdouts 15–17 and 20 met it in one app each; holdout 21 met it in two (banklab, nine
routes; Codex, one) and failed C6 on it. In the tuning corpus (307 apps) the ledger has 24 such false
positives across 10 apps, out of 185 "Missing `<h1>`" false positives. A related shape, an mdsvex `.md`
or `.svx` module rendered as a component, adds 10 more across 6 apps.

## How the markdown reaches the page

The 10 apps load it in six different ways:

| Mechanism                                                                         | Apps                                    | False positives |
| --------------------------------------------------------------------------------- | --------------------------------------- | --------------- |
| A `?raw` import in the route's own files, passed to the component that renders it | pulse                                   | 4               |
| `import.meta.glob` in a `$lib` helper, the entry picked by a route parameter      | Codex, smart-job-seeker, echobell (MDX) | 4               |
| A `$lib` helper given a literal slug, which imports `` `…/${slug}.md?raw` ``      | banklab                                 | 9               |
| `readFile` of a path built from a literal or a parameter                          | aid-ly, Entropia-Nexus                  | 3               |
| Content fetched from another repository at build time                             | dsh                                     | 2               |
| Markdown stored in the database (seeded on setup)                                 | tierdom                                 | 1               |
| Not determined from the basis                                                     | raksara                                 | 1               |

Only the first row is visible from the route's files alone. Every other row needs the analyzer to
follow a call from the load into a `$lib` module and evaluate how that module turns its arguments into a
file (a glob keyed by a parameter, a template string, a path join), and the last two are not in the
checkout at all.

## Options measured

Each option treats a qualifying `{@html}` as a heading of unknown level, so the route is not reported as
missing an `<h1>`, the way an undeterminable `<svelte:element>` already is. Measured on the 307 corpus
apps against the committed verdicts:

| Option                                                                                          | False positives removed | tp lost |
| ----------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| `{@html}` whose expression names markdown or ends in `.html` (`marked(body)`, `data.post.html`) | 16                      | 40      |
| The same, only in apps that import a `.md` file (`?raw`, `import.meta.glob`, `from '….md'`)     | 16                      | 9       |
| Every `{@html}` (measured after holdout 15)                                                     | —                       | 364     |

The tp lost are routes whose `{@html}` really renders no `<h1>`: user-authored markdown (wiki pages,
READMEs, posts) and committed markdown that opens below level 1 (banklab's `/archive` starts at `##`).
Telling them apart needs the markdown itself.

Resolving the source per route (reading the `.md` and checking for a leading `# `) would keep the tp,
but it means interprocedural evaluation of glob keys, template strings and path joins across modules,
plus file reads the I/O budget (`packages/cli/test/io-budget.test.ts`) does not have room for. The first
row alone (route-local `?raw`) is cheap, but covers 4 of the 24.

## Markdown rendered as a component

An mdsvex `.md`/`.svx` module imported into a page or component is resolved like a `.svelte` file and
read for its ATX headings (front matter and fenced code skipped), so its `# `/`## ` headings count where
it renders. A component held in a `let` with `$derived` or assigned by a legacy `$: Content = …` is
followed like one in a `const`; when it holds one of several modules (a language switch) that each
always render a heading, a heading of an undetermined level holds its place for
`seo/heading-level-skip`. This needs no data flow: the import names the file. Holdout 24 met this form
in the Holmström website (33 false positives), and four ledger false positives had it (steaminputdb.com,
dotsem.be). A module a `load` returns or `import.meta.glob` picks by a parameter (utsuwa, biubiu.tools,
dxlbnl) is not named by an import, needs the data flow below, and stays open.

## Decision on `{@html}`

Not pursued. Neither name-based option is acceptable: each removes false positives by dropping real
findings, and the source-resolving design costs a data-flow engine for a class that reaches one or two
apps a holdout. The class stays listed under "Left open" in each holdout fix and counts against C6 like
any other when two apps meet it in one holdout.

Revisit if a signal appears that separates committed markdown with a leading `# ` from everything else
without reading the files, or if the class starts deciding results every round.
