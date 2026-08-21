# a11y/unverified-id-ref Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the opt-in open-world sibling rule `a11y/unverified-id-ref` per `docs/superpowers/specs/2026-08-21-unverified-id-ref-design.md`.

**Architecture:** A new `Rule.defaultOff` flag (one shared absent-means-off helper feeding `selectRules` and the inventory), a severity parameter on the a11y route `resultFactory`, the rule itself (mirror of `a11y/no-missing-id-ref` on non-resolved routes, message naming `unresolvedCauses`), a `--rules` materialization fix in the CLI, a one-line rendered-mode notice in the vite build path, kitchen-sink guards, docs, and a post-implementation precision measurement.

**Tech Stack:** TypeScript, vitest, pnpm workspace. Work on branch `design/unverified-id-ref` (the spec is committed there).

## Global Constraints

- Core purity: no `node:` imports, no I/O in `packages/core`.
- No new dependencies. Do NOT touch `packages/core/src/index.ts`.
- The rule id is `a11y/unverified-id-ref`, declared severity `info`, `defaultOff: true`. A user who never opts in must see identical scores (disabled `defaultOff` rule contributes nothing to any inventory denominator).
- Overrides are NOT an enablement path (post-analysis semantics); enablement is the rules map or `--rules` only.
- en/ja docs edited together, then `pnpm --filter docs run translate:stamp <en-file...>` (no `--` separator — the script rejects it).
- Run `pnpm format` before each commit; conventional commits scoped by package.
- After Task 2 and every later task, the FULL monorepo suite must be green (`pnpm test` runs build first). Tasks 1–2 are ordered so no intermediate commit leaves the suite red.

---

### Task 1: `defaultOff` mechanism and `resultFactory` severity parameter (core)

**Files:**

- Modify: `packages/core/src/rule.ts` (add `defaultOff?: true` to `Rule`)
- Modify: `packages/core/src/config-apply.ts` (new `configuredSeverity` helper; `selectRules` uses it)
- Modify: `packages/core/src/scoring/inventory.ts` (`severityOf` delegates to the helper)
- Modify: `packages/core/src/rules/a11y/route-rule.ts` (`resultFactory` severity parameter)
- Modify: the four `resultFactory` call sites — `packages/core/src/rules/a11y/no-missing-id-ref.ts`, `top-level-landmark.ts`, `required-element.ts`, and `surplusRule` inside `route-rule.ts` — each passing `'warning'`
- Test: `packages/core/test/rule-selection-core.test.ts` (new file)

**Interfaces:**

- Consumes: existing `settingSeverity` (`config-apply.ts`), `Rule`, `Severity`.
- Produces (Tasks 2–3 rely on these exact shapes):

  ```ts
  // packages/core/src/rule.ts, on Rule:
  /** Off unless config.rules names the rule explicitly — the opt-in class (design 2026-08-21). */
  defaultOff?: true;

  // packages/core/src/config-apply.ts:
  /** A rule's effective severity under `config`, or undefined when it is off — including a `defaultOff` rule that no config entry names. */
  export function configuredSeverity(rule: Rule, config: Config): Severity | undefined;

  // packages/core/src/rules/a11y/route-rule.ts:
  export function resultFactory(id: string, recommendation: string, severity: Severity): …
  ```

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/rule-selection-core.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/types.js';
import { selectRules, configuredSeverity } from '../src/config-apply.js';
import { buildInventory, pairKey } from '../src/scoring/inventory.js';
import type { Rule } from '../src/rule.js';

const check = async (): Promise<Result[]> => [];
const onRule: Rule = {
  id: 'a11y/x-on',
  title: 'x',
  category: 'a11y',
  severity: 'info',
  scope: 'route',
  rationale: 'r',
  check
};
const offRule: Rule = { ...onRule, id: 'a11y/x-off', defaultOff: true };

describe('defaultOff selection and inventory', () => {
  it('a defaultOff rule is not selected and carries no weight without a config entry', () => {
    const config = defineConfig({});
    expect(selectRules([onRule, offRule], config).map((r) => r.id)).toEqual(['a11y/x-on']);
    expect(configuredSeverity(offRule, config)).toBeUndefined();
    const inv = buildInventory(config, [offRule]);
    expect(inv.get(pairKey('a11y', 'route'))).toBeUndefined();
  });

  it('any explicit entry enables it — severity string or options object', () => {
    const bySeverity = defineConfig({ rules: { 'a11y/x-off': 'warning' } });
    expect(selectRules([offRule], bySeverity).map((r) => r.id)).toEqual(['a11y/x-off']);
    expect(configuredSeverity(offRule, bySeverity)).toBe('warning');
    const byObject = defineConfig({ rules: { 'a11y/x-off': { options: {} } } });
    expect(selectRules([offRule], byObject).map((r) => r.id)).toEqual(['a11y/x-off']);
    expect(configuredSeverity(offRule, byObject)).toBe('info');
    expect(buildInventory(byObject, [offRule]).get(pairKey('a11y', 'route'))).toBe(1);
  });

  it("an explicit 'off' still turns it off", () => {
    const config = defineConfig({ rules: { 'a11y/x-off': 'off' } });
    expect(selectRules([offRule], config)).toEqual([]);
    expect(configuredSeverity(offRule, config)).toBeUndefined();
  });
});
```

(`defineConfig` may validate rule ids against the registry — if it rejects `a11y/x-off`, build the `Config` object literal directly the way other core tests around `buildInventory` do; check `packages/core/test/` for the existing pattern before fighting it.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/rule-selection-core.test.ts`
Expected: FAIL — `configuredSeverity` is not exported.

- [ ] **Step 3: Implement**

`packages/core/src/rule.ts` — add to `Rule` after `passLabel` (JSDoc from the Interfaces block above).

`packages/core/src/config-apply.ts`:

```ts
/**
 * A rule's effective severity under `config`, or undefined when it is off. The one place the
 * defaultOff decision lives: a `defaultOff` rule with no `config.rules` entry is off — an
 * explicit entry (any severity, or an options object) is the only enablement path.
 */
export function configuredSeverity(rule: Rule, config: Config): Severity | undefined {
  const setting = config.rules[rule.id];
  if (setting === undefined) return rule.defaultOff ? undefined : rule.severity;
  const severity = settingSeverity(setting);
  if (severity === 'off') return undefined;
  return severity ?? rule.severity;
}
```

(This needs `Rule` — check for an import cycle: `config-apply.ts` currently does not import `rule.ts`, and `rule.ts` imports `rule-options.ts`, not `config-apply.ts`. If adding `import type { Rule }` creates a cycle, accept a structural parameter instead: `rule: { id: string; severity: Severity; defaultOff?: true }`.)

Rewrite `selectRules` to use it:

```ts
export function selectRules(rules: Rule[], config: Config): Rule[] {
  return rules.filter((rule) => configuredSeverity(rule, config) !== undefined);
}
```

`packages/core/src/scoring/inventory.ts` — replace the private `severityOf` body with a delegation:

```ts
function severityOf(rule: Rule, config: Config): Severity | undefined {
  return configuredSeverity(rule, config);
}
```

(or inline `configuredSeverity` at its call site and delete `severityOf`).

`packages/core/src/rules/a11y/route-rule.ts` — `resultFactory(id, recommendation, severity: Severity)` with `severity` used in place of the literal; update the four call sites to pass `'warning'` (in `no-missing-id-ref.ts`, `top-level-landmark.ts`, `required-element.ts`, and `surplusRule`).

- [ ] **Step 4: Run the tests and the full core + cli suites**

Run: `pnpm --filter @svelte-vitals/core exec vitest run && pnpm --filter @svelte-vitals/core run build && pnpm --filter svelte-vitals exec vitest run`
Expected: all PASS — behavior is unchanged for every existing rule (none is `defaultOff`; every factory caller still emits `warning`).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src packages/core/test/rule-selection-core.test.ts
git commit -m "feat(core): defaultOff rule class and severity-parameterized a11y route resultFactory"
```

---

### Task 2: the rule, registration, docs pages, and kitchen-sink expectations

This task is atomic on purpose: registering a rule makes `docs-links.test.ts`, `rules-index.test.ts`, `skills-repo.test.ts`, and the kitchen-sink meta-test demand their artifacts in the same commit.

**Files:**

- Create: `packages/core/src/rules/a11y/unverified-id-ref.ts`
- Modify: `packages/core/src/rules/index.ts` (import + `allRules` + re-export, next to `a11yNoMissingIdRef`)
- Create: `docs/src/content/docs/rules/a11y/unverified-id-ref.md` and `docs/src/content/docs/ja/rules/a11y/unverified-id-ref.md`
- Modify: `docs/src/content/docs/rules/a11y/no-missing-id-ref.md` + ja (cross-link paragraph)
- Modify: `examples/kitchen-sink/expected-findings.json` and `expected-findings.rendered.json`
- Regenerate: rules index pages (`gen:rules-index`), `skills/` (`gen:skills`)
- Test: `packages/core/test/a11y-route-rules.test.ts`

**Interfaces:**

- Consumes: `resultFactory(id, recommendation, severity)` and `Rule.defaultOff` from Task 1; `ResolvedA11y.unresolvedCauses` / `A11ySkipCause` (already shipped).
- Produces: `a11yUnverifiedIdRef: Rule` with id `a11y/unverified-id-ref`, severity `'info'`, `defaultOff: true`, exported from `rules/index.ts` — Tasks 3–5 enable it by that id.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/a11y-route-rules.test.ts` (the `ra`/`ctxA11y`/`fails` helpers are at the top of the file; add `a11yUnverifiedIdRef` to the `../src/internal.js` import):

```ts
describe('a11y/unverified-id-ref', () => {
  const cause = (over: object) => ({
    kind: 'component' as const,
    file: 'src/lib/A.svelte',
    line: 2,
    detail: 'A',
    ...over
  });
  const open = (over: Partial<ResolvedA11y>) => ra({ fullyResolved: false, unresolvedCauses: [cause({})], ...over });

  it('flags an unmatched ref on a non-resolved route, naming the blocking cause', async () => {
    const rs = await a11yUnverifiedIdRef.check(
      ctxA11y([open({ idRefs: [{ id: 'ghost', attr: 'for', file: 'f', line: 3 }], idCandidates: [] })])
    );
    const f = fails(rs);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ location: 'f', line: 3, severity: 'info' });
    expect(f[0]!.message).toBe(
      'for="ghost" references an id not found in any analyzed source — the route is not fully resolved ' +
        '(unresolved component <A> at src/lib/A.svelte:2); verify the id exists at runtime'
    );
  });

  it('caps the cause list at three plus a count', async () => {
    const causes = [
      cause({}),
      cause({ kind: 'spread', detail: undefined, file: 'b.svelte', line: 1 }),
      cause({ kind: 'html', detail: undefined, file: 'c.svelte', line: 4 }),
      cause({ kind: 'dynamic-id', detail: undefined, file: 'd.svelte', line: 5 }),
      cause({ kind: 'spread', detail: undefined, file: 'e.svelte', line: 6 })
    ];
    const rs = await a11yUnverifiedIdRef.check(
      ctxA11y([open({ unresolvedCauses: causes, idRefs: [{ id: 'g', attr: 'for', file: 'f', line: 1 }] })])
    );
    expect(fails(rs)[0]!.message).toContain(
      '(unresolved component <A> at src/lib/A.svelte:2, spread at b.svelte:1, {@html} at c.svelte:4, +2 more)'
    );
  });

  it('PASS when every ref matches an optimistic candidate; href fragments use the # display form', async () => {
    const rs = await a11yUnverifiedIdRef.check(
      ctxA11y([open({ idRefs: [{ id: 'x', attr: 'href', file: 'f', line: 2 }], idCandidates: ['x'] })])
    );
    expect(rs).toHaveLength(1);
    expect(fails(rs)).toHaveLength(0);
    const miss = await a11yUnverifiedIdRef.check(
      ctxA11y([open({ idRefs: [{ id: 'x', attr: 'href', file: 'f', line: 2 }], idCandidates: [] })])
    );
    expect(fails(miss)[0]!.message).toMatch(/^href="#x" references /);
  });

  it('emits nothing on fully resolved routes and on routes without refs', async () => {
    const resolved = await a11yUnverifiedIdRef.check(
      ctxA11y([ra({ idRefs: [{ id: 'g', attr: 'for', file: 'f', line: 1 }], idCandidates: [] })])
    );
    expect(resolved).toHaveLength(0);
    expect(await a11yUnverifiedIdRef.check(ctxA11y([open({})]))).toHaveLength(0);
  });

  it('declares the opt-in class', () => {
    expect(a11yUnverifiedIdRef.defaultOff).toBe(true);
    expect(a11yUnverifiedIdRef.severity).toBe('info');
  });
});
```

(The spec's "causes are present whenever `fullyResolved` is false" invariant is pinned at
the collection boundary by `packages/cli/test/source-provider.test.ts` — the rule still
reads `unresolvedCauses ?? []` so a synthetic context without causes cannot crash it.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/a11y-route-rules.test.ts`
Expected: FAIL — `a11yUnverifiedIdRef` is not exported.

- [ ] **Step 3: Implement the rule**

Create `packages/core/src/rules/a11y/unverified-id-ref.ts`:

```ts
import type { Result } from '../../types.js';
import type { Rule, RuleContext } from '../../rule.js';
import type { A11ySkipCause } from '../../a11y.js';
import { PENALIZED, PASS } from '../detection.js';
import { resultFactory } from './route-rule.js';

const recommendation =
  'The reference could not be verified against the composed route. Confirm the id exists in the rendered page, or resolve the causes so a11y/no-missing-id-ref can verify it.';
const result = resultFactory('a11y/unverified-id-ref', recommendation, 'info');

const CAUSE_LABEL: Record<A11ySkipCause['kind'], string> = {
  component: 'unresolved component',
  spread: 'spread',
  html: '{@html}',
  'dynamic-id': 'dynamic id'
};

function causeList(causes: readonly A11ySkipCause[]): string {
  const shown = causes.slice(0, 3).map((c) => {
    const name = c.kind === 'component' && c.detail ? `${CAUSE_LABEL.component} <${c.detail}>` : CAUSE_LABEL[c.kind];
    return `${name} at ${c.file}:${c.line}`;
  });
  const rest = causes.length - shown.length;
  return shown.join(', ') + (rest > 0 ? `, +${rest} more` : '');
}

/**
 * a11y/unverified-id-ref — the opt-in open-world arm of a11y/no-missing-id-ref (design
 * 2026-08-21): on routes whose composition is NOT fully resolved, a literal id reference
 * matching no optimistic candidate is reported as unverifiable, never as missing — an
 * unresolved component, spread, {@html}, or dynamic id could still define the id.
 */
export const a11yUnverifiedIdRef: Rule = {
  id: 'a11y/unverified-id-ref',
  title: 'Unverified id reference',
  category: 'a11y',
  severity: 'info',
  scope: 'route',
  defaultOff: true,
  rationale:
    'Opt-in: on routes a11y/no-missing-id-ref must skip (composition not fully resolved), an id reference that matches no literal id anywhere analyzed is reported as unverifiable — a real dangling reference and an id hidden inside an unresolved component look the same, so findings need manual confirmation.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.a11y ?? []) {
      if (route.fullyResolved || route.idRefs.length === 0) continue;
      const candidates = new Set(route.idCandidates);
      const causes = causeList(route.unresolvedCauses ?? []);
      let hasUnverified = false;
      for (const ref of route.idRefs) {
        if (candidates.has(ref.id)) continue;
        hasUnverified = true;
        out.push(
          result(
            route.route,
            PENALIZED,
            ref,
            `${ref.attr}="${ref.attr === 'href' ? '#' : ''}${ref.id}" references an id not found in any analyzed source — the route is not fully resolved (${causes}); verify the id exists at runtime`
          )
        );
      }
      if (!hasUnverified) {
        const first = route.idRefs[0]!;
        out.push(
          result(
            route.route,
            PASS,
            { file: first.file, line: 0 },
            'All id references match literal ids (composition not fully resolved)'
          )
        );
      }
    }
    return out;
  }
};
```

Register in `packages/core/src/rules/index.ts` in all three places, directly beside `a11yNoMissingIdRef` (import block, `allRules` array, re-export block).

- [ ] **Step 4: Run the core tests**

Run: `pnpm --filter @svelte-vitals/core exec vitest run`
Expected: PASS.

- [ ] **Step 5: Kitchen-sink expectations**

`examples/kitchen-sink/expected-findings.json` — add (alphabetical placement next to the sibling):

```json
"a11y/unverified-id-ref": {
  "inert": "default-off (opt-in); exercised by the scoped --rules e2e invocation"
},
```

`examples/kitchen-sink/expected-findings.rendered.json` — add `"a11y/unverified-id-ref": 0,` (the build e2e pins the rendered key set to the static one; the rule is both default-off and structurally inert in rendered mode).

- [ ] **Step 6: Docs pages**

Create `docs/src/content/docs/rules/a11y/unverified-id-ref.md`:

````markdown
---
title: a11y/unverified-id-ref · Unverified id reference
description: 'Opt-in: flags id references that cannot be verified on routes whose composition is not fully resolved.'
---

**Severity:** info · **Category:** a11y · **Opt-in** (off by default)

## What it checks

On routes [`a11y/no-missing-id-ref`](/rules/a11y/no-missing-id-ref) must skip — any route whose composition is not fully resolved (an unresolved component, a spread attribute, `{@html}`, or a dynamic `id` anywhere in the composed files) — this rule matches every literal id reference against every literal id the analysis did see (all branches, resolved components, and the `src/app.html` shell). A reference that matches nothing is reported as **unverifiable** — deliberately not as _missing_: the id may exist inside exactly the content the analysis could not see. Every finding names the causes that keep the route unresolved, with file and line, so the claim can be checked by hand. The two rules split cleanly: fully resolved routes belong to `a11y/no-missing-id-ref`, everything else to this rule — no route is ever reported by both.

`href="#top"` and text-fragment directives keep the sibling rule's exemptions.

## Why it is opt-in

svelte-vitals defaults to zero false positives: the sibling rule skips rather than guesses, and the JSON report's `skipped` map says where and why. This rule trades that guarantee for reach — an unmatched reference here is a _candidate_ defect, not a proven one — so it never runs unless you enable it:

```js
// svelte-vitals.config.js
export default {
  rules: { 'a11y/unverified-id-ref': 'info' }
};
```
````

or one-off: `npx svelte-vitals --rules a11y/unverified-id-ref`. An `overrides` entry cannot enable it — overrides apply to results after analysis — but once enabled globally, overrides scope it normally (e.g. `'off'` for a route subtree).

## Mode differences

Source-mode (CLI and the dev dashboard's static layer) only. In rendered mode (`vite build`) the prerendered document is always fully resolved, so this rule can never fire there — `a11y/no-missing-id-ref` covers rendered documents completely, and the plugin prints a notice if this rule is enabled in a build.

## How to fix

Confirm the reference in the rendered page. If the id genuinely never renders, fix it as you would a [`a11y/no-missing-id-ref`](/rules/a11y/no-missing-id-ref) finding; if it lives inside a library component, pass the id through or silence the finding with a suppressions entry.

````

Create the ja page as a full, natural translation (technical terms and field names stay as-is), then add one cross-link sentence to the **sibling's** page (en + ja), at the end of the skip-surfacing paragraph added by the skip-visibility change:

```markdown
The opt-in sibling rule [`a11y/unverified-id-ref`](/rules/a11y/unverified-id-ref) can check these skipped routes open-world, reporting unmatched references as unverifiable rather than missing.
````

Stamp both pairs:

```bash
pnpm --filter docs run translate:stamp "src/content/docs/rules/a11y/unverified-id-ref.md" "src/content/docs/rules/a11y/no-missing-id-ref.md"
```

- [ ] **Step 7: Regenerate and verify the whole suite**

```bash
pnpm --filter svelte-vitals run gen:rules-index && pnpm --filter svelte-vitals run gen:skills && pnpm format
pnpm test
```

Expected: everything green — the default kitchen-sink run shows zero findings and zero passes for the new rule (the `inert` assertions), docs-links/rules-index/skills tests satisfied.

- [ ] **Step 8: Commit**

```bash
git add packages/core examples/kitchen-sink/expected-findings.json examples/kitchen-sink/expected-findings.rendered.json docs/src/content/docs docs/blume.translations.json skills packages/cli/src packages/cli/docs
git status   # confirm only intended files; gen:rules-index/gen:skills outputs vary — add what they wrote
git commit -m "feat(core): a11y/unverified-id-ref opt-in open-world rule"
```

---

### Task 3: CLI `--rules` materialization for defaultOff rules

**Files:**

- Modify: `packages/cli/src/rule-selection.ts`
- Create: `packages/cli/test/fixtures/unverified-ref-project/` (package.json + two source files)
- Test: `packages/cli/test/rule-selection.test.ts`, `packages/cli/test/analyze-project.test.ts`

**Interfaces:**

- Consumes: `allRules` (already imported by `rule-selection.ts`), `Rule.defaultOff`, the rule id `a11y/unverified-id-ref`.
- Produces: nothing new — behavior only.

- [ ] **Step 1: Create the fixture**

`packages/cli/test/fixtures/unverified-ref-project/package.json`:

```json
{
  "name": "unverified-ref-fixture",
  "private": true,
  "type": "module",
  "devDependencies": { "@sveltejs/kit": "^2.0.0", "svelte": "^5.0.0" }
}
```

`packages/cli/test/fixtures/unverified-ref-project/src/routes/+page.svelte`:

```svelte
<svelte:head><title>t</title></svelte:head>
<h1>t</h1>
<label for="ghost-input">Ghost</label>
<div {...attrs}>spread poisons the closed world</div>
```

(The dangling `for` plus the spread make `/` a non-resolved route with one literal ref — the sibling skips it, the new rule flags it. `/smt-spread` in `basic-project` cannot serve here: it has zero literal refs, so the enabled rule emits nothing there.)

- [ ] **Step 2: Write the failing tests**

In `packages/cli/test/rule-selection.test.ts` add:

```ts
describe('defaultOff materialization', () => {
  it('--rules materializes an entry for a defaultOff rule with no config entry', () => {
    const out = resolveRuleSelection({ allowRules: ['a11y/unverified-id-ref'] });
    expect(out['a11y/unverified-id-ref']).toBe('info');
  });

  it("--rules overrides an explicit config 'off' for a defaultOff rule", () => {
    const out = resolveRuleSelection({
      fileRules: { 'a11y/unverified-id-ref': 'off' },
      allowRules: ['a11y/unverified-id-ref']
    });
    expect(out['a11y/unverified-id-ref']).toBe('info');
  });

  it('a normal rule still gets no materialized entry (absent means default-on)', () => {
    const out = resolveRuleSelection({ allowRules: ['a11y/no-missing-id-ref'] });
    expect(out['a11y/no-missing-id-ref']).toBeUndefined();
  });
});
```

(Match the file's existing import/call style for `resolveRuleSelection`.)

In `packages/cli/test/analyze-project.test.ts` add (declare `const unverifiedRefFixtureDir = join(here, 'fixtures', 'unverified-ref-project');` beside the other fixture dirs):

```ts
describe('a11y/unverified-id-ref opt-in', () => {
  it('is not selected and reports no evidence row by default', async () => {
    const { ruleIds, results } = await analyzeProject({ cwd: unverifiedRefFixtureDir });
    expect(ruleIds).not.toContain('a11y/unverified-id-ref');
    expect(results.some((r) => r.id === 'a11y/unverified-id-ref')).toBe(false);
  });

  it('flags the unverifiable ref when enabled via the rules map', async () => {
    const { results } = await analyzeProject({
      cwd: unverifiedRefFixtureDir,
      rules: { 'a11y/unverified-id-ref': 'info' }
    });
    const finding = results.find((r) => r.id === 'a11y/unverified-id-ref' && r.detection.presence === 'none');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('for="ghost-input"');
    expect(finding!.message).toContain('spread at src/routes/+page.svelte:');
  });

  it('flags it when enabled via --rules force-enable', async () => {
    const { results } = await analyzeProject({
      cwd: unverifiedRefFixtureDir,
      allowRules: ['a11y/unverified-id-ref']
    });
    expect(results.some((r) => r.id === 'a11y/unverified-id-ref' && r.detection.presence === 'none')).toBe(true);
  });
});
```

(`AnalyzeOptions.rules` and `allowRules` both exist — see `analyzeProject`'s `resolveRuleSelection` call.)

- [ ] **Step 3: Run to verify failures**

Run: `pnpm --filter svelte-vitals exec vitest run test/rule-selection.test.ts test/analyze-project.test.ts`
Expected: the materialization tests FAIL (entry stays absent); the enabled-via-rules-map test may already pass (config-object path) — that is fine, the force-enable ones must fail.

- [ ] **Step 4: Implement**

In `packages/cli/src/rule-selection.ts`, at the end of the `if (allow.length > 0)` block (after the existing per-id loop, i.e. on the post-delete state):

```ts
// A defaultOff rule's absent entry means OFF, so force-enable must materialize one —
// covering both "never configured" and "config said 'off', the delete above removed it".
for (const id of allowed) {
  if (out[id] !== undefined) continue;
  const rule = allRules.find((r) => r.id === id);
  if (rule?.defaultOff) out[id] = rule.severity;
}
```

- [ ] **Step 5: Run the cli suite**

Run: `pnpm --filter svelte-vitals exec vitest run`
Expected: PASS (flag-coverage and io-budget untouched: no new flags, the fixture adds routes only to its own project).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/rule-selection.ts packages/cli/test
git commit -m "feat(cli): --rules force-enable materializes entries for defaultOff rules"
```

---

### Task 4: vite build-path notice

**Files:**

- Modify: `packages/vite/src/analyze.ts`
- Test: `packages/vite/test/analyze.test.ts`

**Interfaces:** consumes `selectRules` output already computed in `analyze.ts` (`const selected = selectRules(allRules, config)`); produces nothing downstream.

- [ ] **Step 1: Write the failing test**

In `packages/vite/test/analyze.test.ts`, mirror the existing "surfaces non-fatal config-file warnings" test (same `makeProject`/`analyze` harness):

```ts
it('notices an enabled a11y/unverified-id-ref: structurally inert in rendered mode', async () => {
  const { cwd, pages } = await makeProject(`export default { rules: { 'a11y/unverified-id-ref': 'info' } };\n`);
  try {
    const r = await analyze(pages, cwd, { report: false });
    expect(r.warnings.some((w) => w.includes('a11y/unverified-id-ref has no effect in rendered mode'))).toBe(true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

it('no notice when the rule is not enabled', async () => {
  const { cwd, pages } = await makeProject(`export default {};\n`);
  try {
    const r = await analyze(pages, cwd, { report: false });
    expect(r.warnings.some((w) => w.includes('unverified-id-ref'))).toBe(false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @svelte-vitals/vite exec vitest run test/analyze.test.ts`
Expected: first new test FAILS.

- [ ] **Step 3: Implement**

In `packages/vite/src/analyze.ts`, right after `const selected = selectRules(allRules, config);`:

```ts
// Rendered collection marks every route fully resolved, so the opt-in open-world rule can
// never fire here — say so instead of holding a silent no-op lever (design 2026-08-21).
if (selected.some((r) => r.id === 'a11y/unverified-id-ref')) {
  warnings.push(
    'a11y/unverified-id-ref has no effect in rendered mode — the prerendered document is always fully resolved.'
  );
}
```

(Push into the same `warnings` array the config-file warnings use; if the array is assembled later, place the push where `skippedFileWarnings` results are pushed.)

- [ ] **Step 4: Run the vite suite**

Run: `pnpm --filter @svelte-vitals/vite exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/vite/src/analyze.ts packages/vite/test/analyze.test.ts
git commit -m "feat(vite): notice when a11y/unverified-id-ref is enabled in rendered mode"
```

---

### Task 5: kitchen-sink scoped e2e (Guard 1)

**Files:**

- Modify: `examples/kitchen-sink/test/e2e-static.test.ts`

**Interfaces:** consumes the built CLI and the existing `/gallery/a11y/skipped` route (dangling `<label for="phantom-input">`, spread, dynamic id).

- [ ] **Step 1: Write the failing test**

Append to the describe block in `e2e-static.test.ts` (it already imports `spawnSync`):

```ts
it('opt-in a11y/unverified-id-ref flags the skipped route open-world when force-enabled', () => {
  const res = spawnSync(process.execPath, [bin, appDir, '--rules', 'a11y/unverified-id-ref', '--reporter', 'json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const scoped = JSON.parse(res.stdout) as JsonReport;
  const route = scoped.routes.find((r) => r.route === '/gallery/a11y/skipped')!;
  const finding = route.issues.find((i) => i.id === 'a11y/unverified-id-ref')!;
  expect(finding).toBeDefined();
  // The message must name at least one concrete blocking cause with file and line.
  expect((finding as { title?: string }).title).toMatch(/at src\/routes\/gallery\/a11y\/skipped\/\+page\.svelte:\d+/);
});
```

(`JsonIssue.title` carries the result message — check the interface at the top of the file and extend the local `issues` element type with `title?: string` if needed. The `--rules` run deliberately turns every other rule off; the sibling's unchanged behavior is already pinned by the default run's `expected-findings.json` assertions.)

- [ ] **Step 2: Build and run**

Run: `pnpm build && pnpm --filter kitchen-sink exec vitest run test/e2e-static.test.ts`
Expected: the new test passes only once Tasks 2–3 are in; everything else stays green (default-run counts unchanged).

- [ ] **Step 3: Commit**

```bash
git add examples/kitchen-sink/test/e2e-static.test.ts
git commit -m "test(cli): kitchen-sink guard for the opt-in unverified-id-ref rule"
```

---

### Task 6: changeset, spec correction, full verification

**Files:**

- Create: `.changeset/unverified-id-ref.md`
- Modify: `docs/superpowers/specs/2026-08-21-unverified-id-ref-design.md` (one parenthetical)

**Interfaces:** none.

- [ ] **Step 1: Changeset**

`.changeset/unverified-id-ref.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

New opt-in rule `a11y/unverified-id-ref`: on routes `a11y/no-missing-id-ref` must skip
(composition not fully resolved), it reports id references that match no literal id
anywhere analyzed as unverifiable — never as missing — naming the unresolved component,
spread, `{@html}`, or dynamic id that blocks verification. Off by default: enable it via
`rules: { 'a11y/unverified-id-ref': 'info' }` or `--rules a11y/unverified-id-ref`. Scores
are unchanged for every project that does not enable it. Source mode only; the vite
plugin prints a notice if it is enabled in rendered mode.
```

- [ ] **Step 2: Spec correction**

In `docs/superpowers/specs/2026-08-21-unverified-id-ref-design.md`, the cli test bullet says config-file enablement can use "(`basic-project`'s `/smt-spread` works)" — it cannot: that route has zero literal id references, so the enabled rule emits nothing there. Replace the parenthetical with "(a dedicated fixture with a dangling ref on a non-resolved route — `/smt-spread` has zero literal refs and cannot observe enablement)".

- [ ] **Step 3: Full verification**

```bash
pnpm format && pnpm build && pnpm typecheck && pnpm test && pnpm lint
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add .changeset/unverified-id-ref.md docs/superpowers/specs/2026-08-21-unverified-id-ref-design.md
git commit -m "chore: changeset for a11y/unverified-id-ref"
```

---

### Task 7: precision measurement (the release gate's numbers)

**Files:**

- Create: `docs/superpowers/specs/2026-08-21-unverified-id-ref-precision-measured.md`
- Modify: `docs/src/content/docs/rules/a11y/unverified-id-ref.md` + ja (add the measured precision paragraph), re-stamp

**Interfaces:** consumes the built CLI from this branch; the measurement corpus clones may still exist at `/private/tmp/claude-501/-Users-oekazuma-localRepo-svelte-vitals/7d89715f-7c94-41c6-86bf-0630e8b198b0/scratchpad/skip-measure-workdir/` (reuse them; re-clone missing ones with `git clone --depth 1`, and always delete any `svelte-vitals.config.*` in a clone before analyzing — the CLI dynamically imports it, and running third-party config code is the risk, not a formality).

- [ ] **Step 1: Collect findings across the corpus**

For each of the nine apps (the eight `scripts/ecosystem-smoke.js` repos at their recorded paths, plus `itswadesh/svelte-commerce` at `.`): run

```bash
node packages/cli/dist/bin.js <app-dir> --rules a11y/unverified-id-ref --reporter json --no-suppressions
```

(exit 0 or 1 both fine) and collect every `a11y/unverified-id-ref` issue from `routes[].issues` — route, location, line, and the referenced id from the message. Record per-app totals.

- [ ] **Step 2: Classify a sample by hand**

Take ~30 findings spread across the apps (all of them if fewer). For each, open the referenced files in the clone and decide: **real** (no element with that id can render on that route — e.g. svelte-commerce's checkout `for="email"`/`for="phone"` with an id-less `<Textbox>`) vs **false positive** (the id demonstrably exists inside the unresolved component/`{@html}` payload the message names) vs **undecidable** (could not trace). Record every classification with the evidence file.

- [ ] **Step 3: Write the measured doc**

`docs/superpowers/specs/2026-08-21-unverified-id-ref-precision-measured.md`: methodology (CLI commit, clone SHAs), per-app finding volume table, the sample classification table, and the precision headline. No mechanism conclusions — this feeds the docs wording only.

- [ ] **Step 4: Fold the number into the rule docs**

Add to the rule page's "Why it is opt-in" section (en, mirrored in ja):
"In a nine-app measurement (`2026-08-21-unverified-id-ref-precision-measured.md`), X of Y sampled findings were real defects." — with the actual numbers. Re-stamp the pair. If the result is catastrophic (near-zero real findings), STOP instead: report to the plan owner before shipping, per the spec's gate.

- [ ] **Step 5: Verify and commit**

```bash
pnpm format && pnpm --filter docs run translate:stamp "src/content/docs/rules/a11y/unverified-id-ref.md"
pnpm lint && pnpm --filter svelte-vitals exec vitest run test/docs-links.test.ts test/rules-index.test.ts
git add docs
git commit -m "docs: measured precision for a11y/unverified-id-ref"
```

(If `gen:rules-index` output changes because the description changed, regenerate and include it.)

---

## After the plan

Branch finish via superpowers:finishing-a-development-branch — PR to `main`, never a direct push. After merge, comment on issue #533 with the shipped rule and the precision doc; whether #533 then closes is the user's call.
