# Config-driven element rules — `disallowed-element`, `required-element`, and the selector question

Roadmap Phase C-10 (the a11y design's "Phase 3"): two rules whose entire content is what the user
declares, plus a decision the roadmap flags as config-schema-affecting and therefore pre-freeze —
whether svelte-vitals grows a second scoping vocabulary (CSS selectors, as file-scoped markup linters
use) beside the `overrides` globs it already has.

Nothing here is measured against a corpus in the way the C-9 rules were: a rule that reports what a
project declared fires exactly as often as the project declares. What is inspected is the cost side —
what facts each rule needs, and whether they are already collected — and one closure predicate is
measured (decision 4).

## Decisions

### 1. Both rules are `a11y/*`, off by default, and inert until configured

The a11y design placed them; they stay there. Both follow `architecture/unit-entry-file`'s
convention for declaration-driven rules: an empty declaration list by default, so the rule is inert
until a project declares something, with `options` declared through `RuleOptionsSpec`. Their
built-in severity is `warning`, so `{ options: { elements: [...] } }` alone is enough to turn one
on. Neither goes through `componentRule`'s per-file option resolution when nothing is declared:
`applies` returns false on an empty list, which is the cheapest precondition the factory offers. A
configured project:

```js
rules: {
  'a11y/disallowed-element': { severity: 'warning', options: { elements: ['iframe', 'marquee'] } },
  'a11y/required-element':   { severity: 'warning', options: { elements: ['main', 'h1'] } }
}
```

Both `elements` options are `string-list`, so per the rule-options design they **add** to the
default (empty) rather than replace it, and an `overrides` entry can extend the list for a route or
file glob (`{ files: 'src/routes/(marketing)/**', rules: { 'a11y/disallowed-element': { options: { elements: ['iframe'] } } } }`).

### 2. Declarations are bare tag names — validated as such — and the scoping vocabulary stays `overrides`

The "selector question" has two halves, and only one is a schema question.

**Where a declaration applies** is answered by `overrides`: it scopes any rule's severity and options
to route globs and file globs, every rule inherits it, and the a11y design's other selector need —
per-element overrides — is answered by the inline directive. A CSS-selector scope would be a second
"where" with its own matcher, its own precedence against `overrides`, and its own selected-nothing
story; it is not added, and that is the decision the roadmap wanted made.

**What a declaration names** is a grammar question, and leaving it open is the mistake: the public
surface is frozen against _reinterpretation_, and a `string-list` accepts `'input[type=file]'` today
as a tag name that matches nothing — giving it meaning later would reinterpret an accepted value.
So the grammar is reserved now: a declaration is a **bare tag name**, `^[a-z][a-z0-9-]*$` after
lowercasing, and anything else (`[`, `=`, `.`, `#`, `>`, `*`, `:`, whitespace) is rejected at
config load with a message naming the value, the way a wrong option kind is. That makes a later
attribute-qualified form (`'input[type=file]'`) pure growth. It is not added now — not because
nothing needs it (that was never measured) but because it is unmeasured, and `ElementFact.attrs`
already carries lowercased attribute names, so a `tag[attr]` presence form would be a zero-collection
lookup when the demand is shown. Names the vendored spec data does not know are accepted: a project
may disallow its own `<my-widget>`.

`RuleOptionSpec`'s `string-list` kind gains an optional `pattern` (a `RegExp` and its description)
for this; `validateRuleOptions` applies it. Generic, so the next declaration-driven rule reserves its
grammar the same way.

**A declaration that matches no element is not warned about.** An earlier draft said the opposite,
by the wrong analogy — an unknown directive _id_ can never be right, but a disallowed tag with zero
occurrences is the rule doing its job: the code is clean, the per-file passes say so, and warning on
it every run is how a warning gets tuned out. AGENTS.md's worked example for "legitimately selects
nothing" is exactly this shape. Typo protection is the grammar check above.

### 3. `disallowed-element` is component-scoped and reads `ElementFact`

Every element in every component is already collected with its lowercased tag (`ElementFact`, from
the deprecated-element work), so the rule is a lookup: an occurrence whose tag is in the declared list
is a finding, anchored at the start tag (the directive-reachability convention). Namespace is not
consulted: a project that disallows `iframe` means every `<iframe>`; SVG-only names
(`foreignObject`) simply never match HTML markup. `<svelte:element this="iframe">` is not seen —
`collectElements` skips dynamic tags even with a literal `this` — and the docs say so.

### 4. `required-element` is route-scoped; presence is open-world, absence is not

"Every route must contain a `<main>`" is a claim about the composed page: a `+page.svelte` that
renders `<Hero />` may get its `<h1>` from the component, and the layout usually owns `<main>`. The
file-scoped alternative — "every file matching this glob contains `<h1>`", declaration-driven and
closed at file granularity — was considered and rejected on its own terms, not on the unscoped
strawman: even scoped to `src/routes/docs/**/+page.svelte`, a page whose heading comes from a shared
`<DocHeader />` is a false positive, and every SvelteKit app of size has that shape. The composed
route is the unit this tool is built around; a per-file variant could return later as an additive
option if a real project asks for it, and would then be a scoping decision, not a grammar one.

Facts: the source composition gains, per route, the set of tag names seen across the layout chain,
the page, and every resolved component (a `Set<string>` per parsed file — `collectA11y` already
visits every element — unioned along the same walk `composeA11y` does), **plus the tags of
`app.html`**, read the way `appHtmlIds` already is: a shell that holds `<main>%sveltekit.body%</main>`
must not produce a "missing `<main>`" on every route. The rendered provider collects the same from
the prerendered HTML, shell included. New optional field on `ResolvedA11y`: `elementTags`. Excluded
by construction, and stated in the docs: `<svelte:head>` content (never body), `<template>` children
(the a11y walk skips them), and `<svelte:element this={expr}>` (unknown tag).

**Presence is open-world safe; absence is not.** An unresolved component can only _add_ elements, so
a route where every declared tag is present among the resolved files **passes regardless of how
closed the world is** — the a11y design's existential-rule doctrine, and what keeps this rule
exercised on real apps in static mode. Only "missing" needs the world closed, and the right closure
for elements is not `fullyResolved`: that flag is cleared by spreads and expression ids, which cannot
hide an element. The composition gains a second flag, `elementsClosed`, cleared by exactly what can:
an unresolved or depth-truncated component, `{@html}`, and a dynamic `<svelte:element>`. Measured on
the #533 corpus it changes nothing today — every route of kener and svelte-commerce carries an
unresolvable package component, so `elementsClosed` is as false as `fullyResolved` there — but it is
the correct predicate, it is what a later answer to #533 (declaring what an unresolvable component
renders) would unlock, and defining it now costs a few lines.

So in static mode the rule reports presence everywhere and absence only where the world is closed —
few routes on a real app until #533 moves. In build mode (`@svelte-vitals/vite`, **prerendered
routes** — SSR/dynamic routes get neither mode) the world is closed by construction and it reports
both. The rule docs' Mode section says this in those words. What must be frozen — the config key's
name, kind and merge — is identical in both modes.

A missing-element finding is located at the route's page file (`length-rule.ts`' convention:
`{ route, file: pageFile }`), so `overrides.files` and `--diff` match it there.

### 5. Both rules report passes so a clean project stays in the evidence

`disallowed-element`: a component with elements and no disallowed one passes. `required-element`: a
route with every declared element present passes, closed world or not; a route missing one is a
finding only when `elementsClosed`, and otherwise emits nothing — not a pass — until #533 decides
how an unjudged route is surfaced.

## Not in scope

- Attribute-qualified declarations and any selector syntax (decision 2).
- A "must carry attribute X" declaration. Unmeasured; and its grammar would be the attribute-qualified
  form decision 2 reserves.
- The rest of the a11y design's Phase 3 pool.

## Testing

1. Options: a declaration with selector characters is rejected at config load with a message naming
   it; bare names, including hyphenated custom-element names, are accepted; the list adds across
   `overrides`.
2. Unit: `disallowed-element` fires per occurrence, case-insensitively, at the start tag; an
   undeclared project emits nothing; an override extends the list for a file glob.
3. Unit: `required-element` passes a route whose declared elements are present in a layout, a
   resolved component, or `app.html`, whether or not the world is closed; reports a missing element
   only when `elementsClosed`; emits nothing for an unclosed route missing one. `elementsClosed` is
   cleared by an unresolved component, `{@html}` and `<svelte:element this={expr}>`, and **not** by
   a spread or an expression id.
4. Rendered: the Vite provider supplies `elementTags` (shell included) and `required-element`
   reports both presence and absence.
5. Kitchen-sink: `svelte-vitals.config.ts` turns both on; a planted `<iframe>` fires
   `disallowed-element`; a fully-resolved route (kitchen-sink has one — `no-missing-id-ref` reports
   there) is planted to miss a declared element and fires `required-element`; both expectation files
   record the counts; the e2e-suppression suite gains the two levers, with the directive above a
   multi-line `<iframe>`.
6. Docs en/ja: both pages state the tag-name-only grammar and what is not seen (`<svelte:element>`,
   `<template>`, `<svelte:head>`); `required-element`'s Mode section says static mode reports
   presence everywhere and absence only on closed routes, and that build mode covers prerendered
   routes; changeset.
