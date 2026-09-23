---
title: ルールの信頼性
description: 各ルールの検出結果が実際の SvelteKit アプリでどれだけ正しいかを、コミットを固定したコーパスで計測した結果。
sidebar:
  order: 4
---

ルールは検出結果が正しくて初めて役に立ちます。svelte-vitals は、コミットを固定したオープンソースの SvelteKit アプリ群に対して全ルールを実行し、検出結果を 1 件ずつ読んで判定を付けています。その集計が下の表です。

## 判定

| 判定      | 意味                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------- |
| `tp`      | ルールのドキュメントが主張するとおりの問題が、そのコードにある。                                        |
| `fp`      | 主張が誤っている。解析がコードを読み違えたか、ルールが自身のドキュメントと矛盾している。                |
| `design`  | ドキュメントどおりの報告だが、欠陥とまでは言えない（例：兄弟の `{#if}` ブロックで同じ id を使うもの）。 |
| `unclear` | ソースコードだけでは判断できなかった。                                                                  |

## 数値の読み方

- **適合率**は `tp / (tp + fp)` で、判定の付いた検出結果だけから計算します。誰も読んでいない検出結果を正しいとは見なしません。`design` と `unclear` は別に表示し、適合率にはどちら向きにも含めません。
- **パーセンテージを信じる前に、レビュー済みの件数を確かめてください。** レビュー済み 3 件での 100% は根拠として弱く、300 件での 100% とは重みが違います。
- **「未レビュー」**は、コーパスで検出はあるものの判定がまだ 1 件も付いていないことを表します。ルールが新しいか、検出ロジックが変わった直後によく見られます。合格という意味ではありません。
- レビュー済みの列の **—** は、コーパスで 1 件も検出がなかったことを表します。ルールの品質については何も語らず、どのアプリもそのルールに該当しなかったというだけです。
- **検出はコード上の位置ごとに 1 件と数えます。** 40 のルートに現れるコンポーネントの検出も 1 件です。コードを 1 度読めば、すべてのルートについて判定できるからです。
- **計測しているのは誤検知で、見逃しではありません。** ルールが報告しなかった欠陥はここに現れません。
- **コーパスは SvelteKit のコードのごく一部です。** プロジェクトの規約に左右されるルールを中心に、あなたのプロジェクトでの適合率とは異なることがあります。

## 最新の状態を保つ仕組み

コーパスのコミットを固定しているのは、判定をそれが付けられたコードに結び付けておくためです。解析器を変更するプルリクエストはどれも、変更の前後で同じコーパスを計測し、追加・削除された検出結果の一覧がコメントされます。追加された検出結果のうち判定のないものには印が付きます。ルールを追加するとコーパスの再計測が必要になるので、新しいルールは検出結果が読まれるまで「未レビュー」として表示されます。

## 計測結果

<!-- rule-reliability:start -->

計測対象は次の 16 個のアプリです。どれもコミットを固定しています。

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

コーパスでの検出 5675 件のうち、判定済みは 1288 件です。

| ルール                                                                                     | コーパスでの検出数 | アプリ数 | レビュー済み (tp / fp / design / unclear) | 適合率         |
| ------------------------------------------------------------------------------------------ | ------------------ | -------- | ----------------------------------------- | -------------- |
| [`a11y/abbr-title`](/ja/rules/a11y/abbr-title)                                             | 0                  | 0        | —                                         | —              |
| [`a11y/accessible-name`](/ja/rules/a11y/accessible-name)                                   | 6                  | 1        | 6 / 0 / 0 / 0                             | 100% (6/6)     |
| [`a11y/aria-hidden-focus`](/ja/rules/a11y/aria-hidden-focus)                               | 3                  | 2        | 3 / 0 / 0 / 0                             | 100% (3/3)     |
| [`a11y/deprecated-aria`](/ja/rules/a11y/deprecated-aria)                                   | 1                  | 1        | 1 / 0 / 0 / 0                             | 100% (1/1)     |
| [`a11y/deprecated-attr`](/ja/rules/a11y/deprecated-attr)                                   | 10                 | 2        | 未レビュー                                | —              |
| [`a11y/deprecated-element`](/ja/rules/a11y/deprecated-element)                             | 0                  | 0        | —                                         | —              |
| [`a11y/disallowed-aria-props`](/ja/rules/a11y/disallowed-aria-props)                       | 29                 | 7        | 1 / 0 / 0 / 0                             | 100% (1/1)     |
| [`a11y/disallowed-element`](/ja/rules/a11y/disallowed-element)                             | 0                  | 0        | —                                         | —              |
| [`a11y/doctype`](/ja/rules/a11y/doctype)                                                   | 0                  | 0        | —                                         | —              |
| [`a11y/duplicate-landmark`](/ja/rules/a11y/duplicate-landmark)                             | 4                  | 3        | 2 / 0 / 2 / 0                             | 100% (2/2)     |
| [`a11y/id-duplication`](/ja/rules/a11y/id-duplication)                                     | 101                | 5        | 14 / 0 / 54 / 0                           | 100% (14/14)   |
| [`a11y/interactive-nesting`](/ja/rules/a11y/interactive-nesting)                           | 60                 | 4        | 11 / 0 / 0 / 0                            | 100% (11/11)   |
| [`a11y/invalid-aria-value`](/ja/rules/a11y/invalid-aria-value)                             | 0                  | 0        | —                                         | —              |
| [`a11y/invalid-role`](/ja/rules/a11y/invalid-role)                                         | 0                  | 0        | —                                         | —              |
| [`a11y/label-has-control`](/ja/rules/a11y/label-has-control)                               | 1                  | 1        | 1 / 0 / 0 / 0                             | 100% (1/1)     |
| [`a11y/no-accesskey`](/ja/rules/a11y/no-accesskey)                                         | 0                  | 0        | —                                         | —              |
| [`a11y/no-autofocus`](/ja/rules/a11y/no-autofocus)                                         | 2                  | 1        | 2 / 0 / 0 / 0                             | 100% (2/2)     |
| [`a11y/no-duplicate-dt`](/ja/rules/a11y/no-duplicate-dt)                                   | 0                  | 0        | —                                         | —              |
| [`a11y/no-missing-id-ref`](/ja/rules/a11y/no-missing-id-ref)                               | 0                  | 0        | —                                         | —              |
| [`a11y/pattern-title`](/ja/rules/a11y/pattern-title)                                       | 2                  | 2        | 2 / 0 / 0 / 0                             | 100% (2/2)     |
| [`a11y/permitted-contents`](/ja/rules/a11y/permitted-contents)                             | 796                | 15       | 458 / 0 / 0 / 0                           | 100% (458/458) |
| [`a11y/placeholder-label-option`](/ja/rules/a11y/placeholder-label-option)                 | 2                  | 1        | 2 / 0 / 0 / 0                             | 100% (2/2)     |
| [`a11y/positive-tabindex`](/ja/rules/a11y/positive-tabindex)                               | 0                  | 0        | —                                         | —              |
| [`a11y/require-datetime`](/ja/rules/a11y/require-datetime)                                 | 0                  | 0        | —                                         | —              |
| [`a11y/required-aria-props`](/ja/rules/a11y/required-aria-props)                           | 1                  | 1        | 1 / 0 / 0 / 0                             | 100% (1/1)     |
| [`a11y/required-element`](/ja/rules/a11y/required-element)                                 | 0                  | 0        | —                                         | —              |
| [`a11y/top-level-landmark`](/ja/rules/a11y/top-level-landmark)                             | 6                  | 5        | 5 / 0 / 0 / 0                             | 100% (5/5)     |
| [`a11y/unknown-aria-attribute`](/ja/rules/a11y/unknown-aria-attribute)                     | 0                  | 0        | —                                         | —              |
| [`a11y/unverified-id-ref`](/ja/rules/a11y/unverified-id-ref)                               | 0                  | 0        | —                                         | —              |
| [`a11y/use-list`](/ja/rules/a11y/use-list)                                                 | 0                  | 0        | —                                         | —              |
| [`architecture/component-size`](/ja/rules/architecture/component-size)                     | 605                | 14       | 未レビュー                                | —              |
| [`architecture/directory-naming`](/ja/rules/architecture/directory-naming)                 | 0                  | 0        | —                                         | —              |
| [`architecture/doc-link-target`](/ja/rules/architecture/doc-link-target)                   | 0                  | 0        | —                                         | —              |
| [`architecture/private-scope-import`](/ja/rules/architecture/private-scope-import)         | 0                  | 0        | —                                         | —              |
| [`architecture/prop-count`](/ja/rules/architecture/prop-count)                             | 97                 | 10       | 未レビュー                                | —              |
| [`architecture/reserved-directory-names`](/ja/rules/architecture/reserved-directory-names) | 0                  | 0        | —                                         | —              |
| [`architecture/reserved-name-placement`](/ja/rules/architecture/reserved-name-placement)   | 0                  | 0        | —                                         | —              |
| [`architecture/route-component-import`](/ja/rules/architecture/route-component-import)     | 1                  | 1        | 未レビュー                                | —              |
| [`architecture/unit-entry-file`](/ja/rules/architecture/unit-entry-file)                   | 0                  | 0        | —                                         | —              |
| [`correctness/autoplay-muted`](/ja/rules/correctness/autoplay-muted)                       | 1                  | 1        | 0 / 0 / 0 / 1                             | —              |
| [`correctness/base-path-navigation`](/ja/rules/correctness/base-path-navigation)           | 34                 | 2        | 34 / 0 / 0 / 0                            | 100% (34/34)   |
| [`correctness/checkable-bind-value`](/ja/rules/correctness/checkable-bind-value)           | 0                  | 0        | —                                         | —              |
| [`correctness/each-index-key`](/ja/rules/correctness/each-index-key)                       | 384                | 9        | 239 / 0 / 0 / 0                           | 100% (239/239) |
| [`correctness/each-key`](/ja/rules/correctness/each-key)                                   | 569                | 12       | 0 / 0 / 66 / 0                            | —              |
| [`correctness/effect-as-derived`](/ja/rules/correctness/effect-as-derived)                 | 4                  | 3        | 4 / 0 / 0 / 0                             | 100% (4/4)     |
| [`correctness/effect-as-onmount`](/ja/rules/correctness/effect-as-onmount)                 | 3                  | 2        | 3 / 0 / 0 / 0                             | 100% (3/3)     |
| [`correctness/instance-browser-global`](/ja/rules/correctness/instance-browser-global)     | 1                  | 1        | 1 / 0 / 0 / 0                             | 100% (1/1)     |
| [`correctness/nonreactive-builtin-state`](/ja/rules/correctness/nonreactive-builtin-state) | 0                  | 0        | —                                         | —              |
| [`correctness/orphan-effect`](/ja/rules/correctness/orphan-effect)                         | 0                  | 0        | —                                         | —              |
| [`correctness/orphan-lifecycle`](/ja/rules/correctness/orphan-lifecycle)                   | 0                  | 0        | —                                         | —              |
| [`correctness/prop-mutation`](/ja/rules/correctness/prop-mutation)                         | 37                 | 7        | 2 / 4 / 11 / 0                            | 33% (2/6)      |
| [`correctness/server-browser-global`](/ja/rules/correctness/server-browser-global)         | 0                  | 0        | —                                         | —              |
| [`correctness/stale-prop-derivation`](/ja/rules/correctness/stale-prop-derivation)         | 27                 | 4        | 未レビュー                                | —              |
| [`correctness/unmutated-state`](/ja/rules/correctness/unmutated-state)                     | 23                 | 4        | 未レビュー                                | —              |
| [`performance/font-preload-crossorigin`](/ja/rules/performance/font-preload-crossorigin)   | 0                  | 0        | —                                         | —              |
| [`performance/heavy-import`](/ja/rules/performance/heavy-import)                           | 0                  | 0        | —                                         | —              |
| [`performance/iframe-loading`](/ja/rules/performance/iframe-loading)                       | 23                 | 6        | 0 / 0 / 7 / 0                             | —              |
| [`performance/image-dimensions`](/ja/rules/performance/image-dimensions)                   | 58                 | 9        | 未レビュー                                | —              |
| [`performance/image-loading-hint`](/ja/rules/performance/image-loading-hint)               | 60                 | 9        | 未レビュー                                | —              |
| [`performance/lcp-image`](/ja/rules/performance/lcp-image)                                 | 0                  | 0        | —                                         | —              |
| [`performance/load-waterfall`](/ja/rules/performance/load-waterfall)                       | 4                  | 3        | 3 / 0 / 0 / 1                             | 100% (3/3)     |
| [`performance/minify-disabled`](/ja/rules/performance/minify-disabled)                     | 0                  | 0        | —                                         | —              |
| [`performance/namespace-import`](/ja/rules/performance/namespace-import)                   | 16                 | 4        | 未レビュー                                | —              |
| [`performance/preconnect`](/ja/rules/performance/preconnect)                               | 0                  | 0        | —                                         | —              |
| [`performance/preload-missing-as`](/ja/rules/performance/preload-missing-as)               | 0                  | 0        | —                                         | —              |
| [`performance/render-blocking-script`](/ja/rules/performance/render-blocking-script)       | 0                  | 0        | —                                         | —              |
| [`performance/responsive-image`](/ja/rules/performance/responsive-image)                   | 54                 | 9        | 未レビュー                                | —              |
| [`performance/sequential-awaits`](/ja/rules/performance/sequential-awaits)                 | 117                | 4        | 未レビュー                                | —              |
| [`performance/state-raw`](/ja/rules/performance/state-raw)                                 | 23                 | 4        | 未レビュー                                | —              |
| [`security/handler-state-write`](/ja/rules/security/handler-state-write)                   | 0                  | 0        | —                                         | —              |
| [`security/javascript-url`](/ja/rules/security/javascript-url)                             | 0                  | 0        | —                                         | —              |
| [`security/raw-html`](/ja/rules/security/raw-html)                                         | 97                 | 13       | 97 / 0 / 0 / 0                            | 100% (97/97)   |
| [`security/server-module-state`](/ja/rules/security/server-module-state)                   | 3                  | 2        | 3 / 0 / 0 / 0                             | 100% (3/3)     |
| [`security/shared-state-import`](/ja/rules/security/shared-state-import)                   | 0                  | 0        | —                                         | —              |
| [`seo/canonical-url`](/ja/rules/seo/canonical-url)                                         | 328                | 15       | 未レビュー                                | —              |
| [`seo/charset`](/ja/rules/seo/charset)                                                     | 0                  | 0        | —                                         | —              |
| [`seo/description-length`](/ja/rules/seo/description-length)                               | 27                 | 5        | 未レビュー                                | —              |
| [`seo/description-presence`](/ja/rules/seo/description-presence)                           | 132                | 10       | 未レビュー                                | —              |
| [`seo/duplicate-description`](/ja/rules/seo/duplicate-description)                         | 4                  | 2        | 4 / 0 / 0 / 0                             | 100% (4/4)     |
| [`seo/duplicate-title`](/ja/rules/seo/duplicate-title)                                     | 4                  | 4        | 4 / 0 / 0 / 0                             | 100% (4/4)     |
| [`seo/heading-level-skip`](/ja/rules/seo/heading-level-skip)                               | 60                 | 4        | 48 / 0 / 0 / 0                            | 100% (48/48)   |
| [`seo/hreflang`](/ja/rules/seo/hreflang)                                                   | 0                  | 0        | —                                         | —              |
| [`seo/html-lang`](/ja/rules/seo/html-lang)                                                 | 2                  | 2        | 2 / 0 / 0 / 0                             | 100% (2/2)     |
| [`seo/image-alt`](/ja/rules/seo/image-alt)                                                 | 0                  | 0        | —                                         | —              |
| [`seo/indexability`](/ja/rules/seo/indexability)                                           | 86                 | 3        | 86 / 0 / 0 / 0                            | 100% (86/86)   |
| [`seo/json-ld`](/ja/rules/seo/json-ld)                                                     | 324                | 15       | 未レビュー                                | —              |
| [`seo/json-ld-date-format`](/ja/rules/seo/json-ld-date-format)                             | 0                  | 0        | —                                         | —              |
| [`seo/json-ld-deprecated-type`](/ja/rules/seo/json-ld-deprecated-type)                     | 0                  | 0        | —                                         | —              |
| [`seo/json-ld-placeholder`](/ja/rules/seo/json-ld-placeholder)                             | 0                  | 0        | —                                         | —              |
| [`seo/json-ld-relative-url`](/ja/rules/seo/json-ld-relative-url)                           | 0                  | 0        | —                                         | —              |
| [`seo/json-ld-required-props`](/ja/rules/seo/json-ld-required-props)                       | 0                  | 0        | —                                         | —              |
| [`seo/json-ld-validity`](/ja/rules/seo/json-ld-validity)                                   | 0                  | 0        | —                                         | —              |
| [`seo/og-description`](/ja/rules/seo/og-description)                                       | 217                | 12       | 未レビュー                                | —              |
| [`seo/og-image`](/ja/rules/seo/og-image)                                                   | 237                | 13       | 未レビュー                                | —              |
| [`seo/og-title`](/ja/rules/seo/og-title)                                                   | 216                | 12       | 未レビュー                                | —              |
| [`seo/og-url`](/ja/rules/seo/og-url)                                                       | 278                | 13       | 未レビュー                                | —              |
| [`seo/robots-txt`](/ja/rules/seo/robots-txt)                                               | 6                  | 6        | 6 / 0 / 0 / 0                             | 100% (6/6)     |
| [`seo/single-h1`](/ja/rules/seo/single-h1)                                                 | 151                | 15       | 74 / 0 / 1 / 0                            | 100% (74/74)   |
| [`seo/sitemap-in-robots`](/ja/rules/seo/sitemap-in-robots)                                 | 1                  | 1        | 未レビュー                                | —              |
| [`seo/sitemap-xml`](/ja/rules/seo/sitemap-xml)                                             | 12                 | 12       | 12 / 0 / 0 / 0                            | 100% (12/12)   |
| [`seo/ssr-disabled`](/ja/rules/seo/ssr-disabled)                                           | 7                  | 4        | 7 / 0 / 0 / 0                             | 100% (7/7)     |
| [`seo/title-length`](/ja/rules/seo/title-length)                                           | 51                 | 10       | 3 / 0 / 0 / 0                             | 100% (3/3)     |
| [`seo/title-presence`](/ja/rules/seo/title-presence)                                       | 12                 | 5        | 未レビュー                                | —              |
| [`seo/twitter-card`](/ja/rules/seo/twitter-card)                                           | 255                | 12       | 未レビュー                                | —              |
| [`seo/viewport`](/ja/rules/seo/viewport)                                                   | 0                  | 0        | —                                         | —              |

<!-- rule-reliability:end -->
