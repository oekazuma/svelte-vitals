# v1 holdout 25 — result (2026-10-07)

Measured with `main` at 307a3e10 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-07-v1-holdout-25-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-25-2026-10-07.json`;
verdicts: `scripts/corpus/holdout-25-2026-10-07-verdicts.json` (3,672 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: not ready.** Four of the nine deciding criteria fail, and two apps account for almost all of
it. C3 fails on 8 false critical findings in supauth: detail routes whose `load` is built by an
imported factory that always redirects, which the analyzer does not read as never rendering. C6 fails on
that class, which ieum's `/logout` also meets. C4 (97.0%) and C7 fail mostly on fcc, whose `<svelte:head>`
renders a canonical link and JSON-LD from a string an imported helper builds: 70 false positives, 35 of
the 38 false warnings. C5 (97.3%) passes and no key is `unclear`. C8, published without deciding the
result, is 31.6%.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 13 apps, 9 of which built | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 8 (`seo/title-presence`, 1 app)                | fail     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 97.0% (1,236 / 1,274)                          | fail     | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 97.3% (1,380 / 1,418)                          | pass     | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class (below)                                | fail     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | 2 below (2 by the earlier definition)          | fail     | none  | none  | none  | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 31.6% (658 / 2,080)                            | reported | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one).

Verdicts (distinct keys): tp 2,756, fp 84, design 832, unclear 0.

C7 fails on two rules whose false positives come from fcc and ieum: `seo/canonical-url` at 65.7% (69 /
105; fcc 35, ieum 1) and `seo/json-ld` at 89.3% (301 / 337; fcc 35, ieum 1). The earlier definition fails
the same two. `seo/single-h1` (97.0%, nos-haiku and cashflow) is above the threshold.

## Critical findings (C3)

148 critical findings: 140 `title-presence` and 8 `handler-state-write`. The 8 `handler-state-write` are tp:
cashflow's universal loads append API errors to a module-level `writable` during SSR, and its root layout
renders them to every later visitor. Of the `title-presence` findings, 132 are tp (offline-finance-dashboard
42, lodestar 39, supauth 35, aivpn 10, proxmox-gui 6) and 8 are fp, all in supauth's admin console:
`/api-resources/[resourceId]`, `/applications/[appId]`, `/enterprise-sso/[configId]`,
`/organizations/[orgId]`, `/roles/[roleId]`, `/security`, `/users/[userId]` and `/webhooks/[webhookId]`. Each
route's `+page.js` is `export const load = createDetailRouteRedirect(…)`, a factory in
`src/lib/detail-route.js` whose returned function throws `error(404)` or `redirect(307)` on every path, so
the route never renders. The analyzer reads a load that always redirects only when its body, or a
top-level function in the same file, does so. The `[tab]` routes that render the same page stay reported.

## False-positive classes

| Class                                                                                                                                                                                         | Findings | Apps | Rules                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------------------------------------------- |
| **A page whose `load` redirects or errors on every path, not read as never rendering** (a `load` an imported factory builds; `return redirect(…)` after `await parent()` and a `try`/`catch`) | 11       | 2    | **title-presence**, canonical-url, og-url, json-ld |
| A canonical link and JSON-LD in a string an imported helper builds and `<svelte:head>` renders with `{@html}`                                                                                 | 70       | 1    | **canonical-url**, **json-ld**                     |
| An object-literal prop deciding a component's `{:else if}` arm (`up={{ isSettings: true }}`)                                                                                                  | 1        | 1    | single-h1                                          |
| A layout `<h1>` behind `{#if pageTitle != null}`, from a `page.data` field the route's `load` does not return                                                                                 | 1        | 1    | single-h1                                          |
| A page's unnamed `<aside>` inside the `<article>` its layout renders children in, read as a top-level landmark                                                                                | 1        | 1    | top-level-landmark                                 |

C6's class reaches the limit the docs state for routes that never render: a `load` that throws or
redirects on every path, directly or through a top-level function of the same file. The two apps meet
it differently:

- supauth's eight detail routes export a `load` built by an imported factory (`createDetailRouteRedirect`).
- ieum's `/logout` ends both paths of its own `load` with `return redirect(303, next)`, after `await
parent()` and a `try`/`catch`; `redirect()` throws, so the `return` never runs.

They are counted as one class, as holdouts 17, 19 and 22 counted classes that reach one documented limit
through different mechanisms. Split by mechanism they are two single-app classes, and C6 would pass; C3,
C4 and C7 would still fail.

fcc's class decides C4 and C7: `FccLayout.svelte` and the home page render `{@html seoHeadExtras}` in
`<svelte:head>`, where `seoHeadExtras = $derived(buildSeoHeadExtras(…))` returns
`<link rel="canonical" …/><script type="application/ld+json">…</script>` from `src/lib/utils.ts`. The
analyzer reads `{@html}` as JSON-LD only when its source names JSON-LD or is built from an
`ld+json` string in the same file, and never as a canonical link.

## C2 in detail

GitHub Actions run 37547690679 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 13 apps and crashed on none. Nine builds completed: sstim (16 prerendered routes analyzed),
teranode (its 14 prerendered routes are `ssr = false` and were skipped), and proxmox-gui, lodestar,
aivpn, ieum, arkvault, nos-haiku and jodal with no prerendered page. After the plugin ran, cashflow's
build was stopped by the plugin's own gate on its critical findings; fcc's on `PUBLIC_SUPABASE_ANON_KEY`
not set; offline-finance-dashboard's on an import of `Navigation.svelte` committed as
`navigation.svelte`, which the case-sensitive runner does not find; and supauth's in a build step that
runs a bun script unable to resolve its `@supauth/shared` workspace package. Before the plugin ran,
matilha-builders' build stopped on its environment schema.

## Labelling notes

- The design share is concentrated in `canonical-url` (217), `description-presence` (203) and
  `each-key` (127); supauth, offline-finance-dashboard, cashflow and lodestar together have 393 of the 658.
- Judgement calls the labellers flagged:
  - teranode's `/admin` and `/settings` are gated by a `hooks.server.ts` redirect the file says never
    runs in production (the app ships as static files behind another server), so they are labelled as
    client-gated (`canonical-url` `design`) rather than as never rendering.
  - offline-finance-dashboard's hooks return 403 to any client that is not on the loopback interface; its
    routes are `design` for `canonical-url` and stay `tp` for `title-presence`, a local tool its users run
    locally.
  - nos-haiku's `single-h1` key is `fp` on 16 of its 17 routes. ieum's root-layout `single-h1` key splits
    1–1 between `/login` (tp) and `/logout` (never renders) and is labelled by the first-look route;
    ieum's `TableSearch` `id-duplication` key is labelled `tp` by finding count on a 1–1 route tie.
  - matilha-builders' `duplicate-landmark` key is `tp` on 9 of 12 routes; on its three public routes the
    layout picks a single-`<main>` arm by `publicRoutes.includes(page.url.pathname)`, a named `const`
    array the analyzer does not decide.
  - proxmox-gui's markdown notes are `tp` for `raw-html`: its DOMPurify fallback passes HTML through
    unchanged on the server, and the tab renders during SSR.
  - sstim leaves `og:url` and `og:image` out on purpose (a static build other operators host); labelled
    `tp` like any other absent og tag.
- Conventions the labellers applied but questioned:
  - og and twitter rules are `tp` on gated, local-only and `robots.txt`-disallowed routes where
    `canonical-url` is `design`.
  - A `robots.txt` or sitemap generated at build time is `design` in most ledger entries and `fp` in one.
  - `title-length` judges the page's `<svelte:head>` title even where `app.html` has an earlier literal
    `<title>`.
  - Staff-authored HTML stored in the app's database is `tp` for `raw-html`, while a site owner's CMS
    content is `design`.
- Seen while labelling, not false positives: lodestar's `/admin/*` canonical findings stay `warning`
  because the gate's first statement is an early return for `/admin/login` before the `locals` check;
  sstim's `permitted-contents` message names a `<div>` where the real violation is a `<footer>` inside
  `<header>`; supauth's `roles` `heading-level-skip` counts a component `<h3>` in an error arm as the
  heading before.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria again needs a
twenty-sixth holdout.
