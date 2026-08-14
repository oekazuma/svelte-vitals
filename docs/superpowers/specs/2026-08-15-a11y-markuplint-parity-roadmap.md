# A11y roadmap: markuplint parity or better

Product bar, set by the maintainer: the a11y category must not be a degraded markuplint — for
every markuplint capability worth having in a SvelteKit checker, svelte-vitals ships an equal or
better version (better usually meaning: resolved cross-component analysis, scoring/gating, and
zero per-project parser config). This document records the bar and the queued increments toward
it, extending `2026-08-14-a11y-category-design.md` (Phase 1, shipped).

## Queued increments

1. **Pretender-style component mapping** — a config surface declaring what an unresolvable
   (node_modules) component renders as (`{ "Link": "a" }`, markuplint's `pretenders` is prior
   art). This is the single highest-leverage unlock: it widens `no-missing-id-ref`'s closed
   world (today it skips any route whose composition touches a library component) and enriches
   landmark composition. Where markuplint _requires_ pretenders for all cross-file knowledge,
   svelte-vitals needs them only at the package boundary — that asymmetry is the "better".
2. **Phase 2 element-level spec data** (`2026-08-14` design, Phase 2 section): full
   `permitted-contents`, `invalid-attr`, generic `required-attr`, `deprecated-element`/`-attr`,
   `ineffective-attr`. Data source (own dataset vs `@markuplint/html-spec`) is that design's
   central question.
3. **Phase 3 config-driven rules** (`required-element`, `disallowed-element`) and the
   selector-scoped configuration question (markuplint `nodeRules` vs svelte-vitals file-glob
   overrides), plus the small-rule pool (`no-consecutive-br`, `no-empty-palpable-content`,
   `table-row-column-alignment`, `no-ambiguous-navigable-target-names`, `neighbor-popovers`).
4. **Inline suppression directives for route-scoped findings** — parity with component rules;
   today only the suppressions file covers them.
5. **Shell-id duplication** — merge `app.html` ids into the composed `ids` map so a
   shell/page id collision is a finding; needs one decision about findingKeys whose location
   is outside the route's files.

## Deferred with a measurement gate (do not implement without `pnpm bench` evidence)

- **Per-file a11y composition memoization** — composition currently re-walks shared layouts
  once per route (`composeA11y` in `packages/cli/src/providers/source/routes.ts`); the fix
  seam is caching base-0 node lists per `(file, depth)` and re-addressing with `offsetPath`.
  Group-id uniqueness across instantiations is the invariant a bug here would corrupt
  silently, so this lands only with a measured win and an instantiation-independence test.
- **Consolidating the seven per-rule template walks** in `component-parse.ts` into one
  dispatching visitor — mechanical, but the walks carry subtly different stop conditions;
  defer until the element-rule set stops growing.
- **Route-collection fs concurrency cap** — `collectRoutes` fans out unbounded
  `Promise.all`; EMFILE territory only on very large projects.

## Recorded decisions

- A route chain containing an unparseable `.svelte` file still fails the run (exit 2) rather
  than degrading per-route: a file the Svelte compiler rejects fails the user's build too, so
  a loud failure is the correct contract. Revisit only if partial-analysis demand appears.
