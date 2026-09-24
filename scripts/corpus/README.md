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

Measured on 28 apps, each pinned to a commit:

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
- [letsrevel/revel-frontend](https://github.com/letsrevel/revel-frontend/tree/b1629c615f343c4ca4fb5c9a46799a02696e180e) (`b1629c6`)
- [johanohly/AirTrail](https://github.com/johanohly/AirTrail/tree/cecf2adff4b9cae83f278eb387b0f4460d9079b9) (`cecf2ad`)
- [rivenmedia/riven-frontend](https://github.com/rivenmedia/riven-frontend/tree/3c9298115672738b259cdc75baced3b90bbf8d34) (`3c92981`)
- [AtCoder-NoviSteps/AtCoderNoviSteps](https://github.com/AtCoder-NoviSteps/AtCoderNoviSteps/tree/56ca7fa4e761ffb4c1020f065bc3a11f0cca7d69) (`56ca7fa`)
- [kagisearch/kite-public](https://github.com/kagisearch/kite-public/tree/08d15108f82fb8728832f55fc8c3799a2836bfd6) (`08d1510`)
- [PauseAI/pauseai-website](https://github.com/PauseAI/pauseai-website/tree/ebe246c6af5b17f52c47501648d028caac10695b) (`ebe246c`)
- [doceazedo/doce.sh](https://github.com/doceazedo/doce.sh/tree/553567c9ece8ce2cef4eb65f914b981ab2679767) (`553567c`)
- [gchq/LD-Explorer](https://github.com/gchq/LD-Explorer/tree/7309e785e3a598598174599fad2f94e1627f3b65) (`7309e78`)
- [cigaleapp/cigale](https://github.com/cigaleapp/cigale/tree/7db3ba4df49d7c0228b2dff12b602fda3d8205c6) (`7db3ba4`)
- [elsbrock/hetzner-radar](https://github.com/elsbrock/hetzner-radar/tree/9d145f45a6c556b356d45947443c5d6dffee998c) (`9d145f4`)
- [timdeschryver/timdeschryver.dev](https://github.com/timdeschryver/timdeschryver.dev/tree/1e222a810c797fc0d37a53f8c30d54f6bff64079) (`1e222a8`)
- [classroomio/classroomio/apps/dashboard](https://github.com/classroomio/classroomio/tree/1b986d2d6874383b36078cf2b200c544b27ebfb7/apps/dashboard) (`1b986d2`)

10315 of 10315 corpus findings have a verdict.

| Rule                                                                                                                  | Corpus findings | Apps | Reviewed (tp / fp / design / unclear) | Precision        | Design share  |
| --------------------------------------------------------------------------------------------------------------------- | --------------- | ---- | ------------------------------------- | ---------------- | ------------- |
| [`a11y/abbr-title`](../../docs/src/content/docs/rules/a11y/abbr-title.md)                                             | 0               | 0    | —                                     | —                | —             |
| [`a11y/accessible-name`](../../docs/src/content/docs/rules/a11y/accessible-name.md)                                   | 7               | 2    | 4 / 0 / 3 / 0                         | 100% (4/4)       | 43% (3/7)     |
| [`a11y/aria-hidden-focus`](../../docs/src/content/docs/rules/a11y/aria-hidden-focus.md)                               | 3               | 2    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)      |
| [`a11y/deprecated-aria`](../../docs/src/content/docs/rules/a11y/deprecated-aria.md)                                   | 6               | 4    | 6 / 0 / 0 / 0                         | 100% (6/6)       | 0% (0/6)      |
| [`a11y/deprecated-attr`](../../docs/src/content/docs/rules/a11y/deprecated-attr.md)                                   | 19              | 5    | 19 / 0 / 0 / 0                        | 100% (19/19)     | 0% (0/19)     |
| [`a11y/deprecated-element`](../../docs/src/content/docs/rules/a11y/deprecated-element.md)                             | 0               | 0    | —                                     | —                | —             |
| [`a11y/disallowed-aria-props`](../../docs/src/content/docs/rules/a11y/disallowed-aria-props.md)                       | 95              | 15   | 94 / 0 / 1 / 0                        | 100% (94/94)     | 1% (1/95)     |
| [`a11y/disallowed-element`](../../docs/src/content/docs/rules/a11y/disallowed-element.md)                             | 0               | 0    | —                                     | —                | —             |
| [`a11y/doctype`](../../docs/src/content/docs/rules/a11y/doctype.md)                                                   | 0               | 0    | —                                     | —                | —             |
| [`a11y/duplicate-landmark`](../../docs/src/content/docs/rules/a11y/duplicate-landmark.md)                             | 14              | 8    | 11 / 0 / 3 / 0                        | 100% (11/11)     | 21% (3/14)    |
| [`a11y/id-duplication`](../../docs/src/content/docs/rules/a11y/id-duplication.md)                                     | 134             | 8    | 25 / 0 / 109 / 0                      | 100% (25/25)     | 81% (109/134) |
| [`a11y/interactive-nesting`](../../docs/src/content/docs/rules/a11y/interactive-nesting.md)                           | 62              | 6    | 62 / 0 / 0 / 0                        | 100% (62/62)     | 0% (0/62)     |
| [`a11y/invalid-aria-value`](../../docs/src/content/docs/rules/a11y/invalid-aria-value.md)                             | 0               | 0    | —                                     | —                | —             |
| [`a11y/invalid-role`](../../docs/src/content/docs/rules/a11y/invalid-role.md)                                         | 0               | 0    | —                                     | —                | —             |
| [`a11y/label-has-control`](../../docs/src/content/docs/rules/a11y/label-has-control.md)                               | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)      |
| [`a11y/no-accesskey`](../../docs/src/content/docs/rules/a11y/no-accesskey.md)                                         | 0               | 0    | —                                     | —                | —             |
| [`a11y/no-autofocus`](../../docs/src/content/docs/rules/a11y/no-autofocus.md)                                         | 10              | 3    | 0 / 0 / 10 / 0                        | —                | 100% (10/10)  |
| [`a11y/no-duplicate-dt`](../../docs/src/content/docs/rules/a11y/no-duplicate-dt.md)                                   | 0               | 0    | —                                     | —                | —             |
| [`a11y/no-missing-id-ref`](../../docs/src/content/docs/rules/a11y/no-missing-id-ref.md)                               | 0               | 0    | —                                     | —                | —             |
| [`a11y/pattern-title`](../../docs/src/content/docs/rules/a11y/pattern-title.md)                                       | 6               | 3    | 6 / 0 / 0 / 0                         | 100% (6/6)       | 0% (0/6)      |
| [`a11y/permitted-contents`](../../docs/src/content/docs/rules/a11y/permitted-contents.md)                             | 1087            | 27   | 1087 / 0 / 0 / 0                      | 100% (1087/1087) | 0% (0/1087)   |
| [`a11y/placeholder-label-option`](../../docs/src/content/docs/rules/a11y/placeholder-label-option.md)                 | 3               | 2    | 2 / 0 / 1 / 0                         | 100% (2/2)       | 33% (1/3)     |
| [`a11y/positive-tabindex`](../../docs/src/content/docs/rules/a11y/positive-tabindex.md)                               | 0               | 0    | —                                     | —                | —             |
| [`a11y/require-datetime`](../../docs/src/content/docs/rules/a11y/require-datetime.md)                                 | 18              | 1    | 18 / 0 / 0 / 0                        | 100% (18/18)     | 0% (0/18)     |
| [`a11y/required-aria-props`](../../docs/src/content/docs/rules/a11y/required-aria-props.md)                           | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)      |
| [`a11y/required-element`](../../docs/src/content/docs/rules/a11y/required-element.md)                                 | 0               | 0    | —                                     | —                | —             |
| [`a11y/top-level-landmark`](../../docs/src/content/docs/rules/a11y/top-level-landmark.md)                             | 11              | 8    | 11 / 0 / 0 / 0                        | 100% (11/11)     | 0% (0/11)     |
| [`a11y/unknown-aria-attribute`](../../docs/src/content/docs/rules/a11y/unknown-aria-attribute.md)                     | 0               | 0    | —                                     | —                | —             |
| [`a11y/unverified-id-ref`](../../docs/src/content/docs/rules/a11y/unverified-id-ref.md)                               | 0               | 0    | —                                     | —                | —             |
| [`a11y/use-list`](../../docs/src/content/docs/rules/a11y/use-list.md)                                                 | 0               | 0    | —                                     | —                | —             |
| [`architecture/component-size`](../../docs/src/content/docs/rules/architecture/component-size.md)                     | 1233            | 25   | 1233 / 0 / 0 / 0                      | 100% (1233/1233) | 0% (0/1233)   |
| [`architecture/directory-naming`](../../docs/src/content/docs/rules/architecture/directory-naming.md)                 | 0               | 0    | —                                     | —                | —             |
| [`architecture/doc-link-target`](../../docs/src/content/docs/rules/architecture/doc-link-target.md)                   | 0               | 0    | —                                     | —                | —             |
| [`architecture/private-scope-import`](../../docs/src/content/docs/rules/architecture/private-scope-import.md)         | 0               | 0    | —                                     | —                | —             |
| [`architecture/prop-count`](../../docs/src/content/docs/rules/architecture/prop-count.md)                             | 406             | 22   | 406 / 0 / 0 / 0                       | 100% (406/406)   | 0% (0/406)    |
| [`architecture/reserved-directory-names`](../../docs/src/content/docs/rules/architecture/reserved-directory-names.md) | 0               | 0    | —                                     | —                | —             |
| [`architecture/reserved-name-placement`](../../docs/src/content/docs/rules/architecture/reserved-name-placement.md)   | 0               | 0    | —                                     | —                | —             |
| [`architecture/route-component-import`](../../docs/src/content/docs/rules/architecture/route-component-import.md)     | 33              | 4    | 0 / 21 / 12 / 0                       | 0% (0/21)        | 36% (12/33)   |
| [`architecture/unit-entry-file`](../../docs/src/content/docs/rules/architecture/unit-entry-file.md)                   | 0               | 0    | —                                     | —                | —             |
| [`correctness/autoplay-muted`](../../docs/src/content/docs/rules/correctness/autoplay-muted.md)                       | 1               | 1    | 0 / 0 / 1 / 0                         | —                | 100% (1/1)    |
| [`correctness/base-path-navigation`](../../docs/src/content/docs/rules/correctness/base-path-navigation.md)           | 37              | 3    | 37 / 0 / 0 / 0                        | 100% (37/37)     | 0% (0/37)     |
| [`correctness/checkable-bind-value`](../../docs/src/content/docs/rules/correctness/checkable-bind-value.md)           | 0               | 0    | —                                     | —                | —             |
| [`correctness/each-index-key`](../../docs/src/content/docs/rules/correctness/each-index-key.md)                       | 415             | 18   | 222 / 0 / 193 / 0                     | 100% (222/222)   | 47% (193/415) |
| [`correctness/each-key`](../../docs/src/content/docs/rules/correctness/each-key.md)                                   | 747             | 18   | 466 / 5 / 276 / 0                     | 99% (466/471)    | 37% (276/747) |
| [`correctness/effect-as-derived`](../../docs/src/content/docs/rules/correctness/effect-as-derived.md)                 | 35              | 9    | 32 / 0 / 3 / 0                        | 100% (32/32)     | 9% (3/35)     |
| [`correctness/effect-as-onmount`](../../docs/src/content/docs/rules/correctness/effect-as-onmount.md)                 | 10              | 6    | 8 / 0 / 2 / 0                         | 100% (8/8)       | 20% (2/10)    |
| [`correctness/instance-browser-global`](../../docs/src/content/docs/rules/correctness/instance-browser-global.md)     | 4               | 3    | 0 / 1 / 3 / 0                         | 0% (0/1)         | 75% (3/4)     |
| [`correctness/nonreactive-builtin-state`](../../docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md) | 0               | 0    | —                                     | —                | —             |
| [`correctness/orphan-effect`](../../docs/src/content/docs/rules/correctness/orphan-effect.md)                         | 0               | 0    | —                                     | —                | —             |
| [`correctness/orphan-lifecycle`](../../docs/src/content/docs/rules/correctness/orphan-lifecycle.md)                   | 0               | 0    | —                                     | —                | —             |
| [`correctness/prop-mutation`](../../docs/src/content/docs/rules/correctness/prop-mutation.md)                         | 62              | 11   | 19 / 0 / 43 / 0                       | 100% (19/19)     | 69% (43/62)   |
| [`correctness/server-browser-global`](../../docs/src/content/docs/rules/correctness/server-browser-global.md)         | 0               | 0    | —                                     | —                | —             |
| [`correctness/stale-prop-derivation`](../../docs/src/content/docs/rules/correctness/stale-prop-derivation.md)         | 33              | 8    | 7 / 0 / 26 / 0                        | 100% (7/7)       | 79% (26/33)   |
| [`correctness/unmutated-state`](../../docs/src/content/docs/rules/correctness/unmutated-state.md)                     | 37              | 12   | 37 / 0 / 0 / 0                        | 100% (37/37)     | 0% (0/37)     |
| [`performance/font-preload-crossorigin`](../../docs/src/content/docs/rules/performance/font-preload-crossorigin.md)   | 0               | 0    | —                                     | —                | —             |
| [`performance/heavy-import`](../../docs/src/content/docs/rules/performance/heavy-import.md)                           | 0               | 0    | —                                     | —                | —             |
| [`performance/iframe-loading`](../../docs/src/content/docs/rules/performance/iframe-loading.md)                       | 39              | 12   | 20 / 0 / 18 / 1                       | 100% (20/20)     | 46% (18/39)   |
| [`performance/image-dimensions`](../../docs/src/content/docs/rules/performance/image-dimensions.md)                   | 112             | 16   | 41 / 0 / 71 / 0                       | 100% (41/41)     | 63% (71/112)  |
| [`performance/image-loading-hint`](../../docs/src/content/docs/rules/performance/image-loading-hint.md)               | 110             | 18   | 65 / 0 / 45 / 0                       | 100% (65/65)     | 41% (45/110)  |
| [`performance/lcp-image`](../../docs/src/content/docs/rules/performance/lcp-image.md)                                 | 3               | 2    | 1 / 1 / 1 / 0                         | 50% (1/2)        | 33% (1/3)     |
| [`performance/load-waterfall`](../../docs/src/content/docs/rules/performance/load-waterfall.md)                       | 15              | 5    | 3 / 0 / 12 / 0                        | 100% (3/3)       | 80% (12/15)   |
| [`performance/minify-disabled`](../../docs/src/content/docs/rules/performance/minify-disabled.md)                     | 0               | 0    | —                                     | —                | —             |
| [`performance/namespace-import`](../../docs/src/content/docs/rules/performance/namespace-import.md)                   | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)      |
| [`performance/preconnect`](../../docs/src/content/docs/rules/performance/preconnect.md)                               | 0               | 0    | —                                     | —                | —             |
| [`performance/preload-missing-as`](../../docs/src/content/docs/rules/performance/preload-missing-as.md)               | 0               | 0    | —                                     | —                | —             |
| [`performance/render-blocking-script`](../../docs/src/content/docs/rules/performance/render-blocking-script.md)       | 0               | 0    | —                                     | —                | —             |
| [`performance/responsive-image`](../../docs/src/content/docs/rules/performance/responsive-image.md)                   | 111             | 17   | 103 / 0 / 8 / 0                       | 100% (103/103)   | 7% (8/111)    |
| [`performance/sequential-awaits`](../../docs/src/content/docs/rules/performance/sequential-awaits.md)                 | 183             | 12   | 86 / 2 / 95 / 0                       | 98% (86/88)      | 52% (95/183)  |
| [`performance/state-raw`](../../docs/src/content/docs/rules/performance/state-raw.md)                                 | 29              | 7    | 29 / 0 / 0 / 0                        | 100% (29/29)     | 0% (0/29)     |
| [`security/handler-state-write`](../../docs/src/content/docs/rules/security/handler-state-write.md)                   | 0               | 0    | —                                     | —                | —             |
| [`security/javascript-url`](../../docs/src/content/docs/rules/security/javascript-url.md)                             | 0               | 0    | —                                     | —                | —             |
| [`security/raw-html`](../../docs/src/content/docs/rules/security/raw-html.md)                                         | 229             | 23   | 26 / 0 / 203 / 0                      | 100% (26/26)     | 89% (203/229) |
| [`security/server-module-state`](../../docs/src/content/docs/rules/security/server-module-state.md)                   | 7               | 5    | 1 / 1 / 5 / 0                         | 50% (1/2)        | 71% (5/7)     |
| [`security/shared-state-import`](../../docs/src/content/docs/rules/security/shared-state-import.md)                   | 15              | 1    | 0 / 15 / 0 / 0                        | 0% (0/15)        | 0% (0/15)     |
| [`seo/canonical-url`](../../docs/src/content/docs/rules/seo/canonical-url.md)                                         | 595             | 23   | 429 / 59 / 107 / 0                    | 88% (429/488)    | 18% (107/595) |
| [`seo/charset`](../../docs/src/content/docs/rules/seo/charset.md)                                                     | 0               | 0    | —                                     | —                | —             |
| [`seo/description-length`](../../docs/src/content/docs/rules/seo/description-length.md)                               | 32              | 8    | 32 / 0 / 0 / 0                        | 100% (32/32)     | 0% (0/32)     |
| [`seo/description-presence`](../../docs/src/content/docs/rules/seo/description-presence.md)                           | 330             | 16   | 172 / 95 / 63 / 0                     | 64% (172/267)    | 19% (63/330)  |
| [`seo/duplicate-description`](../../docs/src/content/docs/rules/seo/duplicate-description.md)                         | 5               | 3    | 5 / 0 / 0 / 0                         | 100% (5/5)       | 0% (0/5)      |
| [`seo/duplicate-title`](../../docs/src/content/docs/rules/seo/duplicate-title.md)                                     | 22              | 9    | 8 / 0 / 14 / 0                        | 100% (8/8)       | 64% (14/22)   |
| [`seo/heading-level-skip`](../../docs/src/content/docs/rules/seo/heading-level-skip.md)                               | 68              | 8    | 66 / 2 / 0 / 0                        | 97% (66/68)      | 0% (0/68)     |
| [`seo/hreflang`](../../docs/src/content/docs/rules/seo/hreflang.md)                                                   | 0               | 0    | —                                     | —                | —             |
| [`seo/html-lang`](../../docs/src/content/docs/rules/seo/html-lang.md)                                                 | 3               | 3    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)      |
| [`seo/image-alt`](../../docs/src/content/docs/rules/seo/image-alt.md)                                                 | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)      |
| [`seo/indexability`](../../docs/src/content/docs/rules/seo/indexability.md)                                           | 118             | 8    | 118 / 0 / 0 / 0                       | 100% (118/118)   | 0% (0/118)    |
| [`seo/json-ld`](../../docs/src/content/docs/rules/seo/json-ld.md)                                                     | 701             | 26   | 646 / 55 / 0 / 0                      | 92% (646/701)    | 0% (0/701)    |
| [`seo/json-ld-date-format`](../../docs/src/content/docs/rules/seo/json-ld-date-format.md)                             | 0               | 0    | —                                     | —                | —             |
| [`seo/json-ld-deprecated-type`](../../docs/src/content/docs/rules/seo/json-ld-deprecated-type.md)                     | 0               | 0    | —                                     | —                | —             |
| [`seo/json-ld-placeholder`](../../docs/src/content/docs/rules/seo/json-ld-placeholder.md)                             | 0               | 0    | —                                     | —                | —             |
| [`seo/json-ld-relative-url`](../../docs/src/content/docs/rules/seo/json-ld-relative-url.md)                           | 0               | 0    | —                                     | —                | —             |
| [`seo/json-ld-required-props`](../../docs/src/content/docs/rules/seo/json-ld-required-props.md)                       | 0               | 0    | —                                     | —                | —             |
| [`seo/json-ld-validity`](../../docs/src/content/docs/rules/seo/json-ld-validity.md)                                   | 0               | 0    | —                                     | —                | —             |
| [`seo/og-description`](../../docs/src/content/docs/rules/seo/og-description.md)                                       | 458             | 19   | 400 / 58 / 0 / 0                      | 87% (400/458)    | 0% (0/458)    |
| [`seo/og-image`](../../docs/src/content/docs/rules/seo/og-image.md)                                                   | 480             | 20   | 422 / 58 / 0 / 0                      | 88% (422/480)    | 0% (0/480)    |
| [`seo/og-title`](../../docs/src/content/docs/rules/seo/og-title.md)                                                   | 457             | 19   | 399 / 58 / 0 / 0                      | 87% (399/457)    | 0% (0/457)    |
| [`seo/og-url`](../../docs/src/content/docs/rules/seo/og-url.md)                                                       | 521             | 20   | 463 / 58 / 0 / 0                      | 89% (463/521)    | 0% (0/521)    |
| [`seo/robots-txt`](../../docs/src/content/docs/rules/seo/robots-txt.md)                                               | 11              | 11   | 10 / 0 / 1 / 0                        | 100% (10/10)     | 9% (1/11)     |
| [`seo/single-h1`](../../docs/src/content/docs/rules/seo/single-h1.md)                                                 | 348             | 25   | 211 / 124 / 12 / 1                    | 63% (211/335)    | 3% (12/348)   |
| [`seo/sitemap-in-robots`](../../docs/src/content/docs/rules/seo/sitemap-in-robots.md)                                 | 2               | 2    | 2 / 0 / 0 / 0                         | 100% (2/2)       | 0% (0/2)      |
| [`seo/sitemap-xml`](../../docs/src/content/docs/rules/seo/sitemap-xml.md)                                             | 19              | 19   | 16 / 0 / 3 / 0                        | 100% (16/16)     | 16% (3/19)    |
| [`seo/ssr-disabled`](../../docs/src/content/docs/rules/seo/ssr-disabled.md)                                           | 17              | 8    | 7 / 0 / 10 / 0                        | 100% (7/7)       | 59% (10/17)   |
| [`seo/title-length`](../../docs/src/content/docs/rules/seo/title-length.md)                                           | 103             | 17   | 101 / 2 / 0 / 0                       | 98% (101/103)    | 0% (0/103)    |
| [`seo/title-presence`](../../docs/src/content/docs/rules/seo/title-presence.md)                                       | 115             | 8    | 20 / 95 / 0 / 0                       | 17% (20/115)     | 0% (0/115)    |
| [`seo/twitter-card`](../../docs/src/content/docs/rules/seo/twitter-card.md)                                           | 525             | 20   | 440 / 85 / 0 / 0                      | 84% (440/525)    | 0% (0/525)    |
| [`seo/viewport`](../../docs/src/content/docs/rules/seo/viewport.md)                                                   | 0               | 0    | —                                     | —                | —             |

<!-- rule-reliability:end -->
