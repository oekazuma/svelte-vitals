# Config-driven element rules — `disallowed-element`, `required-element`, and the selector question

Roadmap Phase C-10 (the a11y design's "Phase 3"): two rules whose entire content is what the user
declares, plus a decision the roadmap flags as config-schema-affecting and therefore pre-freeze —
whether svelte-vitals grows a second scoping vocabulary (CSS selectors, as file-scoped markup linters
use) beside the `overrides` globs it already has.

Nothing here is measured against a corpus in the way the C-9 rules were: a rule that reports what a
project declared fires exactly as often as the project declares. What is measured is the cost side —
what facts each rule needs, and whether they are already collected.

## Decisions

### 1. Both rules are `a11y/*`, off by default, and inert until configured

The a11y design placed them; they stay there. Both follow `architecture/unit-entry-file`'s
convention for declaration-driven rules: `'off'` by default, `options` declared through
`RuleOptionsSpec`, and `isMentionedAnywhere` short-circuits an unconfigured project so the rule costs
nothing there. A configured project turns one on with a setting that carries the declarations:

```js
rules: {
  'a11y/disallowed-element': { severity: 'warning', options: { elements: ['iframe', 'marquee'] } },
  'a11y/required-element':   { severity: 'warning', options: { elements: ['main', 'h1'] } }
}
```

Both `elements` options are `string-list`, so per the rule-options design they **add** to the
default (empty) rather than replace it, and an `overrides` entry can extend the list for a route or
file glob (`{ files: 'src/routes/(marketing)/**', rules: { 'a11y/disallowed-element': { options: { elements: ['iframe'] } } } }`).

### 2. Declarations are lowercase tag names, and the scoping vocabulary stays `overrides`

The "selector question": file-scoped linters let a rule's configuration target a CSS selector
(`"input[type=file]"`, `".legacy *"`) because they have no other way to say _where_ a declaration
applies. svelte-vitals already has one — `overrides` scopes any rule's severity and options to
route globs and file globs, and every rule inherits it for free. Adding selectors would be a second
place to answer "where", with its own matcher, its own precedence against `overrides`, and its own
"selected nothing" warning to design; the lever rule in AGENTS.md would demand all three.

So the declaration is a **tag name** (`'iframe'`, `'font'`, `'main'`), matched case-insensitively
against the element name; `where` is `overrides`. An attribute-qualified form (`'input[type=file]'`)
is not added: nothing measured asks for it, and it is exactly the selector surface this decision keeps
out. If a project needs "no `<input type=file>` here", the answer today is a component boundary or a
review rule, and the gap is recorded rather than half-filled.

Tag names not known to the vendored HTML spec data are still accepted — a project may want to
disallow a custom element or its own `<my-widget>` — but a declaration naming nothing in the
analysed source is exactly the "lever that selected nothing" the AGENTS.md rule is about, and it is
**never** legitimate on a full run for `disallowed-element` (the user is asking about a tag that does
not occur; either the code is clean, which the pass says, or the name is wrong). The rule reports a
pass per file, so a clean project sees passes, not silence; and a declared name that matches no
element in any scanned file on a full run is warned about, the way an unknown directive id is.

### 3. `disallowed-element` is component-scoped and reads `ElementFact`

Every element in every component is already collected with its lowercased tag (`ElementFact`, from
the deprecated-element work), so the rule is a lookup: an occurrence whose tag is in the declared list
is a finding, anchored at the start tag (the directive-reachability convention). Namespace is not
consulted: a project that disallows `iframe` means every `<iframe>`, and one that disallows `style`
inside `<svg>` can say so with a file-scoped override; SVG-only names (`foreignObject`) simply never
match HTML markup.

### 4. `required-element` is route-scoped, and its static-mode reach is bounded by #533

"Every route must contain a `<main>`" is a claim about the composed page, not about one file: a
`+page.svelte` that renders `<Hero />` may get its `<h1>` from the component, and the layout usually
owns `<main>`. Judging it per file would report every page whose required element lives in a layout
or a child — wrong on most SvelteKit apps. So the rule is route-scoped, like `duplicate-landmark`.

Facts: the source composition gains, per route, the set of tag names seen across the layout chain,
the page, and every resolved component (a `Set<string>` per parsed file, unioned along the same walk
`composeA11y` already does); the rendered provider collects the same from the prerendered HTML.
That is a new field on `ResolvedA11y` (`elementTags`), optional, absent where a provider does not
supply it.

**Absence is a closed-world claim.** "This route has no `<main>`" is only true if every component
the route composes was resolved — an unresolved package component may render one. In rendered mode
(the Vite plugin) the world is closed by construction, and the rule works fully. In static mode the
rule gates on the same `fullyResolved` flag `no-missing-id-ref` does, and #533 measured that flag as
false on essentially every route of a real app. This design does not solve that — it is #533's
problem, and it is what makes `required-element` a rendered-mode rule first. The rule docs say so in
their Mode section, in those words, and static mode reports the skip the way #533 decides to report
it once it does. What this design settles is the **config key** — its name, kind and merge — which is
what must be frozen, and which is identical in both modes.

### 5. Both rules report passes so a clean project stays in the evidence

`disallowed-element`: a component with elements and no disallowed one passes. `required-element`: a
route judged (closed world) with every required element present passes. A route not judged emits
nothing, per #533's current state — not a pass.

## Not in scope

- Attribute-qualified declarations and any selector syntax (decision 2).
- A `required-attr`-style "must carry attribute X" declaration — the measured record
  (`2026-08-19-attribute-rules-measured.md`) is why.
- The rest of the a11y design's Phase 3 pool.

## Testing

1. Unit: `disallowed-element` fires per occurrence, case-insensitively, at the start tag; an
   undeclared project emits nothing and does no work; overrides extend the list for a file glob.
2. Unit: `required-element` reports a route missing a declared element only when the route is fully
   resolved; a route whose required element comes from a layout or a resolved component passes; an
   unresolved route emits nothing.
3. Rendered: the Vite provider supplies `elementTags`, and `required-element` judges every route.
4. The full-run warning for a `disallowed-element` declaration matching no element in any scanned
   file; silent under `--route`.
5. Kitchen-sink: `svelte-vitals.config.ts` turns both on with declarations; a planted `<iframe>`
   fires; a route with every required element passes; the e2e-suppression suite gains the two levers
   (config declaration + inline directive on a multi-line `<iframe>`).
6. Docs en/ja: both pages state the Mode difference for `required-element` and the tag-name-only
   declaration for both; changeset.
