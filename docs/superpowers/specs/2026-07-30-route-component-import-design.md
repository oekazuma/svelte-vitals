# architecture/route-component-import — design

**Date:** 2026-07-30
**Status:** approved, **sequenced second**
**Charter row:** verdict #1 — importing a route component (L1)
**Blocked on:** SvelteKit alias resolution, which measurement moved ahead of this rule. See
"Why this waits" below.

## The problem

A SvelteKit route entry — `+page.svelte`, `+layout.svelte`, `+error.svelte` — is written on the
assumption that Kit renders it. Kit hands a page its `data` and `params`; it hands an error page its
`page.error` and `page.status`. Imported from somewhere else, the component receives none of that and
renders against nothing.

The mistake is easy to make and reads as reasonable: another page needs the same markup, the markup
already exists in a `+page.svelte`, so it gets imported. Nothing in the toolchain objects. The
component renders — emptily, or with the importing page's data standing in for its own.

## Where it sits

The charter's first **L1** admission: the claim comes from framework mechanics, not from a project's
preference. That makes it the first Architecture rule that is **on by default**, which changes the
weight of the precision gate. The three L3 rules shipped before it assert nothing until configured, so
a design error there costs a user nothing; here it reaches everyone.

**Mission fit.** Requires knowing what a route entry is and what Kit passes it — SvelteKit semantics a
file-local tool cannot have.

**Precision.** Every exempt case is enumerated below, and the enumeration is short for a structural
reason: the fact set only covers `.svelte`, `.svelte.ts` and `.svelte.js` files, so the largest
legitimate consumer of a route component — a plain `.ts` test — is invisible before any rule logic runs.

**Actionability.** The finding sits on the import, and the remedy is one sentence: extract the shared
markup into a component under `$lib` and import that from both places.

**Default stance.** On, at `info` — the landing severity every new rule takes.

## Design

### Identity

|                |                                        |
| -------------- | -------------------------------------- |
| id             | `architecture/route-component-import`  |
| category       | architecture                           |
| severity       | `info`, on by default                  |
| scope          | `component`                            |
| facts consumed | `ComponentFacts.importSpans`, extended |
| harness        | `componentRule`                        |

### The check, in four steps

1. **Skip type-only imports.** A `import type P from './+page.svelte'` is erased at build; nothing
   renders, so the harm the rule describes cannot occur. Reporting it would be a false positive.
2. **Resolve the specifier to a repo-relative path.** `$lib/` and relative specifiers resolve; a bare
   package does not.
3. **Require the resolved path to be a route entry**: under the routes directory, with a basename
   matching `/^\+(page|layout)(@[^./]*)?\.svelte$/` or equal to `+error.svelte`. Seven names, the
   `@` forms included, because a breakout entry is an entry.
4. **Require the importer not to be exempt** — see below.

Steps 2 and 3 are separate on purpose. A file named `+page.svelte` outside the routes directory is not
a route entry: Kit gives those names meaning only under `src/routes`.

### `+error.svelte` is included, though its mechanism differs

`+page.svelte` and `+layout.svelte` receive `data` and `params` as props. `+error.svelte` receives
nothing; it reads `page.error` and `page.status` from `$app/state`. Imported elsewhere it still renders,
and still renders wrongly — it shows the state of a page that has no error.

Both are the same failure at the level the rule states its claim: **a Kit entry is not a reusable
unit, and importing one strips the context it was written for.** That framing covers all seven names
without special-casing.

### Exempt importers

A `string-list`, `exemptImporters`, whose **default carries the built-ins** — so the merge semantics of
that option kind (append to the default, never replace) give users extension for free, and
`explain_rule` shows them what they are extending:

```js
exemptImporters: ['**/*.stories.svelte', '**/*.test.svelte', '**/*.spec.svelte'];
```

These are ecosystem conventions: a story renders a component to look at it, a test renders it to assert
on it, and both legitimately supply by hand what Kit would have supplied. Matching is by glob, so
`Foo.error.test.svelte` is exempt under `**/*.test.svelte` — the `*` is a within-segment wildcard, and
`Foo.error` sits inside it.

**The default is deliberately narrow, and the reason is that the option can only widen it.** A
`string-list` appends; nothing removes an entry. So the two failure directions are not symmetric:

| If the default is | The failure is         | Can a user fix it?                        |
| ----------------- | ---------------------- | ----------------------------------------- |
| too narrow        | a false positive       | **yes** — append to `exemptImporters`     |
| too broad         | a missed true positive | **no** — a `string-list` cannot be shrunk |

Only the narrow side leaves the user a lever, which decides it. An earlier draft widened the default to
"any `.svelte` file whose basename carries a second dot", on the theory that a doubled extension always
marks a satellite file; measurement (below) supports that theory but the asymmetry above overrides it.
Configuration is therefore an expected step for a project whose satellite convention is its own, not an
exceptional one, and the rule page says so.

### `applies` and `bad`

`componentRule` treats `applies` as "does this file carry the signal at all" — false means neither a
penalty nor a seeded pass. The assignment:

- **`applies`** — the file imports at least one route entry, exempt or not.
- **`bad`** — those imports, or nothing when the importer is exempt.

So an exempt story file gets a **pass**, which is the true statement that its route-entry imports are
fine. Putting the exemption into `applies` instead would call such a file signal-free, which it is not.
A file importing no route entry produces nothing either way.

### The fact extension, and one thing it does not do

`importSpans` gains an optional `type?: true`, set when the declaration's `importKind` is `type`. It is
read by two shipped rules — `performance/heavy-import` and `architecture/private-scope-import` — and an
added optional field changes neither.

Worth recording rather than losing: **the extension makes a latent correction available to
`performance/heavy-import`**, which today counts a type-only import of a heavy package as a runtime
cost it does not have. That is a shipped rule's behaviour and not this rule's business, so it is not
taken here. Recorded for its own decision.

## Why this waits: measured reach

The design above was measured against a real monorepo of several SvelteKit apps, on a
convention-compliant branch. Three results, in order of how much they changed the plan.

**No route entry is imported anywhere, by any file type.** A repo-wide search across `.svelte`, `.ts`
and `.js` found nothing, and the search pattern was validated first against a synthetic file carrying a
relative import, an alias import with an `@` breakout, and a type-only import — all three matched. So
the tree is genuinely clean; the rule would report nothing and miss nothing on it.

**The built-in exempt list covers a minority of that tree's satellite files.** Its own convention — not
one of the three built-ins — accounts for the large majority of them, and neither `*.stories.svelte` nor
`*.spec.svelte` occurs at all. One tree is not evidence against an ecosystem convention, so the
built-ins stay; what it does show is that configuration will often be needed, which the rule page now
states plainly instead of treating as an edge case.

**A custom alias is used more widely there than `$lib`, which that repo deliberately forbids.** This is
what re-sequenced the work. `resolveRepoLocalPath` resolves `$lib/` and relative specifiers only, so in
a repo that has standardised on its own alias, **this rule ships as a no-op** — its reach is empty even
though its precision is perfect. The charter recorded alias resolution as a light pre-1.0 constraint;
that estimate does not survive the measurement.

Two things follow. Alias resolution goes first, as its own spec, because it lifts the reach of
`architecture/private-scope-import`, `security/shared-state-import` and `performance/heavy-import` at
the same time. And its design has to consider that an alias value can point **outside** the app it is
declared in — one of the measured configs aliases another app's `src` — which `resolveRepoLocalPath`
currently rejects as escaping the root.

This spec depends on the **contract** `resolveRepoLocalPath` already offers — a specifier and an
importing file in, a repo-relative path or `undefined` out — not on how it resolves. Widening what it
resolves widens this rule with no change here.

## Deliberately not solved

- **Dynamic `import()`.** Not an `ImportDeclaration`, so it is absent from `importSpans`. The same
  mistake, invisible.
- **Imports from plain `.ts` / `.js` files.** Not in the fact set at all. This is load-bearing rather
  than regrettable: it is why the exempt list can be three entries long instead of an open-ended guess
  at every project's test-file convention.
- **A routes directory other than `src/routes`.** `kit.files.routes` is read nowhere in the repository;
  the whole analyzer assumes the default. This rule inherits that assumption rather than fixing it.

## Testing

1. **Mechanism** — all seven names; an `@` breakout form; a file of the same name outside the routes
   directory drawing nothing; `$lib/` and relative specifiers both; a bare package ignored.
2. **Exemptions** — each built-in pattern; a suffixed form (`Foo.error.test.svelte`) exempt under
   `**/*.test.svelte`; a pattern appended through the option; and an exempt importer receiving a
   **pass** rather than silence.
3. **Type-only imports skipped**, verified by reverting the fact extension and watching that test fail —
   a test for an exemption that would pass without the mechanism is worth nothing.
4. **The extension is backwards compatible** — the existing suites of `performance/heavy-import` and
   `architecture/private-scope-import` pass **unedited**.

## Deliverables

- `packages/core/src/rules/architecture/route-component-import.ts`, built on `componentRule`.
- `importSpans` gains `type?: true` in `packages/core/src/component.ts` and its parser.
- Registration in all four places, and the regenerated rule-index pages.
- `docs/src/content/docs/rules/architecture/route-component-import.md` and its Japanese counterpart.
- `configuration.mdx`, English and Japanese.
- A changeset. This is the first default-on Architecture rule, so the changeset says what a project
  that does nothing will now see.
