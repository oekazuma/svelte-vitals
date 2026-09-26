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

Measured on 112 apps, each pinned to a commit:

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
- [civitai/civitai/apps/moderator](https://github.com/civitai/civitai/tree/6ff7aff2ab52090358752dc58dca22fd04135d96/apps/moderator) (`6ff7aff`)
- [pauljoda/Prismedia/apps/web-svelte](https://github.com/pauljoda/Prismedia/tree/627958a491f565babf1f8f693a5bb48ea834bc7e/apps/web-svelte) (`627958a`)
- [flazouh/acepe/packages/website](https://github.com/flazouh/acepe/tree/7706ea4937793719c721111840c7f27b74aca433/packages/website) (`7706ea4`)
- [logdash-io/logdash.io/apps/frontend](https://github.com/logdash-io/logdash.io/tree/3e7432d7c26726867237fda025fe24e26dfb5dba/apps/frontend) (`3e7432d`)
- [IcelandicIcecream/aphex/apps/studio](https://github.com/IcelandicIcecream/aphex/tree/1241575ad94290d8dd3e305ad75b46112734d338/apps/studio) (`1241575`)
- [rleeon/hoard/web](https://github.com/rleeon/hoard/tree/1c147e0c7302ca178a87f56da8020952295f9be1/web) (`1c147e0`)
- [torrust/torrust-website](https://github.com/torrust/torrust-website/tree/3ee3ae4089b0c4db0d9fd914875891502e61fe80) (`3ee3ae4`)
- [Ratimon/openquok-monorepo/web](https://github.com/Ratimon/openquok-monorepo/tree/f5d2a14528195926fe5f591afa1f072f7c202c62/web) (`f5d2a14`)
- [xKesvaL/kesval.com](https://github.com/xKesvaL/kesval.com/tree/1e188bdc85847be769cbeeb417905f08c3deb333) (`1e188bd`)
- [BlackbirdWorks/gopherstack/ui](https://github.com/BlackbirdWorks/gopherstack/tree/ed13a01a3dfaffee9ac1cc07c0ab96c8f422fd28/ui) (`ed13a01`)
- [tp-link-extender/MercuryCore/Site](https://github.com/tp-link-extender/MercuryCore/tree/b9acfa53ae57b93fb2cb91c404b273a203941b93/Site) (`b9acfa5`)
- [temporalio/ui](https://github.com/temporalio/ui/tree/ffee0375c167ae61ad9acedc19f104c85ceef59d) (`ffee037`)
- [greymass/unicove](https://github.com/greymass/unicove/tree/2cbc1c00728b70aba586b9ea3ccd3f5159b2f8f6) (`2cbc1c0`)
- [sillsdev/appbuilder-portal](https://github.com/sillsdev/appbuilder-portal/tree/efa44e416c0744ce1c1edf82ae4d92c3e088f49a) (`efa44e4`)
- [flo-bit/atmo-events/apps/web](https://github.com/flo-bit/atmo-events/tree/ed2fb4279a6ddec7c8c58380747463e9d15b725f/apps/web) (`ed2fb42`)
- [bocchio-web-lab/bocchio.dev](https://github.com/bocchio-web-lab/bocchio.dev/tree/8eb3691ecc745cd055795e6e34f8b02e2aebb0ee) (`8eb3691`)
- [PIWEEK/easyfest/frontend](https://github.com/PIWEEK/easyfest/tree/2bc2404d37a4ea651a70af850292e238f7c38db2/frontend) (`2bc2404`)
- [Gamermaker-dev/Bria-nutrition](https://github.com/Gamermaker-dev/Bria-nutrition/tree/eef7e111fe13f5231ca5cd99b4ae7671a0152a2f) (`eef7e11`)
- [Avi-ADAM/1.0](https://github.com/Avi-ADAM/1.0/tree/879dd90456008888f7e145f0e0d64670c32f1edc) (`879dd90`)
- [openbancor/catalogmx/packages/webapp-svelte](https://github.com/openbancor/catalogmx/tree/d122ac955a0bd5123ee25782419a1bdf5bab5a94/packages/webapp-svelte) (`d122ac9`)
- [istota-project/istota/web](https://github.com/istota-project/istota/tree/1bf5214ae9485143faf2872b13cbda60bb717678/web) (`1bf5214`)
- [mazipan/baca-quran.id](https://github.com/mazipan/baca-quran.id/tree/18b3756716735c0c25dc71c41b885e127583f582) (`18b3756`)
- [open-reception/appointment-booking-software](https://github.com/open-reception/appointment-booking-software/tree/a9ef3f54772f536c99028037c572c6fe18b0efba) (`a9ef3f5`)
- [Trifall/cosmic](https://github.com/Trifall/cosmic/tree/a75412c81126e9a4c78ce22982a8c0ecd49da894) (`a75412c`)
- [langx/website](https://github.com/langx/website/tree/d89b572e3ec04ce790245426cc66a3a9f6d97077) (`d89b572`)
- [muni-town/roomy/packages/app-lite](https://github.com/muni-town/roomy/tree/1365910bbfbd9f27960fa70202f136f581f88e91/packages/app-lite) (`1365910`)
- [penxle/typie/apps/website](https://github.com/penxle/typie/tree/5138e1e85b1d5d0ea0d43202a4d085509333c4a8/apps/website) (`5138e1e`)
- [aidotse/behovskartan/explorer](https://github.com/aidotse/behovskartan/tree/49fed0d2e5f3ac2aa140bffd1f1594ace0caf152/explorer) (`49fed0d`)
- [execut4ble/vilnius-hardcore](https://github.com/execut4ble/vilnius-hardcore/tree/a58dddd1d1f0146909ed953c27ea0603f046fd23) (`a58dddd`)
- [cmintey/wishlist](https://github.com/cmintey/wishlist/tree/a5150c73620abb912a802afdcfb51e403230fff3) (`a5150c7`)
- [DeutscheModelUnitedNations/munify-delegator](https://github.com/DeutscheModelUnitedNations/munify-delegator/tree/50ef3d8c2b9bca4d3114c3a5226e29bf323146f7) (`50ef3d8`)
- [imjlk/645-live/pages/www](https://github.com/imjlk/645-live/tree/05077a949e8ba40f91e8e3d318b6abf97f763232/pages/www) (`05077a9`)
- [brandonwie/brandonwie.dev](https://github.com/brandonwie/brandonwie.dev/tree/877b40e9b6336712e1de0bbcc0e916f5eb3e4eab) (`877b40e`)
- [nidhinmahesh/htmltopdf.pro](https://github.com/nidhinmahesh/htmltopdf.pro/tree/6942a55bcfbf384dcf02dfcc7c9031e7a4ab20aa) (`6942a55`)
- [flo-bit/atmo-social](https://github.com/flo-bit/atmo-social/tree/47692bc0e1c77fb030ef894ccf4efd7d78eabeb0) (`47692bc`)
- [carlelieser/yuki/apps/web](https://github.com/carlelieser/yuki/tree/2c856baef923fa63c428a960b42b8e4b6fd988d8/apps/web) (`2c856ba`)
- [sebadob/rauthy/frontend](https://github.com/sebadob/rauthy/tree/523b6c6889fb2333cc14174e6bfb3026550704e6/frontend) (`523b6c6`)
- [atshelchin/biubiu-monorepo/apps/biubiu.tools](https://github.com/atshelchin/biubiu-monorepo/tree/0bb03976ee0d06a5951e062030e418bec7376891/apps/biubiu.tools) (`0bb0397`)
- [NikolasP98/minion_hub](https://github.com/NikolasP98/minion_hub/tree/6716b2767aeacd5ccc6a30e141115c59f47c1cf2) (`6716b27`)
- [huggingface/Mongoku](https://github.com/huggingface/Mongoku/tree/985dddea975284bf86229395802036514b090232) (`985ddde`)
- [rhpo/lms](https://github.com/rhpo/lms/tree/662f0f4a80ab42aba6deb75950e5acf36463f46b) (`662f0f4`)
- [sona-fast/sona](https://github.com/sona-fast/sona/tree/4f84dac8b1e37cf5406fd800d973010c3e932e6f) (`4f84dac`)
- [beeblock/orkestrai](https://github.com/beeblock/orkestrai/tree/9798ade4e1aa84c1035171c49a8a08e46f6f91b1) (`9798ade`)
- [Verdagraph/Webapp/apps/web](https://github.com/Verdagraph/Webapp/tree/d4fe44c73d260c7610fa6a289b88f33b73cf41b3/apps/web) (`d4fe44c`)
- [shuffle-project/blinddate](https://github.com/shuffle-project/blinddate/tree/04534b16c79c073960d232aa34163f70f9cfa79f) (`04534b1`)
- [mony-dropout/lifeatuni/apps/app](https://github.com/mony-dropout/lifeatuni/tree/15c2f649c9e36db7f5fca6bad5ba3244854a6c8c/apps/app) (`15c2f64`)
- [SiMiTaKu/imrg-platform/web](https://github.com/SiMiTaKu/imrg-platform/tree/5b396c9d70a2ebadac4e6a175d58bee52d58dd8d/web) (`5b396c9`)
- [megany128/sklonuj](https://github.com/megany128/sklonuj/tree/5a987078ee3ccdd34e8d76392a488232a0a3acec) (`5a98707`)
- [twangodev/uwcourses](https://github.com/twangodev/uwcourses/tree/0797c6e67d37df9a62e9e8ab449b0f01a5450089) (`0797c6e`)
- [AlchemillaHQ/Sylve/web](https://github.com/AlchemillaHQ/Sylve/tree/0245cabf18f16540afb2f299b3f1253a3bc6f040/web) (`0245cab`)
- [simonhackler/digitable/packages/app](https://github.com/simonhackler/digitable/tree/fe97d9f329a1813304b87025dbb066792e7d2df1/packages/app) (`fe97d9f`)
- [jjh4450/KAIROS-Landing-Page/web](https://github.com/jjh4450/KAIROS-Landing-Page/tree/86555087f713316fa4b62433428e49161793e38b/web) (`8655508`)
- [weelone/echobell.one](https://github.com/weelone/echobell.one/tree/254fce050150f957a4277f4f4ca982715e6a2f02) (`254fce0`)
- [MoldyTaint/Cinephage](https://github.com/MoldyTaint/Cinephage/tree/5f1279a6a1f6873e21e7b69db5d2ef47ef509f35) (`5f1279a`)
- [Alia5/steaminputdb.com/frontend](https://github.com/Alia5/steaminputdb.com/tree/b5f29b8b5cdd5262deaab4a1fb3d24a12a9d98f8/frontend) (`b5f29b8`)
- [asciimoo/hister/webui/app](https://github.com/asciimoo/hister/tree/25dccadb866779e0be16ee631bfd32fb55bea6b1/webui/app) (`25dccad`)

48616 of 48616 corpus findings have a verdict.

| Rule                                                                                                                  | Corpus findings | Apps | Reviewed (tp / fp / design / unclear) | Precision        | Design share    |
| --------------------------------------------------------------------------------------------------------------------- | --------------- | ---- | ------------------------------------- | ---------------- | --------------- |
| [`a11y/abbr-title`](../../docs/src/content/docs/rules/a11y/abbr-title.md)                                             | 0               | 0    | —                                     | —                | —               |
| [`a11y/accessible-name`](../../docs/src/content/docs/rules/a11y/accessible-name.md)                                   | 171             | 18   | 155 / 0 / 16 / 0                      | 100% (155/155)   | 9% (16/171)     |
| [`a11y/aria-hidden-focus`](../../docs/src/content/docs/rules/a11y/aria-hidden-focus.md)                               | 26              | 8    | 26 / 0 / 0 / 0                        | 100% (26/26)     | 0% (0/26)       |
| [`a11y/deprecated-aria`](../../docs/src/content/docs/rules/a11y/deprecated-aria.md)                                   | 25              | 15   | 25 / 0 / 0 / 0                        | 100% (25/25)     | 0% (0/25)       |
| [`a11y/deprecated-attr`](../../docs/src/content/docs/rules/a11y/deprecated-attr.md)                                   | 59              | 21   | 59 / 0 / 0 / 0                        | 100% (59/59)     | 0% (0/59)       |
| [`a11y/deprecated-element`](../../docs/src/content/docs/rules/a11y/deprecated-element.md)                             | 2               | 1    | 2 / 0 / 0 / 0                         | 100% (2/2)       | 0% (0/2)        |
| [`a11y/disallowed-aria-props`](../../docs/src/content/docs/rules/a11y/disallowed-aria-props.md)                       | 376             | 56   | 371 / 0 / 5 / 0                       | 100% (371/371)   | 1% (5/376)      |
| [`a11y/disallowed-element`](../../docs/src/content/docs/rules/a11y/disallowed-element.md)                             | 0               | 0    | —                                     | —                | —               |
| [`a11y/doctype`](../../docs/src/content/docs/rules/a11y/doctype.md)                                                   | 0               | 0    | —                                     | —                | —               |
| [`a11y/duplicate-landmark`](../../docs/src/content/docs/rules/a11y/duplicate-landmark.md)                             | 168             | 41   | 150 / 0 / 18 / 0                      | 100% (150/150)   | 11% (18/168)    |
| [`a11y/id-duplication`](../../docs/src/content/docs/rules/a11y/id-duplication.md)                                     | 626             | 33   | 114 / 0 / 512 / 0                     | 100% (114/114)   | 82% (512/626)   |
| [`a11y/interactive-nesting`](../../docs/src/content/docs/rules/a11y/interactive-nesting.md)                           | 321             | 39   | 321 / 0 / 0 / 0                       | 100% (321/321)   | 0% (0/321)      |
| [`a11y/invalid-aria-value`](../../docs/src/content/docs/rules/a11y/invalid-aria-value.md)                             | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)        |
| [`a11y/invalid-role`](../../docs/src/content/docs/rules/a11y/invalid-role.md)                                         | 0               | 0    | —                                     | —                | —               |
| [`a11y/label-has-control`](../../docs/src/content/docs/rules/a11y/label-has-control.md)                               | 89              | 11   | 89 / 0 / 0 / 0                        | 100% (89/89)     | 0% (0/89)       |
| [`a11y/no-accesskey`](../../docs/src/content/docs/rules/a11y/no-accesskey.md)                                         | 0               | 0    | —                                     | —                | —               |
| [`a11y/no-autofocus`](../../docs/src/content/docs/rules/a11y/no-autofocus.md)                                         | 54              | 19   | 7 / 0 / 47 / 0                        | 100% (7/7)       | 87% (47/54)     |
| [`a11y/no-duplicate-dt`](../../docs/src/content/docs/rules/a11y/no-duplicate-dt.md)                                   | 0               | 0    | —                                     | —                | —               |
| [`a11y/no-missing-id-ref`](../../docs/src/content/docs/rules/a11y/no-missing-id-ref.md)                               | 3               | 1    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)        |
| [`a11y/pattern-title`](../../docs/src/content/docs/rules/a11y/pattern-title.md)                                       | 19              | 13   | 19 / 0 / 0 / 0                        | 100% (19/19)     | 0% (0/19)       |
| [`a11y/permitted-contents`](../../docs/src/content/docs/rules/a11y/permitted-contents.md)                             | 2503            | 99   | 2503 / 0 / 0 / 0                      | 100% (2503/2503) | 0% (0/2503)     |
| [`a11y/placeholder-label-option`](../../docs/src/content/docs/rules/a11y/placeholder-label-option.md)                 | 11              | 5    | 2 / 0 / 9 / 0                         | 100% (2/2)       | 82% (9/11)      |
| [`a11y/positive-tabindex`](../../docs/src/content/docs/rules/a11y/positive-tabindex.md)                               | 3               | 1    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)        |
| [`a11y/require-datetime`](../../docs/src/content/docs/rules/a11y/require-datetime.md)                                 | 18              | 1    | 18 / 0 / 0 / 0                        | 100% (18/18)     | 0% (0/18)       |
| [`a11y/required-aria-props`](../../docs/src/content/docs/rules/a11y/required-aria-props.md)                           | 2               | 2    | 2 / 0 / 0 / 0                         | 100% (2/2)       | 0% (0/2)        |
| [`a11y/required-element`](../../docs/src/content/docs/rules/a11y/required-element.md)                                 | 0               | 0    | —                                     | —                | —               |
| [`a11y/top-level-landmark`](../../docs/src/content/docs/rules/a11y/top-level-landmark.md)                             | 203             | 33   | 203 / 0 / 0 / 0                       | 100% (203/203)   | 0% (0/203)      |
| [`a11y/unknown-aria-attribute`](../../docs/src/content/docs/rules/a11y/unknown-aria-attribute.md)                     | 0               | 0    | —                                     | —                | —               |
| [`a11y/unverified-id-ref`](../../docs/src/content/docs/rules/a11y/unverified-id-ref.md)                               | 0               | 0    | —                                     | —                | —               |
| [`a11y/use-list`](../../docs/src/content/docs/rules/a11y/use-list.md)                                                 | 13              | 4    | 11 / 0 / 2 / 0                        | 100% (11/11)     | 15% (2/13)      |
| [`architecture/component-size`](../../docs/src/content/docs/rules/architecture/component-size.md)                     | 5396            | 108  | 5396 / 0 / 0 / 0                      | 100% (5396/5396) | 0% (0/5396)     |
| [`architecture/directory-naming`](../../docs/src/content/docs/rules/architecture/directory-naming.md)                 | 0               | 0    | —                                     | —                | —               |
| [`architecture/doc-link-target`](../../docs/src/content/docs/rules/architecture/doc-link-target.md)                   | 0               | 0    | —                                     | —                | —               |
| [`architecture/private-scope-import`](../../docs/src/content/docs/rules/architecture/private-scope-import.md)         | 0               | 0    | —                                     | —                | —               |
| [`architecture/prop-count`](../../docs/src/content/docs/rules/architecture/prop-count.md)                             | 2025            | 99   | 2025 / 0 / 0 / 0                      | 100% (2025/2025) | 0% (0/2025)     |
| [`architecture/reserved-directory-names`](../../docs/src/content/docs/rules/architecture/reserved-directory-names.md) | 0               | 0    | —                                     | —                | —               |
| [`architecture/reserved-name-placement`](../../docs/src/content/docs/rules/architecture/reserved-name-placement.md)   | 0               | 0    | —                                     | —                | —               |
| [`architecture/route-component-import`](../../docs/src/content/docs/rules/architecture/route-component-import.md)     | 18              | 7    | 0 / 0 / 18 / 0                        | —                | 100% (18/18)    |
| [`architecture/unit-entry-file`](../../docs/src/content/docs/rules/architecture/unit-entry-file.md)                   | 0               | 0    | —                                     | —                | —               |
| [`correctness/autoplay-muted`](../../docs/src/content/docs/rules/correctness/autoplay-muted.md)                       | 7               | 5    | 5 / 0 / 2 / 0                         | 100% (5/5)       | 29% (2/7)       |
| [`correctness/base-path-navigation`](../../docs/src/content/docs/rules/correctness/base-path-navigation.md)           | 42              | 7    | 41 / 0 / 1 / 0                        | 100% (41/41)     | 2% (1/42)       |
| [`correctness/checkable-bind-value`](../../docs/src/content/docs/rules/correctness/checkable-bind-value.md)           | 0               | 0    | —                                     | —                | —               |
| [`correctness/each-index-key`](../../docs/src/content/docs/rules/correctness/each-index-key.md)                       | 1040            | 68   | 530 / 0 / 510 / 0                     | 100% (530/530)   | 49% (510/1040)  |
| [`correctness/each-key`](../../docs/src/content/docs/rules/correctness/each-key.md)                                   | 4541            | 77   | 3476 / 0 / 1064 / 1                   | 100% (3476/3476) | 23% (1064/4541) |
| [`correctness/effect-as-derived`](../../docs/src/content/docs/rules/correctness/effect-as-derived.md)                 | 210             | 57   | 178 / 0 / 32 / 0                      | 100% (178/178)   | 15% (32/210)    |
| [`correctness/effect-as-onmount`](../../docs/src/content/docs/rules/correctness/effect-as-onmount.md)                 | 66              | 31   | 47 / 0 / 19 / 0                       | 100% (47/47)     | 29% (19/66)     |
| [`correctness/instance-browser-global`](../../docs/src/content/docs/rules/correctness/instance-browser-global.md)     | 24              | 12   | 2 / 0 / 22 / 0                        | 100% (2/2)       | 92% (22/24)     |
| [`correctness/nonreactive-builtin-state`](../../docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md) | 16              | 10   | 15 / 0 / 1 / 0                        | 100% (15/15)     | 6% (1/16)       |
| [`correctness/orphan-effect`](../../docs/src/content/docs/rules/correctness/orphan-effect.md)                         | 0               | 0    | —                                     | —                | —               |
| [`correctness/orphan-lifecycle`](../../docs/src/content/docs/rules/correctness/orphan-lifecycle.md)                   | 0               | 0    | —                                     | —                | —               |
| [`correctness/prop-mutation`](../../docs/src/content/docs/rules/correctness/prop-mutation.md)                         | 286             | 43   | 167 / 1 / 118 / 0                     | 99% (167/168)    | 41% (118/286)   |
| [`correctness/server-browser-global`](../../docs/src/content/docs/rules/correctness/server-browser-global.md)         | 1               | 1    | 0 / 0 / 1 / 0                         | —                | 100% (1/1)      |
| [`correctness/stale-prop-derivation`](../../docs/src/content/docs/rules/correctness/stale-prop-derivation.md)         | 101             | 25   | 25 / 0 / 76 / 0                       | 100% (25/25)     | 75% (76/101)    |
| [`correctness/unmutated-state`](../../docs/src/content/docs/rules/correctness/unmutated-state.md)                     | 159             | 44   | 159 / 0 / 0 / 0                       | 100% (159/159)   | 0% (0/159)      |
| [`performance/font-preload-crossorigin`](../../docs/src/content/docs/rules/performance/font-preload-crossorigin.md)   | 0               | 0    | —                                     | —                | —               |
| [`performance/heavy-import`](../../docs/src/content/docs/rules/performance/heavy-import.md)                           | 37              | 2    | 37 / 0 / 0 / 0                        | 100% (37/37)     | 0% (0/37)       |
| [`performance/iframe-loading`](../../docs/src/content/docs/rules/performance/iframe-loading.md)                       | 93              | 40   | 34 / 0 / 58 / 1                       | 100% (34/34)     | 62% (58/93)     |
| [`performance/image-dimensions`](../../docs/src/content/docs/rules/performance/image-dimensions.md)                   | 636             | 72   | 197 / 0 / 439 / 0                     | 100% (197/197)   | 69% (439/636)   |
| [`performance/image-loading-hint`](../../docs/src/content/docs/rules/performance/image-loading-hint.md)               | 580             | 81   | 211 / 0 / 369 / 0                     | 100% (211/211)   | 64% (369/580)   |
| [`performance/lcp-image`](../../docs/src/content/docs/rules/performance/lcp-image.md)                                 | 55              | 20   | 32 / 0 / 23 / 0                       | 100% (32/32)     | 42% (23/55)     |
| [`performance/load-waterfall`](../../docs/src/content/docs/rules/performance/load-waterfall.md)                       | 180             | 19   | 71 / 1 / 108 / 0                      | 99% (71/72)      | 60% (108/180)   |
| [`performance/minify-disabled`](../../docs/src/content/docs/rules/performance/minify-disabled.md)                     | 0               | 0    | —                                     | —                | —               |
| [`performance/namespace-import`](../../docs/src/content/docs/rules/performance/namespace-import.md)                   | 9               | 4    | 5 / 0 / 4 / 0                         | 100% (5/5)       | 44% (4/9)       |
| [`performance/preconnect`](../../docs/src/content/docs/rules/performance/preconnect.md)                               | 0               | 0    | —                                     | —                | —               |
| [`performance/preload-missing-as`](../../docs/src/content/docs/rules/performance/preload-missing-as.md)               | 0               | 0    | —                                     | —                | —               |
| [`performance/render-blocking-script`](../../docs/src/content/docs/rules/performance/render-blocking-script.md)       | 4               | 2    | 4 / 0 / 0 / 0                         | 100% (4/4)       | 0% (0/4)        |
| [`performance/responsive-image`](../../docs/src/content/docs/rules/performance/responsive-image.md)                   | 634             | 75   | 533 / 0 / 101 / 0                     | 100% (533/533)   | 16% (101/634)   |
| [`performance/sequential-awaits`](../../docs/src/content/docs/rules/performance/sequential-awaits.md)                 | 754             | 56   | 327 / 1 / 425 / 1                     | 100% (327/328)   | 56% (425/754)   |
| [`performance/state-raw`](../../docs/src/content/docs/rules/performance/state-raw.md)                                 | 279             | 51   | 279 / 0 / 0 / 0                       | 100% (279/279)   | 0% (0/279)      |
| [`security/handler-state-write`](../../docs/src/content/docs/rules/security/handler-state-write.md)                   | 10              | 3    | 9 / 0 / 1 / 0                         | 100% (9/9)       | 10% (1/10)      |
| [`security/javascript-url`](../../docs/src/content/docs/rules/security/javascript-url.md)                             | 43              | 2    | 43 / 0 / 0 / 0                        | 100% (43/43)     | 0% (0/43)       |
| [`security/raw-html`](../../docs/src/content/docs/rules/security/raw-html.md)                                         | 1029            | 93   | 115 / 0 / 913 / 1                     | 100% (115/115)   | 89% (913/1029)  |
| [`security/server-module-state`](../../docs/src/content/docs/rules/security/server-module-state.md)                   | 63              | 20   | 3 / 0 / 60 / 0                        | 100% (3/3)       | 95% (60/63)     |
| [`security/shared-state-import`](../../docs/src/content/docs/rules/security/shared-state-import.md)                   | 47              | 3    | 42 / 0 / 5 / 0                        | 100% (42/42)     | 11% (5/47)      |
| [`seo/canonical-url`](../../docs/src/content/docs/rules/seo/canonical-url.md)                                         | 2961            | 88   | 1417 / 20 / 1524 / 0                  | 99% (1417/1437)  | 51% (1524/2961) |
| [`seo/charset`](../../docs/src/content/docs/rules/seo/charset.md)                                                     | 0               | 0    | —                                     | —                | —               |
| [`seo/description-length`](../../docs/src/content/docs/rules/seo/description-length.md)                               | 97              | 29   | 97 / 0 / 0 / 0                        | 100% (97/97)     | 0% (0/97)       |
| [`seo/description-presence`](../../docs/src/content/docs/rules/seo/description-presence.md)                           | 2080            | 71   | 370 / 61 / 1649 / 0                   | 86% (370/431)    | 79% (1649/2080) |
| [`seo/duplicate-description`](../../docs/src/content/docs/rules/seo/duplicate-description.md)                         | 52              | 12   | 47 / 0 / 5 / 0                        | 100% (47/47)     | 10% (5/52)      |
| [`seo/duplicate-title`](../../docs/src/content/docs/rules/seo/duplicate-title.md)                                     | 53              | 28   | 14 / 0 / 39 / 0                       | 100% (14/14)     | 74% (39/53)     |
| [`seo/heading-level-skip`](../../docs/src/content/docs/rules/seo/heading-level-skip.md)                               | 296             | 49   | 283 / 13 / 0 / 0                      | 96% (283/296)    | 0% (0/296)      |
| [`seo/hreflang`](../../docs/src/content/docs/rules/seo/hreflang.md)                                                   | 0               | 0    | —                                     | —                | —               |
| [`seo/html-lang`](../../docs/src/content/docs/rules/seo/html-lang.md)                                                 | 3               | 3    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)        |
| [`seo/image-alt`](../../docs/src/content/docs/rules/seo/image-alt.md)                                                 | 11              | 3    | 11 / 0 / 0 / 0                        | 100% (11/11)     | 0% (0/11)       |
| [`seo/indexability`](../../docs/src/content/docs/rules/seo/indexability.md)                                           | 476             | 32   | 476 / 0 / 0 / 0                       | 100% (476/476)   | 0% (0/476)      |
| [`seo/json-ld`](../../docs/src/content/docs/rules/seo/json-ld.md)                                                     | 3577            | 101  | 3575 / 2 / 0 / 0                      | 100% (3575/3577) | 0% (0/3577)     |
| [`seo/json-ld-date-format`](../../docs/src/content/docs/rules/seo/json-ld-date-format.md)                             | 0               | 0    | —                                     | —                | —               |
| [`seo/json-ld-deprecated-type`](../../docs/src/content/docs/rules/seo/json-ld-deprecated-type.md)                     | 0               | 0    | —                                     | —                | —               |
| [`seo/json-ld-placeholder`](../../docs/src/content/docs/rules/seo/json-ld-placeholder.md)                             | 0               | 0    | —                                     | —                | —               |
| [`seo/json-ld-relative-url`](../../docs/src/content/docs/rules/seo/json-ld-relative-url.md)                           | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)        |
| [`seo/json-ld-required-props`](../../docs/src/content/docs/rules/seo/json-ld-required-props.md)                       | 0               | 0    | —                                     | —                | —               |
| [`seo/json-ld-validity`](../../docs/src/content/docs/rules/seo/json-ld-validity.md)                                   | 0               | 0    | —                                     | —                | —               |
| [`seo/og-description`](../../docs/src/content/docs/rules/seo/og-description.md)                                       | 2742            | 83   | 2677 / 65 / 0 / 0                     | 98% (2677/2742)  | 0% (0/2742)     |
| [`seo/og-image`](../../docs/src/content/docs/rules/seo/og-image.md)                                                   | 2660            | 86   | 2619 / 41 / 0 / 0                     | 98% (2619/2660)  | 0% (0/2660)     |
| [`seo/og-title`](../../docs/src/content/docs/rules/seo/og-title.md)                                                   | 2678            | 83   | 2613 / 65 / 0 / 0                     | 98% (2613/2678)  | 0% (0/2678)     |
| [`seo/og-url`](../../docs/src/content/docs/rules/seo/og-url.md)                                                       | 2744            | 83   | 2724 / 20 / 0 / 0                     | 99% (2724/2744)  | 0% (0/2744)     |
| [`seo/robots-txt`](../../docs/src/content/docs/rules/seo/robots-txt.md)                                               | 46              | 46   | 23 / 0 / 23 / 0                       | 100% (23/23)     | 50% (23/46)     |
| [`seo/single-h1`](../../docs/src/content/docs/rules/seo/single-h1.md)                                                 | 1002            | 91   | 883 / 42 / 73 / 4                     | 95% (883/925)    | 7% (73/1002)    |
| [`seo/sitemap-in-robots`](../../docs/src/content/docs/rules/seo/sitemap-in-robots.md)                                 | 6               | 6    | 6 / 0 / 0 / 0                         | 100% (6/6)       | 0% (0/6)        |
| [`seo/sitemap-xml`](../../docs/src/content/docs/rules/seo/sitemap-xml.md)                                             | 74              | 74   | 33 / 1 / 40 / 0                       | 97% (33/34)      | 54% (40/74)     |
| [`seo/ssr-disabled`](../../docs/src/content/docs/rules/seo/ssr-disabled.md)                                           | 242             | 40   | 76 / 0 / 166 / 0                      | 100% (76/76)     | 69% (166/242)   |
| [`seo/title-length`](../../docs/src/content/docs/rules/seo/title-length.md)                                           | 551             | 65   | 551 / 0 / 0 / 0                       | 100% (551/551)   | 0% (0/551)      |
| [`seo/title-presence`](../../docs/src/content/docs/rules/seo/title-presence.md)                                       | 269             | 43   | 235 / 26 / 7 / 1                      | 90% (235/261)    | 3% (7/269)      |
| [`seo/twitter-card`](../../docs/src/content/docs/rules/seo/twitter-card.md)                                           | 2917            | 86   | 2862 / 55 / 0 / 0                     | 98% (2862/2917)  | 0% (0/2917)     |
| [`seo/viewport`](../../docs/src/content/docs/rules/seo/viewport.md)                                                   | 0               | 0    | —                                     | —                | —               |

<!-- rule-reliability:end -->
