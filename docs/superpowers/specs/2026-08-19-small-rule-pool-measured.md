# The small-rule pool, measured — and not built

Roadmap Phase C-11 lists nine candidates: `no-consecutive-br`, `no-empty-palpable-content`,
`table-row-column-alignment`, `no-ambiguous-navigable-target-names`, `neighbor-popovers`, and the
adjacent-category four (`correct-aspect-ratio`, `srcset-sizes-constraint` → Performance; `link-types`,
`head-element-order` → SEO). Each would be a normal rule increment — docs in two languages, a gallery
sample, the review cycle every rule here goes through — so, as for the attribute-level rules
(`2026-08-19-attribute-rules-measured.md`), the question asked first was whether any of them finds
anything on real code.

## Measured

A parser-level probe over the five corpus apps (kener 41 routes, svelte-commerce 54, CMSaasStarter
25, networking-toolbox 193, joy 8), each candidate implemented as its literal check on the Svelte AST:

| candidate                             | hits | what they are                                                                                                                           |
| ------------------------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------- |
| `no-empty-palpable-content`           |   67 | `<span class="dot"></span>`, `<span aria-hidden="true"></span>`, skeleton bars — decorative elements CSS paints; not one forgotten body |
| `no-consecutive-br`                   |    1 | networking-toolbox                                                                                                                      |
| `head-element-order`                  |    1 | a `<svelte:head>` where `viewport` is not first                                                                                         |
| `table-row-column-alignment`          |    0 | literal rows only; dynamic rows were skipped as unjudgeable                                                                             |
| `correct-aspect-ratio`                |    0 | `width`/`height` vs an inline `aspect-ratio`                                                                                            |
| `srcset-sizes-constraint`             |    0 | a `w`-descriptor `srcset` without `sizes`                                                                                               |
| `link-types`                          |    0 | a `rel` token outside the registered set                                                                                                |
| `no-ambiguous-navigable-target-names` |    0 |                                                                                                                                         |
| `neighbor-popovers`                   |    — | no `popover` usage in the corpus; unmeasurable here                                                                                     |

The one candidate with a count is a false-positive class: an empty `<span>` with a class is how
current CSS draws a dot, a rule, a placeholder, and the corpus shows exactly that — 67 intentional
elements and nothing that reads as a missing body. The other eight total two findings across 321
routes.

## Decision

None of the nine is built. A rule that finds nothing on five real apps, or finds only what the author
meant, is not a rule earning its place in a scored report; it is a maintenance bill with a
false-positive risk attached. This is a measured "no", on the same footing as the attribute-level
decision: the probe is the literal check each rule would ship, dynamic content was skipped
conservatively, and the result is what the rules would report.

If a later corpus says otherwise, each is a normal increment with no data or infrastructure
prerequisite — the facts they need (`ElementFact`, head tags, image attributes) are already
collected.

## What this leaves of Phase C

- `permitted-contents` — not decided; its measurement needs the content-model DSL evaluated, which is
  its own piece of work, and the compiler already errors on the browser-repair subset
  (`node_invalid_placement`).
- Items 6 and 7 (the closed world for `no-missing-id-ref`, and `app.html` ids in it) — issue #533.

Everything else in Phase C has shipped or been decided against with its measurement on record.
