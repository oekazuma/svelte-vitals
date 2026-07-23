# correctness/unmutated-state: directive expressions are escapes — Design

Date: 2026-07-23
Status: Approved

## Problem

`let obj = $state({});` used only as `<div use:draggable={obj} />` is currently reported by `correctness/unmutated-state` as a never-written `$state`. The finding's premise is wrong: an action receives the proxy by reference and may mutate it (`obj.x = …`), with those mutations tracked reactively — the binding IS using its reactivity, invisibly to static analysis. Following the finding's `$state.raw` suggestion breaks the action's mutations. `transition:`/`animate:` parameters are the same reference-handoff class. (`{@attach fn(obj)}` is already covered: the call-argument escape catches it.)

Recorded as a follow-up in `docs/superpowers/specs/2026-07-22-state-raw-design.md` (Interplay) when `performance/state-raw` gained its own directive-escape collector; this change extends the same treatment to `unmutated-state`.

## Change

1. In `parseComponentFacts`'s `constableStates` disqualification block (component-parse.ts, next to the existing `collectTemplateEscapes(ast.fragment, stateNames, writtenOrEscaped)` call), add one call:

   ```ts
   collectDirectiveEscapes(ast.fragment, stateNames, writtenOrEscaped);
   ```

2. Update `collectDirectiveEscapes`'s doc comment: it now serves `performance/state-raw` AND `correctness/unmutated-state`; the shared `collectTemplateEscapes` deliberately still excludes directives so `correctness/stale-prop-derivation`'s disqualification set is unchanged (a stale prop-derived value handed to an action is still a stale-value bug worth flagging there).

3. No rule-file changes; the rule reads `constableStates` as before.

## Not changed

- `collectTemplateEscapes` (shared) — unchanged, so `stale-prop-derivation` behavior is byte-identical.
- `performance/state-raw` — already calls `collectDirectiveEscapes` with its own candidate set; unchanged.
- The `unmutated-state` recommendation text — unchanged (already appropriate when the finding legitimately fires).

## Effect

Strictly narrows `unmutated-state` (removes the false-positive class); no rule can gain findings from this change.

## Docs, changeset

- `docs/src/content/docs/rules/correctness/unmutated-state.md` + ja mirror: add one sentence to the not-flagged/limitations area: state passed to a `use:`/`transition:`/`animate:` directive is not flagged — the receiving code holds the reference and may mutate it invisibly.
- Changeset: **patch** for core / cli / vite / mcp (false-positive fix in a shipped rule).

## Testing

- Parse unit (extend the file that pins `constableStates` parsing, or `state-raw-parse.test.ts`'s sibling): `$state` used only via `use:action={obj}` → NOT in `constableStates`; same for a `transition:fly={obj}` param; regression: an untouched `$state` with no directives → still IN `constableStates`; a directive whose expression doesn't reference the state → state still constable.
- Rule level: existing `unmutated-state` tests unchanged (they build facts directly).
- Full core suite green; `state-raw` and `stale-prop` suites untouched and green.
