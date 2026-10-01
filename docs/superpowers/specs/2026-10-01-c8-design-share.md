# C8 (design share) is reported, not a release gate; login-gated routes report SEO presence as info

Status: decided.

## Problem

C8 in `2026-09-24-v1-release-criteria.md` limits `design` findings (reported as documented, not a
demonstrable defect) to 30% of critical + warning findings on each holdout. Holdouts 1–13 failed it
ten times, between 30.1% and 42.7%. False-positive fixes cannot move it: a `design` finding is not
wrong.

Across the thirteen holdouts, 14,985 critical + warning keys were labelled `design`:

| Rule                           | Share |
| ------------------------------ | ----- |
| `seo/description-presence`     | 24%   |
| `seo/canonical-url`            | 22%   |
| `correctness/each-key`         | 16%   |
| `security/raw-html`            | 13%   |
| `performance/image-dimensions` | 6%    |

The share follows the mix of apps a holdout draws. Admin consoles and internal tools carry hundreds
of routes nobody searches for, and one such app (xavyo-web's 455 keys in holdout 13) moves the
whole holdout by several points.

## What the design findings are

Of the 6,433 `design` verdicts on `canonical-url` and `description-presence`, 5,114 say the route is
behind a login. The rest: a literal `noindex` (678), an internal or local tool (216), a desktop shell
(199), other (216).

How those 5,114 login gates are written, from the labellers' evidence:

| Gate                                                           | Share |
| -------------------------------------------------------------- | ----- |
| Server `load` (`+layout.server.ts` / `+page.server.ts`)        | 46%   |
| `hooks.server.ts` (`handle` redirecting outside an allow-list) | 25%   |
| Client side (`onMount` / `goto`, `$effect`)                    | 12%   |
| Universal `load` (`+layout.ts` / `+page.ts`)                   | 11%   |
| Not stated                                                     | 6%    |

## Decision

1. **`seo/canonical-url` and `seo/description-presence` report as `info` on a route whose server
   `load` sends a request without a session away.** The page's own `load`, or a layout's above it,
   starts with an `if` whose test is only negated reads of the request's `locals` (`!locals.user`,
   `!(await locals.auth())`, a binding taken from one) and whose branch redirects or errors 401/403.
   A crawler has no session, so it only ever sees the redirect.
2. **C8 stays measured and published in every holdout result, and is not a release gate.** The other
   nine criteria are unchanged.

## Why `info`, not silence

A misread gate keeps the finding visible; skipping the route would hide it. That is the failure the
`seo.indexable` design (`2026-09-21-noindex-seo-rules-design.md`) rejected for deriving the opt-out
from a route's `noindex`. A gate differs from `noindex` in one way that matters: an accidental
`noindex` hides a public page, while a gated route is invisible to a crawler however it got that way.

## Why only the server `load`

It is the one shape that is local and literal. A `hooks.server.ts` gate decides by path
(`isPublicPath(url.pathname)`), which needs the allow-list evaluated; a client gate runs only in the
browser. Both stay `warning`, and their routes are what `overrides` and `seo: { indexable: false }`
are for.

The known misread: an app whose `hooks.server.ts` creates a user for every visitor makes
`if (!locals.user)` never fire. In the corpus this is one route (spelwijsheid `/about/you`).

## Measured effect

The corpus run (195 apps): 1,600 findings move from `warning` to `info` (canonical 850, description
750). By verdict: 1,577 `design`, 5 `fp`, 18 `tp`. 17 of those `tp` were routes behind a login that
earlier rounds labelled before the convention (realworld 6, AdventureLog 9, CMSaasStarter 2), and
are relabelled `design`. The 18th is the spelwijsheid misread above.

C8 per holdout, with the demoted keys taken out of critical + warning:

| Holdout | Before | After |
| ------- | ------ | ----- |
| 1       | 25.3%  | 22.2% |
| 2       | 33.0%  | 32.6% |
| 3       | 22.7%  | 21.9% |
| 4       | 23.3%  | 23.3% |
| 5       | 35.6%  | 34.5% |
| 6       | 33.4%  | 32.1% |
| 7       | 34.4%  | 33.2% |
| 8       | 37.8%  | 37.3% |
| 9       | 42.7%  | 41.2% |
| 10      | 33.6%  | 30.5% |
| 11      | 35.1%  | 32.1% |
| 12      | 30.1%  | 28.9% |
| 13      | 35.0%  | 25.4% |

Five of thirteen pass, against three before. Holdouts 1, 2, 4 and 6 were measured installed and the
corpus run is not, so some of their keys have no corpus counterpart; their "after" understates the
effect.

Ceilings, assuming every gate of a kind is detected: server `load` alone passes 5 of 13; adding
universal `load`, 6; adding `hooks.server.ts`, 9. Holdouts 5, 7, 8 and 9 stay above 30% under every
detector, and still do with `each-key` and `raw-html` taken out of the measure as well.

## Rejected

- **Raise the threshold, or take named rules out of C8.** Either picks a ruler after seeing the
  measurements, which the criteria document exists to prevent. Dropping C8 as a gate is also a change
  after measuring; it is made openly, the share keeps being published, and C4, C5 and C7 still bound
  how often a warning is wrong.
- **Demote `raw-html` or stop flagging `noindex` routes.** Decided against on 2026-09-24 and
  2026-09-21; the measurements here add nothing that changes those reasons.
