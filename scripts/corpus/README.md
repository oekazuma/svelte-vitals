# Rule reliability (internal)

How often each rule's findings hold up on real SvelteKit apps. This is a development aid, not a
user-facing claim: use it to see which rules need attention and whether a change made a rule more or
less trustworthy. Design: `docs/superpowers/specs/2026-09-23-corpus-precision-design.md`.

- `targets.json` — the corpus: open-source SvelteKit apps, each pinned to a commit.
- `verdicts/` — one verdict per finding, keyed `app::rule::file:line::claim`, in one file per app
  (`owner__repo[__path].json`, `/` and `:` written as `__`) so no file nears GitHub's size limit.
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
- **"not yet reviewed"** means the rule fired on the corpus but none of its findings has a verdict yet. Add verdicts to `verdicts/` to move it.
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

Measured on 558 apps, each pinned to a commit:

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
- [SciSharp/BotSharp-UI](https://github.com/SciSharp/BotSharp-UI/tree/8ceb94109778148f8c1e877798dc9754255fe994) (`8ceb941`)
- [QAStudio-Dev/studio](https://github.com/QAStudio-Dev/studio/tree/00b4599339ed3245fd04d3c903a23334d094254c) (`00b4599`)
- [spuithori/tokimekibluesky](https://github.com/spuithori/tokimekibluesky/tree/f0883fba527c6324a7169e111ae2c8ddcf4e9366) (`f0883fb`)
- [civitai/civitai/apps/moderator](https://github.com/civitai/civitai/tree/6ff7aff2ab52090358752dc58dca22fd04135d96/apps/moderator) (`6ff7aff`)
- [pauljoda/Prismedia/apps/web-svelte](https://github.com/pauljoda/Prismedia/tree/627958a491f565babf1f8f693a5bb48ea834bc7e/apps/web-svelte) (`627958a`)
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
- [infosave2007/aivpn/platforms/aivpn-web/client](https://github.com/infosave2007/aivpn/tree/3553767443e57c521f7cd2c18a468724beb8eafb/platforms/aivpn-web/client) (`3553767`)
- [bsv-blockchain/teranode/ui/dashboard](https://github.com/bsv-blockchain/teranode/tree/581b600dd79127c2609c8a967a78a40536946943/ui/dashboard) (`581b600`)
- [openstate/jodal/frontend](https://github.com/openstate/jodal/tree/917918a2702a30128ff05ecfc597be19ec724ac2/frontend) (`917918a`)
- [nikolat/nos-haiku](https://github.com/nikolat/nos-haiku/tree/4a284c2027bc4effa482ef7994df3bae7f5e9da7) (`4a284c2`)
- [kmc7468/arkvault](https://github.com/kmc7468/arkvault/tree/b35585c7bb55407e2fef0755b1ce47bb26a43232) (`b35585c`)
- [nagringa-dev/matilha-builders/apps/web](https://github.com/nagringa-dev/matilha-builders/tree/ebb3aa4db019726912b2f95bad51458e971a7c42/apps/web) (`ebb3aa4`)
- [datasektionen/cashflow/frontend](https://github.com/datasektionen/cashflow/tree/f5d2731dec023f95671e25921275d17b77dc7f41/frontend) (`f5d2731`)
- [chloepriceless/proxmox-gui/frontend](https://github.com/chloepriceless/proxmox-gui/tree/e485bc4371e564d240993e0f98d272d41ff4124c/frontend) (`e485bc4`)
- [vibeunion/supauth/packages/admin-console](https://github.com/vibeunion/supauth/tree/3b41d09dc50d8c247d8c19be7407a24684d30c55/packages/admin-console) (`3b41d09`)
- [w3c-cg/sstim](https://github.com/w3c-cg/sstim/tree/6421fe84843f8b506201ef5df65ead31a4e803a8) (`6421fe8`)
- [kasra-org/ieum/frontend](https://github.com/kasra-org/ieum/tree/052d9014d0c7696a294fbf86d74c38f63cdb5eb5/frontend) (`052d901`)
- [n9d0g/fcc](https://github.com/n9d0g/fcc/tree/a277f14c2d6af951107fdb04b379a585aca7bfcf) (`a277f14`)
- [hayhaydz/offline-finance-dashboard](https://github.com/hayhaydz/offline-finance-dashboard/tree/b7ce3e453c2f5202737ea691fc82b4a423edabeb) (`b7ce3e4`)
- [henryj-dev/lodestar](https://github.com/henryj-dev/lodestar/tree/eb15f010a445d9eee57e96a53bad5508fb38d04c) (`eb15f01`)
- [hoshi-io/hoshi/hoshi-frontend](https://github.com/hoshi-io/hoshi/tree/d642ece8a76d90602c3e96a2febf330720d48716/hoshi-frontend) (`d642ece`)
- [numerique-gouv/ami-notifications-api/public/mobile-app](https://github.com/numerique-gouv/ami-notifications-api/tree/b3e608c93665c149dad354a0b6cd7da593a61361/public/mobile-app) (`b3e608c`)
- [Giant-Bomb-Preservation-Project/duders-zone](https://github.com/Giant-Bomb-Preservation-Project/duders-zone/tree/8bc3a897a7b1fef2bce02e743a78ae9e5f97eb2a) (`8bc3a89`)
- [decent-stuff/decent-cloud/website](https://github.com/decent-stuff/decent-cloud/tree/13dda9dee3c85a422983beaab485b0a7d8e0f2b6/website) (`13dda9d`)
- [funmary-app/funmary/apps/web](https://github.com/funmary-app/funmary/tree/317bde2bd1f32d31b131f59c0d06997b04953372/apps/web) (`317bde2`)
- [caelyreth/site](https://github.com/caelyreth/site/tree/1304dcda57e3e197febe09b6b07edeb024c5f80a) (`1304dcd`)
- [dsa-ntc/brdsa.github.io](https://github.com/dsa-ntc/brdsa.github.io/tree/43b5dcfead0c5a15fb93ec0c1b6da9b0882fe025) (`43b5dcf`)
- [limoncc/trailer/trailer-ui](https://github.com/limoncc/trailer/tree/1e1179cf185036582262cb92485cca64c1fe3387/trailer-ui) (`1e1179c`)
- [mathiasscherer2007/lemke-bank/client](https://github.com/mathiasscherer2007/lemke-bank/tree/618f5b171d4f8d85e9532d99743a8594983ca985/client) (`618f5b1`)
- [KaisAbiyyi/tarkana](https://github.com/KaisAbiyyi/tarkana/tree/6d17c340bbcd1a39f3acaed876fc4232152440e3) (`6d17c34`)
- [yethdev/greenmods/ui](https://github.com/yethdev/greenmods/tree/d2d7d0c01dd2938004885d4bc6df81c269652726/ui) (`d2d7d0c`)
- [freekmetsch/kitchenbrain](https://github.com/freekmetsch/kitchenbrain/tree/4a364d356df48fd8d42ca023fa8e94e1d4ce78cf) (`4a364d3`)
- [gluonMaster/reg_allgemein](https://github.com/gluonMaster/reg_allgemein/tree/2186969752c290930051eaeee27ace5c755f490a) (`2186969`)
- [SampleTown-org/eDNA-SampleTown](https://github.com/SampleTown-org/eDNA-SampleTown/tree/650fdee007c4bcda3172425d2012618941cc0fbf) (`650fdee`)
- [The-Robotics-Catalyst-Foundation/ct-ftc-website](https://github.com/The-Robotics-Catalyst-Foundation/ct-ftc-website/tree/8323c71cb09c160b4a7392a3fe9704f0ba1d5e5e) (`8323c71`)
- [michaelbonner/bootpack-digital](https://github.com/michaelbonner/bootpack-digital/tree/6b85d289892dae3ed997ff1886cec2ceb1960f53) (`6b85d28`)
- [mbocek/syam-web](https://github.com/mbocek/syam-web/tree/712d61ae4281482a4a59e9b20ba374012280ce0c) (`712d61a`)
- [Manta-Epitech-Academy/jump/frontend](https://github.com/Manta-Epitech-Academy/jump/tree/04d06dcd53ee58bb60da6e079337abcd48986091/frontend) (`04d06dc`)
- [CarloMicieli/rusty-shed](https://github.com/CarloMicieli/rusty-shed/tree/b95e2eca519ae1b0037154d8388462c0e14013a6) (`b95e2ec`)
- [EmKaCe/scipro_review/frontend](https://github.com/EmKaCe/scipro_review/tree/efd2eabea1c635fb1d597d1631e96c503ae21d4a/frontend) (`efd2eab`)
- [LkMasterhub/defisAsso](https://github.com/LkMasterhub/defisAsso/tree/cdb4a8b72c79e853fbbe08f2e9799126555b2a92) (`cdb4a8b`)
- [openprx/sylvode/frontend](https://github.com/openprx/sylvode/tree/b35d8f2f27a7699c97c3157df1e79543979063ab/frontend) (`b35d8f2`)
- [BrettM86/coves-frontend](https://github.com/BrettM86/coves-frontend/tree/02c35021886dab79fd879dd49e2e7b12f932a1d4) (`02c3502`)
- [chickendude/Kalenj.in](https://github.com/chickendude/Kalenj.in/tree/1356bbc0f1daf3ad96223e9afbc207f3d88decd7) (`1356bbc`)
- [JonasLeonhard/jonasleonhard.de](https://github.com/JonasLeonhard/jonasleonhard.de/tree/6e7d494ae2cbf040a18216220afd23aaa9f48110) (`6e7d494`)
- [dennisklappe/CloudMeet](https://github.com/dennisklappe/CloudMeet/tree/5a9f0e3c8ec29485e8221893c8712be10ec0e122) (`5a9f0e3`)
- [Omaledanjumaogale/SchoolXense](https://github.com/Omaledanjumaogale/SchoolXense/tree/e7cc567cece855894763089759cbf9c5356ab19e) (`e7cc567`)
- [DeVinci-FabLab/SmartLock-Dashboard/web](https://github.com/DeVinci-FabLab/SmartLock-Dashboard/tree/6311a53243853c8cff71b707e032e66397a76d2b/web) (`6311a53`)
- [rbignon/speedfog-racing/web](https://github.com/rbignon/speedfog-racing/tree/16f591d3d2aacb52510a7da099ae0fd71bec468d/web) (`16f591d`)
- [Hexdigest123/merckel.dev](https://github.com/Hexdigest123/merckel.dev/tree/bef9abd44921d338e8ccb1caf779a65fe09ca1f3) (`bef9abd`)
- [frostbase-dev/frostbase](https://github.com/frostbase-dev/frostbase/tree/389a0211faad25742629e5a159787a4f3e0cd0c9) (`389a021`)
- [CiaronHowell/minilib](https://github.com/CiaronHowell/minilib/tree/44280a29780b437ab641e85fd3035d4015427057) (`44280a2`)
- [computerlovetech/umbod/umbod/frontend](https://github.com/computerlovetech/umbod/tree/3513507fbd332a0cf6c8f1de2079801706180a32/umbod/frontend) (`3513507`)
- [MVRU/Conectando-Corazones/app](https://github.com/MVRU/Conectando-Corazones/tree/2452c1272767389a78ecc91cecbbf79c0c02f01a/app) (`2452c12`)
- [bingud/filemat/web](https://github.com/bingud/filemat/tree/29f8b31615ac022046a1c7734c8511f55f89bb8c/web) (`29f8b31`)
- [d347h-eth/artgod/frontend](https://github.com/d347h-eth/artgod/tree/5696b330534b508b30b35d58edb85327bfaf2656/frontend) (`5696b33`)
- [ePetrack/Puds2](https://github.com/ePetrack/Puds2/tree/d0a1994969badea0d6a3208ab681d9b76fea1117) (`d0a1994`)
- [faulander/chapterlane](https://github.com/faulander/chapterlane/tree/ac1f961507420026c3f63427b9b8fec2c90c290b) (`ac1f961`)
- [ezcorp-org/EZHarness/web](https://github.com/ezcorp-org/EZHarness/tree/e3309906d4cac4927290dc5da6473be4619ab889/web) (`e330990`)
- [whadafunk/haps/packages/web](https://github.com/whadafunk/haps/tree/1989de1e4740e1e730968031b8b74c41e2ddd922/packages/web) (`1989de1`)
- [NASA-ACROSS/across-frontend](https://github.com/NASA-ACROSS/across-frontend/tree/8ff597d3569cc0b4ce7c37e13585d1ee19ed8175) (`8ff597d`)
- [spiculedata/saiku/saiku-ui](https://github.com/spiculedata/saiku/tree/1aec85a7dc4709ab6e1458d086dcd96f3d35429c/saiku-ui) (`1aec85a`)
- [komiljonmaksudov/taijobi/taijobi-web](https://github.com/komiljonmaksudov/taijobi/tree/3b77f817eaa31d901ec8fc224db539e47a765ce1/taijobi-web) (`3b77f81`)
- [rodrigohgpontes/buscabase/apps/web](https://github.com/rodrigohgpontes/buscabase/tree/a547fb5c890b937ea46b6e7f7342a215784bbb5e/apps/web) (`a547fb5`)
- [saffronjam/saffron-hive/web](https://github.com/saffronjam/saffron-hive/tree/1dc89389b839d4019c6aa70b2edd915968ddd231/web) (`1dc8938`)
- [nadun96/quizare/frontend](https://github.com/nadun96/quizare/tree/13d294633fffe3e4b52b963d8354ad1cef210147/frontend) (`13d2946`)
- [volturine/data-forge/packages/frontend](https://github.com/volturine/data-forge/tree/ee9ed6119dbd1d269a6eec6a7de7d8643e25b248/packages/frontend) (`ee9ed61`)
- [JaggerITA/relicblade-companion](https://github.com/JaggerITA/relicblade-companion/tree/f9f590c45564bff85fd93936687fcbb99d57429c) (`f9f590c`)
- [Vortextbloons/Hoop-Rush/apps/web](https://github.com/Vortextbloons/Hoop-Rush/tree/9f55ad154efb96fe6df4bf8655a19e089ba9caaf/apps/web) (`9f55ad1`)
- [PaulDepping/ranking-forge/web](https://github.com/PaulDepping/ranking-forge/tree/9836c2447592b5b69e30335f53120dd38482ab13/web) (`9836c24`)
- [fr0gtech/spoty-stalk/apps/web](https://github.com/fr0gtech/spoty-stalk/tree/cb10d97ffd6819736209b2246e309b582ab9665b/apps/web) (`cb10d97`)
- [Kevin2Holt/program](https://github.com/Kevin2Holt/program/tree/3afa74b25200cd686961bb417cda8ac7c51498ae) (`3afa74b`)
- [tracepad/tracepad/ui](https://github.com/tracepad/tracepad/tree/efc7016a839eed6fcbef9b0f0a31e9d1fbe9eb47/ui) (`efc7016`)
- [Herover/shareviz](https://github.com/Herover/shareviz/tree/83ec327f1b6a5c0991fabaf7cf5adc2fcedbd396) (`83ec327`)
- [techguide-jp/corporate/techguide](https://github.com/techguide-jp/corporate/tree/70e8e50e889561f9915115f9cd1d5a927a726ae7/techguide) (`70e8e50`)
- [Ibrahim-SWE/HadesCompanion](https://github.com/Ibrahim-SWE/HadesCompanion/tree/48e18925c9eabe8201db5220eeffbee2ccd98092) (`48e1892`)
- [Patrik-Homelab/Web](https://github.com/Patrik-Homelab/Web/tree/182500dd447127077923c6725ec16abac44efa82) (`182500d`)
- [AI-Almanac/ai-almanac/web](https://github.com/AI-Almanac/ai-almanac/tree/461af13a240140f3cfb5d5aeb5fd1d2282bf2b01/web) (`461af13`)
- [farhanmunim/site-scanner/apps/web](https://github.com/farhanmunim/site-scanner/tree/c26b4e9174dfaf34c26a22118a2febc9719e10a1/apps/web) (`c26b4e9`)
- [dankobg/fluffly/web](https://github.com/dankobg/fluffly/tree/2ddfdd519ba218660ad2583dfa48255a79415278/web) (`2ddfdd5`)
- [beyondsimulations/statistik-interaktiv](https://github.com/beyondsimulations/statistik-interaktiv/tree/32b8239741167339a9088d43a6024794ab1da6ca) (`32b8239`)
- [CrispStrobe/CrispDeck](https://github.com/CrispStrobe/CrispDeck/tree/61001b80bd3c3481680a29228bfeed6133b3e760) (`61001b8`)
- [stamler/tybalt_turbo/ui](https://github.com/stamler/tybalt_turbo/tree/d7f0d21d914a05c8c09563a3c8b40ef28de4a9d9/ui) (`d7f0d21`)
- [formswrite/schoolrise/apps/web](https://github.com/formswrite/schoolrise/tree/8b611c278857887e4c9c3e55e9b0c8a0c9a9ffd1/apps/web) (`8b611c2`)
- [Tessera-Note/tessera/apps/web](https://github.com/Tessera-Note/tessera/tree/9d499711799cc1606ed9d36b2e1e4965168df67f/apps/web) (`9d49971`)
- [Sekai-World/sekai-viewer-reborn/apps/content-site](https://github.com/Sekai-World/sekai-viewer-reborn/tree/6e8f00b82a96925b5a3d75e1b16e0df85b95ac6e/apps/content-site) (`6e8f00b`)
- [jjkroell/ridgeline/web](https://github.com/jjkroell/ridgeline/tree/014151cce542c8ebe8ac44602286f5f02e6aaeb4/web) (`014151c`)
- [gvorwaller/madonnahist](https://github.com/gvorwaller/madonnahist/tree/731a583a367872c65781576fd88a269d288f3a5f) (`731a583`)
- [openclaw/clickclack/apps/web](https://github.com/openclaw/clickclack/tree/e9938a42620d54a8b9b09e5d42bb6354994cfa4d/apps/web) (`e9938a4`)
- [boboshan/wwiser](https://github.com/boboshan/wwiser/tree/eea8e51f7ce30cf58cd3b2eef1c97d20d1cfbd49) (`eea8e51`)
- [Your-Business-Today/jewelbb](https://github.com/Your-Business-Today/jewelbb/tree/a72399c075c1cafa842b9a30ecfbb7d23e31f95a) (`a72399c`)
- [csuzw/gothic-garrison/apps/gothic-garrison](https://github.com/csuzw/gothic-garrison/tree/625b315e5ccdbf979f8c2c4e64a1e4f4f524d4d8/apps/gothic-garrison) (`625b315`)
- [nickheyer/distroface/web/distroface](https://github.com/nickheyer/distroface/tree/d478c4c35b0307c512fdcdefdfa72bf2e312e581/web/distroface) (`d478c4c`)
- [lunzai/arguspam/web](https://github.com/lunzai/arguspam/tree/275631efa9d5bafba6f0301ff915169a21156a1b/web) (`275631e`)
- [hildanku/xemarify/web](https://github.com/hildanku/xemarify/tree/555dec38f71c682b97185fdd4203e7dd24200af0/web) (`555dec3`)
- [szigetidev/racona-core/apps/web](https://github.com/szigetidev/racona-core/tree/099f0cc8ef36b31d7eeefc4631ba3d04c6ab3ab1/apps/web) (`099f0cc`)
- [kclejeune/sparkles/ui](https://github.com/kclejeune/sparkles/tree/985e3e0c334b9760f1080973f01db7d9a473bbe3/ui) (`985e3e0`)
- [monxas/remote-pulse/web](https://github.com/monxas/remote-pulse/tree/63e0de542dead01631e7f3d5b719437426a7a7d4/web) (`63e0de5`)
- [it-bcs-tech/erp-bcs-frontend](https://github.com/it-bcs-tech/erp-bcs-frontend/tree/ae02bc503ba881fab198674153c668ba1fd537da) (`ae02bc5`)
- [sernl/listing-sync/web](https://github.com/sernl/listing-sync/tree/360f10a666a834d4f29745874b73b5a7294c2130/web) (`360f10a`)
- [jerryboganda/radiologyos/apps/web](https://github.com/jerryboganda/radiologyos/tree/8254579b00b188eb85fb65acd426a04c2c2b3507/apps/web) (`8254579`)
- [Finsys/dockhand](https://github.com/Finsys/dockhand/tree/e8c09b1eb66681f6ed676447ba929b4bbfc39f4a) (`e8c09b1`)
- [jesperorb/intl-explorer](https://github.com/jesperorb/intl-explorer/tree/d754e31fa26599dcadc5f0c99fd7baf607bb3534) (`d754e31`)
- [phonesett10401/thailand-dems/web](https://github.com/phonesett10401/thailand-dems/tree/d07d133dd854fbcfcb67765f8712115ffefebf4a/web) (`d07d133`)
- [suchmememanyskill/mesh-organiser](https://github.com/suchmememanyskill/mesh-organiser/tree/08cdd95509ce6e632d8027b24ed65c702778950d) (`08cdd95`)
- [denlukia/plavna/apps/plavna](https://github.com/denlukia/plavna/tree/f6e1a2e9e93e5dce00dd56715685e6afd0b9ff50/apps/plavna) (`f6e1a2e`)
- [Kage0x3B/capgo-update-lite/packages/app](https://github.com/Kage0x3B/capgo-update-lite/tree/d0c0e98de8b8cfc78cb64f3a17ea53cc1c99249b/packages/app) (`d0c0e98`)
- [mbryzek/hackathon](https://github.com/mbryzek/hackathon/tree/ed720d62e4ccc9a24b8cecf9f6116f09feb8342e) (`ed720d6`)
- [cirodam/resolute-society](https://github.com/cirodam/resolute-society/tree/3aca1bb6a7a4679592a3132e789f994e517339f7) (`3aca1bb`)
- [SunReye/SunReye/apps/web](https://github.com/SunReye/SunReye/tree/7324b5589f3a7adc66a1891121fa4309ae25dd6f/apps/web) (`7324b55`)
- [MorganKryze/FabDoYouMeme/frontend](https://github.com/MorganKryze/FabDoYouMeme/tree/497ef06e87d4f442e5c628d2be81677eb90c5526/frontend) (`497ef06`)
- [DavidK276/empi/empi-web](https://github.com/DavidK276/empi/tree/58092c01be53b9b71dcc3e9db7ffd609e330e62b/empi-web) (`58092c0`)
- [StefanBerlin/splitclone](https://github.com/StefanBerlin/splitclone/tree/a4e049c3c0bcc3dd9128b4c9188317df6546d3a5) (`a4e049c`)
- [Vermont-Complex-Systems/vcsi-website](https://github.com/Vermont-Complex-Systems/vcsi-website/tree/5bb1c83c14a9ce20038962f2261601ad7a5f9df9) (`5bb1c83`)
- [Ak-sara/sso](https://github.com/Ak-sara/sso/tree/9b6ff75954172a903c73b86c355d96efc653485c) (`9b6ff75`)
- [raymond-itsec/vulnledger/frontend](https://github.com/raymond-itsec/vulnledger/tree/fa19701ccc908fa550c96bf6dae5053ee832fafe/frontend) (`fa19701`)
- [PalmarHealer/opensax/apps/web](https://github.com/PalmarHealer/opensax/tree/e5c0cb5c5ebd9b7391650bdaaea761329015c5f4/apps/web) (`e5c0cb5`)
- [jcsoftlabs/civora-backend/apps/web](https://github.com/jcsoftlabs/civora-backend/tree/7168e754d5069ea064bac7122c682ecf79e4c1ac/apps/web) (`7168e75`)
- [dj-pearson/apidown/frontend](https://github.com/dj-pearson/apidown/tree/25b02930bb13512bc72bc80c631c5ededc66568b/frontend) (`25b0293`)
- [orbingol/soju-platform/apps/web](https://github.com/orbingol/soju-platform/tree/0a2c8d45d59fd05e5748da198111dc6714421a7e/apps/web) (`0a2c8d4`)
- [f-elix/ironkit](https://github.com/f-elix/ironkit/tree/ad6abfc78e299405f8936030ac36e0d4f59e62b0) (`ad6abfc`)
- [CRCKC/BibleTogether](https://github.com/CRCKC/BibleTogether/tree/126f80e67cc47c44eaf45800f3f722bbd4e7e44c) (`126f80e`)
- [M0okz/cairnops/web](https://github.com/M0okz/cairnops/tree/2604f074eb2de1e1789d85500251f1e3391c23bd/web) (`2604f07`)
- [Forest-Department-of-Belize/wildlife-permit-system](https://github.com/Forest-Department-of-Belize/wildlife-permit-system/tree/3bb4f59068a6ca99826a7120f9a45ca00c28f4c3) (`3bb4f59`)
- [War-Brokers/War-Brokers/apps/stats-site](https://github.com/War-Brokers/War-Brokers/tree/4eb25a0936fbd21d7d67c067bed849af582f5dae/apps/stats-site) (`4eb25a0`)
- [hxri-nxrxyxn/kalharam/web](https://github.com/hxri-nxrxyxn/kalharam/tree/5d6297b6a34fd56af208f5ca5f65c9c65e8429ed/web) (`5d6297b`)
- [JohnnyFFM/sideout/web](https://github.com/JohnnyFFM/sideout/tree/eaa497cb1d2b83b6e939e2c8b5ae5d25aa39f700/web) (`eaa497c`)
- [g2m7/gardensuite-marketing/gs_landing](https://github.com/g2m7/gardensuite-marketing/tree/f0008ae7dbd475d2b004e169f1742eb15daec13e/gs_landing) (`f0008ae`)
- [Pikslots/pikslots/packages/ui](https://github.com/Pikslots/pikslots/tree/b1400d5929cb5a3ab4aab7121c1ee9fbf9052797/packages/ui) (`b1400d5`)
- [tellbow/schwingen](https://github.com/tellbow/schwingen/tree/ebe3f48e64562edce25cea69bd384be3808a98fc) (`ebe3f48`)
- [RafayGhafoor/gjms-frontend](https://github.com/RafayGhafoor/gjms-frontend/tree/fe648f2d26d71045847b92806f594290b45f7f81) (`fe648f2`)
- [chicomcastro/harpa-crista-online](https://github.com/chicomcastro/harpa-crista-online/tree/6f740478dffa65afb85584dc694cefd1fa523a7d) (`6f74047`)
- [AlecDusheck/receiverproxy/web](https://github.com/AlecDusheck/receiverproxy/tree/dab8b41aa7e05e91607eeda1ad4b5d97bc085b48/web) (`dab8b41`)
- [sansseriff/lab-wizard/lab_wizard/wizard/frontend](https://github.com/sansseriff/lab-wizard/tree/c8274a8f8d18be1feb061b64cbafb2daec96ed52/lab_wizard/wizard/frontend) (`c8274a8`)
- [DawoT/kipuspay/apps/pos-web](https://github.com/DawoT/kipuspay/tree/fb9587b8eacb77b259899986553f2720864993ec/apps/pos-web) (`fb9587b`)
- [wowcrise54/iris-web-utmn/v3/frontend](https://github.com/wowcrise54/iris-web-utmn/tree/6cac74aebbb764366ae52356d533810977954de7/v3/frontend) (`6cac74a`)
- [darrelhong/openplays/web](https://github.com/darrelhong/openplays/tree/0592884ff152c507c315dff70b9bc07c59e0e239/web) (`0592884`)
- [bence-boer/clanqr/web](https://github.com/bence-boer/clanqr/tree/e1b978b3a663d18a413b4daa1a3daf5cbf8b6f2a/web) (`e1b978b`)
- [grinlemon/sackli](https://github.com/grinlemon/sackli/tree/9ccc338181da8b0cd611d1024625486a9849e5cd) (`9ccc338`)
- [QaidVoid/awsim/ui](https://github.com/QaidVoid/awsim/tree/eb227bfc04e5db6c997e4a737c6c9dc963341712/ui) (`eb227bf`)
- [BCYCAData/soc-dev](https://github.com/BCYCAData/soc-dev/tree/aaf2de27922bd5bd4740d60b404971e591a3ddec) (`aaf2de2`)
- [andrei0x309/flashsoft-sk](https://github.com/andrei0x309/flashsoft-sk/tree/7d45109e4dd803d118bb29e90fdf70bab5895bbb) (`7d45109`)
- [onassis-salinas/CSTGRP_ERP/apps/app](https://github.com/onassis-salinas/CSTGRP_ERP/tree/68c9d31f519a3cb726fc6e4b5cce53503e6664b2/apps/app) (`68c9d31`)
- [skybridgeskills/orca](https://github.com/skybridgeskills/orca/tree/9082b7c69ccb3cad85ed3ae68eb5cb421ab5c74f) (`9082b7c`)
- [dahisea/GF-HOME-NEXT](https://github.com/dahisea/GF-HOME-NEXT/tree/2fe823ce2a647af739a377d914fca36c69c017a7) (`2fe823c`)
- [bmccorm2/web](https://github.com/bmccorm2/web/tree/2db249325ed5f5e05601dd6f6e3c6e0262496883) (`2db2493`)
- [Vantaneant-International-Ltd/vnta](https://github.com/Vantaneant-International-Ltd/vnta/tree/d796dcb11bf9b88ff2b6685000e6a5f668d7085b) (`d796dcb`)
- [Gamacore/orchestrate](https://github.com/Gamacore/orchestrate/tree/1e5b5ca4649d2b2caa3033c77d3f4d04c3a0c143) (`1e5b5ca`)
- [guycorbaz/kesh/frontend](https://github.com/guycorbaz/kesh/tree/c780f2e37cf7f683449826bfac52e0b8d33afcc7/frontend) (`c780f2e`)
- [athNdev/carbon-panel/web/carbon-panel](https://github.com/athNdev/carbon-panel/tree/beb83bc26934a8bc37508033c5cc8c8c8e114d9b/web/carbon-panel) (`beb83bc`)
- [Ottohesten/fastapi-svelte/frontend](https://github.com/Ottohesten/fastapi-svelte/tree/3b4621e0e062d4141995b84418ee8d07a0db94bc/frontend) (`3b4621e`)
- [addun/cowkoszyku/apps/web](https://github.com/addun/cowkoszyku/tree/039993ac795101201118cb00c18ba9a1ac12ba5f/apps/web) (`039993a`)
- [Danieldotcomcoder/fastpitstop/apps/web](https://github.com/Danieldotcomcoder/fastpitstop/tree/10e18b0e1d5e422f4a06eff9bb5b76808dbced29/apps/web) (`10e18b0`)
- [AlphaTechini/Mithra/apps/web](https://github.com/AlphaTechini/Mithra/tree/56fa3b22852b2e1e44fd1fab8798d794b08a8e3f/apps/web) (`56fa3b2`)
- [manos-zalokostas/R2WX/front](https://github.com/manos-zalokostas/R2WX/tree/a78f3f29b4b9d8c2d9849adcbf5e63a098080c89/front) (`a78f3f2`)
- [CUB-CORR/concepts-browser/app](https://github.com/CUB-CORR/concepts-browser/tree/00a7fa0315fb8f8f430fab7c4a161bfa7646ff6f/app) (`00a7fa0`)
- [Gurparkash-Singh/Taqdeer-Alitura](https://github.com/Gurparkash-Singh/Taqdeer-Alitura/tree/d0b8c495d6ad53fbfb740d1d5cca977a4fdc7afc) (`d0b8c49`)
- [100-tokens/astrophoto/frontend](https://github.com/100-tokens/astrophoto/tree/ed12183c5968710f6914f827c716813b556a30b8/frontend) (`ed12183`)
- [j-adom/Alkebu-Load/alkebu-web](https://github.com/j-adom/Alkebu-Load/tree/bff2586ceb2f266d1c82b5a1e7ff9fc5a36f8265/alkebu-web) (`bff2586`)
- [jsuvic/agent-profile/apps/web](https://github.com/jsuvic/agent-profile/tree/3d7a6c3040bc75bbf21aff2db59f8ea8db7e6f8b/apps/web) (`3d7a6c3`)
- [RasmaPlasma/mill/ui](https://github.com/RasmaPlasma/mill/tree/58f4b0fd03a9cd32e8c15668cc2bfb44bfa52baa/ui) (`58f4b0f`)
- [glowfinger/match-manager](https://github.com/glowfinger/match-manager/tree/0eec47fc44732e08ff8769b2874f9367bd621f68) (`0eec47f`)
- [Xavelite/RestoStaff](https://github.com/Xavelite/RestoStaff/tree/87cb1d74d5546d6e044e585d19d6b53cbbf4f734) (`87cb1d7`)
- [avifenesh/openslot/frontend](https://github.com/avifenesh/openslot/tree/c6006ae481d082fb1f341a8d48a8609171784cd0/frontend) (`c6006ae`)
- [miztiik/yen-idhazh/frontend](https://github.com/miztiik/yen-idhazh/tree/bf4969e6b19b0e62de16d99e42c25c7236e9db2c/frontend) (`bf4969e`)
- [XinShiLab/Foldnano](https://github.com/XinShiLab/Foldnano/tree/7b4c923058e66a269fb97d198e45aa807ddb7eb5) (`7b4c923`)
- [dispbd/NerdDen/SudokuManiac](https://github.com/dispbd/NerdDen/tree/182e5b514322182744bacb0c8933f60812a3058f/SudokuManiac) (`182e5b5`)
- [JameZUK/lyrion-anywhere/web/app](https://github.com/JameZUK/lyrion-anywhere/tree/8800c27576ab8be20ea8e51fc1dced1e0d0e6d28/web/app) (`8800c27`)
- [resu-mx/forge/packages/webui](https://github.com/resu-mx/forge/tree/4ee3914995c3b49e395c42fdd8dbcecfb1241c35/packages/webui) (`4ee3914`)
- [escendit/coldframe/apps/ts/web](https://github.com/escendit/coldframe/tree/ed69105d2dc6f8b789ac7cc4e369310e1e251e7a/apps/ts/web) (`ed69105`)
- [AkiChang0409/MiniERP](https://github.com/AkiChang0409/MiniERP/tree/4540e7d7401b447a33f6c22782353dcd7c9e3b05) (`4540e7d`)
- [Advanced-Digital-Marketing-LTDA/Advanced-Digital-Marketing-LTDA](https://github.com/Advanced-Digital-Marketing-LTDA/Advanced-Digital-Marketing-LTDA/tree/712637ef17edb9014374d0bfafae3139ac0f7588) (`712637e`)
- [tanch-p/tomimi-dev](https://github.com/tanch-p/tomimi-dev/tree/a43af0109406296959fd8499ffca4585e9e60edf) (`a43af01`)
- [Luen/runaround](https://github.com/Luen/runaround/tree/366bca37efa1ab216f1ef2d365cd5074508f12b8) (`366bca3`)
- [nautilus-cyberneering/nautilus-website](https://github.com/nautilus-cyberneering/nautilus-website/tree/a729ace5a642797a301274b781b73c8e8a531a08) (`a729ace`)
- [CUNY-AI-Lab/slide-maker/apps/web](https://github.com/CUNY-AI-Lab/slide-maker/tree/282d7180497b3cdd54464ccb248390e03e892df4/apps/web) (`282d718`)
- [mwmbl/front-end](https://github.com/mwmbl/front-end/tree/acf5dc395f67fe95a1e6574ccea08e914befbab5) (`acf5dc3`)
- [dmwin72015/netdisk/frontend](https://github.com/dmwin72015/netdisk/tree/0b7f47f07fbf19485e8f2ebff2fd60d342681511/frontend) (`0b7f47f`)
- [agazso/feeds/packages/app](https://github.com/agazso/feeds/tree/5327fcd5a709191a91c8419319c7b2eaa25e034a/packages/app) (`5327fcd`)
- [oddessentials/skylark/web](https://github.com/oddessentials/skylark/tree/b52a44260727953ca457b219bbf5c5191c117e67/web) (`b52a442`)
- [Charge-Research-Platform-Volt/Kennisbank/frontend](https://github.com/Charge-Research-Platform-Volt/Kennisbank/tree/ea6fa3edd882792f081f919e09011b1ddfa1fb54/frontend) (`ea6fa3e`)
- [lilith/weaver/apps/play](https://github.com/lilith/weaver/tree/2c234067a5fdbff67cb7c0bf779e65a2ddfc903a/apps/play) (`2c23406`)
- [AntiTcb/ygo.tools](https://github.com/AntiTcb/ygo.tools/tree/4836527a9a3dcf0ce3653e226350806c91d83530) (`4836527`)
- [TZGyn/shortener/frontend](https://github.com/TZGyn/shortener/tree/60347ef6e5fd19ceede8476dd19eb8ee17ca57a9/frontend) (`60347ef`)
- [Volkoy/locatra-ex](https://github.com/Volkoy/locatra-ex/tree/89aae4ac01ff966c076770ed22bdbbf8c36fa47a) (`89aae4a`)
- [polotto/polotto.dev](https://github.com/polotto/polotto.dev/tree/5a213e69e01ab02a30df3b89e140736794979ed0) (`5a213e6`)
- [thiagotn/football-manager/football-frontend](https://github.com/thiagotn/football-manager/tree/e961a6ee19ff507243b4d57f9302c970fde1e5b5/football-frontend) (`e961a6e`)
- [MedPACTech/TurnKeyOps/client](https://github.com/MedPACTech/TurnKeyOps/tree/2c0ca3cc49bf4f1480ac0155e8587bfa2454fbbd/client) (`2c0ca3c`)
- [lgriffin/toads/apps/web](https://github.com/lgriffin/toads/tree/ec197f5c6aa64742528c6a41ab10e0ac6b4350c1/apps/web) (`ec197f5`)
- [DanR978/IglesiaRestauracion/web](https://github.com/DanR978/IglesiaRestauracion/tree/1ecf3a9889b16c4b36e63b5db0005aae75c2a2c6/web) (`1ecf3a9`)
- [scottdkey/bardbase/projects/web](https://github.com/scottdkey/bardbase/tree/48669f6c2a4cd19b53a316f27ec0a46d6cbd27d9/projects/web) (`48669f6`)
- [parent-tobias/shared-gigwidget/apps/web](https://github.com/parent-tobias/shared-gigwidget/tree/bfac10a3c3415bb78b81323651431851d2d30b69/apps/web) (`bfac10a`)
- [Kyroinfra/Kyro/packages/web](https://github.com/Kyroinfra/Kyro/tree/bdc7632ac47da55e738fd6852b279838209d3260/packages/web) (`bdc7632`)
- [Moh-mmed/kidooz/apps/web](https://github.com/Moh-mmed/kidooz/tree/d0f24ebc0fd66c6b17ed55cce21828095f08ba1d/apps/web) (`d0f24eb`)
- [keplersystems/kepler-chat](https://github.com/keplersystems/kepler-chat/tree/d45e47960bec15d3886d35eb6b7d97bb0edabca5) (`d45e479`)
- [SecureCloudGroup/SmartBrain_3000/web](https://github.com/SecureCloudGroup/SmartBrain_3000/tree/8d753fdf1e9dd86f4d80fc4916a9234526c42f88/web) (`8d753fd`)
- [trakt/trakt-web/projects/client](https://github.com/trakt/trakt-web/tree/4242837b6b9ca372ddddbc528c0e6b521e79b6ec/projects/client) (`4242837`)
- [owodunni/curarehab/packages/web](https://github.com/owodunni/curarehab/tree/0e410321bbd99d7751f3a69ce3bb48647aebe3ae/packages/web) (`0e41032`)
- [brodbeckleon/matthias-brodbeck](https://github.com/brodbeckleon/matthias-brodbeck/tree/0044f88d80cc2458a472832b02e433a2d2e56d82) (`0044f88`)
- [ESchouten/ai-detector/web](https://github.com/ESchouten/ai-detector/tree/5a56ed06cfd3b9b26219a404c340c4b1bc49ba31/web) (`5a56ed0`)
- [Flexksx/ai-marketing-platform/apps/web](https://github.com/Flexksx/ai-marketing-platform/tree/27d180efe45c8e7b019a2ccab0215f89b2fadac2/apps/web) (`27d180e`)
- [maltzsama/baleia/web](https://github.com/maltzsama/baleia/tree/b765fa4786ed27ddda54429814eafa9d184f6fd4/web) (`b765fa4`)
- [the-astrosky-ecosystem/website](https://github.com/the-astrosky-ecosystem/website/tree/3ef773f4590f80f0219b5732a670281e38673cff) (`3ef773f`)
- [nathanfaucett/rs-of/apps/app](https://github.com/nathanfaucett/rs-of/tree/9cfad4be26ffaf3dd8f749a97dc5feededd7012c/apps/app) (`9cfad4b`)
- [vaionex/telomere.ai/apps/web](https://github.com/vaionex/telomere.ai/tree/24df3ba9b908e71ccc0b9f5c99665d19f0b26fa2/apps/web) (`24df3ba`)
- [thoutmose/axon/web](https://github.com/thoutmose/axon/tree/890413101f4b078ba1d6147084cbc202b15f4914/web) (`8904131`)
- [gr8monk3ys/finance-owl/packages/frontend](https://github.com/gr8monk3ys/finance-owl/tree/7df2911db61df33021a4b0b760706718803a7439/packages/frontend) (`7df2911`)
- [b4its/kepin-official/frontend](https://github.com/b4its/kepin-official/tree/8c3be5a99252781f5c9a42384f5a0a9a5e7d6da8/frontend) (`8c3be5a`)
- [schmolldechse/archive/frontend](https://github.com/schmolldechse/archive/tree/fd63cc4c95c33c28c722c905ae5208f97b58c661/frontend) (`fd63cc4`)
- [lilBunnyRabbit/series-tracker](https://github.com/lilBunnyRabbit/series-tracker/tree/abc4adec0e707c55b12c4fe4c7fca78addc20463) (`abc4ade`)
- [ajith4Tech/rforum/frontend](https://github.com/ajith4Tech/rforum/tree/903c553f485f9e00504fd04d05355d936dcee358/frontend) (`903c553`)
- [ubeann/vmb/apps/web](https://github.com/ubeann/vmb/tree/e18a3abbcaba5ecfd3ba505e709a82d759ce8c2c/apps/web) (`e18a3ab`)
- [westborn/SB-Reg-svelte5](https://github.com/westborn/SB-Reg-svelte5/tree/bd39957fefed932756d44ac98badca8c2d8f0b4b) (`bd39957`)
- [Gooowan/matchup/services/frontend](https://github.com/Gooowan/matchup/tree/7426d52cf4dd5040e2b21edf3774f67879e5dcba/services/frontend) (`7426d52`)
- [Isaza-Labs/flow-weaver/frontend](https://github.com/Isaza-Labs/flow-weaver/tree/0e8448928f3f8389528989a986b7b6a93582c567/frontend) (`0e84489`)
- [Heracraft/repose/apps/web](https://github.com/Heracraft/repose/tree/83eb7d16609007fbe9f5493c0ae87a6e7e9cfcd4/apps/web) (`83eb7d1`)
- [reubenmiller/lab-ztp-provisioner/web](https://github.com/reubenmiller/lab-ztp-provisioner/tree/a7f13f95404b9e98e4936a2b59bb60069cd66f4c/web) (`a7f13f9`)
- [jhoelzl/swing-dance-moves/frontend](https://github.com/jhoelzl/swing-dance-moves/tree/a7bc08068264e8820b351d3d8b6998a4c28e7727/frontend) (`a7bc080`)
- [ABGEO/maroid/apps/deck](https://github.com/ABGEO/maroid/tree/60e9336d38bac7096bee64de6c97e81e6df5a04c/apps/deck) (`60e9336`)
- [diniztheus/controle-financeiro](https://github.com/diniztheus/controle-financeiro/tree/231d56d9a8c57772673f609f607fb2b8b58bc0a3) (`231d56d`)
- [DriscollDev/Widgetry/apps/web](https://github.com/DriscollDev/Widgetry/tree/a0a719345aa8ad94cef22689e88f6bfae872e471/apps/web) (`a0a7193`)
- [JaakkoLipp/concord/apps/web](https://github.com/JaakkoLipp/concord/tree/24fb446c6795f0e737cefbca80640d8c02e7518a/apps/web) (`24fb446`)
- [ajianaz/gofin-full/web](https://github.com/ajianaz/gofin-full/tree/ea7b2bbd2730e73e7e14fb33c5ea0b421961f21b/web) (`ea7b2bb`)
- [evanxdsouza/mangrove/web](https://github.com/evanxdsouza/mangrove/tree/bef04a7e1e749a46839ae04160762611d9a863ac/web) (`bef04a7`)

218657 of 218682 corpus findings have a verdict.

| Rule                                                                                                                  | Corpus findings | Apps | Reviewed (tp / fp / design / unclear) | Precision          | Design share     |
| --------------------------------------------------------------------------------------------------------------------- | --------------- | ---- | ------------------------------------- | ------------------ | ---------------- |
| [`a11y/abbr-title`](../../docs/src/content/docs/rules/a11y/abbr-title.md)                                             | 2               | 2    | 0 / 0 / 2 / 0                         | —                  | 100% (2/2)       |
| [`a11y/accessible-name`](../../docs/src/content/docs/rules/a11y/accessible-name.md)                                   | 418             | 82   | 368 / 0 / 50 / 0                      | 100% (368/368)     | 12% (50/418)     |
| [`a11y/aria-hidden-focus`](../../docs/src/content/docs/rules/a11y/aria-hidden-focus.md)                               | 134             | 31   | 93 / 0 / 41 / 0                       | 100% (93/93)       | 31% (41/134)     |
| [`a11y/deprecated-aria`](../../docs/src/content/docs/rules/a11y/deprecated-aria.md)                                   | 66              | 45   | 66 / 0 / 0 / 0                        | 100% (66/66)       | 0% (0/66)        |
| [`a11y/deprecated-attr`](../../docs/src/content/docs/rules/a11y/deprecated-attr.md)                                   | 151             | 63   | 150 / 0 / 1 / 0                       | 100% (150/150)     | 1% (1/151)       |
| [`a11y/deprecated-element`](../../docs/src/content/docs/rules/a11y/deprecated-element.md)                             | 33              | 6    | 33 / 0 / 0 / 0                        | 100% (33/33)       | 0% (0/33)        |
| [`a11y/disallowed-aria-props`](../../docs/src/content/docs/rules/a11y/disallowed-aria-props.md)                       | 1896            | 286  | 1841 / 2 / 53 / 0                     | 100% (1841/1843)   | 3% (53/1896)     |
| [`a11y/disallowed-element`](../../docs/src/content/docs/rules/a11y/disallowed-element.md)                             | 0               | 0    | —                                     | —                  | —                |
| [`a11y/doctype`](../../docs/src/content/docs/rules/a11y/doctype.md)                                                   | 0               | 0    | —                                     | —                  | —                |
| [`a11y/duplicate-landmark`](../../docs/src/content/docs/rules/a11y/duplicate-landmark.md)                             | 710             | 163  | 673 / 6 / 31 / 0                      | 99% (673/679)      | 4% (31/710)      |
| [`a11y/id-duplication`](../../docs/src/content/docs/rules/a11y/id-duplication.md)                                     | 1240            | 155  | 335 / 27 / 878 / 0                    | 93% (335/362)      | 71% (878/1240)   |
| [`a11y/interactive-nesting`](../../docs/src/content/docs/rules/a11y/interactive-nesting.md)                           | 1200            | 193  | 1159 / 4 / 37 / 0                     | 100% (1159/1163)   | 3% (37/1200)     |
| [`a11y/invalid-aria-value`](../../docs/src/content/docs/rules/a11y/invalid-aria-value.md)                             | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)         | 0% (0/1)         |
| [`a11y/invalid-role`](../../docs/src/content/docs/rules/a11y/invalid-role.md)                                         | 0               | 0    | —                                     | —                  | —                |
| [`a11y/label-has-control`](../../docs/src/content/docs/rules/a11y/label-has-control.md)                               | 1751            | 63   | 1751 / 0 / 0 / 0                      | 100% (1751/1751)   | 0% (0/1751)      |
| [`a11y/no-accesskey`](../../docs/src/content/docs/rules/a11y/no-accesskey.md)                                         | 0               | 0    | —                                     | —                  | —                |
| [`a11y/no-autofocus`](../../docs/src/content/docs/rules/a11y/no-autofocus.md)                                         | 222             | 89   | 28 / 0 / 194 / 0                      | 100% (28/28)       | 87% (194/222)    |
| [`a11y/no-duplicate-dt`](../../docs/src/content/docs/rules/a11y/no-duplicate-dt.md)                                   | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)         | 0% (0/1)         |
| [`a11y/no-missing-id-ref`](../../docs/src/content/docs/rules/a11y/no-missing-id-ref.md)                               | 28              | 9    | 28 / 0 / 0 / 0                        | 100% (28/28)       | 0% (0/28)        |
| [`a11y/pattern-title`](../../docs/src/content/docs/rules/a11y/pattern-title.md)                                       | 102             | 56   | 88 / 0 / 14 / 0                       | 100% (88/88)       | 14% (14/102)     |
| [`a11y/permitted-contents`](../../docs/src/content/docs/rules/a11y/permitted-contents.md)                             | 8240            | 439  | 8234 / 6 / 0 / 0                      | 100% (8234/8240)   | 0% (0/8240)      |
| [`a11y/placeholder-label-option`](../../docs/src/content/docs/rules/a11y/placeholder-label-option.md)                 | 150             | 38   | 58 / 0 / 92 / 0                       | 100% (58/58)       | 61% (92/150)     |
| [`a11y/positive-tabindex`](../../docs/src/content/docs/rules/a11y/positive-tabindex.md)                               | 6               | 2    | 6 / 0 / 0 / 0                         | 100% (6/6)         | 0% (0/6)         |
| [`a11y/require-datetime`](../../docs/src/content/docs/rules/a11y/require-datetime.md)                                 | 21              | 2    | 21 / 0 / 0 / 0                        | 100% (21/21)       | 0% (0/21)        |
| [`a11y/required-aria-props`](../../docs/src/content/docs/rules/a11y/required-aria-props.md)                           | 4               | 4    | 4 / 0 / 0 / 0                         | 100% (4/4)         | 0% (0/4)         |
| [`a11y/required-element`](../../docs/src/content/docs/rules/a11y/required-element.md)                                 | 0               | 0    | —                                     | —                  | —                |
| [`a11y/top-level-landmark`](../../docs/src/content/docs/rules/a11y/top-level-landmark.md)                             | 1004            | 177  | 983 / 13 / 8 / 0                      | 99% (983/996)      | 1% (8/1004)      |
| [`a11y/unknown-aria-attribute`](../../docs/src/content/docs/rules/a11y/unknown-aria-attribute.md)                     | 0               | 0    | —                                     | —                  | —                |
| [`a11y/unverified-id-ref`](../../docs/src/content/docs/rules/a11y/unverified-id-ref.md)                               | 0               | 0    | —                                     | —                  | —                |
| [`a11y/use-list`](../../docs/src/content/docs/rules/a11y/use-list.md)                                                 | 77              | 14   | 71 / 0 / 6 / 0                        | 100% (71/71)       | 8% (6/77)        |
| [`architecture/component-size`](../../docs/src/content/docs/rules/architecture/component-size.md)                     | 20630           | 543  | 20630 / 0 / 0 / 0                     | 100% (20630/20630) | 0% (0/20630)     |
| [`architecture/directory-naming`](../../docs/src/content/docs/rules/architecture/directory-naming.md)                 | 0               | 0    | —                                     | —                  | —                |
| [`architecture/doc-link-target`](../../docs/src/content/docs/rules/architecture/doc-link-target.md)                   | 0               | 0    | —                                     | —                  | —                |
| [`architecture/private-scope-import`](../../docs/src/content/docs/rules/architecture/private-scope-import.md)         | 0               | 0    | —                                     | —                  | —                |
| [`architecture/prop-count`](../../docs/src/content/docs/rules/architecture/prop-count.md)                             | 8146            | 504  | 8146 / 0 / 0 / 0                      | 100% (8146/8146)   | 0% (0/8146)      |
| [`architecture/reserved-directory-names`](../../docs/src/content/docs/rules/architecture/reserved-directory-names.md) | 0               | 0    | —                                     | —                  | —                |
| [`architecture/reserved-name-placement`](../../docs/src/content/docs/rules/architecture/reserved-name-placement.md)   | 0               | 0    | —                                     | —                  | —                |
| [`architecture/route-component-import`](../../docs/src/content/docs/rules/architecture/route-component-import.md)     | 103             | 38   | 4 / 0 / 99 / 0                        | 100% (4/4)         | 96% (99/103)     |
| [`architecture/unit-entry-file`](../../docs/src/content/docs/rules/architecture/unit-entry-file.md)                   | 0               | 0    | —                                     | —                  | —                |
| [`correctness/autoplay-muted`](../../docs/src/content/docs/rules/correctness/autoplay-muted.md)                       | 25              | 19   | 14 / 0 / 11 / 0                       | 100% (14/14)       | 44% (11/25)      |
| [`correctness/base-path-navigation`](../../docs/src/content/docs/rules/correctness/base-path-navigation.md)           | 212             | 30   | 72 / 0 / 140 / 0                      | 100% (72/72)       | 66% (140/212)    |
| [`correctness/checkable-bind-value`](../../docs/src/content/docs/rules/correctness/checkable-bind-value.md)           | 0               | 0    | —                                     | —                  | —                |
| [`correctness/each-index-key`](../../docs/src/content/docs/rules/correctness/each-index-key.md)                       | 4136            | 355  | 1897 / 0 / 2239 / 0                   | 100% (1897/1897)   | 54% (2239/4136)  |
| [`correctness/each-key`](../../docs/src/content/docs/rules/correctness/each-key.md)                                   | 19249           | 367  | 13119 / 1 / 6128 / 1                  | 100% (13119/13120) | 32% (6128/19249) |
| [`correctness/effect-as-derived`](../../docs/src/content/docs/rules/correctness/effect-as-derived.md)                 | 987             | 258  | 829 / 0 / 158 / 0                     | 100% (829/829)     | 16% (158/987)    |
| [`correctness/effect-as-onmount`](../../docs/src/content/docs/rules/correctness/effect-as-onmount.md)                 | 236             | 114  | 163 / 2 / 71 / 0                      | 99% (163/165)      | 30% (71/236)     |
| [`correctness/instance-browser-global`](../../docs/src/content/docs/rules/correctness/instance-browser-global.md)     | 62              | 34   | 4 / 0 / 58 / 0                        | 100% (4/4)         | 94% (58/62)      |
| [`correctness/nonreactive-builtin-state`](../../docs/src/content/docs/rules/correctness/nonreactive-builtin-state.md) | 44              | 30   | 32 / 0 / 12 / 0                       | 100% (32/32)       | 27% (12/44)      |
| [`correctness/orphan-effect`](../../docs/src/content/docs/rules/correctness/orphan-effect.md)                         | 0               | 0    | —                                     | —                  | —                |
| [`correctness/orphan-lifecycle`](../../docs/src/content/docs/rules/correctness/orphan-lifecycle.md)                   | 0               | 0    | —                                     | —                  | —                |
| [`correctness/prop-mutation`](../../docs/src/content/docs/rules/correctness/prop-mutation.md)                         | 1092            | 151  | 526 / 3 / 563 / 0                     | 99% (526/529)      | 52% (563/1092)   |
| [`correctness/server-browser-global`](../../docs/src/content/docs/rules/correctness/server-browser-global.md)         | 14              | 6    | 0 / 0 / 14 / 0                        | —                  | 100% (14/14)     |
| [`correctness/stale-prop-derivation`](../../docs/src/content/docs/rules/correctness/stale-prop-derivation.md)         | 310             | 107  | 72 / 0 / 238 / 0                      | 100% (72/72)       | 77% (238/310)    |
| [`correctness/unmutated-state`](../../docs/src/content/docs/rules/correctness/unmutated-state.md)                     | 630             | 186  | 628 / 2 / 0 / 0                       | 100% (628/630)     | 0% (0/630)       |
| [`performance/font-preload-crossorigin`](../../docs/src/content/docs/rules/performance/font-preload-crossorigin.md)   | 0               | 0    | —                                     | —                  | —                |
| [`performance/heavy-import`](../../docs/src/content/docs/rules/performance/heavy-import.md)                           | 112             | 9    | 112 / 0 / 0 / 0                       | 100% (112/112)     | 0% (0/112)       |
| [`performance/iframe-loading`](../../docs/src/content/docs/rules/performance/iframe-loading.md)                       | 356             | 166  | 82 / 0 / 269 / 5                      | 100% (82/82)       | 76% (269/356)    |
| [`performance/image-dimensions`](../../docs/src/content/docs/rules/performance/image-dimensions.md)                   | 3330            | 348  | 1012 / 2 / 2316 / 0                   | 100% (1012/1014)   | 70% (2316/3330)  |
| [`performance/image-loading-hint`](../../docs/src/content/docs/rules/performance/image-loading-hint.md)               | 3066            | 365  | 1132 / 2 / 1932 / 0                   | 100% (1132/1134)   | 63% (1932/3066)  |
| [`performance/lcp-image`](../../docs/src/content/docs/rules/performance/lcp-image.md)                                 | 251             | 93   | 102 / 6 / 143 / 0                     | 94% (102/108)      | 57% (143/251)    |
| [`performance/load-waterfall`](../../docs/src/content/docs/rules/performance/load-waterfall.md)                       | 310             | 52   | 150 / 0 / 160 / 0                     | 100% (150/150)     | 52% (160/310)    |
| [`performance/minify-disabled`](../../docs/src/content/docs/rules/performance/minify-disabled.md)                     | 0               | 0    | —                                     | —                  | —                |
| [`performance/namespace-import`](../../docs/src/content/docs/rules/performance/namespace-import.md)                   | 21              | 12   | 9 / 0 / 12 / 0                        | 100% (9/9)         | 57% (12/21)      |
| [`performance/preconnect`](../../docs/src/content/docs/rules/performance/preconnect.md)                               | 3               | 3    | 3 / 0 / 0 / 0                         | 100% (3/3)         | 0% (0/3)         |
| [`performance/preload-missing-as`](../../docs/src/content/docs/rules/performance/preload-missing-as.md)               | 0               | 0    | —                                     | —                  | —                |
| [`performance/render-blocking-script`](../../docs/src/content/docs/rules/performance/render-blocking-script.md)       | 7               | 5    | 7 / 0 / 0 / 0                         | 100% (7/7)         | 0% (0/7)         |
| [`performance/responsive-image`](../../docs/src/content/docs/rules/performance/responsive-image.md)                   | 3321            | 356  | 2792 / 5 / 524 / 0                    | 100% (2792/2797)   | 16% (524/3321)   |
| [`performance/sequential-awaits`](../../docs/src/content/docs/rules/performance/sequential-awaits.md)                 | 3148            | 260  | 1731 / 4 / 1411 / 2                   | 100% (1731/1735)   | 45% (1411/3148)  |
| [`performance/state-raw`](../../docs/src/content/docs/rules/performance/state-raw.md)                                 | 1101            | 255  | 1101 / 0 / 0 / 0                      | 100% (1101/1101)   | 0% (0/1101)      |
| [`security/handler-state-write`](../../docs/src/content/docs/rules/security/handler-state-write.md)                   | 27              | 10   | 18 / 0 / 9 / 0                        | 100% (18/18)       | 33% (9/27)       |
| [`security/javascript-url`](../../docs/src/content/docs/rules/security/javascript-url.md)                             | 45              | 3    | 45 / 0 / 0 / 0                        | 100% (45/45)       | 0% (0/45)        |
| [`security/raw-html`](../../docs/src/content/docs/rules/security/raw-html.md)                                         | 4082            | 391  | 425 / 0 / 3657 / 0                    | 100% (425/425)     | 90% (3657/4082)  |
| [`security/server-module-state`](../../docs/src/content/docs/rules/security/server-module-state.md)                   | 212             | 65   | 4 / 2 / 206 / 0                       | 67% (4/6)          | 97% (206/212)    |
| [`security/shared-state-import`](../../docs/src/content/docs/rules/security/shared-state-import.md)                   | 64              | 12   | 49 / 0 / 15 / 0                       | 100% (49/49)       | 23% (15/64)      |
| [`seo/canonical-url`](../../docs/src/content/docs/rules/seo/canonical-url.md)                                         | 14305           | 455  | 4735 / 83 / 9487 / 0                  | 98% (4735/4818)    | 66% (9487/14305) |
| [`seo/charset`](../../docs/src/content/docs/rules/seo/charset.md)                                                     | 0               | 0    | —                                     | —                  | —                |
| [`seo/description-length`](../../docs/src/content/docs/rules/seo/description-length.md)                               | 570             | 149  | 513 / 0 / 57 / 0                      | 100% (513/513)     | 10% (57/570)     |
| [`seo/description-presence`](../../docs/src/content/docs/rules/seo/description-presence.md)                           | 11204           | 375  | 1176 / 91 / 9937 / 0                  | 93% (1176/1267)    | 89% (9937/11204) |
| [`seo/duplicate-description`](../../docs/src/content/docs/rules/seo/duplicate-description.md)                         | 162             | 86   | 109 / 0 / 53 / 0                      | 100% (109/109)     | 33% (53/162)     |
| [`seo/duplicate-title`](../../docs/src/content/docs/rules/seo/duplicate-title.md)                                     | 364             | 172  | 61 / 3 / 300 / 0                      | 95% (61/64)        | 82% (300/364)    |
| [`seo/heading-level-skip`](../../docs/src/content/docs/rules/seo/heading-level-skip.md)                               | 1499            | 274  | 1453 / 40 / 6 / 0                     | 97% (1453/1493)    | 0% (6/1499)      |
| [`seo/hreflang`](../../docs/src/content/docs/rules/seo/hreflang.md)                                                   | 0               | 0    | —                                     | —                  | —                |
| [`seo/html-lang`](../../docs/src/content/docs/rules/seo/html-lang.md)                                                 | 5               | 5    | 4 / 0 / 1 / 0                         | 100% (4/4)         | 20% (1/5)        |
| [`seo/image-alt`](../../docs/src/content/docs/rules/seo/image-alt.md)                                                 | 26              | 6    | 26 / 0 / 0 / 0                        | 100% (26/26)       | 0% (0/26)        |
| [`seo/indexability`](../../docs/src/content/docs/rules/seo/indexability.md)                                           | 1482            | 123  | 1478 / 4 / 0 / 0                      | 100% (1478/1482)   | 0% (0/1482)      |
| [`seo/json-ld`](../../docs/src/content/docs/rules/seo/json-ld.md)                                                     | 16395           | 502  | 16318 / 58 / 19 / 0                   | 100% (16318/16376) | 0% (19/16395)    |
| [`seo/json-ld-date-format`](../../docs/src/content/docs/rules/seo/json-ld-date-format.md)                             | 0               | 0    | —                                     | —                  | —                |
| [`seo/json-ld-deprecated-type`](../../docs/src/content/docs/rules/seo/json-ld-deprecated-type.md)                     | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)         | 0% (0/1)         |
| [`seo/json-ld-placeholder`](../../docs/src/content/docs/rules/seo/json-ld-placeholder.md)                             | 0               | 0    | —                                     | —                  | —                |
| [`seo/json-ld-relative-url`](../../docs/src/content/docs/rules/seo/json-ld-relative-url.md)                           | 1               | 1    | 1 / 0 / 0 / 0                         | 100% (1/1)         | 0% (0/1)         |
| [`seo/json-ld-required-props`](../../docs/src/content/docs/rules/seo/json-ld-required-props.md)                       | 0               | 0    | —                                     | —                  | —                |
| [`seo/json-ld-validity`](../../docs/src/content/docs/rules/seo/json-ld-validity.md)                                   | 45              | 11   | 45 / 0 / 0 / 0                        | 100% (45/45)       | 0% (0/45)        |
| [`seo/og-description`](../../docs/src/content/docs/rules/seo/og-description.md)                                       | 13652           | 421  | 13558 / 94 / 0 / 0                    | 99% (13558/13652)  | 0% (0/13652)     |
| [`seo/og-image`](../../docs/src/content/docs/rules/seo/og-image.md)                                                   | 13783           | 429  | 13719 / 64 / 0 / 0                    | 100% (13719/13783) | 0% (0/13783)     |
| [`seo/og-title`](../../docs/src/content/docs/rules/seo/og-title.md)                                                   | 13486           | 420  | 13393 / 93 / 0 / 0                    | 99% (13393/13486)  | 0% (0/13486)     |
| [`seo/og-url`](../../docs/src/content/docs/rules/seo/og-url.md)                                                       | 13968           | 428  | 13912 / 54 / 2 / 0                    | 100% (13912/13966) | 0% (2/13968)     |
| [`seo/robots-txt`](../../docs/src/content/docs/rules/seo/robots-txt.md)                                               | 218             | 218  | 86 / 2 / 130 / 0                      | 98% (86/88)        | 60% (130/218)    |
| [`seo/single-h1`](../../docs/src/content/docs/rules/seo/single-h1.md)                                                 | 3911            | 441  | 3545 / 119 / 216 / 6                  | 97% (3545/3664)    | 6% (216/3886)    |
| [`seo/sitemap-in-robots`](../../docs/src/content/docs/rules/seo/sitemap-in-robots.md)                                 | 16              | 16   | 15 / 0 / 1 / 0                        | 100% (15/15)       | 6% (1/16)        |
| [`seo/sitemap-xml`](../../docs/src/content/docs/rules/seo/sitemap-xml.md)                                             | 391             | 391  | 140 / 2 / 249 / 0                     | 99% (140/142)      | 64% (249/391)    |
| [`seo/ssr-disabled`](../../docs/src/content/docs/rules/seo/ssr-disabled.md)                                           | 748             | 191  | 146 / 0 / 602 / 0                     | 100% (146/146)     | 80% (602/748)    |
| [`seo/title-length`](../../docs/src/content/docs/rules/seo/title-length.md)                                           | 3260            | 355  | 2097 / 7 / 1156 / 0                   | 100% (2097/2104)   | 35% (1156/3260)  |
| [`seo/title-presence`](../../docs/src/content/docs/rules/seo/title-presence.md)                                       | 2537            | 183  | 2418 / 40 / 79 / 0                    | 98% (2418/2458)    | 3% (79/2537)     |
| [`seo/twitter-card`](../../docs/src/content/docs/rules/seo/twitter-card.md)                                           | 13864           | 426  | 13781 / 83 / 0 / 0                    | 99% (13781/13864)  | 0% (0/13864)     |
| [`seo/viewport`](../../docs/src/content/docs/rules/seo/viewport.md)                                                   | 0               | 0    | —                                     | —                  | —                |

<!-- rule-reliability:end -->
