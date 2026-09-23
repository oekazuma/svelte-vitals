---
title: Rule reliability
description: How often each rule's findings hold up on real SvelteKit apps, measured on a pinned corpus.
sidebar:
  order: 4
---

A rule is only useful if its findings are right. svelte-vitals runs every rule over a fixed set of open-source SvelteKit apps, each pinned to a commit, and its findings are read one by one and given a verdict. The table below is the result.

## Verdicts

| Verdict   | Meaning                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| `tp`      | The rule's documented claim holds for this code.                                                               |
| `fp`      | The claim is false: the analyzer misread the code, or the rule contradicts its own docs.                       |
| `design`  | Reported as the rule documents, but not demonstrably a defect (e.g. ids repeated in sibling `{#if}` branches). |
| `unclear` | Could not be decided from the source alone.                                                                    |

## Reading the numbers

- **Precision** is `tp / (tp + fp)`, computed only over findings that have a verdict. A finding nobody has read is not assumed to be correct. `design` and `unclear` are shown separately and do not count toward precision in either direction.
- **Check the reviewed column before trusting a percentage.** 100% over three reviewed findings is weak evidence; 100% over three hundred is not.
- **"not yet reviewed"** means the rule fired on the corpus but none of its findings has a verdict yet, usually because the rule is new or its detection changed. It is not a pass.
- **—** in the reviewed column means the rule reported nothing on the corpus. That says nothing about the rule's quality: it only means none of these apps triggered it.
- **Findings are counted once per code location.** A component finding that shows up on forty routes counts as one finding, because one reading of the code decides all of them.
- **This measures false positives, not misses.** A defect the rule failed to report does not appear here.
- **The corpus is a small sample of SvelteKit code.** Precision on your project can differ, especially for rules that depend on project conventions.

## How it stays current

The corpus is pinned so that a verdict stays tied to the exact code it was given on. Every pull request that changes the analyzer is measured against the same corpus before and after the change, and a comment lists the findings it added or removed, flagging any added finding that has no verdict yet. Adding a rule requires re-measuring the corpus, so a new rule appears here as "not yet reviewed" until its findings have been read.

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

1288 of 5931 corpus findings have a verdict.

| Rule                                                                                    | Corpus findings | Apps | Reviewed (tp / fp / design / unclear) | Precision |
| --------------------------------------------------------------------------------------- | --------------- | ---- | ------------------------------------- | --------- |
| [`a11y/abbr-title`](/rules/a11y/abbr-title)                                             | 0               | 0    | —                                     | —         |
| [`a11y/accessible-name`](/rules/a11y/accessible-name)                                   | 6               | 1    | 6 / 0 / 0 / 0                         | 100%      |
| [`a11y/aria-hidden-focus`](/rules/a11y/aria-hidden-focus)                               | 3               | 2    | 3 / 0 / 0 / 0                         | 100%      |
| [`a11y/deprecated-aria`](/rules/a11y/deprecated-aria)                                   | 1               | 1    | 1 / 0 / 0 / 0                         | 100%      |
| [`a11y/deprecated-attr`](/rules/a11y/deprecated-attr)                                   | 10              | 2    | not yet reviewed                      | —         |
| [`a11y/deprecated-element`](/rules/a11y/deprecated-element)                             | 0               | 0    | —                                     | —         |
| [`a11y/disallowed-aria-props`](/rules/a11y/disallowed-aria-props)                       | 29              | 7    | 1 / 0 / 0 / 0                         | 100%      |
| [`a11y/disallowed-element`](/rules/a11y/disallowed-element)                             | 0               | 0    | —                                     | —         |
| [`a11y/doctype`](/rules/a11y/doctype)                                                   | 0               | 0    | —                                     | —         |
| [`a11y/duplicate-landmark`](/rules/a11y/duplicate-landmark)                             | 4               | 3    | 2 / 0 / 2 / 0                         | 100%      |
| [`a11y/id-duplication`](/rules/a11y/id-duplication)                                     | 101             | 5    | 14 / 0 / 54 / 0                       | 100%      |
| [`a11y/interactive-nesting`](/rules/a11y/interactive-nesting)                           | 60              | 4    | 11 / 0 / 0 / 0                        | 100%      |
| [`a11y/invalid-aria-value`](/rules/a11y/invalid-aria-value)                             | 0               | 0    | —                                     | —         |
| [`a11y/invalid-role`](/rules/a11y/invalid-role)                                         | 0               | 0    | —                                     | —         |
| [`a11y/label-has-control`](/rules/a11y/label-has-control)                               | 1               | 1    | 1 / 0 / 0 / 0                         | 100%      |
| [`a11y/no-accesskey`](/rules/a11y/no-accesskey)                                         | 0               | 0    | —                                     | —         |
| [`a11y/no-autofocus`](/rules/a11y/no-autofocus)                                         | 2               | 1    | 2 / 0 / 0 / 0                         | 100%      |
| [`a11y/no-duplicate-dt`](/rules/a11y/no-duplicate-dt)                                   | 0               | 0    | —                                     | —         |
| [`a11y/no-missing-id-ref`](/rules/a11y/no-missing-id-ref)                               | 0               | 0    | —                                     | —         |
| [`a11y/pattern-title`](/rules/a11y/pattern-title)                                       | 2               | 2    | 2 / 0 / 0 / 0                         | 100%      |
| [`a11y/permitted-contents`](/rules/a11y/permitted-contents)                             | 796             | 15   | 458 / 0 / 0 / 0                       | 100%      |
| [`a11y/placeholder-label-option`](/rules/a11y/placeholder-label-option)                 | 2               | 1    | 2 / 0 / 0 / 0                         | 100%      |
| [`a11y/positive-tabindex`](/rules/a11y/positive-tabindex)                               | 0               | 0    | —                                     | —         |
| [`a11y/require-datetime`](/rules/a11y/require-datetime)                                 | 0               | 0    | —                                     | —         |
| [`a11y/required-aria-props`](/rules/a11y/required-aria-props)                           | 1               | 1    | 1 / 0 / 0 / 0                         | 100%      |
| [`a11y/required-element`](/rules/a11y/required-element)                                 | 0               | 0    | —                                     | —         |
| [`a11y/top-level-landmark`](/rules/a11y/top-level-landmark)                             | 6               | 5    | 5 / 0 / 0 / 0                         | 100%      |
| [`a11y/unknown-aria-attribute`](/rules/a11y/unknown-aria-attribute)                     | 0               | 0    | —                                     | —         |
| [`a11y/unverified-id-ref`](/rules/a11y/unverified-id-ref)                               | 0               | 0    | —                                     | —         |
| [`a11y/use-list`](/rules/a11y/use-list)                                                 | 0               | 0    | —                                     | —         |
| [`architecture/component-size`](/rules/architecture/component-size)                     | 605             | 14   | not yet reviewed                      | —         |
| [`architecture/directory-naming`](/rules/architecture/directory-naming)                 | 0               | 0    | —                                     | —         |
| [`architecture/doc-link-target`](/rules/architecture/doc-link-target)                   | 0               | 0    | —                                     | —         |
| [`architecture/private-scope-import`](/rules/architecture/private-scope-import)         | 0               | 0    | —                                     | —         |
| [`architecture/prop-count`](/rules/architecture/prop-count)                             | 97              | 10   | not yet reviewed                      | —         |
| [`architecture/reserved-directory-names`](/rules/architecture/reserved-directory-names) | 0               | 0    | —                                     | —         |
| [`architecture/reserved-name-placement`](/rules/architecture/reserved-name-placement)   | 0               | 0    | —                                     | —         |
| [`architecture/route-component-import`](/rules/architecture/route-component-import)     | 1               | 1    | not yet reviewed                      | —         |
| [`architecture/unit-entry-file`](/rules/architecture/unit-entry-file)                   | 0               | 0    | —                                     | —         |
| [`correctness/autoplay-muted`](/rules/correctness/autoplay-muted)                       | 1               | 1    | 0 / 0 / 0 / 1                         | —         |
| [`correctness/base-path-navigation`](/rules/correctness/base-path-navigation)           | 34              | 2    | 34 / 0 / 0 / 0                        | 100%      |
| [`correctness/checkable-bind-value`](/rules/correctness/checkable-bind-value)           | 0               | 0    | —                                     | —         |
| [`correctness/each-index-key`](/rules/correctness/each-index-key)                       | 384             | 9    | 239 / 0 / 0 / 0                       | 100%      |
| [`correctness/each-key`](/rules/correctness/each-key)                                   | 569             | 12   | 0 / 0 / 66 / 0                        | —         |
| [`correctness/effect-as-derived`](/rules/correctness/effect-as-derived)                 | 4               | 3    | 4 / 0 / 0 / 0                         | 100%      |
| [`correctness/effect-as-onmount`](/rules/correctness/effect-as-onmount)                 | 3               | 2    | 3 / 0 / 0 / 0                         | 100%      |
| [`correctness/instance-browser-global`](/rules/correctness/instance-browser-global)     | 1               | 1    | 1 / 0 / 0 / 0                         | 100%      |
| [`correctness/nonreactive-builtin-state`](/rules/correctness/nonreactive-builtin-state) | 0               | 0    | —                                     | —         |
| [`correctness/orphan-effect`](/rules/correctness/orphan-effect)                         | 0               | 0    | —                                     | —         |
| [`correctness/orphan-lifecycle`](/rules/correctness/orphan-lifecycle)                   | 0               | 0    | —                                     | —         |
| [`correctness/prop-mutation`](/rules/correctness/prop-mutation)                         | 37              | 7    | 2 / 4 / 11 / 0                        | 33%       |
| [`correctness/server-browser-global`](/rules/correctness/server-browser-global)         | 0               | 0    | —                                     | —         |
| [`correctness/stale-prop-derivation`](/rules/correctness/stale-prop-derivation)         | 27              | 4    | not yet reviewed                      | —         |
| [`correctness/unmutated-state`](/rules/correctness/unmutated-state)                     | 23              | 4    | not yet reviewed                      | —         |
| [`performance/font-preload-crossorigin`](/rules/performance/font-preload-crossorigin)   | 0               | 0    | —                                     | —         |
| [`performance/heavy-import`](/rules/performance/heavy-import)                           | 0               | 0    | —                                     | —         |
| [`performance/iframe-loading`](/rules/performance/iframe-loading)                       | 23              | 6    | 0 / 0 / 7 / 0                         | —         |
| [`performance/image-dimensions`](/rules/performance/image-dimensions)                   | 58              | 9    | not yet reviewed                      | —         |
| [`performance/image-loading-hint`](/rules/performance/image-loading-hint)               | 60              | 9    | not yet reviewed                      | —         |
| [`performance/lcp-image`](/rules/performance/lcp-image)                                 | 0               | 0    | —                                     | —         |
| [`performance/load-waterfall`](/rules/performance/load-waterfall)                       | 4               | 3    | 3 / 0 / 0 / 1                         | 100%      |
| [`performance/minify-disabled`](/rules/performance/minify-disabled)                     | 0               | 0    | —                                     | —         |
| [`performance/namespace-import`](/rules/performance/namespace-import)                   | 16              | 4    | not yet reviewed                      | —         |
| [`performance/preconnect`](/rules/performance/preconnect)                               | 0               | 0    | —                                     | —         |
| [`performance/preload-missing-as`](/rules/performance/preload-missing-as)               | 0               | 0    | —                                     | —         |
| [`performance/render-blocking-script`](/rules/performance/render-blocking-script)       | 0               | 0    | —                                     | —         |
| [`performance/responsive-image`](/rules/performance/responsive-image)                   | 62              | 9    | not yet reviewed                      | —         |
| [`performance/sequential-awaits`](/rules/performance/sequential-awaits)                 | 117             | 4    | not yet reviewed                      | —         |
| [`performance/state-raw`](/rules/performance/state-raw)                                 | 23              | 4    | not yet reviewed                      | —         |
| [`security/handler-state-write`](/rules/security/handler-state-write)                   | 0               | 0    | —                                     | —         |
| [`security/javascript-url`](/rules/security/javascript-url)                             | 0               | 0    | —                                     | —         |
| [`security/raw-html`](/rules/security/raw-html)                                         | 97              | 13   | 97 / 0 / 0 / 0                        | 100%      |
| [`security/server-module-state`](/rules/security/server-module-state)                   | 3               | 2    | 3 / 0 / 0 / 0                         | 100%      |
| [`security/shared-state-import`](/rules/security/shared-state-import)                   | 0               | 0    | —                                     | —         |
| [`seo/canonical-url`](/rules/seo/canonical-url)                                         | 333             | 15   | not yet reviewed                      | —         |
| [`seo/charset`](/rules/seo/charset)                                                     | 0               | 0    | —                                     | —         |
| [`seo/description-length`](/rules/seo/description-length)                               | 27              | 5    | not yet reviewed                      | —         |
| [`seo/description-presence`](/rules/seo/description-presence)                           | 135             | 10   | not yet reviewed                      | —         |
| [`seo/duplicate-description`](/rules/seo/duplicate-description)                         | 4               | 2    | 4 / 0 / 0 / 0                         | 100%      |
| [`seo/duplicate-title`](/rules/seo/duplicate-title)                                     | 4               | 4    | 4 / 0 / 0 / 0                         | 100%      |
| [`seo/heading-level-skip`](/rules/seo/heading-level-skip)                               | 60              | 4    | 48 / 0 / 0 / 0                        | 100%      |
| [`seo/hreflang`](/rules/seo/hreflang)                                                   | 0               | 0    | —                                     | —         |
| [`seo/html-lang`](/rules/seo/html-lang)                                                 | 2               | 2    | 2 / 0 / 0 / 0                         | 100%      |
| [`seo/image-alt`](/rules/seo/image-alt)                                                 | 0               | 0    | —                                     | —         |
| [`seo/indexability`](/rules/seo/indexability)                                           | 86              | 3    | 86 / 0 / 0 / 0                        | 100%      |
| [`seo/json-ld`](/rules/seo/json-ld)                                                     | 528             | 16   | not yet reviewed                      | —         |
| [`seo/json-ld-date-format`](/rules/seo/json-ld-date-format)                             | 0               | 0    | —                                     | —         |
| [`seo/json-ld-deprecated-type`](/rules/seo/json-ld-deprecated-type)                     | 0               | 0    | —                                     | —         |
| [`seo/json-ld-placeholder`](/rules/seo/json-ld-placeholder)                             | 0               | 0    | —                                     | —         |
| [`seo/json-ld-relative-url`](/rules/seo/json-ld-relative-url)                           | 0               | 0    | —                                     | —         |
| [`seo/json-ld-required-props`](/rules/seo/json-ld-required-props)                       | 0               | 0    | —                                     | —         |
| [`seo/json-ld-validity`](/rules/seo/json-ld-validity)                                   | 0               | 0    | —                                     | —         |
| [`seo/og-description`](/rules/seo/og-description)                                       | 220             | 12   | not yet reviewed                      | —         |
| [`seo/og-image`](/rules/seo/og-image)                                                   | 240             | 13   | not yet reviewed                      | —         |
| [`seo/og-title`](/rules/seo/og-title)                                                   | 219             | 12   | not yet reviewed                      | —         |
| [`seo/og-url`](/rules/seo/og-url)                                                       | 282             | 13   | not yet reviewed                      | —         |
| [`seo/robots-txt`](/rules/seo/robots-txt)                                               | 6               | 6    | 6 / 0 / 0 / 0                         | 100%      |
| [`seo/single-h1`](/rules/seo/single-h1)                                                 | 169             | 16   | 74 / 0 / 1 / 0                        | 100%      |
| [`seo/sitemap-in-robots`](/rules/seo/sitemap-in-robots)                                 | 1               | 1    | not yet reviewed                      | —         |
| [`seo/sitemap-xml`](/rules/seo/sitemap-xml)                                             | 12              | 12   | 12 / 0 / 0 / 0                        | 100%      |
| [`seo/ssr-disabled`](/rules/seo/ssr-disabled)                                           | 7               | 4    | 7 / 0 / 0 / 0                         | 100%      |
| [`seo/title-length`](/rules/seo/title-length)                                           | 51              | 10   | 3 / 0 / 0 / 0                         | 100%      |
| [`seo/title-presence`](/rules/seo/title-presence)                                       | 14              | 5    | not yet reviewed                      | —         |
| [`seo/twitter-card`](/rules/seo/twitter-card)                                           | 258             | 12   | not yet reviewed                      | —         |
| [`seo/viewport`](/rules/seo/viewport)                                                   | 0               | 0    | —                                     | —         |

<!-- rule-reliability:end -->
