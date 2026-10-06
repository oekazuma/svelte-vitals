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

Measured on 349 apps, each pinned to a commit:

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
- [tjheffner/heffdotdev](https://github.com/tjheffner/heffdotdev/tree/f75ac691207643a4ab61f4947ddc989642cb8b2e) (`f75ac69`)
- [AdiCahyaSaputra/forumgw-v2](https://github.com/AdiCahyaSaputra/forumgw-v2/tree/315850fcd02b337434dd938238e2a51758da2bfd) (`315850f`)
- [MilkWithKnives/FSM](https://github.com/MilkWithKnives/FSM/tree/328309b62ba3b0578f3f92a67ebc2388ba7b5a54) (`328309b`)
- [nino-chavez/nino-chavez-photography](https://github.com/nino-chavez/nino-chavez-photography/tree/6a26d22dfb6a58ac7e262cf242cdf350b14505af) (`6a26d22`)
- [barbi1001/eco/eco](https://github.com/barbi1001/eco/tree/4471e56d178e2169afec1f6f9ad937717ad1ac7d/eco) (`4471e56`)
- [Joshjess/honeylink-website](https://github.com/Joshjess/honeylink-website/tree/0aba2a4986b907f9c4d6becf77442f7e06afa4ec) (`0aba2a4`)
- [janvier-s/catechismecatholique](https://github.com/janvier-s/catechismecatholique/tree/57e9d0a5c637da9c1b8138adbcefa88f6e72ba31) (`57e9d0a`)
- [haydenkoch/knowledgebasket.org](https://github.com/haydenkoch/knowledgebasket.org/tree/77162ec2c764439a30cd25e6e57f5dbef21c5172) (`77162ec`)
- [rricajos/superyayas](https://github.com/rricajos/superyayas/tree/5b5386bbc02a34ae01f625467fc82f1652000a4a) (`5b5386b`)
- [maxdorninger/MediaManager/web](https://github.com/maxdorninger/MediaManager/tree/98f253238c780b462af42691154bf0d1f5723f92/web) (`98f2532`)
- [convertigo/convertigo/convertigo-studio-web](https://github.com/convertigo/convertigo/tree/0c32d1464cfb5d643cd4221174b68a2a40b3785f/convertigo-studio-web) (`0c32d14`)
- [manikandareas/aqsha/apps/web](https://github.com/manikandareas/aqsha/tree/ff9ed1fc76bd783c9ef864c3862cc11a8b49c796/apps/web) (`ff9ed1f`)
- [hms-dbmi/PIC-SURE-Frontend](https://github.com/hms-dbmi/PIC-SURE-Frontend/tree/803fa3e9460a27cd08551f50cbcfa50437a7c8d8) (`803fa3e`)
- [aid-ly/aid-ly](https://github.com/aid-ly/aid-ly/tree/9d6eeec7b2a709c5981f1b84b22571edd785f33c) (`9d6eeec`)
- [jdegreef/ochorus/frontend](https://github.com/jdegreef/ochorus/tree/74e6d282ac9a85676104a7df8a1a3adef9d9e011/frontend) (`74e6d28`)
- [MTES-MCT/boris/apps/frontend](https://github.com/MTES-MCT/boris/tree/2154af23b31a0cb9099fe2c42d0c668f87aee54a/apps/frontend) (`2154af2`)
- [SkepticMystic/rescued](https://github.com/SkepticMystic/rescued/tree/1fdb244ef947ec6e19bd1428f7148a2b797408d0) (`1fdb244`)
- [intent-hq/cloudlands-fe](https://github.com/intent-hq/cloudlands-fe/tree/c35dc2b442f5080d137ba318c0263f6722568c50) (`c35dc2b`)
- [aolose/emm](https://github.com/aolose/emm/tree/e12fc7b746a0c47076d9207b442770f4e664639f) (`e12fc7b`)
- [wihlarkop/applykit/frontend](https://github.com/wihlarkop/applykit/tree/aaf526040e55a321bc3819326a4ca77428c51a3d/frontend) (`aaf5260`)
- [jesposito/Facet/frontend](https://github.com/jesposito/Facet/tree/3b5ff991174979520026fedd543fb9b4bf5b169f/frontend) (`3b5ff99`)
- [communisaas/commons](https://github.com/communisaas/commons/tree/043226125ba953d69a93216a6a4de26aef8bf0bc) (`0432261`)
- [getgrav/grav-admin-next](https://github.com/getgrav/grav-admin-next/tree/9f7399f1c568db6f112e92bb87053dacdb10b6ce) (`9f7399f`)
- [nrock34/rwm-front](https://github.com/nrock34/rwm-front/tree/5ea319d053f5477a781a0e0fd564e4f09e2d563c) (`5ea319d`)
- [keithk/atmoBB](https://github.com/keithk/atmoBB/tree/1cab4afaab4bb01aa5aba71a34bb4178da62acdd) (`1cab4af`)
- [wordplaydev/wordplay](https://github.com/wordplaydev/wordplay/tree/11e11599e577212585984d9bebf479fb573a2db5) (`11e1159`)
- [gentleloop-labs/patterns/website](https://github.com/gentleloop-labs/patterns/tree/11fc0594dee2257f4697339bec5ae03433c45e18/website) (`11fc059`)
- [0x5916/OpenCW/frontend](https://github.com/0x5916/OpenCW/tree/4b7f7b517d9b960dc7de2e1af057b3d5a01841dc/frontend) (`4b7f7b5`)
- [arpi09/grocery-manager](https://github.com/arpi09/grocery-manager/tree/fcfd052f28a266a188148ffd5220c81d31c119df) (`fcfd052`)
- [triskel-labs/localsnow-legacy](https://github.com/triskel-labs/localsnow-legacy/tree/3275667124d7edd8c3781ce3a952ef48bae09679) (`3275667`)
- [pmh-only/welplan2/webapp](https://github.com/pmh-only/welplan2/tree/4eb7a342f89cb75ec06f41ff3f759c00872b2446/webapp) (`4eb7a34`)
- [arkanere/solar-app/apps/main-app](https://github.com/arkanere/solar-app/tree/84be045550b6d6554110c8253668a30bcf809dcb/apps/main-app) (`84be045`)
- [AxelDeneu/aden.solutions](https://github.com/AxelDeneu/aden.solutions/tree/101c467d6f4128be18c851bb341395805536369a) (`101c467`)
- [dldx/kissaten/frontend](https://github.com/dldx/kissaten/tree/232dde0a36c98875ea900300745c5aa25aa84353/frontend) (`232dde0`)
- [ygrip/raksara/sveltekit](https://github.com/ygrip/raksara/tree/ccd9ccfd5c4ee4342ed43c34206f231c2fa347ef/sveltekit) (`ccd9ccf`)
- [company-of-heroes/app/packages/app](https://github.com/company-of-heroes/app/tree/592503c38df7fe83f4c6126c1c88ef6ef88805f2/packages/app) (`592503c`)
- [hoaxisr/awg-manager/frontend](https://github.com/hoaxisr/awg-manager/tree/e4bff4a7ed16cde9911eee195fb359109add8ccc/frontend) (`e4bff4a`)
- [joeldesante/TurfBuilder](https://github.com/joeldesante/TurfBuilder/tree/c0de9d0ab8d67977cd9fcb3e182c3ba11e6a7dd3) (`c0de9d0`)
- [obellprat/augur-hakesch/src/frontend](https://github.com/obellprat/augur-hakesch/tree/75fd9b9585f525c4b269a0c661342c5207b6958a/src/frontend) (`75fd9b9`)
- [selfagency/open-communities](https://github.com/selfagency/open-communities/tree/b3b81fe1d7740d4532fd3ea5f8eecb3ba9778ff0) (`b3b81fe`)
- [shuji-bonji/e-shiwake](https://github.com/shuji-bonji/e-shiwake/tree/2228be1b098a54ebd3c90a03a44fa55248e31d21) (`2228be1`)
- [takara2314/3rd-tobamaru-lastyear](https://github.com/takara2314/3rd-tobamaru-lastyear/tree/298abb5c58023725498e83efb9dcede36c5397bd) (`298abb5`)
- [exceptionless/Exceptionless/src/Exceptionless.Web/ClientApp](https://github.com/exceptionless/Exceptionless/tree/0cb2090ce55a252f0cd6a55bbadfa9037a6bca3b/src/Exceptionless.Web/ClientApp) (`0cb2090`)
- [tracewayapp/traceway/frontend](https://github.com/tracewayapp/traceway/tree/1d6a8e6a437119e3d46f943e3b95b025a288e65c/frontend) (`1d6a8e6`)
- [peterthepeter/groly](https://github.com/peterthepeter/groly/tree/f86a9b7ced93047f2dc3210a77be6293e315c7c9) (`f86a9b7`)
- [sira313/rapkumer](https://github.com/sira313/rapkumer/tree/c8700c76719cda07955e039723af3e0e5fe470d4) (`c8700c7`)
- [mxz7/nypsi-website](https://github.com/mxz7/nypsi-website/tree/7c890dc888c4ef0b9c70517a1d49bf18fe14cfbb) (`7c890dc`)
- [willuhmjs/lingolearn](https://github.com/willuhmjs/lingolearn/tree/99515a1bb39ee6ac4fd5de773b0b281175ef9637) (`99515a1`)
- [Hunteraulo1/f95-france](https://github.com/Hunteraulo1/f95-france/tree/5c75b0ae604f8e6dae1da6272b631f5ed2ec7085) (`5c75b0a`)
- [kjetilhoiby/resonans](https://github.com/kjetilhoiby/resonans/tree/e6dca4daaae6463412dfb9318410f1cc9b4e14ae) (`e6dca4d`)
- [MartinoPolo/prejemesi](https://github.com/MartinoPolo/prejemesi/tree/991e98191723ef5d0bd571e228e3073c240119b0) (`991e981`)
- [NERC-Digital-Solutions-Hub/dsh/hub](https://github.com/NERC-Digital-Solutions-Hub/dsh/tree/37eff77bfa5fdf14a6c980502c3c9f9914ebfd82/hub) (`37eff77`)
- [thowerapp/thower-app](https://github.com/thowerapp/thower-app/tree/3c27beb3f39636a022e5c79c25e7456c5255ecf8) (`3c27beb`)
- [NahusenayTadesse/BeautySalon](https://github.com/NahusenayTadesse/BeautySalon/tree/a40979376d2043f7ae9744c04bb46711ff75184a) (`a409793`)
- [orchestra-canvas-tokyo/homepage](https://github.com/orchestra-canvas-tokyo/homepage/tree/c6597925cb9e02f86137c792bedd1dd1e17b3ed3) (`c659792`)
- [zveltio-devs/zveltio/packages/studio](https://github.com/zveltio-devs/zveltio/tree/e075f27985b6b7db630a2f8177725e0266563d82/packages/studio) (`e075f27`)
- [obot-platform/obot/ui/user](https://github.com/obot-platform/obot/tree/fb4b094cc1643ae5b47dff65cd6e16a5c2606b95/ui/user) (`fb4b094`)
- [official-tisao/image.complianttools.com/apps/web](https://github.com/official-tisao/image.complianttools.com/tree/4caae891f007ca76d7f1ca66e12f0e1b5594743c/apps/web) (`4caae89`)
- [glen-spilbraet/portal](https://github.com/glen-spilbraet/portal/tree/d7b7725b63222ffdd71d027f1e1a2dd831068ad4) (`d7b7725`)
- [mobilars/epj](https://github.com/mobilars/epj/tree/18078a4357b2757c0bf8472a6fea54fef9b5f8fb) (`18078a4`)
- [jbndrf/ueberblick](https://github.com/jbndrf/ueberblick/tree/b903ee4f389a6ae5e1f51e63c4d111f70fb5b6e0) (`b903ee4`)
- [hkarlsen06/ampoteket](https://github.com/hkarlsen06/ampoteket/tree/909b9f29f640ef612c72609cb4d82a37665c0f31) (`909b9f2`)
- [disnet/skyreader/frontend](https://github.com/disnet/skyreader/tree/89d73c6a277416df5594c860020e62db3f218602/frontend) (`89d73c6`)
- [sunnypilot/sunnylink-frontend](https://github.com/sunnypilot/sunnylink-frontend/tree/7edbc84f605e36dcf1f761401b3e3065e6b64e11) (`7edbc84`)
- [Stoat-Labs/Stoat/apps/web](https://github.com/Stoat-Labs/Stoat/tree/25a4246c4022c0cc483a361254353b33c8d2790a/apps/web) (`25a4246`)
- [yavuzilyas/laf](https://github.com/yavuzilyas/laf/tree/7cecd0693965b54b288aa05396f56cd5dc45eb8b) (`7cecd06`)
- [mary-ext/anartia](https://github.com/mary-ext/anartia/tree/c94521e425648e74339421fb01d9ed11ae24b281) (`c94521e`)
- [hammadmajid/silroad](https://github.com/hammadmajid/silroad/tree/590e0a0a0a25cfa8984345cf2d1427b5401c0c2e) (`590e0a0`)
- [tanvoid0/portal-desktop](https://github.com/tanvoid0/portal-desktop/tree/65689c8040d77a722cc3cc17057573fca9ee493d) (`65689c8`)
- [Ileies/hacibaba](https://github.com/Ileies/hacibaba/tree/dc27556b6c081531850a1210155893fbaf479ef9) (`dc27556`)
- [xavyo/xavyo-web](https://github.com/xavyo/xavyo-web/tree/7c88512b14450095fff7be05cd787c0a55a56dee) (`7c88512`)
- [menzies-mariesta-com/medora-web-menzies](https://github.com/menzies-mariesta-com/medora-web-menzies/tree/238aee57ea218e6389f6f2c35828f4609afd4c64) (`238aee5`)
- [AlexBocken/homepage](https://github.com/AlexBocken/homepage/tree/19bb5ac71fa60c58ff2f48ab1c54cf7d8cee3056) (`19bb5ac`)
- [michailbouklas/marketing-offers-tool](https://github.com/michailbouklas/marketing-offers-tool/tree/04f86988edc158ab3d696715bd5d0848036885a3) (`04f8698`)
- [cliffordkleinsr/intuitive](https://github.com/cliffordkleinsr/intuitive/tree/eca3ff75cf08ef8bcf77bc70b17ac309209a3398) (`eca3ff7`)
- [One-Learn-Platform/platform](https://github.com/One-Learn-Platform/platform/tree/dcbb294f3fea8a22a7a2afe43984e9e126920d2a) (`dcbb294`)
- [F-Bureaucracy/wohnraum](https://github.com/F-Bureaucracy/wohnraum/tree/11b88b9db7763864f2fb28c63d6648d4af550b59) (`11b88b9`)
- [LausanneTourisme/press](https://github.com/LausanneTourisme/press/tree/8c5d0f7a02656869ff7929d97f77ada11cb0b579) (`8c5d0f7`)
- [tylergraydev/claude-code-tool-manager](https://github.com/tylergraydev/claude-code-tool-manager/tree/63b54d669680d26c17830673dcdf4628b93336b3) (`63b54d6`)
- [glennsyang/synapse](https://github.com/glennsyang/synapse/tree/df66868a0762b3f3c16c4ae2c8c61af6a3352ca2) (`df66868`)
- [ut-code/cms.utcode.net](https://github.com/ut-code/cms.utcode.net/tree/de7a2534f37db381ee50d59af26190492935f0b6) (`de7a253`)
- [obcode/plexams.gui](https://github.com/obcode/plexams.gui/tree/e2449a1e537d87e2728823b9c061676f48cdb5a1) (`e2449a1`)
- [MaxOpperman/spelwijsheid](https://github.com/MaxOpperman/spelwijsheid/tree/0e17f1dec7f86c035f9864e60bcdb641dbab5375) (`0e17f1d`)
- [tilloh-dev/tilloh.dev/frontend](https://github.com/tilloh-dev/tilloh.dev/tree/3013455c974b39c935878f025ea78dfef1eccc15/frontend) (`3013455`)
- [Zahara-Nour/ubumaths](https://github.com/Zahara-Nour/ubumaths/tree/d7ab0237cb13216064bdcefea05c56ac3247c623) (`d7ab023`)
- [ontoplano/ontoplano](https://github.com/ontoplano/ontoplano/tree/892c2ed096c2b29f3713789d9839e9a5ce44c95c) (`892c2ed`)
- [scottcarlton/threadline](https://github.com/scottcarlton/threadline/tree/1927c378495448c5fd9b7f4bcbf58ff33084450c) (`1927c37`)
- [vrennat/nah-tools](https://github.com/vrennat/nah-tools/tree/c676b6ed12a5a65870179782471af72fa379f2c7) (`c676b6e`)
- [syr-is/syr/apps/syr/app](https://github.com/syr-is/syr/tree/139dbed01f21e75d0ab05ceb6f652324217bf216/apps/syr/app) (`139dbed`)
- [simonbrunou/diversif](https://github.com/simonbrunou/diversif/tree/4a32a01b291a51b97d9c305ce8c7e55cdfc297a8) (`4a32a01`)
- [atiohaidar/s2if](https://github.com/atiohaidar/s2if/tree/44573f831c885781cbd63ebe321cfd48d447054d) (`44573f8`)
- [mia-cx/maal](https://github.com/mia-cx/maal/tree/74a12ec38f6c297d1a6adbf596234c45212bac11) (`74a12ec`)
- [Optikt/optikt-app](https://github.com/Optikt/optikt-app/tree/7e2fed4161523725cf982c711c8261ef728d5f5f) (`7e2fed4`)
- [akmmp241/akmmp-porto](https://github.com/akmmp241/akmmp-porto/tree/1b58e7ba5b754f8deb42f8c5278a27b17beacca7) (`1b58e7b`)
- [otterscale/dashboard](https://github.com/otterscale/dashboard/tree/2ffeabbb9cd6ae0f5a53fe2a3d1ba77dd20a97f4) (`2ffeabb`)
- [Mbehbahani/JobPilot](https://github.com/Mbehbahani/JobPilot/tree/aed10d813aabc64ce60b5f6fc5a9bf21df0218c1) (`aed10d8`)
- [fcrozatier/SoME](https://github.com/fcrozatier/SoME/tree/253b383a28611e44bcb3e97a427ad41cab64122e) (`253b383`)
- [radio4000/r4atproto](https://github.com/radio4000/r4atproto/tree/b59ba7aba728683fd333a47f9e5a90bbeda3e5a2) (`b59ba7a`)
- [OpenSelena/omniget](https://github.com/OpenSelena/omniget/tree/bad83311bf05a251accd5e5dbd09d053ecf49d4f) (`bad8331`)
- [motis-project/prima](https://github.com/motis-project/prima/tree/e7369576a951002602bffafb6b93b50a069e1aee) (`e736957`)
- [iamernie/BookShelf](https://github.com/iamernie/BookShelf/tree/ae00cc9b2f8dedd813456a2c80da1244f28eb0ca) (`ae00cc9`)
- [gitaarik/smart-job-seeker](https://github.com/gitaarik/smart-job-seeker/tree/a881154e54889341cc2124d79175f37d8ddf4725) (`a881154`)
- [Wolfe-Jam/faf-one-svelte-new](https://github.com/Wolfe-Jam/faf-one-svelte-new/tree/b58db9c75df89ff6821fd33fbec65ece0a616ed0) (`b58db9c`)
- [RainyMrGab/comedy-connector-app](https://github.com/RainyMrGab/comedy-connector-app/tree/63206cc310e73cef13fbb979f94a67348624ebba) (`63206cc`)
- [domialbrecht/summit](https://github.com/domialbrecht/summit/tree/93ce5b9081db1aca0d8e1e28ed0804bd63d4ddc6) (`93ce5b9`)
- [Anquuni/duas-pro-frontend](https://github.com/Anquuni/duas-pro-frontend/tree/5ea841782d01970e6286535c23501f9a9c0869d3) (`5ea8417`)
- [reddoorla/beachfront-dentistry](https://github.com/reddoorla/beachfront-dentistry/tree/b0e14c9e6789fb43f506c1c448d91f21ce08e4aa) (`b0e14c9`)
- [knicholson32/Contour](https://github.com/knicholson32/Contour/tree/140438d2b9234f1cfed51683146e40b9dffff545) (`140438d`)
- [fmadore/Website](https://github.com/fmadore/Website/tree/250c6bce6209ccaee96e7c136251a969bfc97ae8) (`250c6bc`)
- [nickhildebrandt/twincars-manager](https://github.com/nickhildebrandt/twincars-manager/tree/0b9ea1cdf3cc52326a31a8766caf18b0e7cc5645) (`0b9ea1c`)
- [SE-UUlm/snowballr-frontend](https://github.com/SE-UUlm/snowballr-frontend/tree/70fbec489f3be8c240c39c3129e7229c3b6d5e21) (`70fbec4`)
- [dnnsmnstrr/muenstererOS](https://github.com/dnnsmnstrr/muenstererOS/tree/43b655952aa9d52e87ea264b44fc899b943f401f) (`43b6559`)
- [AtalayaLabs/OxiCloud/frontend](https://github.com/AtalayaLabs/OxiCloud/tree/8c0dd334cf065ad11f60f9be24e2aafd5dda7550/frontend) (`8c0dd33`)
- [nasty-project/nasty/webui](https://github.com/nasty-project/nasty/tree/9a5801d2546171ce6528d42f7179df25218868e3/webui) (`9a5801d`)
- [useindelible/indelible/web](https://github.com/useindelible/indelible/tree/37e90494d3fabcd5282376aee483f88605d2bb15/web) (`37e9049`)
- [forewit/daggerheart-daggerbrain](https://github.com/forewit/daggerheart-daggerbrain/tree/cdc87eb8a8be10283be3e63bbbdbe331d1fc5a02) (`cdc87eb`)
- [office-rivals/mmr-project/frontend](https://github.com/office-rivals/mmr-project/tree/f70e56a37b3dfd1692302d07d59ef2e1f4f2fd51/frontend) (`f70e56a`)
- [qfiber/hybridsocial/frontend](https://github.com/qfiber/hybridsocial/tree/63dfddb4ba14e584ad89256bee5ca47354ed02ec/frontend) (`63dfddb`)
- [vgebrev/leagr](https://github.com/vgebrev/leagr/tree/5e620ca7e79b8b5f0451946ae3dac48212099371) (`5e620ca`)
- [lyriks-io/lyriks-community](https://github.com/lyriks-io/lyriks-community/tree/1536fbb47d8ae919baa10754a373abfd6da80ca8) (`1536fbb`)
- [sirlag/Herocraft/src/webapp](https://github.com/sirlag/Herocraft/tree/98350d243e49080d56c008d6ab9d85f3fcc97cb8/src/webapp) (`98350d2`)
- [tierdom/tierdom-app](https://github.com/tierdom/tierdom-app/tree/14e6a4611a1988b90b25646f28bcc1942fa7fc69) (`14e6a46`)
- [firdausng/duitgee](https://github.com/firdausng/duitgee/tree/264e139a920e9d5ca234a889115eb3de717b459d) (`264e139`)
- [Santrionlinecom/web](https://github.com/Santrionlinecom/web/tree/3924a28af1e8f0616656646d009aa43722ea6ff6) (`3924a28`)
- [caelo-cms/caelo-cms/apps/admin](https://github.com/caelo-cms/caelo-cms/tree/c4896b03ceca4e9be66f6dc07b91cb9b7584f09f/apps/admin) (`c4896b0`)
- [openlobbying/openlobbying](https://github.com/openlobbying/openlobbying/tree/eefd27cb935445ef13f16df3c7ee484e13d6170e) (`eefd27c`)
- [Null-Signal-Games/nrdbv2](https://github.com/Null-Signal-Games/nrdbv2/tree/f79bdc6f487d6de89a9a443105946201f93a92a3) (`f79bdc6`)
- [LemonTV-win/LemonTV](https://github.com/LemonTV-win/LemonTV/tree/56476be748404adb8b7959245244283b11a8eb45) (`56476be`)
- [SamsterZero/Granthalay](https://github.com/SamsterZero/Granthalay/tree/c3dfe7c9e24556e3128d702db399fb9596b7d3d3) (`c3dfe7c`)
- [dledger-com/dledger](https://github.com/dledger-com/dledger/tree/b1360568fd8a62f095ff65527151a38d7b2b5f87) (`b136056`)
- [0base-vc/whoearns-live/ui](https://github.com/0base-vc/whoearns-live/tree/52e9b3979f0512b5cbb3ef03f4386852f2cc9195/ui) (`52e9b39`)
- [PISSARAW/Black-Whale/apps/web](https://github.com/PISSARAW/Black-Whale/tree/be7b9415623f8dee3cbc95e47622491b0de67e63/apps/web) (`be7b941`)
- [sashplatonov/habit-runner/apps/web](https://github.com/sashplatonov/habit-runner/tree/9ac59e2b656100da40ff1cb4e6800866c62604a7/apps/web) (`9ac59e2`)
- [notkimroberts/family-reunion](https://github.com/notkimroberts/family-reunion/tree/86c92c30159f27e445563b633999851f8f99910a) (`86c92c3`)
- [getzenai/untitledconference](https://github.com/getzenai/untitledconference/tree/b76e97646a3c0422397461f16a6a801330d2baa4) (`b76e976`)
- [Kripta-Studios/ja-automation-platform/apps/portal](https://github.com/Kripta-Studios/ja-automation-platform/tree/fd53da19af0242ee1c7d3ba5b715f6f48c44e3d8/apps/portal) (`fd53da1`)
- [RajeshPandey057/orderhive](https://github.com/RajeshPandey057/orderhive/tree/ebc489feadd0585bbb2a04df071f4cfd46da4389) (`ebc489f`)
- [oblivion8282-1337/pulse/web](https://github.com/oblivion8282-1337/pulse/tree/87ed1bd5c8ef9b9bd31ff21756916dfdf6f19f17/web) (`87ed1bd`)
- [dotsem/dotsem.be/portfolio](https://github.com/dotsem/dotsem.be/tree/5cf8d813b57f8168b1ac927b8c6f6ee7e7c66a16/portfolio) (`5cf8d81`)
- [davideastmond/gov-vote](https://github.com/davideastmond/gov-vote/tree/4c25275abd740ceb19f99eda473f7c444dddbd83) (`4c25275`)
- [demml/opsml/crates/opsml_server/opsml_ui](https://github.com/demml/opsml/tree/fd9731e9fa90b1f689bf0f539e9f82e46ecd18ff/crates/opsml_server/opsml_ui) (`fd9731e`)
- [koder-cog/kepce/webapp](https://github.com/koder-cog/kepce/tree/e4531dec210c191b404b47b52d54241168c0d4f2/webapp) (`e4531de`)
- [emse-students/canari/frontend](https://github.com/emse-students/canari/tree/07bc794be3fd1e06cab79292b29f7b6f1c0159ef/frontend) (`07bc794`)
- [Rensing1/gustav/frontend](https://github.com/Rensing1/gustav/tree/748748f29cb3d75e5ff2d782a1bec13eafceb56d/frontend) (`748748f`)
- [MaxKeenti/anotame-microservices/anotame-web](https://github.com/MaxKeenti/anotame-microservices/tree/59ccc826ae00efedcd0975bb92057753f4b632ef/anotame-web) (`59ccc82`)
- [o-in25/Busser](https://github.com/o-in25/Busser/tree/49af452e49343560aab53b7960f83a6ed28f426e) (`49af452`)
- [4www/enlist](https://github.com/4www/enlist/tree/be2d4e9bc700be321a90b2dac330abb4fd310d04) (`be2d4e9`)
- [sophomorica/seminary-sidekick](https://github.com/sophomorica/seminary-sidekick/tree/810168b67986a552732bf87d58e42dc09c74be06) (`810168b`)
- [statox/apps.statox.fr](https://github.com/statox/apps.statox.fr/tree/ba80b88abbb2e20ddc211469b7077f435a21483d) (`ba80b88`)
- [Bewinxed/cawco/apps/dashboard](https://github.com/Bewinxed/cawco/tree/a9cea4d58ce72add7dd38859197790b4219b9b4c/apps/dashboard) (`a9cea4d`)
- [kris-lx/kpos/kpos](https://github.com/kris-lx/kpos/tree/49673f0a94b2c45bfe6ffcd326653b590d497f5b/kpos) (`49673f0`)
- [hunchulchoi/dgst](https://github.com/hunchulchoi/dgst/tree/913ec0194ce53f2d9c7215271c0c4d088c8e4363) (`913ec01`)
- [dxlbnl/website](https://github.com/dxlbnl/website/tree/206452ba4e0224a13d2929b6339b07b68c44a52a) (`206452b`)
- [Mi-Bee-Studio/MiBeeSteward/web](https://github.com/Mi-Bee-Studio/MiBeeSteward/tree/df278c27df039ce778790fa898938ddad8e84627/web) (`df278c2`)
- [codicocodes/dotfyle](https://github.com/codicocodes/dotfyle/tree/fc2795aeb7c02254492cc67947fa35a8b92e4afc) (`fc2795a`)
- [gtmun/couchmun](https://github.com/gtmun/couchmun/tree/ab12bd086c2bb69e139e8a47618801e0a8b3c0f3) (`ab12bd0`)
- [Specy/genshin-music](https://github.com/Specy/genshin-music/tree/2cf86b5d6e3f310ab3ba776a707936bfa3442d02) (`2cf86b5`)
- [likeon/geometa/apps/frontend](https://github.com/likeon/geometa/tree/1213e3e3c1b5bfeec19faa473e417df69a17cd6a/apps/frontend) (`1213e3e`)
- [comcent-io/comcent-ce/packages/web-app](https://github.com/comcent-io/comcent-ce/tree/150c92f592f2964d2b739eb1e5fd616f5a143e95/packages/web-app) (`150c92f`)
- [vokartz/inkforum/apps/web](https://github.com/vokartz/inkforum/tree/96a37c5651ceb3599c0217480194b93ed6fc4001/apps/web) (`96a37c5`)
- [palewire/fivethirtyeightindex.com/web](https://github.com/palewire/fivethirtyeightindex.com/tree/332aa03ccfb34ac11c206a09b0fd5a7bdea5ee13/web) (`332aa03`)
- [Agma-Schwa/nguh.org](https://github.com/Agma-Schwa/nguh.org/tree/712661c10899d6fb3e4e5f7a4bba2233231d3c77) (`712661c`)
- [zmiguel/d-scan.space](https://github.com/zmiguel/d-scan.space/tree/48f31818ac95f466cf3ebe2115d01d43b332ffb8) (`48f3181`)
- [mozilla/performance](https://github.com/mozilla/performance/tree/632ab202547b00d32b55d30a0db045df8625d2ad) (`632ab20`)
- [arnaudon/ScoreGuide/frontend-svelte/ui](https://github.com/arnaudon/ScoreGuide/tree/4eaa868d55ef264f30ce357ed2b13d9ad4a397de/frontend-svelte/ui) (`4eaa868`)
- [dottmp/10xPrivacy](https://github.com/dottmp/10xPrivacy/tree/d128e56109d5a47ea691669f256f930acee5871c) (`d128e56`)
- [avitus/mankunku](https://github.com/avitus/mankunku/tree/005da95c74e78f1c6618842a12ed937da45c189f) (`005da95`)
- [iamleson98/social-front](https://github.com/iamleson98/social-front/tree/c84c96c1e4c80786558fe27f1da4c30c2acdffd5) (`c84c96c`)
- [wevisdemo/parliament-watch](https://github.com/wevisdemo/parliament-watch/tree/1cb15ae42e59d368c84596d2b92d99a7def88546) (`1cb15ae`)
- [xinity-ai/xinity-ai/packages/xinity-ai-dashboard](https://github.com/xinity-ai/xinity-ai/tree/57ddc2aaaf2f3f8b4b5733bbc7751e37978d595c/packages/xinity-ai-dashboard) (`57ddc2a`)
- [hawkinslabdev/motomate/motomate](https://github.com/hawkinslabdev/motomate/tree/8f259cad84170615e707413574a91f0faba8e7c9/motomate) (`8f259ca`)
- [idah-ai/idah/app/frontend](https://github.com/idah-ai/idah/tree/7ea4c21fd6c0aaa5830254463e34cd5587a115d3/app/frontend) (`7ea4c21`)
- [cacack/my-family/web](https://github.com/cacack/my-family/tree/49df53cc1f88e5b11464737bde414fdd076e7058/web) (`49df53c`)
- [vizchitra/website](https://github.com/vizchitra/website/tree/03d50484c4b4728b0c790dcf90a0d6223bc475b4) (`03d5048`)
- [ImGajeed76/quick-cards/website](https://github.com/ImGajeed76/quick-cards/tree/103a5b59c5ef5093de591b7cab3eb6985040ee4c/website) (`103a5b5`)
- [mdragosv/Entropia-Nexus/nexus](https://github.com/mdragosv/Entropia-Nexus/tree/371b7c99d192053776aa9e6e209b27f0a979d2c0/nexus) (`371b7c9`)
- [ThoughtCloudsLost/Care-y/packages/client](https://github.com/ThoughtCloudsLost/Care-y/tree/fcdb0cdf541be5e18dbe720cc332d5110223c758/packages/client) (`fcdb0cd`)
- [Xevion/glint/frontend](https://github.com/Xevion/glint/tree/04688a27070a841dbe99cc5e5718eab9c64f6568/frontend) (`04688a2`)
- [PardalisEdu/PardalisWebSite](https://github.com/PardalisEdu/PardalisWebSite/tree/2148d988217059535f9e91a8d7468cbe6a2357a7) (`2148d98`)
- [clusterzx/netscope/web](https://github.com/clusterzx/netscope/tree/c950b97d590f40433c9d03ec60550753d617edfd/web) (`c950b97`)
- [NeoVand/coms](https://github.com/NeoVand/coms/tree/6163e8d8d8e221a45114dbf6f8dad008d1aa9433) (`6163e8d`)
- [rromenskyi/platform-dash](https://github.com/rromenskyi/platform-dash/tree/026a9388e11bf3252f60df973176d6dcc415f2e8) (`026a938`)
- [gnanakeethan/veli/frontend](https://github.com/gnanakeethan/veli/tree/ed4e0a3107714c98040f8f5060daf5619fbf45aa/frontend) (`ed4e0a3`)
- [sandsower/hundavaent](https://github.com/sandsower/hundavaent/tree/cb93c07de829ff07c7ce09e113def7710cee720a) (`cb93c07`)
- [Home-Vermeylen/homevermeylen-svelte](https://github.com/Home-Vermeylen/homevermeylen-svelte/tree/5ee32298525b3dd5c1eb192511159aff8797c091) (`5ee3229`)
- [dyad-berlin/dyad](https://github.com/dyad-berlin/dyad/tree/e96ceb807b37b9da04fa6ddc5548bf8986c1c8b0) (`e96ceb8`)
- [Boszsp/discord-wh-manager-v2](https://github.com/Boszsp/discord-wh-manager-v2/tree/53d2a3502446e60de5c08a3fe673ef00fec79a73) (`53d2a35`)
- [mtaanquist/Codex](https://github.com/mtaanquist/Codex/tree/c170280c82b58a0c0655a4649b0bf106138c065f) (`c170280`)
- [kubedoio/chv/ui](https://github.com/kubedoio/chv/tree/1fbb2b0431b85f3ef41cdb3915de947dfd39ee66/ui) (`1fbb2b0`)
- [stonith404/umpteenth/frontend](https://github.com/stonith404/umpteenth/tree/9a1d9f5ef02f7aa26379faadeea4de85bfca2c87/frontend) (`9a1d9f5`)
- [p-arndt/uprox](https://github.com/p-arndt/uprox/tree/910aacf0d380679b33efc74b9d6ca00d2b5b2a83) (`910aacf`)
- [hernihistorie/haweb](https://github.com/hernihistorie/haweb/tree/4f90d18e49f1c0bba20dfc12667d76ac699035d3) (`4f90d18`)
- [Dwi-Wahyu/minmat-puskomlekad](https://github.com/Dwi-Wahyu/minmat-puskomlekad/tree/2d0137846bbf0d8bf1e10a01ae90084957240674) (`2d01378`)
- [banklab/banklab.github.io](https://github.com/banklab/banklab.github.io/tree/2b3292a24dd679b0b2b3c77e361616222bc0bbc4) (`2b3292a`)
- [halideworks/onelight/packages/web](https://github.com/halideworks/onelight/tree/dc5b1bdfc9de264d17f5109f2ec96e4406c2453c/packages/web) (`dc5b1bd`)
- [ViniZap4/devnook-web](https://github.com/ViniZap4/devnook-web/tree/e1ed658d9588a87cc6c3d7f70fe395737a06d28a) (`e1ed658`)
- [lunarr-app/lunarr-go](https://github.com/lunarr-app/lunarr-go/tree/af35226b6a86b9cda3faf75e7a26b49147ed2ed0) (`af35226`)
- [supatv/web](https://github.com/supatv/web/tree/079e27e1938333fce429383fe001441603ef1f6b) (`079e27e`)
- [solyto/app](https://github.com/solyto/app/tree/22c5a68e4500570721412c85df9475341dd10349) (`22c5a68`)
- [smovidya/pussadu](https://github.com/smovidya/pussadu/tree/ca040226585eda38b638b26ebafa16a555418c1c) (`ca04022`)
- [kayordDX/pos/client](https://github.com/kayordDX/pos/tree/e8e6169a407f707446144e7b7dedc3e515cc1395/client) (`e8e6169`)
- [Great-Falls-Tool-Bus/gftb-site](https://github.com/Great-Falls-Tool-Bus/gftb-site/tree/28878ae0ba5fcb1bb6cf521bad85fe287f7df39f) (`28878ae`)
- [colinbate/storied](https://github.com/colinbate/storied/tree/3cd9dfdddafaeef0bc4a36d8b37bd5aace1909a2) (`3cd9dfd`)
- [data-miner00/webutils](https://github.com/data-miner00/webutils/tree/2f32b58f738ac94424b83194a5490e2dd94a6e62) (`2f32b58`)
- [radnou/sci-manager-renew/frontend](https://github.com/radnou/sci-manager-renew/tree/9fc6564905bf4ad4b2b61ed76fc4593adaecf047/frontend) (`9fc6564`)
- [notizen-00/u-cms/apps/dashboard](https://github.com/notizen-00/u-cms/tree/11c72baea9cfbe4e88ded3e539990c5adf9f41ba/apps/dashboard) (`11c72ba`)
- [DevelexGroup/DevelexTasks](https://github.com/DevelexGroup/DevelexTasks/tree/8df9d982028fc41f54ffc7347c9a2bd3e4a80802) (`8df9d98`)
- [PRECEPTORST/preceptor-fisic](https://github.com/PRECEPTORST/preceptor-fisic/tree/c43996eb4fbc8a0582b5373f73c5c19b66f894fa) (`c43996e`)
- [hoagsmedia/dead-and-tattooed](https://github.com/hoagsmedia/dead-and-tattooed/tree/38c70315a3382940fae1a4e5d58f4ebfc4b59861) (`38c7031`)
- [Neil-Watson-UK/arthawks](https://github.com/Neil-Watson-UK/arthawks/tree/80ddd5ab0eace6c01737c8f4b3bcb1ada7132968) (`80ddd5a`)
- [arackaf/booklist/svelte-kit](https://github.com/arackaf/booklist/tree/4d3eddbf0d084b0f2d23288db9d2a4b97c325120/svelte-kit) (`4d3eddb`)
- [kurozenzen/kurosearch](https://github.com/kurozenzen/kurosearch/tree/631fcdb1e1ea017dc6edd0167190b752bedf102a) (`631fcdb`)
- [unb-mds/2025-1-NoFluxoUnB/frontend](https://github.com/unb-mds/2025-1-NoFluxoUnB/tree/df5ee5f468c9d6e9e0899a4b06e9a25d42adc74a/frontend) (`df5ee5f`)
- [stuy-arista/arista-web](https://github.com/stuy-arista/arista-web/tree/e5c4d1ff1a77bf3c8c7d6f63291041c5e7341171) (`e5c4d1f`)
- [ieedan/skilless/apps/web](https://github.com/ieedan/skilless/tree/e7ea1ab2b7cd59a43eb618bc1f2dfea7776d6925/apps/web) (`e7ea1ab`)
- [martinemde/martinemde.com](https://github.com/martinemde/martinemde.com/tree/d544d22f5df9b6cc507f01f9ce9116474ef7ec56) (`d544d22`)
- [DHBern/ACO](https://github.com/DHBern/ACO/tree/a7d6c05a5cefa005d0c8cc71eb2cc58ae4426c7d) (`a7d6c05`)
- [hiro-league/hiroleague/admin_frontend](https://github.com/hiro-league/hiroleague/tree/a565474a63306f1d2995a03a36fec1f25e3921f6/admin_frontend) (`a565474`)
- [gibsondevhouse/novellum](https://github.com/gibsondevhouse/novellum/tree/e8205026bc7f1e25423e36f935256bf8eaa2bb0d) (`e820502`)
- [DieSoftwarerobbe/HUMAN](https://github.com/DieSoftwarerobbe/HUMAN/tree/07ad22540bfb293db5bf1f9046ade48632fbcb3c) (`07ad225`)
- [julioborgesigt/escalas](https://github.com/julioborgesigt/escalas/tree/968cd6477b5c4ee994628c9a35f63bce957bbeef) (`968cd64`)
- [Cordn-msg/cordn-web](https://github.com/Cordn-msg/cordn-web/tree/3ffa7bfab7174304ce6851849e05fa2aae2a4371) (`3ffa7bf`)
- [andreucv/puzzle_league](https://github.com/andreucv/puzzle_league/tree/d86f34b684357097c0c26a6e2fd707a2824a4aee) (`d86f34b`)
- [lqn5/senftube](https://github.com/lqn5/senftube/tree/650e13437d944c8a1cbe7e7726964ea33f30c912) (`650e134`)
- [banbox/banbot/web/ui](https://github.com/banbox/banbot/tree/cd037c767c08697afa666e81d6a11e320718cf91/web/ui) (`cd037c7`)
- [sunburnco/sunburn/pwa](https://github.com/sunburnco/sunburn/tree/e6e0690a89893822902eb78bb4b32502de69f461/pwa) (`e6e0690`)
- [alensiljak/cashier-sveltekit](https://github.com/alensiljak/cashier-sveltekit/tree/04ce73501239eca910b20af90d4316b16df0fff1) (`04ce735`)
- [MFergie121/kali-afl-stats](https://github.com/MFergie121/kali-afl-stats/tree/b50577b7792691c525b356c0d180017d2a68e06c) (`b50577b`)
- [adaptocms/adapto-sveltekit-client](https://github.com/adaptocms/adapto-sveltekit-client/tree/691af5f12934bb522979992ec762880d43b61bef) (`691af5f`)
- [FRC5800/MagicScouting](https://github.com/FRC5800/MagicScouting/tree/4635e36eabba85113dde6ba2a44d8e48939d61e3) (`4635e36`)
- [aleapc/guia-guangzhou](https://github.com/aleapc/guia-guangzhou/tree/fcf2a1697912e91ff5e3954da395133e682bd3b2) (`fcf2a16`)
- [SigurdurVilhelmsson/namsbokasafn-vefur](https://github.com/SigurdurVilhelmsson/namsbokasafn-vefur/tree/3dbf50b2293890674639aa547bd0264ef039d810) (`3dbf50b`)
- [BjornKennethHolmstrom/website](https://github.com/BjornKennethHolmstrom/website/tree/d7c8fc9ce6f09990e46071ba6bf13d8d9771371d) (`d7c8fc9`)
- [rakharamadhana/halal-ima-taiwan](https://github.com/rakharamadhana/halal-ima-taiwan/tree/40c62a9f28109ef432ea7934bbc48d54099ea9a8) (`40c62a9`)
- [karaberke/my-kitchen](https://github.com/karaberke/my-kitchen/tree/a37ce2f8a8e3067b0261346e8e505106bc79d4c8) (`a37ce2f`)
- [gofreeil/community/my_new_project](https://github.com/gofreeil/community/tree/efe177a268357bce4718667723c5df2c14d13878/my_new_project) (`efe177a`)
- [KK92-Inc/KKApp/App.Frontend](https://github.com/KK92-Inc/KKApp/tree/7d9fe9ab8e67afaff34854f748d2ebe98c58d0e7/App.Frontend) (`7d9fe9a`)
- [vtes-biased/archon-vibe/frontend](https://github.com/vtes-biased/archon-vibe/tree/df77d4e51d666766c57254b2c451cf6620463be8/frontend) (`df77d4e`)

153459 of 153484 corpus findings have a verdict.

| Rule                                                                                                                  | Corpus findings | Apps | Reviewed (tp / fp / design / unclear) | Precision          | Design share     |
| --------------------------------------------------------------------------------------------------------------------- | --------------- | ---- | ------------------------------------- | ------------------ | ---------------- |
| [`a11y/abbr-title`](../../docs/src/content/docs/rules/a11y/abbr-title.md)                                             | 1               | 1    | 0 / 0 / 1 / 0                         | —                  | 100% (1/1)       |
| [`a11y/accessible-name`](../../docs/src/content/docs/rules/a11y/accessible-name.md)                                   | 330             | 53   | 305 / 0 / 25 / 0                      | 100% (305/305)     | 8% (25/330)      |
| [`a11y/aria-hidden-focus`](../../docs/src/content/docs/rules/a11y/aria-hidden-focus.md)                               | 126             | 27   | 86 / 0 / 40 / 0                       | 100% (86/86)       | 32% (40/126)     |
| [`a11y/deprecated-aria`](../../docs/src/content/docs/rules/a11y/deprecated-aria.md)                                   | 43              | 27   | 43 / 0 / 0 / 0                        | 100% (43/43)       | 0% (0/43)        |
| [`a11y/deprecated-attr`](../../docs/src/content/docs/rules/a11y/deprecated-attr.md)                                   | 109             | 48   | 108 / 0 / 1 / 0                       | 100% (108/108)     | 1% (1/109)       |
| [`a11y/deprecated-element`](../../docs/src/content/docs/rules/a11y/deprecated-element.md)                             | 33              | 6    | 33 / 0 / 0 / 0                        | 100% (33/33)       | 0% (0/33)        |
| [`a11y/disallowed-aria-props`](../../docs/src/content/docs/rules/a11y/disallowed-aria-props.md)                       | 1383            | 189  | 1337 / 2 / 44 / 0                     | 100% (1337/1339)   | 3% (44/1383)     |
| [`a11y/disallowed-element`](../../docs/src/content/docs/rules/a11y/disallowed-element.md)                             | 0               | 0    | —                                     | —                  | —                |
| [`a11y/doctype`](../../docs/src/content/docs/rules/a11y/doctype.md)                                                   | 0               | 0    | —                                     | —                  | —                |
| [`a11y/duplicate-landmark`](../../docs/src/content/docs/rules/a11y/duplicate-landmark.md)                             | 600             | 122  | 568 / 3 / 29 / 0                      | 99% (568/571)      | 5% (29/600)      |
| [`a11y/id-duplication`](../../docs/src/content/docs/rules/a11y/id-duplication.md)                                     | 1074            | 114  | 355 / 24 / 695 / 0                    | 94% (355/379)      | 65% (695/1074)   |
| [`a11y/interactive-nesting`](../../docs/src/content/docs/rules/a11y/interactive-nesting.md)                           | 951             | 126  | 921 / 4 / 26 / 0                      | 100% (921/925)     | 3% (26/951)      |
| [`a11y/invalid-aria-value`](../../docs/src/content/docs/rules/a11y/invalid-aria-value.md)                             | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)         | 0% (0/1)         |
| [`a11y/invalid-role`](../../docs/src/content/docs/rules/a11y/invalid-role.md)                                         | 0               | 0    | —                                     | —                  | —                |
| [`a11y/label-has-control`](../../docs/src/content/docs/rules/a11y/label-has-control.md)                               | 595             | 43   | 595 / 0 / 0 / 0                       | 100% (595/595)     | 0% (0/595)       |
| [`a11y/no-accesskey`](../../docs/src/content/docs/rules/a11y/no-accesskey.md)                                         | 0               | 0    | —                                     | —                  | —                |
| [`a11y/no-autofocus`](../../docs/src/content/docs/rules/a11y/no-autofocus.md)                                         | 176             | 57   | 21 / 0 / 155 / 0                      | 100% (21/21)       | 88% (155/176)    |
| [`a11y/no-duplicate-dt`](../../docs/src/content/docs/rules/a11y/no-duplicate-dt.md)                                   | 0               | 0    | —                                     | —                  | —                |
| [`a11y/no-missing-id-ref`](../../docs/src/content/docs/rules/a11y/no-missing-id-ref.md)                               | 21              | 3    | 21 / 0 / 0 / 0                        | 100% (21/21)       | 0% (0/21)        |
| [`a11y/pattern-title`](../../docs/src/content/docs/rules/a11y/pattern-title.md)                                       | 75              | 37   | 71 / 0 / 4 / 0                        | 100% (71/71)       | 5% (4/75)        |
| [`a11y/permitted-contents`](../../docs/src/content/docs/rules/a11y/permitted-contents.md)                             | 6402            | 289  | 6396 / 6 / 0 / 0                      | 100% (6396/6402)   | 0% (0/6402)      |
| [`a11y/placeholder-label-option`](../../docs/src/content/docs/rules/a11y/placeholder-label-option.md)                 | 89              | 25   | 16 / 0 / 73 / 0                       | 100% (16/16)       | 82% (73/89)      |
| [`a11y/positive-tabindex`](../../docs/src/content/docs/rules/a11y/positive-tabindex.md)                               | 6               | 2    | 6 / 0 / 0 / 0                         | 100% (6/6)         | 0% (0/6)         |
| [`a11y/require-datetime`](../../docs/src/content/docs/rules/a11y/require-datetime.md)                                 | 21              | 2    | 21 / 0 / 0 / 0                        | 100% (21/21)       | 0% (0/21)        |
| [`a11y/required-aria-props`](../../docs/src/content/docs/rules/a11y/required-aria-props.md)                           | 3               | 3    | 3 / 0 / 0 / 0                         | 100% (3/3)         | 0% (0/3)         |
| [`a11y/required-element`](../../docs/src/content/docs/rules/a11y/required-element.md)                                 | 0               | 0    | —                                     | —                  | —                |
| [`a11y/top-level-landmark`](../../docs/src/content/docs/rules/a11y/top-level-landmark.md)                             | 794             | 126  | 783 / 8 / 3 / 0                       | 99% (783/791)      | 0% (3/794)       |
| [`a11y/unknown-aria-attribute`](../../docs/src/content/docs/rules/a11y/unknown-aria-attribute.md)                     | 0               | 0    | —                                     | —                  | —                |
| [`a11y/unverified-id-ref`](../../docs/src/content/docs/rules/a11y/unverified-id-ref.md)                               | 0               | 0    | —                                     | —                  | —                |
| [`a11y/use-list`](../../docs/src/content/docs/rules/a11y/use-list.md)                                                 | 53              | 11   | 49 / 0 / 4 / 0                        | 100% (49/49)       | 8% (4/53)        |
| [`architecture/component-size`](../../docs/src/content/docs/rules/architecture/component-size.md)                     | 15778           | 341  | 15778 / 0 / 0 / 0                     | 100% (15778/15778) | 0% (0/15778)     |
| [`architecture/directory-naming`](../../docs/src/content/docs/rules/architecture/directory-naming.md)                 | 0               | 0    | —                                     | —                  | —                |
| [`architecture/doc-link-target`](../../docs/src/content/docs/rules/architecture/doc-link-target.md)                   | 0               | 0    | —                                     | —                  | —                |
| [`architecture/private-scope-import`](../../docs/src/content/docs/rules/architecture/private-scope-import.md)         | 0               | 0    | —                                     | —                  | —                |
| [`architecture/prop-count`](../../docs/src/content/docs/rules/architecture/prop-count.md)                             | 6244            | 323  | 6244 / 0 / 0 / 0                      | 100% (6244/6244)   | 0% (0/6244)      |
| [`architecture/reserved-directory-names`](../../docs/src/content/docs/rules/architecture/reserved-directory-names.md) | 0               | 0    | —                                     | —                  | —                |
| [`architecture/reserved-name-placement`](../../docs/src/content/docs/rules/architecture/reserved-name-placement.md)   | 0               | 0    | —                                     | —                  | —                |
| [`architecture/route-component-import`](../../docs/src/content/docs/rules/architecture/route-component-import.md)     | 55              | 23   | 3 / 0 / 52 / 0                        | 100% (3/3)         | 95% (52/55)      |
| [`architecture/unit-entry-file`](../../docs/src/content/docs/rules/architecture/unit-entry-file.md)                   | 0               | 0    | —                                     | —                  | —                |
| [`correctness/autoplay-muted`](../../docs/src/content/docs/rules/correctness/autoplay-muted.md)                       | 23              | 16   | 13 / 0 / 10 / 0                       | 100% (13/13)       | 43% (10/23)      |
| [`correctness/base-path-navigation`](../../docs/src/content/docs/rules/correctness/base-path-navigation.md)           | 159             | 17   | 62 / 0 / 97 / 0                       | 100% (62/62)       | 61% (97/159)     |
| [`correctness/checkable-bind-value`](../../docs/src/content/docs/rules/correctness/checkable-bind-value.md)           | 0               | 0    | —                                     | —                  | —                |
| [`correctness/each-index-key`](../../docs/src/content/docs/rules/correctness/each-index-key.md)                       | 3152            | 232  | 1623 / 0 / 1529 / 0                   | 100% (1623/1623)   | 49% (1529/3152)  |
| [`correctness/each-key`](../../docs/src/content/docs/rules/correctness/each-key.md)                                   | 13717           | 231  | 9666 / 0 / 4050 / 1                   | 100% (9666/9666)   | 30% (4050/13717) |
| [`correctness/effect-as-derived`](../../docs/src/content/docs/rules/correctness/effect-as-derived.md)                 | 728             | 173  | 630 / 0 / 98 / 0                      | 100% (630/630)     | 13% (98/728)     |
| [`correctness/effect-as-onmount`](../../docs/src/content/docs/rules/correctness/effect-as-onmount.md)                 | 202             | 82   | 148 / 2 / 52 / 0                      | 99% (148/150)      | 26% (52/202)     |
| [`correctness/instance-browser-global`](../../docs/src/content/docs/rules/correctness/instance-browser-global.md)     | 41              | 23   | 3 / 0 / 38 / 0                        | 100% (3/3)         | 93% (38/41)      |
| [`correctness/nonreactive-builtin-state`](../../docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md) | 43              | 27   | 34 / 0 / 9 / 0                        | 100% (34/34)       | 21% (9/43)       |
| [`correctness/orphan-effect`](../../docs/src/content/docs/rules/correctness/orphan-effect.md)                         | 0               | 0    | —                                     | —                  | —                |
| [`correctness/orphan-lifecycle`](../../docs/src/content/docs/rules/correctness/orphan-lifecycle.md)                   | 0               | 0    | —                                     | —                  | —                |
| [`correctness/prop-mutation`](../../docs/src/content/docs/rules/correctness/prop-mutation.md)                         | 861             | 119  | 418 / 3 / 440 / 0                     | 99% (418/421)      | 51% (440/861)    |
| [`correctness/server-browser-global`](../../docs/src/content/docs/rules/correctness/server-browser-global.md)         | 11              | 4    | 0 / 0 / 11 / 0                        | —                  | 100% (11/11)     |
| [`correctness/stale-prop-derivation`](../../docs/src/content/docs/rules/correctness/stale-prop-derivation.md)         | 247             | 81   | 67 / 0 / 180 / 0                      | 100% (67/67)       | 73% (180/247)    |
| [`correctness/unmutated-state`](../../docs/src/content/docs/rules/correctness/unmutated-state.md)                     | 508             | 130  | 502 / 6 / 0 / 0                       | 99% (502/508)      | 0% (0/508)       |
| [`performance/font-preload-crossorigin`](../../docs/src/content/docs/rules/performance/font-preload-crossorigin.md)   | 0               | 0    | —                                     | —                  | —                |
| [`performance/heavy-import`](../../docs/src/content/docs/rules/performance/heavy-import.md)                           | 109             | 7    | 109 / 0 / 0 / 0                       | 100% (109/109)     | 0% (0/109)       |
| [`performance/iframe-loading`](../../docs/src/content/docs/rules/performance/iframe-loading.md)                       | 268             | 121  | 69 / 0 / 197 / 2                      | 100% (69/69)       | 74% (197/268)    |
| [`performance/image-dimensions`](../../docs/src/content/docs/rules/performance/image-dimensions.md)                   | 2486            | 240  | 723 / 2 / 1761 / 0                    | 100% (723/725)     | 71% (1761/2486)  |
| [`performance/image-loading-hint`](../../docs/src/content/docs/rules/performance/image-loading-hint.md)               | 2265            | 252  | 840 / 2 / 1423 / 0                    | 100% (840/842)     | 63% (1423/2265)  |
| [`performance/lcp-image`](../../docs/src/content/docs/rules/performance/lcp-image.md)                                 | 197             | 72   | 88 / 4 / 105 / 0                      | 96% (88/92)        | 53% (105/197)    |
| [`performance/load-waterfall`](../../docs/src/content/docs/rules/performance/load-waterfall.md)                       | 285             | 40   | 134 / 1 / 150 / 0                     | 99% (134/135)      | 53% (150/285)    |
| [`performance/minify-disabled`](../../docs/src/content/docs/rules/performance/minify-disabled.md)                     | 0               | 0    | —                                     | —                  | —                |
| [`performance/namespace-import`](../../docs/src/content/docs/rules/performance/namespace-import.md)                   | 17              | 9    | 7 / 0 / 10 / 0                        | 100% (7/7)         | 59% (10/17)      |
| [`performance/preconnect`](../../docs/src/content/docs/rules/performance/preconnect.md)                               | 3               | 3    | 3 / 0 / 0 / 0                         | 100% (3/3)         | 0% (0/3)         |
| [`performance/preload-missing-as`](../../docs/src/content/docs/rules/performance/preload-missing-as.md)               | 0               | 0    | —                                     | —                  | —                |
| [`performance/render-blocking-script`](../../docs/src/content/docs/rules/performance/render-blocking-script.md)       | 5               | 3    | 5 / 0 / 0 / 0                         | 100% (5/5)         | 0% (0/5)         |
| [`performance/responsive-image`](../../docs/src/content/docs/rules/performance/responsive-image.md)                   | 2502            | 250  | 2064 / 2 / 436 / 0                    | 100% (2064/2066)   | 17% (436/2502)   |
| [`performance/sequential-awaits`](../../docs/src/content/docs/rules/performance/sequential-awaits.md)                 | 2355            | 184  | 1117 / 2 / 1234 / 2                   | 100% (1117/1119)   | 52% (1234/2355)  |
| [`performance/state-raw`](../../docs/src/content/docs/rules/performance/state-raw.md)                                 | 750             | 162  | 750 / 0 / 0 / 0                       | 100% (750/750)     | 0% (0/750)       |
| [`security/handler-state-write`](../../docs/src/content/docs/rules/security/handler-state-write.md)                   | 18              | 8    | 10 / 0 / 8 / 0                        | 100% (10/10)       | 44% (8/18)       |
| [`security/javascript-url`](../../docs/src/content/docs/rules/security/javascript-url.md)                             | 45              | 3    | 45 / 0 / 0 / 0                        | 100% (45/45)       | 0% (0/45)        |
| [`security/raw-html`](../../docs/src/content/docs/rules/security/raw-html.md)                                         | 3614            | 269  | 369 / 0 / 3244 / 1                    | 100% (369/369)     | 90% (3244/3614)  |
| [`security/server-module-state`](../../docs/src/content/docs/rules/security/server-module-state.md)                   | 186             | 54   | 4 / 2 / 180 / 0                       | 67% (4/6)          | 97% (180/186)    |
| [`security/shared-state-import`](../../docs/src/content/docs/rules/security/shared-state-import.md)                   | 59              | 9    | 47 / 0 / 12 / 0                       | 100% (47/47)       | 20% (12/59)      |
| [`seo/canonical-url`](../../docs/src/content/docs/rules/seo/canonical-url.md)                                         | 9362            | 273  | 3402 / 42 / 5918 / 0                  | 99% (3402/3444)    | 63% (5918/9362)  |
| [`seo/charset`](../../docs/src/content/docs/rules/seo/charset.md)                                                     | 0               | 0    | —                                     | —                  | —                |
| [`seo/description-length`](../../docs/src/content/docs/rules/seo/description-length.md)                               | 485             | 111  | 457 / 0 / 28 / 0                      | 100% (457/457)     | 6% (28/485)      |
| [`seo/description-presence`](../../docs/src/content/docs/rules/seo/description-presence.md)                           | 7071            | 225  | 849 / 83 / 6139 / 0                   | 91% (849/932)      | 87% (6139/7071)  |
| [`seo/duplicate-description`](../../docs/src/content/docs/rules/seo/duplicate-description.md)                         | 127             | 59   | 90 / 0 / 37 / 0                       | 100% (90/90)       | 29% (37/127)     |
| [`seo/duplicate-title`](../../docs/src/content/docs/rules/seo/duplicate-title.md)                                     | 222             | 109  | 43 / 2 / 177 / 0                      | 96% (43/45)        | 80% (177/222)    |
| [`seo/heading-level-skip`](../../docs/src/content/docs/rules/seo/heading-level-skip.md)                               | 1121            | 180  | 1080 / 38 / 3 / 0                     | 97% (1080/1118)    | 0% (3/1121)      |
| [`seo/hreflang`](../../docs/src/content/docs/rules/seo/hreflang.md)                                                   | 0               | 0    | —                                     | —                  | —                |
| [`seo/html-lang`](../../docs/src/content/docs/rules/seo/html-lang.md)                                                 | 4               | 4    | 3 / 0 / 1 / 0                         | 100% (3/3)         | 25% (1/4)        |
| [`seo/image-alt`](../../docs/src/content/docs/rules/seo/image-alt.md)                                                 | 26              | 6    | 26 / 0 / 0 / 0                        | 100% (26/26)       | 0% (0/26)        |
| [`seo/indexability`](../../docs/src/content/docs/rules/seo/indexability.md)                                           | 1052            | 90   | 1048 / 4 / 0 / 0                      | 100% (1048/1052)   | 0% (0/1052)      |
| [`seo/json-ld`](../../docs/src/content/docs/rules/seo/json-ld.md)                                                     | 11250           | 310  | 11232 / 18 / 0 / 0                    | 100% (11232/11250) | 0% (0/11250)     |
| [`seo/json-ld-date-format`](../../docs/src/content/docs/rules/seo/json-ld-date-format.md)                             | 0               | 0    | —                                     | —                  | —                |
| [`seo/json-ld-deprecated-type`](../../docs/src/content/docs/rules/seo/json-ld-deprecated-type.md)                     | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)         | 0% (0/1)         |
| [`seo/json-ld-placeholder`](../../docs/src/content/docs/rules/seo/json-ld-placeholder.md)                             | 0               | 0    | —                                     | —                  | —                |
| [`seo/json-ld-relative-url`](../../docs/src/content/docs/rules/seo/json-ld-relative-url.md)                           | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)         | 0% (0/1)         |
| [`seo/json-ld-required-props`](../../docs/src/content/docs/rules/seo/json-ld-required-props.md)                       | 0               | 0    | —                                     | —                  | —                |
| [`seo/json-ld-validity`](../../docs/src/content/docs/rules/seo/json-ld-validity.md)                                   | 38              | 7    | 38 / 0 / 0 / 0                        | 100% (38/38)       | 0% (0/38)        |
| [`seo/og-description`](../../docs/src/content/docs/rules/seo/og-description.md)                                       | 8991            | 257  | 8903 / 88 / 0 / 0                     | 99% (8903/8991)    | 0% (0/8991)      |
| [`seo/og-image`](../../docs/src/content/docs/rules/seo/og-image.md)                                                   | 9108            | 260  | 9044 / 64 / 0 / 0                     | 99% (9044/9108)    | 0% (0/9108)      |
| [`seo/og-title`](../../docs/src/content/docs/rules/seo/og-title.md)                                                   | 8919            | 257  | 8832 / 87 / 0 / 0                     | 99% (8832/8919)    | 0% (0/8919)      |
| [`seo/og-url`](../../docs/src/content/docs/rules/seo/og-url.md)                                                       | 9283            | 259  | 9235 / 48 / 0 / 0                     | 99% (9235/9283)    | 0% (0/9283)      |
| [`seo/robots-txt`](../../docs/src/content/docs/rules/seo/robots-txt.md)                                               | 123             | 123  | 52 / 2 / 69 / 0                       | 96% (52/54)        | 56% (69/123)     |
| [`seo/single-h1`](../../docs/src/content/docs/rules/seo/single-h1.md)                                                 | 2936            | 289  | 2652 / 108 / 145 / 6                  | 96% (2652/2760)    | 5% (145/2911)    |
| [`seo/sitemap-in-robots`](../../docs/src/content/docs/rules/seo/sitemap-in-robots.md)                                 | 14              | 14   | 13 / 0 / 1 / 0                        | 100% (13/13)       | 7% (1/14)        |
| [`seo/sitemap-xml`](../../docs/src/content/docs/rules/seo/sitemap-xml.md)                                             | 229             | 229  | 86 / 2 / 141 / 0                      | 98% (86/88)        | 62% (141/229)    |
| [`seo/ssr-disabled`](../../docs/src/content/docs/rules/seo/ssr-disabled.md)                                           | 494             | 113  | 132 / 0 / 362 / 0                     | 100% (132/132)     | 73% (362/494)    |
| [`seo/title-length`](../../docs/src/content/docs/rules/seo/title-length.md)                                           | 2130            | 222  | 1926 / 5 / 199 / 0                    | 100% (1926/1931)   | 9% (199/2130)    |
| [`seo/title-presence`](../../docs/src/content/docs/rules/seo/title-presence.md)                                       | 1530            | 117  | 1451 / 40 / 38 / 1                    | 97% (1451/1491)    | 2% (38/1530)     |
| [`seo/twitter-card`](../../docs/src/content/docs/rules/seo/twitter-card.md)                                           | 9148            | 255  | 9071 / 77 / 0 / 0                     | 99% (9071/9148)    | 0% (0/9148)      |
| [`seo/viewport`](../../docs/src/content/docs/rules/seo/viewport.md)                                                   | 0               | 0    | —                                     | —                  | —                |

<!-- rule-reliability:end -->
