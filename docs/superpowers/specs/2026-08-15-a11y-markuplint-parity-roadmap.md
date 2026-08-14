# A11y roadmap: markuplint parity or better

Product bar, set by the maintainer: the a11y category must not be a degraded markuplint — for
every markuplint capability worth having in a SvelteKit checker, svelte-vitals ships an equal or
better version (better usually meaning: resolved cross-component analysis, scoring/gating, and
zero per-project parser config). This document records the bar and the queued increments toward
it, extending `2026-08-14-a11y-category-design.md` (Phase 1, shipped).

## markuplint v5 delta (audited against v5.0.0-rc.4)

v5 splits the v4 `wai-aria` umbrella into granular rules and adds new ones. Mapping against
what Phase 1 already ships:

**Covered** — `wai-aria-non-existent-role` + `wai-aria-abstract-role` (→ `a11y/invalid-role`),
`wai-aria-required-props` (→ `a11y/required-aria-props`), `wai-aria-value`
(→ `a11y/invalid-aria-value`), unknown `aria-*` names (→ `a11y/unknown-aria-attribute`),
`no-duplicate-visible-main` (→ `a11y/duplicate-landmark`, strictly stronger: composed route,
plus banner/contentinfo).

**Implementable with the already-shipped `aria-query` data — front of the Phase 2 queue:**

- `wai-aria-disallowed-props` — an `aria-*` prop the element's role does not support
  (`roles.get(role).props` is already in the dependency).
- `wai-aria-implicit-role` — redundant explicit role matching the host's implicit role
  (`elementRoles` map). The Svelte compiler warns on a subset; scored parity per the bar.
- `wai-aria-deprecated-props` / `wai-aria-deprecated-role` — check aria-query's deprecation
  coverage first; fall back to a hand table if absent.

**Queued behind element-level spec data (Phase 2 proper):** `wai-aria-permitted-roles`
(already queued as permitted-role), `wai-aria-implicit-props`, `wai-aria-default-value`,
`wai-aria-no-global-prop`, `wai-aria-interaction-in-hidden`,
`wai-aria-presentational-children`, `wai-aria-required-owned-elements`,
`wai-aria-required-parent-role`, `redundant-accessible-name`, `no-duplicate-autofocus`,
`require-dialog-autofocus`.

**Adjacent categories, not a11y:** `correct-aspect-ratio` and `srcset-sizes-constraint`
(Performance image family), `link-types` and `head-element-order` (SEO head family),
`attr-order` (formatter territory — the existing not-adopted posture),
`no-unsupported-features` (baseline/browser-support data — its own design if ever).

## Svelte syntax coverage note

Both `{@const x = y}` (legacy) and the Svelte 5.56+ declaration tags `{const x = $derived(y)}`
/ `{let x = $state(y)}` parse and traverse correctly through every collector (single
`ConstTag`/`DeclarationTag` handling site in `component-parse.ts`; the template walks are
type-agnostic), pinned by a `parse-file` test. Known false-negative: runes declared in
template declaration tags are invisible to the script-scope correctness facts
(`constableStates` etc.) — revisit if template-declared state becomes idiomatic.

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
