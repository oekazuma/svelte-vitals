# architecture/doc-link-target — design

**Date:** 2026-08-03
**Status:** approved; field-checked 2026-08-03
**Charter row:** verdict #12 — M9, "a path written in prose must resolve" (L3)

## The problem

A convention-driven reorganisation left dangling references behind that no existing check could see. A
style-guide link written inside a component comment has no type and no module resolution to fail, so a
filename linter, `svelte-check`, the test runner and the formatter all pass over it. The 404s were found
by human review and by nothing else.

## What measurement changed

The charter recorded M9 from field evidence, and a second field measurement reshaped it. Three of its
premises did not survive.

**The dominant form is not a relative path.** The references that actually 404'd are **absolute URLs whose
path mirrors the repository path** — 115 of them, all in `.svelte` comments. A rule resolving relative
paths would have caught none of them.

**`sourceFiles` suffices for that form and for no other.** The URL form sits 115/115 inside `src/`. The
files carrying pure Markdown links sit **0 of 17 inside it** — convention documents live at the repository
root and under `.github/`, which the `src/**/*` inventory never sees. (17 counts files; the 67 links below
counts links.)

**One of the charter's three failure categories is out of reach in principle.** "A renamed unit's old name
left in `describe` names and comments" is an identifier, not a path reference. Nothing resolves it.

And a fourth correction, to the charter's own claim that M9 "needs no new collector": no new **collector**
is needed — no I/O, no glob — but a new **fact** is, because `ComponentFacts` carries neither comment text
nor raw source. `collectSuppressions` reads the source directly inside the parser and its findings never
reach a fact.

## Scope: the URL form only

The three measured categories are effectively three rules. This spec is the first.

| Form                            | Referencing file                  | Count | Resolution basis                      | v1      |
| ------------------------------- | --------------------------------- | ----- | ------------------------------------- | ------- |
| **URL mirroring a repo path**   | `.svelte` comments, inside `src/` | 115   | strip a declared URL prefix           | **yes** |
| Markdown relative / bare links  | `.md`, **outside** `src/`         | 67    | file-relative, directory refs allowed | no      |
| Relative imports in code fences | `.md`                             | 84    | the **consuming** file, not the `.md` | no      |

Taking the URL form first is not a convenience. It is the category the charter's evidence is actually
about, it is the only one whose referencing files the existing inventory sees, and — as the precision
section below shows — it is the only one where the false-positive hazard can be closed by declaration
rather than by guesswork.

## Design

### The declaration: one URL prefix per project root

Measurement found the prefix to strip has two shapes, because a monorepo's workspace layout leaks into the
published URL:

```text
app        .../components/<ws>/src/lib/…            → strip ".../components/<ws>/"
package    .../components/packages/<ws>/src/lib/…   → strip ".../components/packages/<ws>/"
```

**Deriving it is impossible.** Stripping the run directory's basename misses every package-side reference;
stripping the type directory plus basename misses every app-side one. There is no rule that covers both,
because whether the type directory appears is a property of the publishing scheme, not of the tree.

So it is not derived. One option, `urlRoots`, is a `string-list` whose entries are **URL prefixes that
stand for this project's root**:

```js
'architecture/doc-link-target': {
  options: { urlRoots: ['https://example.test/components/packages/ui/'] }
}
```

The asymmetry disappears because the whole prefix is one declared string — whether it contains
`packages/` is now a fact about the string, not a branch in the resolver.

`string-list` is the right kind for its merge semantics: entries **append** to the default, so a project
reachable under a second host (a staging deployment, a renamed domain) adds one without removing the
other. The default is empty, which makes the rule inert until declared — L3, as the charter requires.

### The fact: links found in comments

`ComponentFacts` gains

```ts
commentLinks?: { url: string; line: number }[];
```

populated during `parseComponentFacts` by a **line-oriented text scan**, matching
`collectSuppressions`'s existing approach rather than walking an AST — a link inside a comment is not a
node, and the two Svelte comment forms (`<!-- … -->` in markup, `// …` in a script) are both plain text at
that point. Only the Markdown link form `[label](url)` is extracted, which is what measurement found; a
bare URL in prose is not a reference to anything the rule can check.

Two scope decisions measurement settled rather than left to judgement:

- **Bare URLs are not references.** Comments carry 16 of them, and **none contains a repository path** —
  they point at external services. Outside comments there are 545 more, which is the strongest argument for
  looking only inside comments.
- **The markup form is the only one in use** — 115 of 115 sit in `<!-- … -->`, with none in a script
  comment. Scanning script comments too costs nothing and generates no false positives, because
  `[label](url)` appears **nowhere** outside a comment; it is insurance, not coverage of a measured case.

No new I/O: the parser already holds the source.

**One implementation hazard, which following `collectSuppressions` avoids for free.** A scanner that treats
`//` as "comment starts here" will fire inside `https://`. `collectSuppressions` does not scan for a comment
opener — it matches a whole line against an anchored pattern — so a scan built the same way cannot make that
mistake. Do not replace it with "split on `//` and read the rest".

### Resolution

For each `commentLinks` entry, in order:

1. Strip a trailing `#fragment` or `?query` from the URL. Either addresses a location **within** the
   target, not the target's own path, so leaving one in place would make an existing target look broken.
2. Find the **longest** declared `urlRoots` entry the URL starts with, matched at a path-segment boundary
   so a root declared without its own trailing slash cannot match past a partial segment (`.../ui` must not
   match `.../uiOther`). **No match → ignore the link entirely.**
3. Strip it. Both the declared root and the remainder are normalised free of trailing slashes first — a
   directory link written the ordinary way (`.../Card/`) has to resolve too, doubled slash and all. What is
   left is a path relative to the analysed project root, the same base `sourceFiles` uses.
4. A remainder that doesn't start with `src/` is **silent**, the same gate as an unmatched URL one level
   in: the inventory globs `src/**/*`, so absence from it means "unindexed", not "missing" — a root-level
   `CONTRIBUTING.md` or a `static/` asset would otherwise be reported despite existing. The two remainders
   that name no target at all — empty, or a bare `src`, both produced by a link to the declared root itself
   — fail this same gate, so they too produce no finding.
5. Report when the remainder names **neither an existing file nor an existing directory**.

**Directory matching is not a courtesy — it is the only reason this rule works.** Measurement is
unambiguous: **114 of 114 targets are directories**, every one a unit directory holding a same-named
`.svelte`, and **not one resolves as a file**. (An earlier report described them as resolving to files;
that was an artefact of an existence check trying extension candidates, and was corrected on review.)

`sourceFiles` is a list of files, so **a directory never appears as an entry**. A resolver that checks only
for a file therefore reports **every measured reference as broken** — all 114. The directory test is
"some entry starts with `<path>/`", and it is a precondition, not an enhancement. An implementation that
lands file matching first and directory matching later is not partially correct; it is entirely wrong on
the only data we have.

File matching is kept anyway, for the reference that points at a file rather than a unit. It is the case
measurement did not find, not the case to build first.

**Longest prefix wins, because entries can nest.** `string-list` appends, so a project may declare several
roots, and one can be a prefix of another — `https://host/components/` beside
`https://host/components/packages/ui/`. Under first-match-wins the answer would depend on declaration
order: the shorter entry strips less, leaving `packages/ui/src/lib/A`, which is not a path relative to the
analysed project. That produces a false positive when the remainder does not exist and, worse, a **silently
missed broken reference** when it accidentally does.

This is deliberately the opposite of `architecture/private-scope-import`'s alias resolution, which takes the
**first** match. That rule reproduces a bundler's own behaviour and fidelity is the requirement; here there
is no external authority to match — the list is ours, so the semantics can be the ones that cannot surprise.

### Precision: unmatched URLs are silent, and that is the whole gate

Measurement found 17 link targets that look like paths and are not — documentation slugs — and established
that **shape cannot separate them**: slugs have no slash and no extension, but so do the 13 legitimate
directory references. Any rule that decides by shape gets one of those two groups wrong.

The alternative, "report only what fails to resolve", is worse: it silences the broken references the rule
exists to find.

Restricting the rule to URLs under a declared prefix closes it. An external link, a documentation slug, a
`mailto:`, and the one measured URL that carries no path at all are all silent — not because they resolved,
but because they were never claimed as references. **The declaration is the filter**, which is what makes
this rule's precision gate satisfiable at all, and why the URL form is the right first scope.

## Deliberately not solved

- **Markdown relative and bare links** (67 measured). Blocked on collection scope: the referencing files
  sit outside `src/`, and `sourceFiles` globs `src/**/*`. Widening it is a separate decision with its own
  I/O budget consequences.
- **Relative imports in code fences** (84 measured). Blocked on resolution basis: 72 of them are written
  relative to the _consuming_ file rather than to the `.md` holding them, so resolving against the `.md`
  would be 93% false positives. Needs either exclusion or a declared base directory — a design question,
  not an omission.
- **A renamed unit's old name in identifiers.** Not a path reference; no resolution to fail. Recorded so
  the charter's third category is not later mistaken for a gap this rule left.
- **Cross-workspace references.** Measured at **0 of 115**, so single-project scope suffices. A reference
  escaping the analysed project would strip to a path `sourceFiles` cannot see; if that ever appears, it
  is a scope change, not a bug.
- **M10 (a filename forbidden in a location).** Declined. The charter already recorded it as "listed for
  completeness rather than as a gap svelte-vitals must close", and the field check confirmed a filename
  linter is already positioned to express it.

## Testing

1. **A link under a declared prefix, pointing at a missing path, is reported** — and the same link is
   silent when no `urlRoots` entry is declared. The second half is the L3 guarantee.
2. **Both prefix shapes work from one declaration each** — one entry containing a type directory, one
   without. This is the measured asymmetry, and a test with only one shape would pass over a resolver that
   re-derived the prefix instead of using the declared string.
3. **An existing target is silent, as a directory and as a file — the directory case first.** All 114
   measured targets are directories and none is a file, so the directory case is the one that decides
   whether the rule works at all; assert it against a `sourceFiles` list containing only files _under_ that
   directory, since that is how a directory appears. A suite that covers only the file case would pass over
   a resolver that reports every real-world reference as broken.
4. **An unmatched URL is silent** — an external host, a documentation slug with no slash, and a URL with no
   path. All three were measured; none may produce a finding.
5. **A second `urlRoots` entry does not displace the first**, exercising `string-list` append semantics
   with two hosts resolving the same reference.
6. **A nested entry does not shadow a longer one.** Declare `https://host/components/` and
   `https://host/components/packages/ui/` together, in that order and reversed, and assert the same
   resolution both ways. Order-dependence here fails silently when the shorter strip happens to leave an
   existing path, so a test asserting only one order proves nothing.
7. **Both comment forms are scanned** — the markup `<!-- [label](url) -->` and a script `// [label](url)`.
   Measurement found only the markup form; the script form costs nothing and a scan written for one would
   silently miss the other.
8. **A link outside a comment is not a reference.** A `[label](url)` in rendered markup is content, not a
   reference to a repository path. Measurement found none, so this pins a property the tree currently has
   rather than fixing a live false positive.
