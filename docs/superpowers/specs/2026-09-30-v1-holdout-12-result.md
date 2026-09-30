# v1 holdout 12 — result (2026-09-30)

Measured with `main` at f871df04 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-30-v1-holdout-12-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: all 14 installed. Raw first look:
`scripts/corpus/holdout-12-2026-09-30.json`; verdicts: `scripts/corpus/holdout-12-2026-09-30-verdicts.json`
(6,961 distinct keys from 14 apps, every one labelled by checks over the source at the pinned commit).

**Result: not ready.** Three of ten criteria fail: C6, C7 and C8. C3 passes with no false critical
finding (65 tp, 2 design), and C4 (98.7%) and C5 (99.0%) pass. C8 misses its threshold by a tenth of a
point. In build mode, the plugin's gate stopped one app's build on 63 false critical findings (see C2).

| #   | Criterion                          | Threshold      | Measured                                       | Result | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 9 of which built | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass   | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 98.7% (2,439 / 2,470)                          | pass   | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.0% (3,173 / 3,205)                          | pass   | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 2 classes (below)                              | fail   | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 3 rules below                                  | fail   | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 30.1% (1,093 / 3,628)                          | fail   | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass   | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 5,677, fp 63, design 1,221, unclear 0.

C7's rules: `performance/load-waterfall` 48.0% (12 / 25), `seo/single-h1` 72.7% (56 / 77) and
`seo/description-presence` 89.5% (17 / 19, 390 findings).

## Critical findings (C3)

67 `title-presence`, the only critical findings: 65 tp (portal-desktop 45, ueberblick 13, silroad 4,
obot 2, anartia 1) and 2 design (unlinked developer pages: ueberblick's `admin/demo/mobile-select` and
obot's `/styles`). Every key was decided on its route's full render chain, including `document.title`
writes and the npm components the chain renders.

## False-positive classes

| Class                                                                                                      | Findings | Apps | Rules                                                        |
| ---------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------------------------------------ |
| **A page option set from `dev` (`csr = dev`, `ssr = dev`) read as on in production**                       | 18       | 2    | **load-waterfall**, server-module-state, shared-state-import |
| **Two `<h1>`s behind complementary guards in separate blocks (`X` / `!X`) counted together**               | 18       | 2    | **single-h1**                                                |
| A load that always redirects behind an imported `as const` flag set to `false` not read as never rendering | 18       | 1    | 10 route-level SEO and performance rules                     |
| A layout that renders its children in two `{#if}` arms: the page is not placed in those arms               | 4        | 1    | single-h1, id-duplication                                    |
| A quoted `src="{logo}"` misses the `.svg`-import exemption the unquoted form gets                          | 2        | 1    | responsive-image                                             |
| Two awaits in mutually exclusive ternaries read as sequential                                              | 1        | 1    | sequential-awaits                                            |
| `.delete(id)` on a service object read as mutating a prop                                                  | 1        | 1    | prop-mutation                                                |
| A `$state` handed to a library inside an object literal (`{ iframeProps: { ref } }`) not read as escaping  | 1        | 1    | unmutated-state                                              |

C6's two classes are the `dev`-derived page option (anartia's root `csr = dev`, obot's root `ssr = dev`)
and the complementary guards (obot's `Layout` title snippet, ampoteket's admin status heading). The
flag class recurs from the tuning corpus (communisaas), as does the two-arm children class (an existing
`my/profile` entry).

## C2 in detail

GitHub Actions run 36663896206 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Nine builds completed (skyreader, portal, silroad, ampoteket,
ueberblick, anartia, epj, portal-desktop and laf); none prerenders a page. obot stopped at the plugin's
own critical gate: its root `+layout.ts` sets `prerender = 'auto'` and `ssr = dev`, so a production
build prerenders 63 routes as the empty app shell, and the plugin, which skips only a literal
`ssr = false`, reported each shell as missing its `<title>`. These are the same class as the first
look's `dev`-derived findings. The others failed on their own: a workspace package with no resolvable
entry (image.complianttools) and `$env/static` variables not set (sunnylink); and, before the plugin
ran, hacibaba's missing database directory and a failed lifecycle script in Stoat's install.

## Labelling notes

- The design share is concentrated in `description-presence` (371), `canonical-url` (255), `each-key`
  (111) and `image-dimensions` (94); obot, portal, portal-desktop and epj together have 666 of the 1,093.
- Conventions the labellers applied but questioned: og/twitter as `tp` on login-only routes and on a
  site that sets `noindex` everywhere (canonical is `design` there); a Tauri shell's canonical as `tp`
  where an earlier Electron shell was `design`; a `<main>` inside a user-opened dialog (the ledger has
  both); `json-ld` as `tp` on routes where `description-presence` is `design`; sunnylink's
  `BASE_PATH` base as `design`, since its only deployment serves at the root.
- Analyzer gaps that did not change a verdict: component headings rendered after `{@render children()}`
  are ordered before the page's content; headings in a native `<dialog>` opened with `.showModal()` are
  read as always rendering; and ampoteket's layout emits og/twitter tags only in the `{:else}` of a
  route-derived `{#if privatePage}`, which the analyzer reads as present on the private routes too.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a
thirteenth holdout.
