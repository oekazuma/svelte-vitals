# Layout and page arms decided by the same `load` field

## Problem

Four holdouts in a row (25 to 28) each had one app whose layout chooses an arm by a field of the
`load` data and whose page, or the route itself, rules the other arm out:

| Holdout | App          | Shape                                                                                                                                                                                                                         |
| ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25      | cashflow     | A layout `<h1>` behind `{#if pageTitle != null}`, a `page.data` field the route's `load` never returns.                                                                                                                       |
| 26      | kitchenbrain | A layout `<main>` behind `{#if data.user}`; `/login`'s own `load` redirects any signed-in user, so `data.user` is always null there.                                                                                          |
| 27      | SmartLock    | The layout renders `{@render children()}` bare under `{#if isAuthRoute \|\| !page.data.user}` and inside `<main>`s otherwise; the page's own `<main>` is in the `{:else}` of `{#if user}`, `user = $derived(page.data.user)`. |
| 28      | haps         | The layout wraps `{@render children()}` in `<main>` under `{#if data.user}` and renders it bare in `{:else}`; the page's own `<main>` is under `{#if !data.user}`.                                                            |

Each was one app, so none failed C6 on its own, but the shape keeps coming back, and two apps in one
holdout would.

The last two can be read from the templates alone: the layout and the page test the same value, and
the arm the page sits in contradicts the arm its landmark sits in. The first two need what a `load`
returns, which the analyzer does not read.

## Decision

Landmarks (`a11y/duplicate-landmark`, `a11y/top-level-landmark`) are read with the conditions of the
arms they sit in, across the route's chain files:

- The a11y walk records, for each landmark and for each place a file renders its children, the
  conditions of the `{#if}` arms above it, in the same `Cond` form the heading walk uses for
  contradicting blocks within one file.
- References the chain shares are read as one: a `data` prop the file destructures from `$props()`
  and never reassigns, `page` imported from `$app/state`, `$page` from `$app/stores`, and a `let` or
  `const` holding `$derived(` one of those `)` (a type assertion unwrapped) that the file never
  reassigns, all name the same `page.data` field. Every other reference is the file's own.
- A chain file's landmark is placed at each place the layouts above render their children, as now,
  except where its arm's conditions and the place's arms' conditions cannot all hold
  (`unsatisfiable`). A layout `<main>` the page is nested in counts only when some place inside it is
  consistent with the page landmark's arm.

The change only removes: with no condition on either side, every landmark is placed and nested
exactly as before. Conditions inside an `{#each}`, a snippet or an `{:then}` are read against several
values and are not recorded; a place where the children positions are merged (past eight, or not
exclusive) carries no conditions.

## Limit

`data.user` in a layout and `page.data.user` in a page are read as one value. A `load` below the
layout that returns its own `user` would make them differ; the change does not read `load` return
shapes, so such a route can lose a landmark finding it should have kept (a missed finding, not a
false one). The rule docs state this.

## Out of scope

- Headings (`seo/single-h1`, `seo/heading-level-skip`) keep their own within-file reading.
- What a `load` returns: cashflow's field the `load` never returns, and kitchenbrain's `/login`,
  where the `load`'s redirect makes `data.user` always null, stay reported.
- Landmarks of components a chain file renders keep the conditions of the component tag they sit
  under; conditions inside the component are its own.
