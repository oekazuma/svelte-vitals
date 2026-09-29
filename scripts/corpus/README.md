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

Measured on 153 apps, each pinned to a commit:

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

64485 of 64485 corpus findings have a verdict.

| Rule                                                                                                                  | Corpus findings | Apps | Reviewed (tp / fp / design / unclear) | Precision        | Design share    |
| --------------------------------------------------------------------------------------------------------------------- | --------------- | ---- | ------------------------------------- | ---------------- | --------------- |
| [`a11y/abbr-title`](../../docs/src/content/docs/rules/a11y/abbr-title.md)                                             | 1               | 1    | 0 / 0 / 1 / 0                         | —                | 100% (1/1)      |
| [`a11y/accessible-name`](../../docs/src/content/docs/rules/a11y/accessible-name.md)                                   | 236             | 25   | 219 / 0 / 17 / 0                      | 100% (219/219)   | 7% (17/236)     |
| [`a11y/aria-hidden-focus`](../../docs/src/content/docs/rules/a11y/aria-hidden-focus.md)                               | 59              | 12   | 29 / 0 / 30 / 0                       | 100% (29/29)     | 51% (30/59)     |
| [`a11y/deprecated-aria`](../../docs/src/content/docs/rules/a11y/deprecated-aria.md)                                   | 32              | 19   | 32 / 0 / 0 / 0                        | 100% (32/32)     | 0% (0/32)       |
| [`a11y/deprecated-attr`](../../docs/src/content/docs/rules/a11y/deprecated-attr.md)                                   | 70              | 24   | 70 / 0 / 0 / 0                        | 100% (70/70)     | 0% (0/70)       |
| [`a11y/deprecated-element`](../../docs/src/content/docs/rules/a11y/deprecated-element.md)                             | 2               | 1    | 2 / 0 / 0 / 0                         | 100% (2/2)       | 0% (0/2)        |
| [`a11y/disallowed-aria-props`](../../docs/src/content/docs/rules/a11y/disallowed-aria-props.md)                       | 585             | 82   | 575 / 0 / 10 / 0                      | 100% (575/575)   | 2% (10/585)     |
| [`a11y/disallowed-element`](../../docs/src/content/docs/rules/a11y/disallowed-element.md)                             | 0               | 0    | —                                     | —                | —               |
| [`a11y/doctype`](../../docs/src/content/docs/rules/a11y/doctype.md)                                                   | 0               | 0    | —                                     | —                | —               |
| [`a11y/duplicate-landmark`](../../docs/src/content/docs/rules/a11y/duplicate-landmark.md)                             | 200             | 56   | 177 / 0 / 23 / 0                      | 100% (177/177)   | 12% (23/200)    |
| [`a11y/id-duplication`](../../docs/src/content/docs/rules/a11y/id-duplication.md)                                     | 749             | 48   | 194 / 0 / 555 / 0                     | 100% (194/194)   | 74% (555/749)   |
| [`a11y/interactive-nesting`](../../docs/src/content/docs/rules/a11y/interactive-nesting.md)                           | 355             | 48   | 353 / 0 / 2 / 0                       | 100% (353/353)   | 1% (2/355)      |
| [`a11y/invalid-aria-value`](../../docs/src/content/docs/rules/a11y/invalid-aria-value.md)                             | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)        |
| [`a11y/invalid-role`](../../docs/src/content/docs/rules/a11y/invalid-role.md)                                         | 0               | 0    | —                                     | —                | —               |
| [`a11y/label-has-control`](../../docs/src/content/docs/rules/a11y/label-has-control.md)                               | 121             | 19   | 121 / 0 / 0 / 0                       | 100% (121/121)   | 0% (0/121)      |
| [`a11y/no-accesskey`](../../docs/src/content/docs/rules/a11y/no-accesskey.md)                                         | 0               | 0    | —                                     | —                | —               |
| [`a11y/no-autofocus`](../../docs/src/content/docs/rules/a11y/no-autofocus.md)                                         | 69              | 24   | 7 / 0 / 62 / 0                        | 100% (7/7)       | 90% (62/69)     |
| [`a11y/no-duplicate-dt`](../../docs/src/content/docs/rules/a11y/no-duplicate-dt.md)                                   | 0               | 0    | —                                     | —                | —               |
| [`a11y/no-missing-id-ref`](../../docs/src/content/docs/rules/a11y/no-missing-id-ref.md)                               | 3               | 1    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)        |
| [`a11y/pattern-title`](../../docs/src/content/docs/rules/a11y/pattern-title.md)                                       | 31              | 19   | 31 / 0 / 0 / 0                        | 100% (31/31)     | 0% (0/31)       |
| [`a11y/permitted-contents`](../../docs/src/content/docs/rules/a11y/permitted-contents.md)                             | 3101            | 133  | 3100 / 1 / 0 / 0                      | 100% (3100/3101) | 0% (0/3101)     |
| [`a11y/placeholder-label-option`](../../docs/src/content/docs/rules/a11y/placeholder-label-option.md)                 | 17              | 8    | 6 / 0 / 11 / 0                        | 100% (6/6)       | 65% (11/17)     |
| [`a11y/positive-tabindex`](../../docs/src/content/docs/rules/a11y/positive-tabindex.md)                               | 3               | 1    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)        |
| [`a11y/require-datetime`](../../docs/src/content/docs/rules/a11y/require-datetime.md)                                 | 18              | 1    | 18 / 0 / 0 / 0                        | 100% (18/18)     | 0% (0/18)       |
| [`a11y/required-aria-props`](../../docs/src/content/docs/rules/a11y/required-aria-props.md)                           | 2               | 2    | 2 / 0 / 0 / 0                         | 100% (2/2)       | 0% (0/2)        |
| [`a11y/required-element`](../../docs/src/content/docs/rules/a11y/required-element.md)                                 | 0               | 0    | —                                     | —                | —               |
| [`a11y/top-level-landmark`](../../docs/src/content/docs/rules/a11y/top-level-landmark.md)                             | 251             | 53   | 247 / 3 / 1 / 0                       | 99% (247/250)    | 0% (1/251)      |
| [`a11y/unknown-aria-attribute`](../../docs/src/content/docs/rules/a11y/unknown-aria-attribute.md)                     | 0               | 0    | —                                     | —                | —               |
| [`a11y/unverified-id-ref`](../../docs/src/content/docs/rules/a11y/unverified-id-ref.md)                               | 0               | 0    | —                                     | —                | —               |
| [`a11y/use-list`](../../docs/src/content/docs/rules/a11y/use-list.md)                                                 | 18              | 5    | 16 / 0 / 2 / 0                        | 100% (16/16)     | 11% (2/18)      |
| [`architecture/component-size`](../../docs/src/content/docs/rules/architecture/component-size.md)                     | 7282            | 148  | 7282 / 0 / 0 / 0                      | 100% (7282/7282) | 0% (0/7282)     |
| [`architecture/directory-naming`](../../docs/src/content/docs/rules/architecture/directory-naming.md)                 | 0               | 0    | —                                     | —                | —               |
| [`architecture/doc-link-target`](../../docs/src/content/docs/rules/architecture/doc-link-target.md)                   | 0               | 0    | —                                     | —                | —               |
| [`architecture/private-scope-import`](../../docs/src/content/docs/rules/architecture/private-scope-import.md)         | 0               | 0    | —                                     | —                | —               |
| [`architecture/prop-count`](../../docs/src/content/docs/rules/architecture/prop-count.md)                             | 2899            | 137  | 2899 / 0 / 0 / 0                      | 100% (2899/2899) | 0% (0/2899)     |
| [`architecture/reserved-directory-names`](../../docs/src/content/docs/rules/architecture/reserved-directory-names.md) | 0               | 0    | —                                     | —                | —               |
| [`architecture/reserved-name-placement`](../../docs/src/content/docs/rules/architecture/reserved-name-placement.md)   | 0               | 0    | —                                     | —                | —               |
| [`architecture/route-component-import`](../../docs/src/content/docs/rules/architecture/route-component-import.md)     | 25              | 12   | 2 / 0 / 23 / 0                        | 100% (2/2)       | 92% (23/25)     |
| [`architecture/unit-entry-file`](../../docs/src/content/docs/rules/architecture/unit-entry-file.md)                   | 0               | 0    | —                                     | —                | —               |
| [`correctness/autoplay-muted`](../../docs/src/content/docs/rules/correctness/autoplay-muted.md)                       | 8               | 6    | 6 / 0 / 2 / 0                         | 100% (6/6)       | 25% (2/8)       |
| [`correctness/base-path-navigation`](../../docs/src/content/docs/rules/correctness/base-path-navigation.md)           | 49              | 9    | 43 / 0 / 6 / 0                        | 100% (43/43)     | 12% (6/49)      |
| [`correctness/checkable-bind-value`](../../docs/src/content/docs/rules/correctness/checkable-bind-value.md)           | 0               | 0    | —                                     | —                | —               |
| [`correctness/each-index-key`](../../docs/src/content/docs/rules/correctness/each-index-key.md)                       | 1223            | 88   | 597 / 0 / 626 / 0                     | 100% (597/597)   | 51% (626/1223)  |
| [`correctness/each-key`](../../docs/src/content/docs/rules/correctness/each-key.md)                                   | 6599            | 112  | 4752 / 0 / 1846 / 1                   | 100% (4752/4752) | 28% (1846/6599) |
| [`correctness/effect-as-derived`](../../docs/src/content/docs/rules/correctness/effect-as-derived.md)                 | 323             | 77   | 275 / 0 / 48 / 0                      | 100% (275/275)   | 15% (48/323)    |
| [`correctness/effect-as-onmount`](../../docs/src/content/docs/rules/correctness/effect-as-onmount.md)                 | 66              | 40   | 53 / 0 / 13 / 0                       | 100% (53/53)     | 20% (13/66)     |
| [`correctness/instance-browser-global`](../../docs/src/content/docs/rules/correctness/instance-browser-global.md)     | 24              | 12   | 2 / 0 / 22 / 0                        | 100% (2/2)       | 92% (22/24)     |
| [`correctness/nonreactive-builtin-state`](../../docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md) | 20              | 14   | 18 / 0 / 2 / 0                        | 100% (18/18)     | 10% (2/20)      |
| [`correctness/orphan-effect`](../../docs/src/content/docs/rules/correctness/orphan-effect.md)                         | 0               | 0    | —                                     | —                | —               |
| [`correctness/orphan-lifecycle`](../../docs/src/content/docs/rules/correctness/orphan-lifecycle.md)                   | 0               | 0    | —                                     | —                | —               |
| [`correctness/prop-mutation`](../../docs/src/content/docs/rules/correctness/prop-mutation.md)                         | 384             | 60   | 177 / 2 / 205 / 0                     | 99% (177/179)    | 53% (205/384)   |
| [`correctness/server-browser-global`](../../docs/src/content/docs/rules/correctness/server-browser-global.md)         | 2               | 2    | 0 / 0 / 2 / 0                         | —                | 100% (2/2)      |
| [`correctness/stale-prop-derivation`](../../docs/src/content/docs/rules/correctness/stale-prop-derivation.md)         | 142             | 36   | 48 / 0 / 94 / 0                       | 100% (48/48)     | 66% (94/142)    |
| [`correctness/unmutated-state`](../../docs/src/content/docs/rules/correctness/unmutated-state.md)                     | 231             | 63   | 230 / 1 / 0 / 0                       | 100% (230/231)   | 0% (0/231)      |
| [`performance/font-preload-crossorigin`](../../docs/src/content/docs/rules/performance/font-preload-crossorigin.md)   | 0               | 0    | —                                     | —                | —               |
| [`performance/heavy-import`](../../docs/src/content/docs/rules/performance/heavy-import.md)                           | 37              | 2    | 37 / 0 / 0 / 0                        | 100% (37/37)     | 0% (0/37)       |
| [`performance/iframe-loading`](../../docs/src/content/docs/rules/performance/iframe-loading.md)                       | 125             | 54   | 40 / 0 / 83 / 2                       | 100% (40/40)     | 66% (83/125)    |
| [`performance/image-dimensions`](../../docs/src/content/docs/rules/performance/image-dimensions.md)                   | 940             | 102  | 268 / 0 / 672 / 0                     | 100% (268/268)   | 71% (672/940)   |
| [`performance/image-loading-hint`](../../docs/src/content/docs/rules/performance/image-loading-hint.md)               | 845             | 113  | 333 / 0 / 512 / 0                     | 100% (333/333)   | 61% (512/845)   |
| [`performance/lcp-image`](../../docs/src/content/docs/rules/performance/lcp-image.md)                                 | 85              | 28   | 40 / 2 / 43 / 0                       | 95% (40/42)      | 51% (43/85)     |
| [`performance/load-waterfall`](../../docs/src/content/docs/rules/performance/load-waterfall.md)                       | 197             | 23   | 79 / 1 / 117 / 0                      | 99% (79/80)      | 59% (117/197)   |
| [`performance/minify-disabled`](../../docs/src/content/docs/rules/performance/minify-disabled.md)                     | 0               | 0    | —                                     | —                | —               |
| [`performance/namespace-import`](../../docs/src/content/docs/rules/performance/namespace-import.md)                   | 10              | 5    | 5 / 0 / 5 / 0                         | 100% (5/5)       | 50% (5/10)      |
| [`performance/preconnect`](../../docs/src/content/docs/rules/performance/preconnect.md)                               | 2               | 2    | 2 / 0 / 0 / 0                         | 100% (2/2)       | 0% (0/2)        |
| [`performance/preload-missing-as`](../../docs/src/content/docs/rules/performance/preload-missing-as.md)               | 0               | 0    | —                                     | —                | —               |
| [`performance/render-blocking-script`](../../docs/src/content/docs/rules/performance/render-blocking-script.md)       | 5               | 3    | 5 / 0 / 0 / 0                         | 100% (5/5)       | 0% (0/5)        |
| [`performance/responsive-image`](../../docs/src/content/docs/rules/performance/responsive-image.md)                   | 909             | 106  | 769 / 0 / 140 / 0                     | 100% (769/769)   | 15% (140/909)   |
| [`performance/sequential-awaits`](../../docs/src/content/docs/rules/performance/sequential-awaits.md)                 | 917             | 80   | 422 / 1 / 493 / 1                     | 100% (422/423)   | 54% (493/917)   |
| [`performance/state-raw`](../../docs/src/content/docs/rules/performance/state-raw.md)                                 | 348             | 68   | 348 / 0 / 0 / 0                       | 100% (348/348)   | 0% (0/348)      |
| [`security/handler-state-write`](../../docs/src/content/docs/rules/security/handler-state-write.md)                   | 17              | 7    | 10 / 0 / 7 / 0                        | 100% (10/10)     | 41% (7/17)      |
| [`security/javascript-url`](../../docs/src/content/docs/rules/security/javascript-url.md)                             | 45              | 3    | 45 / 0 / 0 / 0                        | 100% (45/45)     | 0% (0/45)       |
| [`security/raw-html`](../../docs/src/content/docs/rules/security/raw-html.md)                                         | 1739            | 127  | 222 / 0 / 1516 / 1                    | 100% (222/222)   | 87% (1516/1739) |
| [`security/server-module-state`](../../docs/src/content/docs/rules/security/server-module-state.md)                   | 88              | 27   | 4 / 1 / 83 / 0                        | 80% (4/5)        | 94% (83/88)     |
| [`security/shared-state-import`](../../docs/src/content/docs/rules/security/shared-state-import.md)                   | 54              | 5    | 45 / 0 / 9 / 0                        | 100% (45/45)     | 17% (9/54)      |
| [`seo/canonical-url`](../../docs/src/content/docs/rules/seo/canonical-url.md)                                         | 3697            | 113  | 1636 / 36 / 2025 / 0                  | 98% (1636/1672)  | 55% (2025/3697) |
| [`seo/charset`](../../docs/src/content/docs/rules/seo/charset.md)                                                     | 0               | 0    | —                                     | —                | —               |
| [`seo/description-length`](../../docs/src/content/docs/rules/seo/description-length.md)                               | 163             | 42   | 163 / 0 / 0 / 0                       | 100% (163/163)   | 0% (0/163)      |
| [`seo/description-presence`](../../docs/src/content/docs/rules/seo/description-presence.md)                           | 2708            | 94   | 407 / 76 / 2225 / 0                   | 84% (407/483)    | 82% (2225/2708) |
| [`seo/duplicate-description`](../../docs/src/content/docs/rules/seo/duplicate-description.md)                         | 63              | 19   | 57 / 0 / 6 / 0                        | 100% (57/57)     | 10% (6/63)      |
| [`seo/duplicate-title`](../../docs/src/content/docs/rules/seo/duplicate-title.md)                                     | 70              | 38   | 21 / 0 / 49 / 0                       | 100% (21/21)     | 70% (49/70)     |
| [`seo/heading-level-skip`](../../docs/src/content/docs/rules/seo/heading-level-skip.md)                               | 475             | 79   | 448 / 27 / 0 / 0                      | 94% (448/475)    | 0% (0/475)      |
| [`seo/hreflang`](../../docs/src/content/docs/rules/seo/hreflang.md)                                                   | 0               | 0    | —                                     | —                | —               |
| [`seo/html-lang`](../../docs/src/content/docs/rules/seo/html-lang.md)                                                 | 4               | 4    | 3 / 0 / 1 / 0                         | 100% (3/3)       | 25% (1/4)       |
| [`seo/image-alt`](../../docs/src/content/docs/rules/seo/image-alt.md)                                                 | 14              | 4    | 14 / 0 / 0 / 0                        | 100% (14/14)     | 0% (0/14)       |
| [`seo/indexability`](../../docs/src/content/docs/rules/seo/indexability.md)                                           | 633             | 47   | 633 / 0 / 0 / 0                       | 100% (633/633)   | 0% (0/633)      |
| [`seo/json-ld`](../../docs/src/content/docs/rules/seo/json-ld.md)                                                     | 4634            | 133  | 4630 / 4 / 0 / 0                      | 100% (4630/4634) | 0% (0/4634)     |
| [`seo/json-ld-date-format`](../../docs/src/content/docs/rules/seo/json-ld-date-format.md)                             | 0               | 0    | —                                     | —                | —               |
| [`seo/json-ld-deprecated-type`](../../docs/src/content/docs/rules/seo/json-ld-deprecated-type.md)                     | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)        |
| [`seo/json-ld-placeholder`](../../docs/src/content/docs/rules/seo/json-ld-placeholder.md)                             | 0               | 0    | —                                     | —                | —               |
| [`seo/json-ld-relative-url`](../../docs/src/content/docs/rules/seo/json-ld-relative-url.md)                           | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)       | 0% (0/1)        |
| [`seo/json-ld-required-props`](../../docs/src/content/docs/rules/seo/json-ld-required-props.md)                       | 0               | 0    | —                                     | —                | —               |
| [`seo/json-ld-validity`](../../docs/src/content/docs/rules/seo/json-ld-validity.md)                                   | 3               | 1    | 3 / 0 / 0 / 0                         | 100% (3/3)       | 0% (0/3)        |
| [`seo/og-description`](../../docs/src/content/docs/rules/seo/og-description.md)                                       | 3550            | 107  | 3469 / 81 / 0 / 0                     | 98% (3469/3550)  | 0% (0/3550)     |
| [`seo/og-image`](../../docs/src/content/docs/rules/seo/og-image.md)                                                   | 3480            | 109  | 3423 / 57 / 0 / 0                     | 98% (3423/3480)  | 0% (0/3480)     |
| [`seo/og-title`](../../docs/src/content/docs/rules/seo/og-title.md)                                                   | 3484            | 107  | 3403 / 81 / 0 / 0                     | 98% (3403/3484)  | 0% (0/3484)     |
| [`seo/og-url`](../../docs/src/content/docs/rules/seo/og-url.md)                                                       | 3499            | 106  | 3463 / 36 / 0 / 0                     | 99% (3463/3499)  | 0% (0/3499)     |
| [`seo/robots-txt`](../../docs/src/content/docs/rules/seo/robots-txt.md)                                               | 58              | 58   | 28 / 0 / 30 / 0                       | 100% (28/28)     | 52% (30/58)     |
| [`seo/single-h1`](../../docs/src/content/docs/rules/seo/single-h1.md)                                                 | 1173            | 125  | 1037 / 51 / 81 / 4                    | 95% (1037/1088)  | 7% (81/1173)    |
| [`seo/sitemap-in-robots`](../../docs/src/content/docs/rules/seo/sitemap-in-robots.md)                                 | 9               | 9    | 9 / 0 / 0 / 0                         | 100% (9/9)       | 0% (0/9)        |
| [`seo/sitemap-xml`](../../docs/src/content/docs/rules/seo/sitemap-xml.md)                                             | 89              | 89   | 36 / 1 / 52 / 0                       | 97% (36/37)      | 58% (52/89)     |
| [`seo/ssr-disabled`](../../docs/src/content/docs/rules/seo/ssr-disabled.md)                                           | 283             | 50   | 77 / 0 / 206 / 0                      | 100% (77/77)     | 73% (206/283)   |
| [`seo/title-length`](../../docs/src/content/docs/rules/seo/title-length.md)                                           | 741             | 92   | 738 / 2 / 1 / 0                       | 100% (738/740)   | 0% (1/741)      |
| [`seo/title-presence`](../../docs/src/content/docs/rules/seo/title-presence.md)                                       | 462             | 60   | 407 / 40 / 14 / 1                     | 91% (407/447)    | 3% (14/462)     |
| [`seo/twitter-card`](../../docs/src/content/docs/rules/seo/twitter-card.md)                                           | 3627            | 109  | 3556 / 71 / 0 / 0                     | 98% (3556/3627)  | 0% (0/3627)     |
| [`seo/viewport`](../../docs/src/content/docs/rules/seo/viewport.md)                                                   | 0               | 0    | —                                     | —                | —               |

<!-- rule-reliability:end -->
