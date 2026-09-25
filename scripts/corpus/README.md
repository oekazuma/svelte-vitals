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

Measured on 56 apps, each pinned to a commit:

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
- [strelov1/freehire/web](https://github.com/strelov1/freehire/tree/357088b4277d5682469fdb88d4dfd8ae4da405b2/web) (`357088b`)
- [JuiceBoxxGames/utsuwa](https://github.com/JuiceBoxxGames/utsuwa/tree/f6dcad9b63209c33b033ea3505e3eb574aa37bf3) (`f6dcad9`)
- [SkillsCat/skillscat/apps/web](https://github.com/SkillsCat/skillscat/tree/cecb16529882a5f3a50c92eaf9ecea07f5b6bdbe/apps/web) (`cecb165`)
- [meshcore-ninja/meshcore-ninja](https://github.com/meshcore-ninja/meshcore-ninja/tree/cef2c91fc0bbfd7c857257466672a59663ec6139) (`cef2c91`)
- [WelcometoMyGarden/welcometomygarden](https://github.com/WelcometoMyGarden/welcometomygarden/tree/51c8c320e9dcbdaaf59f0e632f5ef07e5eb8111a) (`51c8c32`)
- [itswadesh/svelte-commerce](https://github.com/itswadesh/svelte-commerce/tree/7dff73af631167f9ce846468fd224eb6b555f9c8) (`7dff73a`)
- [chithi-dev/chithi/src/frontend](https://github.com/chithi-dev/chithi/tree/b53647156e38c5570846351e03e07b17cdaf8bf1/src/frontend) (`b536471`)
- [tradingstrategy-ai/frontend](https://github.com/tradingstrategy-ai/frontend/tree/06129ca54672d1857aba405d3d8d35ed0d0f4007) (`06129ca`)
- [apchrme/phoxiv](https://github.com/apchrme/phoxiv/tree/5f5dcda625a6e0abc34eb8c472c45676eba9df7b) (`5f5dcda`)
- [Django-CRM/Django-CRM/frontend](https://github.com/Django-CRM/Django-CRM/tree/7ef17056d1316616b04d4d4abb93844749bfdcbd/frontend) (`7ef1705`)
- [ZTL-ARTCC/scheddy](https://github.com/ZTL-ARTCC/scheddy/tree/29587e6fdbe89febaa0ece6963b22a8ac37d2f1f) (`29587e6`)
- [logtide-dev/logtide/packages/frontend](https://github.com/logtide-dev/logtide/tree/3c0c0bbf41ce59da72d2ebe11caf77d86d5554e2/packages/frontend) (`3c0c0bb`)
- [krmanik/Anki-xiehanzi](https://github.com/krmanik/Anki-xiehanzi/tree/6da570ecf92056f796c50b9ede103df9d94af0ad) (`6da570e`)
- [EpicenterHQ/epicenter/apps/whispering](https://github.com/EpicenterHQ/epicenter/tree/20e9f3b4af6166c71484575c93a1047e95f157e4/apps/whispering) (`20e9f3b`)
- [hyvor/blogs/frontend](https://github.com/hyvor/blogs/tree/a78e7615c43ee502b230975118b22fad11431f98/frontend) (`a78e761`)
- [chipi/orrery](https://github.com/chipi/orrery/tree/f216622b46d73c2ea47b36e5c0bfcb0840b6cf36) (`f216622`)
- [glowingkitty/OpenMates/frontend/apps/web_app](https://github.com/glowingkitty/OpenMates/tree/9f3228ef9ac3e4061b8129a1f42e983925214900/frontend/apps/web_app) (`9f3228e`)
- [josh-collinsworth/joco-sveltekit](https://github.com/josh-collinsworth/joco-sveltekit/tree/cf6ee85821af1b563f6c851f7e3a8342841bf082) (`cf6ee85`)
- [ow-mods/outerwildsmods.com](https://github.com/ow-mods/outerwildsmods.com/tree/2afa15fc366285c0d5ae0be1f7d001b8d02057ec) (`2afa15f`)
- [openiap/core-web](https://github.com/openiap/core-web/tree/c3c8d8746374da102983db82c3b921a4bd361e28) (`c3c8d87`)
- [primocms/primo](https://github.com/primocms/primo/tree/f0db28a5a4719de08b657b2d0e1f92f657d6d8fa) (`f0db28a`)
- [scpwiki/wikijump/framerail](https://github.com/scpwiki/wikijump/tree/11231f37c3d3a52a536a85e62a3e7aa76fd49af3/framerail) (`11231f3`)
- [Bastian/bstats-web](https://github.com/Bastian/bstats-web/tree/76630c53babf5ea178e3168560034b53aebe4dda) (`76630c5`)
- [intuitem/ciso-assistant-community/frontend](https://github.com/intuitem/ciso-assistant-community/tree/2d7e695948b6c12bc574996f9be3aa8799eed95e/frontend) (`2d7e695`)
- [damoang/angple/apps/web](https://github.com/damoang/angple/tree/16084b2c27ac03b232f0db8076cfc795ba2caab7/apps/web) (`16084b2`)
- [SciSharp/BotSharp-UI](https://github.com/SciSharp/BotSharp-UI/tree/8ceb94109778148f8c1e877798dc9754255fe994) (`8ceb941`)
- [QAStudio-Dev/studio](https://github.com/QAStudio-Dev/studio/tree/00b4599339ed3245fd04d3c903a23334d094254c) (`00b4599`)
- [spuithori/tokimekibluesky](https://github.com/spuithori/tokimekibluesky/tree/f0883fba527c6324a7169e111ae2c8ddcf4e9366) (`f0883fb`)

25000 of 25000 corpus findings have a verdict.

| Rule                                                                                                                  | Corpus findings | Apps | Reviewed (tp / fp / design / unclear) | Precision        | Design share   |
| --------------------------------------------------------------------------------------------------------------------- | --------------- | ---- | ------------------------------------- | ---------------- | -------------- |
| [`a11y/abbr-title`](../../docs/src/content/docs/rules/a11y/abbr-title.md)                                             | 0               | 0    | —                                     | —                | —              |
| [`a11y/accessible-name`](../../docs/src/content/docs/rules/a11y/accessible-name.md)                                   | 79              | 8    | 64 / 0 / 15 / 0                       | 100% (64/64)     | 19% (15/79)    |
| [`a11y/aria-hidden-focus`](../../docs/src/content/docs/rules/a11y/aria-hidden-focus.md)                               | 20              | 6    | 20 / 0 / 0 / 0                        | 100% (20/20)     | 0% (0/20)      |
| [`a11y/deprecated-aria`](../../docs/src/content/docs/rules/a11y/deprecated-aria.md)                                   | 18              | 11   | 18 / 0 / 0 / 0                        | 100% (18/18)     | 0% (0/18)      |
| [`a11y/deprecated-attr`](../../docs/src/content/docs/rules/a11y/deprecated-attr.md)                                   | 42              | 15   | 42 / 0 / 0 / 0                        | 100% (42/42)     | 0% (0/42)      |
| [`a11y/deprecated-element`](../../docs/src/content/docs/rules/a11y/deprecated-element.md)                             | 2               | 1    | 2 / 0 / 0 / 0                         | 100% (2/2)       | 0% (0/2)       |
| [`a11y/disallowed-aria-props`](../../docs/src/content/docs/rules/a11y/disallowed-aria-props.md)                       | 182             | 29   | 180 / 0 / 2 / 0                       | 100% (180/180)   | 1% (2/182)     |
| [`a11y/disallowed-element`](../../docs/src/content/docs/rules/a11y/disallowed-element.md)                             | 0               | 0    | —                                     | —                | —              |
| [`a11y/doctype`](../../docs/src/content/docs/rules/a11y/doctype.md)                                                   | 0               | 0    | —                                     | —                | —              |
| [`a11y/duplicate-landmark`](../../docs/src/content/docs/rules/a11y/duplicate-landmark.md)                             | 91              | 24   | 87 / 0 / 4 / 0                        | 100% (87/87)     | 4% (4/91)      |
| [`a11y/id-duplication`](../../docs/src/content/docs/rules/a11y/id-duplication.md)                                     | 178             | 14   | 39 / 0 / 139 / 0                      | 100% (39/39)     | 78% (139/178)  |
| [`a11y/interactive-nesting`](../../docs/src/content/docs/rules/a11y/interactive-nesting.md)                           | 132             | 22   | 132 / 0 / 0 / 0                       | 100% (132/132)   | 0% (0/132)     |
| [`a11y/invalid-aria-value`](../../docs/src/content/docs/rules/a11y/invalid-aria-value.md)                             | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)       |
| [`a11y/invalid-role`](../../docs/src/content/docs/rules/a11y/invalid-role.md)                                         | 0               | 0    | —                                     | —                | —              |
| [`a11y/label-has-control`](../../docs/src/content/docs/rules/a11y/label-has-control.md)                               | 35              | 5    | 35 / 0 / 0 / 0                        | 100% (35/35)     | 0% (0/35)      |
| [`a11y/no-accesskey`](../../docs/src/content/docs/rules/a11y/no-accesskey.md)                                         | 0               | 0    | —                                     | —                | —              |
| [`a11y/no-autofocus`](../../docs/src/content/docs/rules/a11y/no-autofocus.md)                                         | 32              | 10   | 3 / 0 / 29 / 0                        | 100% (3/3)       | 91% (29/32)    |
| [`a11y/no-duplicate-dt`](../../docs/src/content/docs/rules/a11y/no-duplicate-dt.md)                                   | 0               | 0    | —                                     | —                | —              |
| [`a11y/no-missing-id-ref`](../../docs/src/content/docs/rules/a11y/no-missing-id-ref.md)                               | 3               | 1    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)       |
| [`a11y/pattern-title`](../../docs/src/content/docs/rules/a11y/pattern-title.md)                                       | 12              | 7    | 12 / 0 / 0 / 0                        | 100% (12/12)     | 0% (0/12)      |
| [`a11y/permitted-contents`](../../docs/src/content/docs/rules/a11y/permitted-contents.md)                             | 1557            | 52   | 1557 / 0 / 0 / 0                      | 100% (1557/1557) | 0% (0/1557)    |
| [`a11y/placeholder-label-option`](../../docs/src/content/docs/rules/a11y/placeholder-label-option.md)                 | 5               | 4    | 2 / 0 / 3 / 0                         | 100% (2/2)       | 60% (3/5)      |
| [`a11y/positive-tabindex`](../../docs/src/content/docs/rules/a11y/positive-tabindex.md)                               | 0               | 0    | —                                     | —                | —              |
| [`a11y/require-datetime`](../../docs/src/content/docs/rules/a11y/require-datetime.md)                                 | 18              | 1    | 18 / 0 / 0 / 0                        | 100% (18/18)     | 0% (0/18)      |
| [`a11y/required-aria-props`](../../docs/src/content/docs/rules/a11y/required-aria-props.md)                           | 2               | 2    | 2 / 0 / 0 / 0                         | 100% (2/2)       | 0% (0/2)       |
| [`a11y/required-element`](../../docs/src/content/docs/rules/a11y/required-element.md)                                 | 0               | 0    | —                                     | —                | —              |
| [`a11y/top-level-landmark`](../../docs/src/content/docs/rules/a11y/top-level-landmark.md)                             | 121             | 20   | 121 / 0 / 0 / 0                       | 100% (121/121)   | 0% (0/121)     |
| [`a11y/unknown-aria-attribute`](../../docs/src/content/docs/rules/a11y/unknown-aria-attribute.md)                     | 0               | 0    | —                                     | —                | —              |
| [`a11y/unverified-id-ref`](../../docs/src/content/docs/rules/a11y/unverified-id-ref.md)                               | 0               | 0    | —                                     | —                | —              |
| [`a11y/use-list`](../../docs/src/content/docs/rules/a11y/use-list.md)                                                 | 5               | 2    | 3 / 0 / 2 / 0                         | 100% (3/3)       | 40% (2/5)      |
| [`architecture/component-size`](../../docs/src/content/docs/rules/architecture/component-size.md)                     | 2660            | 53   | 2660 / 0 / 0 / 0                      | 100% (2660/2660) | 0% (0/2660)    |
| [`architecture/directory-naming`](../../docs/src/content/docs/rules/architecture/directory-naming.md)                 | 0               | 0    | —                                     | —                | —              |
| [`architecture/doc-link-target`](../../docs/src/content/docs/rules/architecture/doc-link-target.md)                   | 0               | 0    | —                                     | —                | —              |
| [`architecture/private-scope-import`](../../docs/src/content/docs/rules/architecture/private-scope-import.md)         | 0               | 0    | —                                     | —                | —              |
| [`architecture/prop-count`](../../docs/src/content/docs/rules/architecture/prop-count.md)                             | 856             | 49   | 856 / 0 / 0 / 0                       | 100% (856/856)   | 0% (0/856)     |
| [`architecture/reserved-directory-names`](../../docs/src/content/docs/rules/architecture/reserved-directory-names.md) | 0               | 0    | —                                     | —                | —              |
| [`architecture/reserved-name-placement`](../../docs/src/content/docs/rules/architecture/reserved-name-placement.md)   | 0               | 0    | —                                     | —                | —              |
| [`architecture/route-component-import`](../../docs/src/content/docs/rules/architecture/route-component-import.md)     | 15              | 5    | 0 / 0 / 15 / 0                        | —                | 100% (15/15)   |
| [`architecture/unit-entry-file`](../../docs/src/content/docs/rules/architecture/unit-entry-file.md)                   | 0               | 0    | —                                     | —                | —              |
| [`correctness/autoplay-muted`](../../docs/src/content/docs/rules/correctness/autoplay-muted.md)                       | 6               | 4    | 5 / 0 / 1 / 0                         | 100% (5/5)       | 17% (1/6)      |
| [`correctness/base-path-navigation`](../../docs/src/content/docs/rules/correctness/base-path-navigation.md)           | 38              | 4    | 38 / 0 / 0 / 0                        | 100% (38/38)     | 0% (0/38)      |
| [`correctness/checkable-bind-value`](../../docs/src/content/docs/rules/correctness/checkable-bind-value.md)           | 0               | 0    | —                                     | —                | —              |
| [`correctness/each-index-key`](../../docs/src/content/docs/rules/correctness/each-index-key.md)                       | 587             | 33   | 340 / 0 / 247 / 0                     | 100% (340/340)   | 42% (247/587)  |
| [`correctness/each-key`](../../docs/src/content/docs/rules/correctness/each-key.md)                                   | 2131            | 39   | 1603 / 0 / 527 / 1                    | 100% (1603/1603) | 25% (527/2131) |
| [`correctness/effect-as-derived`](../../docs/src/content/docs/rules/correctness/effect-as-derived.md)                 | 94              | 24   | 80 / 0 / 14 / 0                       | 100% (80/80)     | 15% (14/94)    |
| [`correctness/effect-as-onmount`](../../docs/src/content/docs/rules/correctness/effect-as-onmount.md)                 | 26              | 16   | 20 / 0 / 6 / 0                        | 100% (20/20)     | 23% (6/26)     |
| [`correctness/instance-browser-global`](../../docs/src/content/docs/rules/correctness/instance-browser-global.md)     | 15              | 6    | 1 / 0 / 14 / 0                        | 100% (1/1)       | 93% (14/15)    |
| [`correctness/nonreactive-builtin-state`](../../docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md) | 5               | 3    | 4 / 0 / 1 / 0                         | 100% (4/4)       | 20% (1/5)      |
| [`correctness/orphan-effect`](../../docs/src/content/docs/rules/correctness/orphan-effect.md)                         | 0               | 0    | —                                     | —                | —              |
| [`correctness/orphan-lifecycle`](../../docs/src/content/docs/rules/correctness/orphan-lifecycle.md)                   | 0               | 0    | —                                     | —                | —              |
| [`correctness/prop-mutation`](../../docs/src/content/docs/rules/correctness/prop-mutation.md)                         | 167             | 23   | 90 / 0 / 77 / 0                       | 100% (90/90)     | 46% (77/167)   |
| [`correctness/server-browser-global`](../../docs/src/content/docs/rules/correctness/server-browser-global.md)         | 0               | 0    | —                                     | —                | —              |
| [`correctness/stale-prop-derivation`](../../docs/src/content/docs/rules/correctness/stale-prop-derivation.md)         | 64              | 14   | 21 / 0 / 43 / 0                       | 100% (21/21)     | 67% (43/64)    |
| [`correctness/unmutated-state`](../../docs/src/content/docs/rules/correctness/unmutated-state.md)                     | 99              | 25   | 99 / 0 / 0 / 0                        | 100% (99/99)     | 0% (0/99)      |
| [`performance/font-preload-crossorigin`](../../docs/src/content/docs/rules/performance/font-preload-crossorigin.md)   | 0               | 0    | —                                     | —                | —              |
| [`performance/heavy-import`](../../docs/src/content/docs/rules/performance/heavy-import.md)                           | 22              | 1    | 22 / 0 / 0 / 0                        | 100% (22/22)     | 0% (0/22)      |
| [`performance/iframe-loading`](../../docs/src/content/docs/rules/performance/iframe-loading.md)                       | 68              | 26   | 28 / 0 / 39 / 1                       | 100% (28/28)     | 57% (39/68)    |
| [`performance/image-dimensions`](../../docs/src/content/docs/rules/performance/image-dimensions.md)                   | 339             | 38   | 114 / 0 / 225 / 0                     | 100% (114/114)   | 66% (225/339)  |
| [`performance/image-loading-hint`](../../docs/src/content/docs/rules/performance/image-loading-hint.md)               | 296             | 42   | 146 / 0 / 150 / 0                     | 100% (146/146)   | 51% (150/296)  |
| [`performance/lcp-image`](../../docs/src/content/docs/rules/performance/lcp-image.md)                                 | 32              | 10   | 20 / 0 / 12 / 0                       | 100% (20/20)     | 38% (12/32)    |
| [`performance/load-waterfall`](../../docs/src/content/docs/rules/performance/load-waterfall.md)                       | 78              | 10   | 50 / 1 / 27 / 0                       | 98% (50/51)      | 35% (27/78)    |
| [`performance/minify-disabled`](../../docs/src/content/docs/rules/performance/minify-disabled.md)                     | 0               | 0    | —                                     | —                | —              |
| [`performance/namespace-import`](../../docs/src/content/docs/rules/performance/namespace-import.md)                   | 5               | 2    | 1 / 0 / 4 / 0                         | 100% (1/1)       | 80% (4/5)      |
| [`performance/preconnect`](../../docs/src/content/docs/rules/performance/preconnect.md)                               | 0               | 0    | —                                     | —                | —              |
| [`performance/preload-missing-as`](../../docs/src/content/docs/rules/performance/preload-missing-as.md)               | 0               | 0    | —                                     | —                | —              |
| [`performance/render-blocking-script`](../../docs/src/content/docs/rules/performance/render-blocking-script.md)       | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)       |
| [`performance/responsive-image`](../../docs/src/content/docs/rules/performance/responsive-image.md)                   | 341             | 39   | 295 / 0 / 46 / 0                      | 100% (295/295)   | 13% (46/341)   |
| [`performance/sequential-awaits`](../../docs/src/content/docs/rules/performance/sequential-awaits.md)                 | 399             | 27   | 209 / 0 / 189 / 1                     | 100% (209/209)   | 47% (189/399)  |
| [`performance/state-raw`](../../docs/src/content/docs/rules/performance/state-raw.md)                                 | 76              | 24   | 76 / 0 / 0 / 0                        | 100% (76/76)     | 0% (0/76)      |
| [`security/handler-state-write`](../../docs/src/content/docs/rules/security/handler-state-write.md)                   | 6               | 1    | 6 / 0 / 0 / 0                         | 100% (6/6)       | 0% (0/6)       |
| [`security/javascript-url`](../../docs/src/content/docs/rules/security/javascript-url.md)                             | 43              | 2    | 43 / 0 / 0 / 0                        | 100% (43/43)     | 0% (0/43)      |
| [`security/raw-html`](../../docs/src/content/docs/rules/security/raw-html.md)                                         | 639             | 47   | 69 / 0 / 569 / 1                      | 100% (69/69)     | 89% (569/639)  |
| [`security/server-module-state`](../../docs/src/content/docs/rules/security/server-module-state.md)                   | 30              | 10   | 1 / 0 / 29 / 0                        | 100% (1/1)       | 97% (29/30)    |
| [`security/shared-state-import`](../../docs/src/content/docs/rules/security/shared-state-import.md)                   | 45              | 2    | 42 / 0 / 3 / 0                        | 100% (42/42)     | 7% (3/45)      |
| [`seo/canonical-url`](../../docs/src/content/docs/rules/seo/canonical-url.md)                                         | 1476            | 45   | 791 / 33 / 652 / 0                    | 96% (791/824)    | 44% (652/1476) |
| [`seo/charset`](../../docs/src/content/docs/rules/seo/charset.md)                                                     | 0               | 0    | —                                     | —                | —              |
| [`seo/description-length`](../../docs/src/content/docs/rules/seo/description-length.md)                               | 63              | 17   | 63 / 0 / 0 / 0                        | 100% (63/63)     | 0% (0/63)      |
| [`seo/description-presence`](../../docs/src/content/docs/rules/seo/description-presence.md)                           | 912             | 31   | 280 / 14 / 618 / 0                    | 95% (280/294)    | 68% (618/912)  |
| [`seo/duplicate-description`](../../docs/src/content/docs/rules/seo/duplicate-description.md)                         | 47              | 9    | 43 / 0 / 4 / 0                        | 100% (43/43)     | 9% (4/47)      |
| [`seo/duplicate-title`](../../docs/src/content/docs/rules/seo/duplicate-title.md)                                     | 37              | 19   | 11 / 0 / 26 / 0                       | 100% (11/11)     | 70% (26/37)    |
| [`seo/heading-level-skip`](../../docs/src/content/docs/rules/seo/heading-level-skip.md)                               | 145             | 21   | 138 / 7 / 0 / 0                       | 95% (138/145)    | 0% (0/145)     |
| [`seo/hreflang`](../../docs/src/content/docs/rules/seo/hreflang.md)                                                   | 0               | 0    | —                                     | —                | —              |
| [`seo/html-lang`](../../docs/src/content/docs/rules/seo/html-lang.md)                                                 | 3               | 3    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)       |
| [`seo/image-alt`](../../docs/src/content/docs/rules/seo/image-alt.md)                                                 | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)       |
| [`seo/indexability`](../../docs/src/content/docs/rules/seo/indexability.md)                                           | 364             | 20   | 364 / 0 / 0 / 0                       | 100% (364/364)   | 0% (0/364)     |
| [`seo/json-ld`](../../docs/src/content/docs/rules/seo/json-ld.md)                                                     | 1910            | 52   | 1877 / 33 / 0 / 0                     | 98% (1877/1910)  | 0% (0/1910)    |
| [`seo/json-ld-date-format`](../../docs/src/content/docs/rules/seo/json-ld-date-format.md)                             | 0               | 0    | —                                     | —                | —              |
| [`seo/json-ld-deprecated-type`](../../docs/src/content/docs/rules/seo/json-ld-deprecated-type.md)                     | 0               | 0    | —                                     | —                | —              |
| [`seo/json-ld-placeholder`](../../docs/src/content/docs/rules/seo/json-ld-placeholder.md)                             | 0               | 0    | —                                     | —                | —              |
| [`seo/json-ld-relative-url`](../../docs/src/content/docs/rules/seo/json-ld-relative-url.md)                           | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)       |
| [`seo/json-ld-required-props`](../../docs/src/content/docs/rules/seo/json-ld-required-props.md)                       | 0               | 0    | —                                     | —                | —              |
| [`seo/json-ld-validity`](../../docs/src/content/docs/rules/seo/json-ld-validity.md)                                   | 0               | 0    | —                                     | —                | —              |
| [`seo/og-description`](../../docs/src/content/docs/rules/seo/og-description.md)                                       | 1356            | 40   | 1341 / 15 / 0 / 0                     | 99% (1341/1356)  | 0% (0/1356)    |
| [`seo/og-image`](../../docs/src/content/docs/rules/seo/og-image.md)                                                   | 1380            | 42   | 1365 / 15 / 0 / 0                     | 99% (1365/1380)  | 0% (0/1380)    |
| [`seo/og-title`](../../docs/src/content/docs/rules/seo/og-title.md)                                                   | 1354            | 40   | 1339 / 15 / 0 / 0                     | 99% (1339/1354)  | 0% (0/1354)    |
| [`seo/og-url`](../../docs/src/content/docs/rules/seo/og-url.md)                                                       | 1418            | 41   | 1403 / 15 / 0 / 0                     | 99% (1403/1418)  | 0% (0/1418)    |
| [`seo/robots-txt`](../../docs/src/content/docs/rules/seo/robots-txt.md)                                               | 25              | 25   | 15 / 0 / 10 / 0                       | 100% (15/15)     | 40% (10/25)    |
| [`seo/single-h1`](../../docs/src/content/docs/rules/seo/single-h1.md)                                                 | 760             | 47   | 628 / 93 / 35 / 4                     | 87% (628/721)    | 5% (35/760)    |
| [`seo/sitemap-in-robots`](../../docs/src/content/docs/rules/seo/sitemap-in-robots.md)                                 | 4               | 4    | 4 / 0 / 0 / 0                         | 100% (4/4)       | 0% (0/4)       |
| [`seo/sitemap-xml`](../../docs/src/content/docs/rules/seo/sitemap-xml.md)                                             | 36              | 36   | 22 / 0 / 14 / 0                       | 100% (22/22)     | 39% (14/36)    |
| [`seo/ssr-disabled`](../../docs/src/content/docs/rules/seo/ssr-disabled.md)                                           | 77              | 21   | 20 / 0 / 57 / 0                       | 100% (20/20)     | 74% (57/77)    |
| [`seo/title-length`](../../docs/src/content/docs/rules/seo/title-length.md)                                           | 321             | 36   | 321 / 0 / 0 / 0                       | 100% (321/321)   | 0% (0/321)     |
| [`seo/title-presence`](../../docs/src/content/docs/rules/seo/title-presence.md)                                       | 96              | 18   | 74 / 16 / 5 / 1                       | 82% (74/90)      | 5% (5/96)      |
| [`seo/twitter-card`](../../docs/src/content/docs/rules/seo/twitter-card.md)                                           | 1496            | 42   | 1481 / 15 / 0 / 0                     | 99% (1481/1496)  | 0% (0/1496)    |
| [`seo/viewport`](../../docs/src/content/docs/rules/seo/viewport.md)                                                   | 0               | 0    | —                                     | —                | —              |

<!-- rule-reliability:end -->
