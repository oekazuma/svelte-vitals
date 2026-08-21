# unverified-id-ref precision — measured

The release gate's numbers for `a11y/unverified-id-ref` (design:
`2026-08-21-unverified-id-ref-design.md`). The CLI built from this branch at `7663e163` was
run with `--rules a11y/unverified-id-ref --reporter json --no-suppressions` against
default-branch clones of the ecosystem corpus (`scripts/ecosystem-smoke.js`) plus
`itswadesh/svelte-commerce`, each clone's `svelte-vitals.config.*` removed before analysis.
Classification is by reading clone source only — no dependency installs, so a package
component's rendering is not observable; where the id lands inside a package primitive the
verdict is **undecidable**, not guessed.

Definitions: a **site** is a unique `(app, file, line)`; the same site reported on several
routes is one site covering several findings. **real** = no element with the referenced id
can render on the route (traced through the route's files and every first-party component
involved, plus an app-wide grep for the id). **false positive** = the id demonstrably
renders inside a component the analysis could not resolve. Precision is
`real / (real + false positive)`; undecidable sits outside the denominator.

## Per-app finding volume

| app                | sha       | findings | unique sites |
| ------------------ | --------- | -------: | -----------: |
| svelte.dev         | `6d238f9` |        0 |            0 |
| shadcn-svelte      | `dabbd4c` |        1 |            1 |
| cobalt             | `a636575` |       18 |            1 |
| AdventureLog       | `5673ef5` |       30 |            6 |
| kener              | `880080c` |        1 |            1 |
| networking-toolbox | `776805f` |        2 |            2 |
| joy-of-code        | `73dc40e` |        0 |            0 |
| CMSaasStarter      | `2e61406` |        0 |            0 |
| svelte-commerce    | `40e0965` |       20 |           20 |
| **total**          |           |   **72** |       **31** |

## Sample classification (all 31 sites)

| app                | site                                                            | ref                              | findings | verdict     | evidence                                                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------- | -------------------------------- | -------: | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shadcn-svelte      | `examples/dashboard/components/app-sidebar.svelte:150`          | `href="##"`                      |        1 | real        | placeholder anchor; no `id="#"` anywhere in `docs/src`                                                                                                                                                                                                               |
| cobalt             | `components/queue/ProcessingQueue.svelte:84`                    | `aria-labelledby="queue-title"`  |       18 | real        | `queue-title` appears nowhere else in `web/src`                                                                                                                                                                                                                      |
| AdventureLog       | `components/CollectionModal.svelte:311`                         | `for="description"`              |        1 | real        | label pairs `MarkdownEditor`, which renders no `id` at all; id nowhere in `src`                                                                                                                                                                                      |
| AdventureLog       | `components/locations/LocationDetails.svelte:291`               | `for="category"`                 |        7 | real        | label pairs `CategoryDropdown`, no `id`; id nowhere in `src`                                                                                                                                                                                                         |
| AdventureLog       | `components/locations/LocationDetails.svelte:404`               | `for="description"`              |        7 | real        | label pairs `MarkdownEditor`, no `id`                                                                                                                                                                                                                                |
| AdventureLog       | `components/locations/LocationVisits.svelte:914`                | `for="timezone-selector"`        |        7 | real        | `TimezoneSelector` only renders `$props.id()`-derived ids                                                                                                                                                                                                            |
| AdventureLog       | `components/transportation/TransportationDetails.svelte:792`    | `for="description"`              |        3 | real        | label pairs `MarkdownEditor`, no `id`                                                                                                                                                                                                                                |
| AdventureLog       | `components/lodging/LodgingDetails.svelte:660`                  | `for="description"`              |        5 | real        | label pairs `MarkdownEditor`, no `id`                                                                                                                                                                                                                                |
| kener              | `manage/app/alerts/logs/[alert_config_id]/+page.svelte:339`     | `for="delete-incident"`          |        1 | undecidable | `<Checkbox id>` spreads into bits-ui `Checkbox.Root`; package source not in clone                                                                                                                                                                                    |
| networking-toolbox | `components/tools/GatewayOption3.svelte:148`                    | `for="gateway-0"`                |        1 | FP          | same file renders `id={i === 0 ? 'gateway-0' : undefined}`; initial `gateways = ['']`                                                                                                                                                                                |
| networking-toolbox | `components/tools/PrefixDelegation.svelte:127`                  | `for="prefix-0"`                 |        1 | FP          | same pattern, initial `prefixes` non-empty                                                                                                                                                                                                                           |
| svelte-commerce    | `auth/change-password/+page.svelte:34/66/98`                    | `for="old"/"password"/"retype"`  |        3 | FP ×3       | `<Input id>` is first-party `ui/input`, spreads onto a native `<input>`                                                                                                                                                                                              |
| svelte-commerce    | `checkout/address/+page.svelte:190`                             | `for="email"`                    |        1 | FP          | the label's own `<Textbox>` gets no `id`/`name` (falls back to `$props.id()`), but the route's `address-form.svelte` renders `<Textbox name="email">`, whose input id falls back to the name — so `id="email"` can render on the route (on a different form's input) |
| svelte-commerce    | `checkout/address/+page.svelte:204`                             | `for="phone"`                    |        1 | FP          | same, via `address-form.svelte`'s `<Textbox name="phone">`                                                                                                                                                                                                           |
| svelte-commerce    | `checkout/address/+page.svelte:412`                             | `for="isBillingAddressSame…"`    |        1 | undecidable | `<Checkbox id>` spreads into bits-ui `Checkbox.Root`                                                                                                                                                                                                                 |
| svelte-commerce    | `checkout/cart/+page.svelte:187`                                | `for="allItemsChecked"`          |        1 | undecidable | same                                                                                                                                                                                                                                                                 |
| svelte-commerce    | `my/addresses/[id]/+page.svelte` (12 lines: 91–287)             | `for="firstName"` … `"locality"` |       12 | FP ×12      | every label pairs first-party `ui/input` with a matching `id`, spread onto a native `<input>`                                                                                                                                                                        |
| svelte-commerce    | `products/[slug]/components/product-reviews-section.svelte:362` | `for="review"`                   |        1 | FP          | `<Textarea id="review">` is first-party, spreads onto a native `<textarea>`                                                                                                                                                                                          |

## Headline

- **Sites** (the sample unit): 8 real, 20 false positive, 3 undecidable → precision
  **8/28 ≈ 29%**.
- **Findings** (the same verdicts rolled up across duplicate routes): 49 real, 20 false
  positive, 3 undecidable of 72 → **49/69 ≈ 71%** — the real sites happen to be the ones
  shared across many routes (cobalt's queue label, AdventureLog's detail modals).

The checkout email/phone pair is worth a footnote: the design's motivating example
classifies as a false positive under this doc's existence definition — the id can render on
the route — even though it lands on a different form's input, so the label's intended
association is still broken. The definition counts existence only, because that is all the
rule itself claims.

Every duplicate-route rollup is safe: each verdict rests on an app-wide grep, on code in
the flagged file itself, or on first-party components of the flagged route — never on what
one specific route's layout provides.
