# Rule reliability (internal)

How often each rule's findings hold up on real SvelteKit apps. This is a development aid, not a
user-facing claim: use it to see which rules need attention and whether a change made a rule more or
less trustworthy. Design: `docs/superpowers/specs/2026-09-23-corpus-precision-design.md`.

- `targets.json` — the corpus: open-source SvelteKit apps, each pinned to a commit.
- `verdicts.json` — one verdict per finding, keyed `app::rule::file:line::claim`.
- `measurement.json` — per-rule counts written by `pnpm corpus update`.

## Verdicts

| Verdict   | Meaning                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| `tp`      | The rule's documented claim holds for this code.                                                               |
| `fp`      | The claim is false: the analyzer misread the code, or the rule contradicts its own docs.                       |
| `design`  | Reported as the rule documents, but not demonstrably a defect (e.g. ids repeated in sibling `{#if}` branches). |
| `unclear` | Could not be decided from the source alone.                                                                    |

## Reading the numbers

- **Precision** is `tp / (tp + fp)` over findings that have a verdict, with the sample size next to it. A finding nobody has read is not assumed to be correct; `design` and `unclear` count toward neither side.
- **Design share** is the part of the reviewed findings that are reported as documented but are not a demonstrable defect. Read it next to precision: a rule at 100% precision with a high design share reports mostly things that are not wrong, and is a candidate for narrowing.
- **"not yet reviewed"** means the rule fired on the corpus but none of its findings has a verdict yet. Add verdicts to `verdicts.json` to move it.
- **—** in the Reviewed column means the rule reported nothing on the corpus, which says nothing about its quality. In the Precision column it means no finding has a `tp` or `fp` verdict (for example, all are `design`), so there is nothing to compute.
- Findings are counted once per code location and claim: a component finding on forty routes is one finding.
- This measures false positives, not misses, on a small sample of SvelteKit code.

## Keeping it current

`pnpm build && pnpm corpus update && pnpm format` rewrites `measurement.json` and the table below.
`packages/cli/test/rule-reliability.test.ts` fails the build when a registered rule is missing from
the measurement or the table is stale, and the `corpus.yml` PR job comments with the findings a
change adds or removes.

## Results

<!-- rule-reliability:start -->

Measured on 16 apps, each pinned to a commit:

- [huntabyte/bits-ui/docs](https://github.com/huntabyte/bits-ui/tree/4ece1256a548a3f23aec3131477cbc4077556dfd/docs) (`4ece125`)
- [huntabyte/bits-ui/tests](https://github.com/huntabyte/bits-ui/tree/4ece1256a548a3f23aec3131477cbc4077556dfd/tests) (`4ece125`)
- [huntabyte/shadcn-svelte/docs](https://github.com/huntabyte/shadcn-svelte/tree/9ebdb0bbc0276745c092a86882e2179203be317e/docs) (`9ebdb0b`)
- [immich-app/immich/web](https://github.com/immich-app/immich/tree/3e2e8e0fe8a9c0210288c030df7aebe7e8dbf261/web) (`3e2e8e0`)
- [imputnet/cobalt/web](https://github.com/imputnet/cobalt/tree/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/web) (`a636575`)
- [lissy93/networking-toolbox](https://github.com/lissy93/networking-toolbox/tree/776805f692c20e59fe5de1942e999ccf91944f54) (`776805f`)
- [matiadev/joy-of-code](https://github.com/matiadev/joy-of-code/tree/2296024e49d58b6911fb81da6d37674994708d61) (`2296024`)
- [open-webui/open-webui](https://github.com/open-webui/open-webui/tree/8bd8b4fac5e059578ac0c74b3c18d11139f88b7d) (`8bd8b4f`)
- [rajnandan1/kener](https://github.com/rajnandan1/kener/tree/2fe50b32b25684cc0b21eee23cd182d4002588c9) (`2fe50b3`)
- [scosman/CMSaasStarter](https://github.com/scosman/CMSaasStarter/tree/2e61406c0764585031b40e657ebebf50187c8429) (`2e61406`)
- [seanmorley15/AdventureLog/frontend](https://github.com/seanmorley15/AdventureLog/tree/5673ef5bb5aaa96081bc250ef1d16da8b45977e3/frontend) (`5673ef5`)
- [skeletonlabs/skeleton/sites/plus.skeleton.dev](https://github.com/skeletonlabs/skeleton/tree/e65535ebfb9b37bf37ccde1ed854b96397d21550/sites/plus.skeleton.dev) (`e65535e`)
- [skeletonlabs/skeleton/sites/themes.skeleton.dev](https://github.com/skeletonlabs/skeleton/tree/e65535ebfb9b37bf37ccde1ed854b96397d21550/sites/themes.skeleton.dev) (`e65535e`)
- [skeletonlabs/skeleton/playgrounds/skeleton-svelte](https://github.com/skeletonlabs/skeleton/tree/e65535ebfb9b37bf37ccde1ed854b96397d21550/playgrounds/skeleton-svelte) (`e65535e`)
- [sveltejs/realworld](https://github.com/sveltejs/realworld/tree/df796708040f5200ec572b28ab7f88ecee5794dd) (`df79670`)
- [sveltejs/svelte.dev/apps/svelte.dev](https://github.com/sveltejs/svelte.dev/tree/1c5ddf9ab29dc9c6544bcde40ca53b51b6374532/apps/svelte.dev) (`1c5ddf9`)

5552 of 5552 corpus findings have a verdict.

| Rule                                                                                                                  | Corpus findings | Apps | Reviewed (tp / fp / design / unclear) | Precision      | Design share  |
| --------------------------------------------------------------------------------------------------------------------- | --------------- | ---- | ------------------------------------- | -------------- | ------------- |
| [`a11y/abbr-title`](../../docs/src/content/docs/rules/a11y/abbr-title.md)                                             | 0               | 0    | —                                     | —              | —             |
| [`a11y/accessible-name`](../../docs/src/content/docs/rules/a11y/accessible-name.md)                                   | 6               | 1    | 4 / 0 / 2 / 0                         | 100% (4/4)     | 33% (2/6)     |
| [`a11y/aria-hidden-focus`](../../docs/src/content/docs/rules/a11y/aria-hidden-focus.md)                               | 3               | 2    | 3 / 0 / 0 / 0                         | 100% (3/3)     | 0% (0/3)      |
| [`a11y/deprecated-aria`](../../docs/src/content/docs/rules/a11y/deprecated-aria.md)                                   | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)     | 0% (0/1)      |
| [`a11y/deprecated-attr`](../../docs/src/content/docs/rules/a11y/deprecated-attr.md)                                   | 10              | 2    | 10 / 0 / 0 / 0                        | 100% (10/10)   | 0% (0/10)     |
| [`a11y/deprecated-element`](../../docs/src/content/docs/rules/a11y/deprecated-element.md)                             | 0               | 0    | —                                     | —              | —             |
| [`a11y/disallowed-aria-props`](../../docs/src/content/docs/rules/a11y/disallowed-aria-props.md)                       | 29              | 7    | 28 / 0 / 1 / 0                        | 100% (28/28)   | 3% (1/29)     |
| [`a11y/disallowed-element`](../../docs/src/content/docs/rules/a11y/disallowed-element.md)                             | 0               | 0    | —                                     | —              | —             |
| [`a11y/doctype`](../../docs/src/content/docs/rules/a11y/doctype.md)                                                   | 0               | 0    | —                                     | —              | —             |
| [`a11y/duplicate-landmark`](../../docs/src/content/docs/rules/a11y/duplicate-landmark.md)                             | 4               | 3    | 2 / 0 / 2 / 0                         | 100% (2/2)     | 50% (2/4)     |
| [`a11y/id-duplication`](../../docs/src/content/docs/rules/a11y/id-duplication.md)                                     | 101             | 5    | 22 / 0 / 79 / 0                       | 100% (22/22)   | 78% (79/101)  |
| [`a11y/interactive-nesting`](../../docs/src/content/docs/rules/a11y/interactive-nesting.md)                           | 60              | 4    | 60 / 0 / 0 / 0                        | 100% (60/60)   | 0% (0/60)     |
| [`a11y/invalid-aria-value`](../../docs/src/content/docs/rules/a11y/invalid-aria-value.md)                             | 0               | 0    | —                                     | —              | —             |
| [`a11y/invalid-role`](../../docs/src/content/docs/rules/a11y/invalid-role.md)                                         | 0               | 0    | —                                     | —              | —             |
| [`a11y/label-has-control`](../../docs/src/content/docs/rules/a11y/label-has-control.md)                               | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)     | 0% (0/1)      |
| [`a11y/no-accesskey`](../../docs/src/content/docs/rules/a11y/no-accesskey.md)                                         | 0               | 0    | —                                     | —              | —             |
| [`a11y/no-autofocus`](../../docs/src/content/docs/rules/a11y/no-autofocus.md)                                         | 2               | 1    | 0 / 0 / 2 / 0                         | —              | 100% (2/2)    |
| [`a11y/no-duplicate-dt`](../../docs/src/content/docs/rules/a11y/no-duplicate-dt.md)                                   | 0               | 0    | —                                     | —              | —             |
| [`a11y/no-missing-id-ref`](../../docs/src/content/docs/rules/a11y/no-missing-id-ref.md)                               | 0               | 0    | —                                     | —              | —             |
| [`a11y/pattern-title`](../../docs/src/content/docs/rules/a11y/pattern-title.md)                                       | 2               | 2    | 2 / 0 / 0 / 0                         | 100% (2/2)     | 0% (0/2)      |
| [`a11y/permitted-contents`](../../docs/src/content/docs/rules/a11y/permitted-contents.md)                             | 796             | 15   | 796 / 0 / 0 / 0                       | 100% (796/796) | 0% (0/796)    |
| [`a11y/placeholder-label-option`](../../docs/src/content/docs/rules/a11y/placeholder-label-option.md)                 | 2               | 1    | 2 / 0 / 0 / 0                         | 100% (2/2)     | 0% (0/2)      |
| [`a11y/positive-tabindex`](../../docs/src/content/docs/rules/a11y/positive-tabindex.md)                               | 0               | 0    | —                                     | —              | —             |
| [`a11y/require-datetime`](../../docs/src/content/docs/rules/a11y/require-datetime.md)                                 | 0               | 0    | —                                     | —              | —             |
| [`a11y/required-aria-props`](../../docs/src/content/docs/rules/a11y/required-aria-props.md)                           | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)     | 0% (0/1)      |
| [`a11y/required-element`](../../docs/src/content/docs/rules/a11y/required-element.md)                                 | 0               | 0    | —                                     | —              | —             |
| [`a11y/top-level-landmark`](../../docs/src/content/docs/rules/a11y/top-level-landmark.md)                             | 6               | 5    | 6 / 0 / 0 / 0                         | 100% (6/6)     | 0% (0/6)      |
| [`a11y/unknown-aria-attribute`](../../docs/src/content/docs/rules/a11y/unknown-aria-attribute.md)                     | 0               | 0    | —                                     | —              | —             |
| [`a11y/unverified-id-ref`](../../docs/src/content/docs/rules/a11y/unverified-id-ref.md)                               | 0               | 0    | —                                     | —              | —             |
| [`a11y/use-list`](../../docs/src/content/docs/rules/a11y/use-list.md)                                                 | 0               | 0    | —                                     | —              | —             |
| [`architecture/component-size`](../../docs/src/content/docs/rules/architecture/component-size.md)                     | 605             | 14   | 605 / 0 / 0 / 0                       | 100% (605/605) | 0% (0/605)    |
| [`architecture/directory-naming`](../../docs/src/content/docs/rules/architecture/directory-naming.md)                 | 0               | 0    | —                                     | —              | —             |
| [`architecture/doc-link-target`](../../docs/src/content/docs/rules/architecture/doc-link-target.md)                   | 0               | 0    | —                                     | —              | —             |
| [`architecture/private-scope-import`](../../docs/src/content/docs/rules/architecture/private-scope-import.md)         | 0               | 0    | —                                     | —              | —             |
| [`architecture/prop-count`](../../docs/src/content/docs/rules/architecture/prop-count.md)                             | 97              | 10   | 97 / 0 / 0 / 0                        | 100% (97/97)   | 0% (0/97)     |
| [`architecture/reserved-directory-names`](../../docs/src/content/docs/rules/architecture/reserved-directory-names.md) | 0               | 0    | —                                     | —              | —             |
| [`architecture/reserved-name-placement`](../../docs/src/content/docs/rules/architecture/reserved-name-placement.md)   | 0               | 0    | —                                     | —              | —             |
| [`architecture/route-component-import`](../../docs/src/content/docs/rules/architecture/route-component-import.md)     | 1               | 1    | 0 / 0 / 1 / 0                         | —              | 100% (1/1)    |
| [`architecture/unit-entry-file`](../../docs/src/content/docs/rules/architecture/unit-entry-file.md)                   | 0               | 0    | —                                     | —              | —             |
| [`correctness/autoplay-muted`](../../docs/src/content/docs/rules/correctness/autoplay-muted.md)                       | 1               | 1    | 0 / 0 / 1 / 0                         | —              | 100% (1/1)    |
| [`correctness/base-path-navigation`](../../docs/src/content/docs/rules/correctness/base-path-navigation.md)           | 34              | 2    | 34 / 0 / 0 / 0                        | 100% (34/34)   | 0% (0/34)     |
| [`correctness/checkable-bind-value`](../../docs/src/content/docs/rules/correctness/checkable-bind-value.md)           | 0               | 0    | —                                     | —              | —             |
| [`correctness/each-index-key`](../../docs/src/content/docs/rules/correctness/each-index-key.md)                       | 326             | 9    | 187 / 0 / 139 / 0                     | 100% (187/187) | 43% (139/326) |
| [`correctness/each-key`](../../docs/src/content/docs/rules/correctness/each-key.md)                                   | 530             | 12   | 349 / 0 / 181 / 0                     | 100% (349/349) | 34% (181/530) |
| [`correctness/effect-as-derived`](../../docs/src/content/docs/rules/correctness/effect-as-derived.md)                 | 4               | 3    | 4 / 0 / 0 / 0                         | 100% (4/4)     | 0% (0/4)      |
| [`correctness/effect-as-onmount`](../../docs/src/content/docs/rules/correctness/effect-as-onmount.md)                 | 3               | 2    | 3 / 0 / 0 / 0                         | 100% (3/3)     | 0% (0/3)      |
| [`correctness/instance-browser-global`](../../docs/src/content/docs/rules/correctness/instance-browser-global.md)     | 1               | 1    | 0 / 0 / 1 / 0                         | —              | 100% (1/1)    |
| [`correctness/nonreactive-builtin-state`](../../docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md) | 0               | 0    | —                                     | —              | —             |
| [`correctness/orphan-effect`](../../docs/src/content/docs/rules/correctness/orphan-effect.md)                         | 0               | 0    | —                                     | —              | —             |
| [`correctness/orphan-lifecycle`](../../docs/src/content/docs/rules/correctness/orphan-lifecycle.md)                   | 0               | 0    | —                                     | —              | —             |
| [`correctness/prop-mutation`](../../docs/src/content/docs/rules/correctness/prop-mutation.md)                         | 32              | 6    | 14 / 0 / 18 / 0                       | 100% (14/14)   | 56% (18/32)   |
| [`correctness/server-browser-global`](../../docs/src/content/docs/rules/correctness/server-browser-global.md)         | 0               | 0    | —                                     | —              | —             |
| [`correctness/stale-prop-derivation`](../../docs/src/content/docs/rules/correctness/stale-prop-derivation.md)         | 27              | 4    | 6 / 0 / 21 / 0                        | 100% (6/6)     | 78% (21/27)   |
| [`correctness/unmutated-state`](../../docs/src/content/docs/rules/correctness/unmutated-state.md)                     | 23              | 4    | 23 / 0 / 0 / 0                        | 100% (23/23)   | 0% (0/23)     |
| [`performance/font-preload-crossorigin`](../../docs/src/content/docs/rules/performance/font-preload-crossorigin.md)   | 0               | 0    | —                                     | —              | —             |
| [`performance/heavy-import`](../../docs/src/content/docs/rules/performance/heavy-import.md)                           | 0               | 0    | —                                     | —              | —             |
| [`performance/iframe-loading`](../../docs/src/content/docs/rules/performance/iframe-loading.md)                       | 23              | 6    | 12 / 0 / 10 / 1                       | 100% (12/12)   | 43% (10/23)   |
| [`performance/image-dimensions`](../../docs/src/content/docs/rules/performance/image-dimensions.md)                   | 58              | 9    | 27 / 0 / 31 / 0                       | 100% (27/27)   | 53% (31/58)   |
| [`performance/image-loading-hint`](../../docs/src/content/docs/rules/performance/image-loading-hint.md)               | 60              | 9    | 43 / 0 / 17 / 0                       | 100% (43/43)   | 28% (17/60)   |
| [`performance/lcp-image`](../../docs/src/content/docs/rules/performance/lcp-image.md)                                 | 0               | 0    | —                                     | —              | —             |
| [`performance/load-waterfall`](../../docs/src/content/docs/rules/performance/load-waterfall.md)                       | 4               | 3    | 3 / 0 / 1 / 0                         | 100% (3/3)     | 25% (1/4)     |
| [`performance/minify-disabled`](../../docs/src/content/docs/rules/performance/minify-disabled.md)                     | 0               | 0    | —                                     | —              | —             |
| [`performance/namespace-import`](../../docs/src/content/docs/rules/performance/namespace-import.md)                   | 0               | 0    | —                                     | —              | —             |
| [`performance/preconnect`](../../docs/src/content/docs/rules/performance/preconnect.md)                               | 0               | 0    | —                                     | —              | —             |
| [`performance/preload-missing-as`](../../docs/src/content/docs/rules/performance/preload-missing-as.md)               | 0               | 0    | —                                     | —              | —             |
| [`performance/render-blocking-script`](../../docs/src/content/docs/rules/performance/render-blocking-script.md)       | 0               | 0    | —                                     | —              | —             |
| [`performance/responsive-image`](../../docs/src/content/docs/rules/performance/responsive-image.md)                   | 54              | 9    | 53 / 0 / 1 / 0                        | 100% (53/53)   | 2% (1/54)     |
| [`performance/sequential-awaits`](../../docs/src/content/docs/rules/performance/sequential-awaits.md)                 | 117             | 4    | 54 / 0 / 63 / 0                       | 100% (54/54)   | 54% (63/117)  |
| [`performance/state-raw`](../../docs/src/content/docs/rules/performance/state-raw.md)                                 | 23              | 4    | 23 / 0 / 0 / 0                        | 100% (23/23)   | 0% (0/23)     |
| [`security/handler-state-write`](../../docs/src/content/docs/rules/security/handler-state-write.md)                   | 0               | 0    | —                                     | —              | —             |
| [`security/javascript-url`](../../docs/src/content/docs/rules/security/javascript-url.md)                             | 0               | 0    | —                                     | —              | —             |
| [`security/raw-html`](../../docs/src/content/docs/rules/security/raw-html.md)                                         | 97              | 13   | 13 / 0 / 84 / 0                       | 100% (13/13)   | 87% (84/97)   |
| [`security/server-module-state`](../../docs/src/content/docs/rules/security/server-module-state.md)                   | 3               | 2    | 0 / 0 / 3 / 0                         | —              | 100% (3/3)    |
| [`security/shared-state-import`](../../docs/src/content/docs/rules/security/shared-state-import.md)                   | 0               | 0    | —                                     | —              | —             |
| [`seo/canonical-url`](../../docs/src/content/docs/rules/seo/canonical-url.md)                                         | 328             | 15   | 317 / 0 / 11 / 0                      | 100% (317/317) | 3% (11/328)   |
| [`seo/charset`](../../docs/src/content/docs/rules/seo/charset.md)                                                     | 0               | 0    | —                                     | —              | —             |
| [`seo/description-length`](../../docs/src/content/docs/rules/seo/description-length.md)                               | 27              | 5    | 27 / 0 / 0 / 0                        | 100% (27/27)   | 0% (0/27)     |
| [`seo/description-presence`](../../docs/src/content/docs/rules/seo/description-presence.md)                           | 132             | 10   | 132 / 0 / 0 / 0                       | 100% (132/132) | 0% (0/132)    |
| [`seo/duplicate-description`](../../docs/src/content/docs/rules/seo/duplicate-description.md)                         | 4               | 2    | 4 / 0 / 0 / 0                         | 100% (4/4)     | 0% (0/4)      |
| [`seo/duplicate-title`](../../docs/src/content/docs/rules/seo/duplicate-title.md)                                     | 4               | 4    | 4 / 0 / 0 / 0                         | 100% (4/4)     | 0% (0/4)      |
| [`seo/heading-level-skip`](../../docs/src/content/docs/rules/seo/heading-level-skip.md)                               | 60              | 4    | 60 / 0 / 0 / 0                        | 100% (60/60)   | 0% (0/60)     |
| [`seo/hreflang`](../../docs/src/content/docs/rules/seo/hreflang.md)                                                   | 0               | 0    | —                                     | —              | —             |
| [`seo/html-lang`](../../docs/src/content/docs/rules/seo/html-lang.md)                                                 | 2               | 2    | 2 / 0 / 0 / 0                         | 100% (2/2)     | 0% (0/2)      |
| [`seo/image-alt`](../../docs/src/content/docs/rules/seo/image-alt.md)                                                 | 0               | 0    | —                                     | —              | —             |
| [`seo/indexability`](../../docs/src/content/docs/rules/seo/indexability.md)                                           | 86              | 3    | 86 / 0 / 0 / 0                        | 100% (86/86)   | 0% (0/86)     |
| [`seo/json-ld`](../../docs/src/content/docs/rules/seo/json-ld.md)                                                     | 324             | 15   | 324 / 0 / 0 / 0                       | 100% (324/324) | 0% (0/324)    |
| [`seo/json-ld-date-format`](../../docs/src/content/docs/rules/seo/json-ld-date-format.md)                             | 0               | 0    | —                                     | —              | —             |
| [`seo/json-ld-deprecated-type`](../../docs/src/content/docs/rules/seo/json-ld-deprecated-type.md)                     | 0               | 0    | —                                     | —              | —             |
| [`seo/json-ld-placeholder`](../../docs/src/content/docs/rules/seo/json-ld-placeholder.md)                             | 0               | 0    | —                                     | —              | —             |
| [`seo/json-ld-relative-url`](../../docs/src/content/docs/rules/seo/json-ld-relative-url.md)                           | 0               | 0    | —                                     | —              | —             |
| [`seo/json-ld-required-props`](../../docs/src/content/docs/rules/seo/json-ld-required-props.md)                       | 0               | 0    | —                                     | —              | —             |
| [`seo/json-ld-validity`](../../docs/src/content/docs/rules/seo/json-ld-validity.md)                                   | 0               | 0    | —                                     | —              | —             |
| [`seo/og-description`](../../docs/src/content/docs/rules/seo/og-description.md)                                       | 217             | 12   | 217 / 0 / 0 / 0                       | 100% (217/217) | 0% (0/217)    |
| [`seo/og-image`](../../docs/src/content/docs/rules/seo/og-image.md)                                                   | 237             | 13   | 237 / 0 / 0 / 0                       | 100% (237/237) | 0% (0/237)    |
| [`seo/og-title`](../../docs/src/content/docs/rules/seo/og-title.md)                                                   | 216             | 12   | 216 / 0 / 0 / 0                       | 100% (216/216) | 0% (0/216)    |
| [`seo/og-url`](../../docs/src/content/docs/rules/seo/og-url.md)                                                       | 278             | 13   | 278 / 0 / 0 / 0                       | 100% (278/278) | 0% (0/278)    |
| [`seo/robots-txt`](../../docs/src/content/docs/rules/seo/robots-txt.md)                                               | 6               | 6    | 6 / 0 / 0 / 0                         | 100% (6/6)     | 0% (0/6)      |
| [`seo/single-h1`](../../docs/src/content/docs/rules/seo/single-h1.md)                                                 | 146             | 14   | 135 / 0 / 10 / 1                      | 100% (135/135) | 7% (10/146)   |
| [`seo/sitemap-in-robots`](../../docs/src/content/docs/rules/seo/sitemap-in-robots.md)                                 | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)     | 0% (0/1)      |
| [`seo/sitemap-xml`](../../docs/src/content/docs/rules/seo/sitemap-xml.md)                                             | 12              | 12   | 11 / 0 / 1 / 0                        | 100% (11/11)   | 8% (1/12)     |
| [`seo/ssr-disabled`](../../docs/src/content/docs/rules/seo/ssr-disabled.md)                                           | 7               | 4    | 7 / 0 / 0 / 0                         | 100% (7/7)     | 0% (0/7)      |
| [`seo/title-length`](../../docs/src/content/docs/rules/seo/title-length.md)                                           | 51              | 10   | 51 / 0 / 0 / 0                        | 100% (51/51)   | 0% (0/51)     |
| [`seo/title-presence`](../../docs/src/content/docs/rules/seo/title-presence.md)                                       | 12              | 5    | 12 / 0 / 0 / 0                        | 100% (12/12)   | 0% (0/12)     |
| [`seo/twitter-card`](../../docs/src/content/docs/rules/seo/twitter-card.md)                                           | 255             | 12   | 255 / 0 / 0 / 0                       | 100% (255/255) | 0% (0/255)    |
| [`seo/viewport`](../../docs/src/content/docs/rules/seo/viewport.md)                                                   | 0               | 0    | —                                     | —              | —             |

<!-- rule-reliability:end -->
