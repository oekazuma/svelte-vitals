# Accessibility (a11y) Category Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the sixth Vitals category `a11y` with 15 native accessibility rules per `docs/superpowers/specs/2026-08-14-a11y-category-design.md`.

**Architecture:** Component-scoped rules (ARIA validity + standalone element rules) ride the existing `componentRule`/`ComponentFacts` machinery with new per-rule fact fields extracted in `component-parse.ts`. Route-scoped rules (landmarks/ids) consume a new mode-independent boundary `ResolvedA11y`, built in source mode by a **branch-aware fold** over elements and component usages (new occurrence extraction inside the CLI's `parseFile`, no second parse, no new file reads) and in rendered mode from prerendered HTML. `a11y/doctype` reads the `app.html` content `collectProjectFacts` already loads.

**Tech Stack:** TypeScript, vitest, `aria-query@5.3.2` (new runtime dep of core — pure data, zero deps), pnpm workspace catalog.

## Global Constraints

- **Core purity**: no `node:` imports, no I/O, no runtime globals anywhere in `packages/core/src/` (AGENTS.md hard rule). `aria-query` is pure data and allowed.
- **Verify commands** (run before claiming any task complete): `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`. `pnpm check:publish` in the task that adds the dependency and in the final task.
- **Registration is 4 places** per rule: `packages/core/src/rules/index.ts` (import + `allRules` entry + re-export block) AND `packages/core/src/index.ts`'s re-export list. Grep the new rule's export name in both files after adding.
- **Every rule needs docs**: `docs/src/content/docs/rules/a11y/<slug>.md` (en) + `docs/src/content/docs/ja/rules/a11y/<slug>.md` (ja), then `pnpm --filter svelte-vitals run gen:rules-index && pnpm format`, then `pnpm --filter docs run translate:stamp docs/src/content/docs/rules/a11y/<slug>.md`. `packages/cli/test/docs-links.test.ts` and `rules-index.test.mjs` fail the build otherwise.
- **Detection principle** (spec): literal values only; expressions are unknowable → skip. For presence checks an expression counts as present. False negatives acceptable, false positives are not.
- **All severities `warning`** except `a11y/use-list` (`info`).
- **Conventional commits**, scoped: `feat(core): …`, `feat(cli): …`, `feat(vite): …`, `docs: …`. `oxfmt` also formats markdown — run `pnpm format` before committing doc changes.
- **No rule counts in prose** — refer to the category, never "15 rules", in READMEs/guides.
- Changesets are written once, in the final task (core minor + cli minor + vite minor, with the Health-score-composition callout).

---

### Task 1: Category infrastructure — `'a11y'` everywhere the category set lives

**Files:**

- Modify: `packages/core/src/types.ts` (`Category` union + `CATEGORIES`)
- Modify: `packages/core/src/rules/component-rule.ts` (`ComponentCategory`)
- Modify: `packages/core/src/reporter/console.ts` (`CATEGORY_ORDER`, `CATEGORY_LABEL`)
- Test: `packages/core/test/console-report.test.ts` (existing file, add cases)

**Interfaces:**

- Produces: `Category` includes `'a11y'`; console prints an `Accessibility` section. Every later task type-checks `category: 'a11y'` against this.

- [ ] **Step 1: Write the failing test** — in `packages/core/test/console-report.test.ts` add:

```ts
it('renders an Accessibility section for a11y findings', () => {
  const results: Result[] = [
    {
      id: 'a11y/duplicate-landmark',
      category: 'a11y',
      severity: 'warning',
      detection: { presence: 'none', value: 'absent' },
      route: '/',
      message: 'Duplicate <main> landmark'
    }
  ];
  const report = formatConsoleReport(results, { color: false });
  expect(report).toContain('Accessibility');
});
```

(Adapt the `formatConsoleReport` call signature to the file's existing tests — copy a neighboring test's invocation.)

- [ ] **Step 2: Run to verify it fails**: `pnpm --filter @svelte-vitals/core test -- console-report` — expected: type error on `category: 'a11y'` / missing label.
- [ ] **Step 3: Implement** — `types.ts`: `export type Category = 'seo' | 'performance' | 'correctness' | 'security' | 'architecture' | 'a11y';` and append `'a11y'` to `CATEGORIES`. `component-rule.ts`: add `'a11y'` to the `Extract<…>` in `ComponentCategory`. `console.ts`: append `a11y` to `CATEGORY_ORDER` (last) and `a11y: 'Accessibility'` to `CATEGORY_LABEL`.
- [ ] **Step 4: Run the full core suite**: `pnpm --filter @svelte-vitals/core test` — expected: PASS (the category machinery is generic; if any test enumerates categories exhaustively, extend it).
- [ ] **Step 5: `pnpm build && pnpm typecheck`** — CLI/vite must still compile (search for exhaustive `Category` switches: `grep -rn "case 'architecture'" packages/` and extend any).
- [ ] **Step 6: Commit** — `feat(core): add a11y to the Category union and console reporter`

### Task 2: `aria-query` dependency + typed data wrapper

**Files:**

- Modify: `pnpm-workspace.yaml` (catalog: `aria-query: 5.3.2`), `packages/core/package.json` (dependencies: `"aria-query": "catalog:"`)
- Create: `packages/core/src/rules/a11y/aria-data.ts`
- Test: `packages/core/test/a11y-aria-data.test.ts`

**Interfaces:**

- Produces:
  - `isKnownRole(role: string): boolean`, `isAbstractRole(role: string): boolean`
  - `isKnownAriaAttribute(name: string): boolean`
  - `requiredAriaProps(role: string): string[]`
  - `ariaValueKind(name: string): { type: string; values?: string[] } | undefined`

- [ ] **Step 1: Add the dependency** — catalog entry in `pnpm-workspace.yaml` under the existing `catalog:` block, `"aria-query": "catalog:"` in `packages/core/package.json` `dependencies`, then `pnpm install`.
- [ ] **Step 2: Write the failing test**:

```ts
import { describe, it, expect } from 'vitest';
import {
  isKnownRole,
  isAbstractRole,
  isKnownAriaAttribute,
  requiredAriaProps,
  ariaValueKind
} from '../src/rules/a11y/aria-data.js';

describe('aria-data wrapper', () => {
  it('knows real, abstract, and fake roles', () => {
    expect(isKnownRole('button')).toBe(true);
    expect(isKnownRole('bogus')).toBe(false);
    expect(isAbstractRole('widget')).toBe(true);
    expect(isAbstractRole('button')).toBe(false);
  });
  it('knows aria attributes', () => {
    expect(isKnownAriaAttribute('aria-label')).toBe(true);
    expect(isKnownAriaAttribute('aria-bogus')).toBe(false);
  });
  it('reports required props per role', () => {
    expect(requiredAriaProps('checkbox')).toContain('aria-checked');
    expect(requiredAriaProps('button')).toEqual([]);
  });
  it('reports value kinds', () => {
    expect(ariaValueKind('aria-hidden')?.type).toBe('boolean');
    expect(ariaValueKind('aria-bogus')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Verify it fails**: `pnpm --filter @svelte-vitals/core test -- a11y-aria-data` — FAIL (module missing).
- [ ] **Step 4: Implement `aria-data.ts`** — thin adapter over aria-query's maps (CJS default-interop import):

```ts
import { roles, aria } from 'aria-query';

export function isKnownRole(role: string): boolean {
  return roles.has(role as Parameters<typeof roles.has>[0]);
}
export function isAbstractRole(role: string): boolean {
  return roles.get(role as Parameters<typeof roles.get>[0])?.abstract === true;
}
export function isKnownAriaAttribute(name: string): boolean {
  return aria.has(name as Parameters<typeof aria.has>[0]);
}
export function requiredAriaProps(role: string): string[] {
  const def = roles.get(role as Parameters<typeof roles.get>[0]);
  return def ? Object.keys(def.requiredProps) : [];
}
export function ariaValueKind(name: string): { type: string; values?: string[] } | undefined {
  const def = aria.get(name as Parameters<typeof aria.get>[0]);
  if (!def) return undefined;
  return { type: def.type, ...(def.values ? { values: def.values.map(String) } : {}) };
}
```

If the named ESM import of the CJS module trips build or types, switch to `import ariaQuery from 'aria-query'` + destructure, and add `@types/aria-query` (catalog) if aria-query ships no types. **Spec fallback**: if `pnpm check:publish` (attw esm-only) or the vite browser bundle breaks on the CJS dep, vendor the needed tables as a generated TS data file instead — record which path was taken in the task commit message.

- [ ] **Step 5: Verify**: `pnpm --filter @svelte-vitals/core test -- a11y-aria-data` PASS, then `pnpm build && pnpm check:publish`.
- [ ] **Step 6: Commit** — `feat(core): add aria-query and the a11y spec-data wrapper`

### Task 3: ARIA element facts in `parseComponentFacts`

**Files:**

- Modify: `packages/core/src/component.ts` (new optional field on `ComponentFacts`)
- Modify: `packages/core/src/component-parse.ts` (template walker addition)
- Test: `packages/core/test/component-parse.test.ts` (add a describe block)

**Interfaces:**

- Produces on `ComponentFacts`:

```ts
/** Elements carrying a role or any aria-* attribute (a11y ARIA rules). */
ariaElements?: {
  tag: string;
  line: number;
  /** literal role value; undefined = no role attr; { expression: true } = dynamic */
  role?: { literal?: string; expression?: boolean };
  /** every aria-* attribute on the element */
  aria: { name: string; literal?: string; expression?: boolean; line: number }[];
}[];
```

- [ ] **Step 1: Write the failing tests**:

```ts
describe('parseComponentFacts — ariaElements (a11y ARIA rules)', () => {
  it('collects literal role and aria attributes with lines', () => {
    const c = parseComponentFacts('<div role="button" aria-label="Close"></div>', 'C.svelte');
    expect(c.ariaElements).toEqual([
      {
        tag: 'div',
        line: 1,
        role: { literal: 'button' },
        aria: [{ name: 'aria-label', literal: 'Close', line: 1 }]
      }
    ]);
  });
  it('marks expression values as expression, not literal', () => {
    const c = parseComponentFacts('<div role={r} aria-hidden={h}></div>', 'C.svelte');
    expect(c.ariaElements![0]!.role).toEqual({ expression: true });
    expect(c.ariaElements![0]!.aria[0]).toMatchObject({ name: 'aria-hidden', expression: true });
  });
  it('skips elements with neither role nor aria-*', () => {
    const c = parseComponentFacts('<div class="x"></div>', 'C.svelte');
    expect(c.ariaElements ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Verify FAIL**, then implement: in the template walk of `component-parse.ts` (follow how `checkableBindValues` walks `RegularElement` nodes), for each `RegularElement` inspect `node.attributes`: an `Attribute` named `role` or starting `aria-` with a single-Text value array → literal (`value[0].data`); value `true` (bare attr) → literal `''`; anything else (expression tag, template with expressions) → `expression: true`. Push a fact only when role or ≥1 aria attr found. Lines from `node.start` via the existing line helper the file uses for other facts.
- [ ] **Step 3: Verify PASS**, run the whole core suite, `pnpm typecheck`.
- [ ] **Step 4: Update the `comp(…)` fixture helper** in `packages/core/test/correctness-rules.test.ts`? Not needed — the field is optional; touch nothing.
- [ ] **Step 5: Commit** — `feat(core): extract ariaElements facts for the a11y ARIA rules`

### Task 4: `a11y/invalid-role`

**Files:**

- Create: `packages/core/src/rules/a11y/invalid-role.ts`
- Modify: `packages/core/src/rules/index.ts`, `packages/core/src/index.ts` (registration, 4 places)
- Create: `docs/src/content/docs/rules/a11y/invalid-role.md`, `docs/src/content/docs/ja/rules/a11y/invalid-role.md`
- Test: `packages/core/test/a11y-aria-rules.test.ts` (new file, shared by Tasks 4–7)

**Interfaces:**

- Consumes: `ComponentFacts.ariaElements` (Task 3), `isKnownRole`/`isAbstractRole` (Task 2), `componentRule` engine.
- Produces: exported `a11yInvalidRole: Rule`.

- [ ] **Step 1: Failing tests** (create the file with the `comp`/`ctx` helpers copied from `correctness-rules.test.ts`'s pattern):

```ts
const el = (over: Partial<NonNullable<ComponentFacts['ariaElements']>[number]>) => ({
  tag: 'div',
  line: 3,
  aria: [],
  ...over
});

describe('a11y/invalid-role', () => {
  it('flags an unknown role and an abstract role', async () => {
    const rs = await a11yInvalidRole.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'bogus' } }), el({ role: { literal: 'widget' }, line: 5 })] })])
    );
    expect(fails(rs).map((r) => r.line)).toEqual([3, 5]);
  });
  it('validates every token of a fallback list', async () => {
    const rs = await a11yInvalidRole.check(ctx([comp({ ariaElements: [el({ role: { literal: 'switch bogus' } })] })]));
    expect(fails(rs)).toHaveLength(1);
  });
  it('passes known roles and skips expressions', async () => {
    const rs = await a11yInvalidRole.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'button' } }), el({ role: { expression: true } })] })])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Verify FAIL**, then implement with `componentRule`:

```ts
import { componentRule } from '../component-rule.js';
import { isKnownRole, isAbstractRole } from './aria-data.js';

export const a11yInvalidRole = componentRule({
  id: 'a11y/invalid-role',
  title: 'Invalid ARIA role',
  category: 'a11y',
  label: 'ARIA roles',
  rationale:
    'A role that does not exist in WAI-ARIA (or is abstract, reserved for the spec itself) is ignored or misread by assistive technology, silently breaking the element’s announced semantics.',
  recommendation: 'Use a concrete WAI-ARIA role; abstract roles and typos are ignored by assistive technology.',
  applies: (c) => (c.ariaElements ?? []).some((e) => e.role?.literal !== undefined),
  bad: (c) =>
    (c.ariaElements ?? []).flatMap((e) => {
      const literal = e.role?.literal;
      if (literal === undefined) return [];
      const tokens = literal.split(/\s+/).filter(Boolean);
      const badTokens = tokens.filter((t) => !isKnownRole(t) || isAbstractRole(t));
      if (badTokens.length === 0) return [];
      return [
        {
          line: e.line,
          message: `role="${literal}" on <${e.tag}> is ${isAbstractRole(badTokens[0]!) ? 'an abstract role' : 'not a WAI-ARIA role'}`
        }
      ];
    })
});
```

- [ ] **Step 3: Register in 4 places** (`rules/index.ts` import + `allRules` + re-export; `core/src/index.ts` export list). Grep: `grep -rn "a11yInvalidRole" packages/core/src | wc -l` → 4+ hits.
- [ ] **Step 4: Verify PASS** (`pnpm --filter @svelte-vitals/core test -- a11y-aria-rules`), then full `pnpm build && pnpm test` — **the CLI docs-links / rules-index tests will fail until Step 5–6 are done; that is the expected order.**
- [ ] **Step 5: Write both docs pages.** English (`docs/src/content/docs/rules/a11y/invalid-role.md`) — follow the frontmatter/section shape of `docs/src/content/docs/rules/seo/charset.md` (title, description, "What it checks", "Why it matters", flagged/not-flagged fenced examples, "How to fix"). Content: checks literal `role` attributes against WAI-ARIA; flags unknown tokens (`role="botton"`) and abstract roles (`role="widget"`); does not flag expression-valued roles (`role={x}`) or valid fallback lists (`role="switch checkbox"`). Fix: correct the typo or drop the role. Japanese page mirrors it.
- [ ] **Step 6: Regenerate + stamp**: `pnpm --filter svelte-vitals run gen:rules-index && pnpm format && pnpm --filter docs run translate:stamp docs/src/content/docs/rules/a11y/invalid-role.md`
- [ ] **Step 7: `pnpm test` fully green, commit** — `feat(core): add a11y/invalid-role`

### Task 5: `a11y/unknown-aria-attribute`

Same file set/shape as Task 4 (rule file `unknown-aria-attribute.ts`, tests appended to `a11y-aria-rules.test.ts`, en+ja docs, 4-place registration, regen + stamp).

- [ ] **Step 1: Failing tests**:

```ts
describe('a11y/unknown-aria-attribute', () => {
  it('flags aria-* names not in the spec', async () => {
    const rs = await a11yUnknownAriaAttribute.check(
      ctx([comp({ ariaElements: [el({ aria: [{ name: 'aria-lable', literal: 'x', line: 4 }] })] })])
    );
    expect(fails(rs).map((r) => r.line)).toEqual([4]);
  });
  it('passes known names regardless of value form', async () => {
    const rs = await a11yUnknownAriaAttribute.check(
      ctx([
        comp({
          ariaElements: [
            el({
              aria: [
                { name: 'aria-label', literal: 'x', line: 4 },
                { name: 'aria-hidden', expression: true, line: 5 }
              ]
            })
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement** — `componentRule`; `applies`: any `ariaElements` entry with `aria.length > 0`; `bad`: for each element, each `aria` entry whose `name` fails `isKnownAriaAttribute` → `{ line: a.line, message: `\`${a.name}\` is not a WAI-ARIA attribute` }`. Name check only — the value is irrelevant here (invalid-aria-value owns values), so expression values are still checked by name.
- [ ] **Step 3: Register (4 places), docs en+ja** (flags `aria-lable`; not-flagged: any spec attribute, including with dynamic values), **regen + stamp, verify, commit** — `feat(core): add a11y/unknown-aria-attribute`

### Task 6: `a11y/required-aria-props`

Same file set/shape as Task 4 (rule file `required-aria-props.ts`).

- [ ] **Step 1: Failing tests**:

```ts
describe('a11y/required-aria-props', () => {
  it('flags a role missing its required props', async () => {
    const rs = await a11yRequiredAriaProps.check(
      ctx([comp({ ariaElements: [el({ role: { literal: 'checkbox' } })] })])
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('satisfied by a literal or expression attribute', async () => {
    const rs = await a11yRequiredAriaProps.check(
      ctx([
        comp({
          ariaElements: [
            el({ role: { literal: 'checkbox' }, aria: [{ name: 'aria-checked', expression: true, line: 3 }] })
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('satisfied by host-element native semantics', async () => {
    const rs = await a11yRequiredAriaProps.check(
      ctx([comp({ ariaElements: [el({ tag: 'input', inputType: 'checkbox', role: { literal: 'switch' } })] })])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});
```

The third case needs the host-semantics input type: extend the Task 3 fact with `inputType?: string` (literal `type` attribute of `<input>`, lowercased; add one parse test for it in `component-parse.test.ts`).

- [ ] **Step 2: Implement** — host-semantics table (spec-fixed):

```ts
const HOST_SUPPLIED: Record<string, (e: AriaElementFact) => boolean> = {
  'aria-checked': (e) => e.tag === 'input' && (e.inputType === 'checkbox' || e.inputType === 'radio'),
  'aria-selected': (e) => e.tag === 'option',
  'aria-level': (e) => /^h[1-6]$/.test(e.tag),
  'aria-valuenow': (e) => (e.tag === 'input' && e.inputType === 'range') || e.tag === 'progress' || e.tag === 'meter'
};
```

`bad`: for each element with `role.literal` naming a single known role, `requiredAriaProps(role)` minus props present in `e.aria` (any form) minus props where `HOST_SUPPLIED[prop]?.(e)` → if non-empty, one issue: `role="${role}" on <${tag}> is missing required ${missing.join(', ')}`. Fallback lists (multi-token roles) are skipped — only the first token would apply and the semantics get murky; skip is the false-negative-safe reading.

- [ ] **Step 3: Register, docs en+ja** (flagged: `<div role="checkbox">`; not flagged: `aria-checked` present in any form, `<input type="checkbox" role="switch">` per ARIA-in-HTML host semantics), **regen + stamp, verify, commit** — `feat(core): add a11y/required-aria-props`

### Task 7: `a11y/invalid-aria-value`

Same file set/shape as Task 4 (rule file `invalid-aria-value.ts`).

- [ ] **Step 1: Failing tests**:

```ts
describe('a11y/invalid-aria-value', () => {
  it('flags a boolean aria attribute with a non-boolean literal', async () => {
    const rs = await a11yInvalidAriaValue.check(
      ctx([comp({ ariaElements: [el({ aria: [{ name: 'aria-hidden', literal: 'yes', line: 7 }] })] })])
    );
    expect(fails(rs).map((r) => r.line)).toEqual([7]);
  });
  it('passes valid literals, expressions, and unknown attributes (owned by unknown-aria-attribute)', async () => {
    const rs = await a11yInvalidAriaValue.check(
      ctx([
        comp({
          ariaElements: [
            el({
              aria: [
                { name: 'aria-hidden', literal: 'true', line: 3 },
                { name: 'aria-live', literal: 'polite', line: 4 },
                { name: 'aria-hidden', expression: true, line: 5 },
                { name: 'aria-bogus', literal: 'zzz', line: 6 }
              ]
            })
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('flags an integer type with a non-integer literal', async () => {
    const rs = await a11yInvalidAriaValue.check(
      ctx([comp({ ariaElements: [el({ aria: [{ name: 'aria-colcount', literal: 'many', line: 2 }] })] })])
    );
    expect(fails(rs)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement** — validator over `ariaValueKind(name)` (skip when `undefined`, skip expressions):
  - `'boolean'` → `true|false`; `'tristate'` → `true|false|mixed`; `'token'` → member of `values`; `'tokenlist'` → every whitespace token a member of `values`; `'integer'` → `/^-?\d+$/`; `'number'` → finite `Number(...)`; `'string'`/`'id'`/`'idlist'` → any literal passes.
- [ ] **Step 3: Register, docs en+ja** (flagged: `aria-hidden="yes"`, `aria-live="loud"`; not flagged: expressions, valid tokens), **regen + stamp, verify, commit** — `feat(core): add a11y/invalid-aria-value`

### Task 8: `a11y/interactive-nesting`

**Files:**

- Modify: `packages/core/src/component.ts` + `packages/core/src/component-parse.ts` (fact extraction)
- Create: `packages/core/src/rules/a11y/interactive-nesting.ts` and `packages/core/src/rules/a11y/interactive.ts` (the shared element-set constant)
- Registration + docs en/ja as in Task 4
- Test: `packages/core/test/a11y-element-rules.test.ts` (new, shared by Tasks 8–13) + parse cases in `component-parse.test.ts`

**Interfaces:**

- Produces on `ComponentFacts`: `interactiveNestings?: { containerTag: string; descendantTag: string; line: number }[]` (line = the descendant's).
- Produces: `packages/core/src/rules/a11y/interactive.ts` exporting `isInteractiveElement(tag: string, attrs: { name: string; literal?: string; expression?: boolean }[]): boolean` — true for `a` with `href` present, `button`, `input` (literal `type` ≠ `hidden`), `select`, `textarea`, `summary`, `audio`/`video` with `controls`, `embed`, `iframe`, literal `tabindex` ≥ 0, literal interactive role (`button`, `link`, `checkbox`, `radio`, `switch`, `tab`, `menuitem`, `menuitemcheckbox`, `menuitemradio`, `option`, `slider`, `spinbutton`, `textbox`, `combobox`, `searchbox`, `scrollbar`, `gridcell`).

- [ ] **Step 1: Failing parse tests** (`component-parse.test.ts`):

```ts
describe('parseComponentFacts — interactiveNestings (a11y/interactive-nesting)', () => {
  it('flags a button inside a link, at the descendant line', () => {
    const c = parseComponentFacts('<a href="/x">\n  <button>Go</button>\n</a>', 'C.svelte');
    expect(c.interactiveNestings).toEqual([{ containerTag: 'a', descendantTag: 'button', line: 2 }]);
  });
  it('ignores tabindex="-1" descendants and href-less <a>', () => {
    const c = parseComponentFacts('<a href="/x"><span tabindex="-1">x</span></a><a><button>y</button></a>', 'C.svelte');
    expect(c.interactiveNestings ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement extraction** — during the template walk, keep a stack of enclosing interactive containers (only `a`-with-`href`, `button`, or literal-interactive-`role` elements open a container per the spec); on entering any interactive element while the stack is non-empty, record one fact. Then the rule itself is a trivial `componentRule` (`applies`: field non-empty; `bad`: one issue per fact, message `` `<${f.descendantTag}> is nested inside interactive <${f.containerTag}>` ``, rationale: nested interactive controls are unreachable/misannounced by keyboard and assistive tech and violate the HTML content model).
- [ ] **Step 3: Rule tests** (in `a11y-element-rules.test.ts`, same `comp`/`ctx` helpers): facts → 1 fail; empty → 0.
- [ ] **Step 4: Register, docs en+ja** (flagged: `<a href>` containing `<button>`; not flagged: `tabindex="-1"`, href-less `<a>`; note the cross-component variant is a recorded non-goal), **regen + stamp, verify, commit** — `feat(core): add a11y/interactive-nesting`

### Task 9: `a11y/accessible-name`

Same file set/shape as Task 8 (rule file `accessible-name.ts`).

**Interfaces** — produces on `ComponentFacts`: `unnamedInteractive?: { tag: string; line: number }[]` — extraction implements the spec's conservative name computation.

- [ ] **Step 1: Failing parse tests**:

```ts
describe('parseComponentFacts — unnamedInteractive (a11y/accessible-name)', () => {
  it('flags an empty button and an icon-only link without alt', () => {
    const c = parseComponentFacts('<button></button>\n<a href="/x"><img src="i.png" /></a>', 'C.svelte');
    expect(c.unnamedInteractive).toEqual([
      { tag: 'button', line: 1 },
      { tag: 'a', line: 2 }
    ]);
  });
  it('accepts text, aria-label (any form), title, img alt, input[type=image] alt, and skips unknowable content', () => {
    const src = [
      '<button>Save</button>',
      '<button aria-label={l}></button>',
      '<button title="t"></button>',
      '<a href="/x"><img src="i.png" alt="Home" /></a>',
      '<input type="image" alt="Search" />',
      '<button>{icon}</button>',
      '<button><Icon /></button>'
    ].join('\n');
    expect(parseComponentFacts(src, 'C.svelte').unnamedInteractive ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement extraction** — targets: `button`, `a` with `href`, `input` with literal `type="image"`. Name sources (any → named): non-whitespace text descendant; `aria-label`/`aria-labelledby`/`title` attribute (literal non-empty or expression); descendant `img` with non-empty literal `alt`; for `input[type=image]`, its own non-empty literal `alt`. Unknowable (→ skip, emit nothing): any expression-tag child, `Component` child, `{@render}`/`{@html}` child, or spread attribute on the element.
- [ ] **Step 3: Rule** (`componentRule`, message `` `<${f.tag}> has no accessible name` ``), rule tests, register, docs en+ja, regen + stamp, verify, commit — `feat(core): add a11y/accessible-name`

### Task 10: `a11y/label-has-control`

Same file set/shape as Task 8 (rule file `label-has-control.ts`).

**Interfaces** — produces on `ComponentFacts`: `unassociatedLabels?: { line: number }[]`.

- [ ] **Step 1: Failing parse tests**:

```ts
describe('parseComponentFacts — unassociatedLabels (a11y/label-has-control)', () => {
  it('flags a label with neither for nor a labelable descendant', () => {
    expect(parseComponentFacts('<label>Name</label>', 'C.svelte').unassociatedLabels).toEqual([{ line: 1 }]);
  });
  it('accepts for=, a wrapped control, and skips unknowable children', () => {
    const src = ['<label for="n">Name</label>', '<label>Name <input /></label>', '<label><Field /></label>'].join('\n');
    expect(parseComponentFacts(src, 'C.svelte').unassociatedLabels ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement** — labelable set: `input` (not literal `type="hidden"`), `select`, `textarea`, `button`, `meter`, `output`, `progress`. `for` present in any form → associated. Component/expression/`{@render}` children → skip. Rule via `componentRule` (message `<label> has no associated control`), tests, register, docs en+ja, regen + stamp, verify, commit — `feat(core): add a11y/label-has-control`

### Task 11: `a11y/use-list` (severity `info`)

Same file set/shape as Task 8 (rule file `use-list.ts`).

**Interfaces** — produces on `ComponentFacts`: `bulletTexts?: { line: number; char: string }[]`.

- [ ] **Step 1: Failing parse tests**:

```ts
describe('parseComponentFacts — bulletTexts (a11y/use-list)', () => {
  it('flags text nodes starting with a bullet character', () => {
    const c = parseComponentFacts('<p>• one</p>\n<p>・ two</p>\n<p>- three</p>\n<p>* four</p>', 'C.svelte');
    expect(c.bulletTexts!.map((b) => b.char)).toEqual(['•', '・', '-', '*']);
  });
  it('ignores text inside li and bullet chars mid-text', () => {
    const c = parseComponentFacts('<ul><li>• fine</li></ul>\n<p>a - b</p>', 'C.svelte');
    expect(c.bulletTexts ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement** — Text nodes whose trimmed content starts with one of `•`, `・`, `·`, `-`, `*` **followed by whitespace** (avoids flagging `-webkit` prose or signed numbers); skip when an ancestor in this file is `li`. Rule via `componentRule` with `severity: 'info'` (message `Text starts with a bullet character ('${char}') — use a list element`), tests, register, docs en+ja, regen + stamp, verify, commit — `feat(core): add a11y/use-list`

### Task 12: `a11y/placeholder-label-option`

Same file set/shape as Task 8 (rule file `placeholder-label-option.ts`).

**Interfaces** — produces on `ComponentFacts`: `selectsMissingPlaceholder?: { line: number }[]`.

- [ ] **Step 1: Failing parse tests**:

```ts
describe('parseComponentFacts — selectsMissingPlaceholder (a11y/placeholder-label-option)', () => {
  it('flags <select required> whose first option is not a placeholder', () => {
    const c = parseComponentFacts('<select required><option value="a">A</option></select>', 'C.svelte');
    expect(c.selectsMissingPlaceholder).toEqual([{ line: 1 }]);
  });
  it('accepts a placeholder first option, and ignores multiple/size>1/non-required selects', () => {
    const src = [
      '<select required><option value="">Choose…</option><option value="a">A</option></select>',
      '<select required multiple><option value="a">A</option></select>',
      '<select required size="3"><option value="a">A</option></select>',
      '<select><option value="a">A</option></select>'
    ].join('\n');
    expect(parseComponentFacts(src, 'C.svelte').selectsMissingPlaceholder ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement** — condition per HTML spec: `required` present, no `multiple`, literal `size` absent or ≤ 1; first `option` element child must have literal `value=""` (or no `value` and empty text). Expression `value`/component children/`{#each}` producing options → skip. Rule, tests, register, docs en+ja, regen + stamp, verify, commit — `feat(core): add a11y/placeholder-label-option`

### Task 13: `a11y/require-datetime`

Same file set/shape as Task 8 (rule file `require-datetime.ts`).

**Interfaces** — produces on `ComponentFacts`: `timesMissingDatetime?: { line: number; text: string }[]`.

- [ ] **Step 1: Failing parse tests**:

```ts
describe('parseComponentFacts — timesMissingDatetime (a11y/require-datetime)', () => {
  it('flags <time> whose literal text is not machine-readable and lacks datetime', () => {
    const c = parseComponentFacts('<time>last Tuesday</time>', 'C.svelte');
    expect(c.timesMissingDatetime).toEqual([{ line: 1, text: 'last Tuesday' }]);
  });
  it('accepts a datetime attr, machine-readable text, or dynamic content', () => {
    const src = ['<time datetime="2026-08-14">last Tuesday</time>', '<time>2026-08-14</time>', '<time>{d}</time>'].join(
      '\n'
    );
    expect(parseComponentFacts(src, 'C.svelte').timesMissingDatetime ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement** — only `<time>` whose children are pure Text (any expression → skip) and with no `datetime` attribute in any form. "Machine-readable" literal check (subset of the HTML time formats, permissive on purpose): `/^\d{4}(-\d{2}){0,2}$/` (year/month/date), `/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/` (time), `/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/` (datetime), `/^\d{2}-\d{2}$/` (yearless), `/^P/i` (duration). Anything matching → fine without `datetime`. Rule, tests, register, docs en+ja, regen + stamp, verify, commit — `feat(core): add a11y/require-datetime`

### Task 14: `a11y/doctype` (project-scoped)

**Files:**

- Modify: `packages/core/src/types.ts` (`Project` gains `appHtmlDoctype?: boolean`)
- Modify: `packages/cli/src/providers/source/project.ts` (set it from the existing `src/app.html` read)
- Create: `packages/core/src/rules/a11y/doctype.ts`
- Registration + docs en/ja as in Task 4
- Test: `packages/core/test/a11y-element-rules.test.ts` (rule) + `packages/cli/test/project.test.ts`-equivalent (find the test file covering `collectProjectFacts` — `grep -rln collectProjectFacts packages/cli/test`)

**Interfaces:**

- Produces on `Project`: `appHtmlDoctype?: boolean` — `true`/`false` when `src/app.html` was read, absent when it wasn't (rule stays silent then, like `viteMinifyDisabled`'s absent convention).

- [ ] **Step 1: Failing rule test**:

```ts
describe('a11y/doctype', () => {
  const projCtx = (p: Partial<Project>): RuleContext => ({ heads: [], config, project: { ...defaultProject, ...p } });
  it('flags a missing doctype, passes a present one, silent when unknown', async () => {
    expect(fails(await a11yDoctype.check(projCtx({ appHtmlDoctype: false })))).toHaveLength(1);
    expect(fails(await a11yDoctype.check(projCtx({ appHtmlDoctype: true })))).toHaveLength(0);
    expect(await a11yDoctype.check(projCtx({}))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement rule** — hand-written project-scope rule (mirror `seo/robots-txt`'s shape): `scope: 'project'`, PENALIZED result `location: 'src/app.html'`, message `src/app.html is missing <!doctype html>`, fix snippet `<!doctype html>` (`lang: 'html'`), rationale: without a doctype browsers render in quirks mode, breaking CSS and accessibility tree behavior.
- [ ] **Step 3: Provider** — in `project.ts` where app.html content is already read for `htmlLang`, add: `appHtmlDoctype: /^\s*(<!--[\s\S]*?-->\s*)*<!doctype\s+html/i.test(content)`; absent when the file was unreadable. Add a provider test (doctype present / missing / no app.html).
- [ ] **Step 4: Verify `packages/cli/test/io-budget.test.ts` still passes unchanged** (spec: zero new reads).
- [ ] **Step 5: Register, docs en+ja, regen + stamp, verify all, commit** — `feat(core): add a11y/doctype` + `feat(cli): collect app.html doctype presence`

### Task 15: CLI parse — branch-context a11y occurrences

**Files:**

- Modify: `packages/cli/src/providers/source/parse.ts` (`ParsedFile` gains `a11y`)
- Test: `packages/cli/test/parse.test.ts` (find the existing `parseFile` test file: `grep -rln "parseFile" packages/cli/test`; add a describe block)

**Interfaces:**

- Produces on `ParsedFile` (consumed by Task 16's fold):

```ts
export interface BranchStep {
  /** index of the {#if}/{#await} block among this file's blocks (document order) */
  group: number;
  /** branch index within the group (if: 0..n consequent→else; await: 0=pending,1=then,2=catch) */
  branch: number;
}
export interface A11yNode {
  kind: 'landmark' | 'id' | 'idref' | 'component';
  /** landmark → 'main'|'banner'|'contentinfo'|'complementary'; id/idref → the literal id; component → component name */
  key: string;
  line: number;
  /** inside {#each} body or {#snippet} definition at any depth (excluded from duplication counting) */
  repeatable: boolean;
  /** branch address from template root (empty = unconditional) */
  path: BranchStep[];
  /** for kind 'idref': the referencing attribute ('for', 'aria-labelledby', …, 'href') */
  attr?: string;
  /** for kind 'landmark': the landmark ancestor element within this file, if any */
  inLandmark?: string;
  /** for kind 'landmark' from <header>/<footer>: nested inside sectioning content (article/aside/nav/section) in this file */
  inSectioning?: boolean;
  /** for kind 'landmark' from <header>/<footer>: at template top level in this file */
  topLevel?: boolean;
}
export interface ParsedA11y {
  nodes: A11yNode[];
  /** landmark ancestor of this file's <slot>/{@render children()} position, if any */
  slotInLandmark?: string;
  /** file contains {@html} or a spread attribute — poisons the closed world for no-missing-id-ref */
  unknowableContent: boolean;
}
```

Landmark mapping: `<main>` → `main`; `role="main"|"banner"|"contentinfo"|"complementary"` (literal) → that kind; `<header>`/`<footer>` → `banner`/`contentinfo` with `topLevel`/`inSectioning` set. `id` nodes: literal `id` attributes. `idref` nodes: literal `for`, `aria-labelledby`/`aria-describedby`/`aria-controls`/`aria-activedescendant` (each whitespace token → one node), and `href="#x"` (strip `#`). `component` nodes: every `Component` usage (name as key).

- [ ] **Step 1: Failing tests**:

```ts
describe('parseFile — a11y occurrences', () => {
  it('assigns branch paths inside {#if}/{:else} and marks {#each} content repeatable', async () => {
    const src = '{#if a}<main />{:else}<main />{/if}{#each xs as x}<div id="dup" />{/each}';
    const parsed = await parseIt(src); // use the file's existing parseFile invocation helper
    const mains = parsed.a11y.nodes.filter((n) => n.kind === 'landmark' && n.key === 'main');
    expect(mains.map((n) => n.path)).toEqual([[{ group: 0, branch: 0 }], [{ group: 0, branch: 1 }]]);
    const id = parsed.a11y.nodes.find((n) => n.kind === 'id');
    expect(id).toMatchObject({ key: 'dup', repeatable: true });
  });
  it('collects idrefs, component uses with paths, slot landmark context, and unknowable content', async () => {
    const src = '<main><label for="n" /><slot /></main>{#if b}<Shell />{/if}{@html raw}';
    const parsed = await parseIt(src);
    expect(parsed.a11y.nodes).toContainEqual(
      expect.objectContaining({ kind: 'idref', key: 'n', attr: 'for', inLandmark: 'main' })
    );
    expect(parsed.a11y.nodes).toContainEqual(
      expect.objectContaining({ kind: 'component', key: 'Shell', path: [{ group: 0, branch: 0 }] })
    );
    expect(parsed.a11y.slotInLandmark).toBe('main');
    expect(parsed.a11y.unknowableContent).toBe(true);
  });
});
```

- [ ] **Step 2: Implement** — a dedicated recursive walk of the already-parsed template AST inside `parseFile` (the AST is in scope there before it's discarded — do NOT re-parse), threading `{path, repeatable, landmarkStack, sectioningDepth}` context down. `{#if}`: allocate a group id, walk `consequent` with `branch: 0`, chained `alternate` if-blocks/else with 1..n. `{#await}`: pending/then/catch = 0/1/2. `{#each}`/`{#snippet}`: set `repeatable`. `{@render children(…)}` and `<slot>` set `slotInLandmark` from the landmark stack. `{@html}` or any `SpreadAttribute` → `unknowableContent = true`.
- [ ] **Step 3: Verify PASS, full cli suite + io-budget green** (same single parse), commit — `feat(cli): extract branch-context a11y occurrences in parseFile`

### Task 16: Core boundary + branch-aware fold + source collection

**Files:**

- Create: `packages/core/src/a11y.ts` (boundary types + the pure fold helpers)
- Modify: `packages/core/src/rule.ts` (`RuleContext` gains `a11y?: ResolvedA11y[]`), `packages/core/src/index.ts` (export types + helpers)
- Modify: `packages/cli/src/providers/source/routes.ts` (build `ResolvedA11y` per route), `packages/cli/src/collect-all.ts` (thread it into the ctx — follow exactly how `headings` flows)
- Test: `packages/core/test/a11y-fold.test.ts` (pure fold), `packages/cli/test` composition test (add to the file that tests route composition — `grep -rln componentHeadings packages/cli/test`)

**Interfaces:**

- Produces (in `packages/core/src/a11y.ts` — core-pure, no I/O):

```ts
export interface A11yOccurrenceInfo {
  file: string;
  line: number;
}
export interface ResolvedA11y {
  route: string;
  /** representatives per landmark kind after the branch-aware fold ('main' | 'banner' | 'contentinfo' | 'complementary') */
  landmarks: Record<string, A11yOccurrenceInfo[]>;
  /** landmark occurrences nested inside another landmark after composition */
  nestedLandmarks: { kind: string; within: string; file: string; line: number }[];
  /** representatives per literal id */
  ids: Record<string, A11yOccurrenceInfo[]>;
  /** literal id references */
  idRefs: { id: string; attr: string; file: string; line: number }[];
  /** optimistic candidates: every literal id anywhere (all branches, each/snippet bodies, components, app.html) */
  idCandidates: string[];
  /** closed world holds: every component resolved, no depth truncation, no {@html}/spread, no dynamic id */
  fullyResolved: boolean;
}
export function foldOccurrences<
  T extends { key: string; path: { group: number; branch: number }[]; repeatable: boolean }
>(nodes: T[]): Map<string, T[]>;
```

`foldOccurrences` — the spec's normative algorithm, per key: drop `repeatable` nodes; recursively, occurrences with empty `path` contribute directly (sum); occurrences sharing a leading `{group}` fold per `branch` recursively and the group contributes **the branch with the most occurrences for that key** (tie → lowest branch index), and those occurrences are the group's representatives. The returned map's lists are the representatives; `count === list.length` always.

- [ ] **Step 1: Failing fold tests** (pure, in core):

```ts
describe('foldOccurrences (branch-aware, spec Control-flow semantics)', () => {
  const n = (key: string, path: BranchStep[] = [], repeatable = false, line = 1) => ({ key, path, repeatable, line });
  it('sums within a branch, maxes across branches, per key', () => {
    // witness A: two same-key nodes in one branch → both representatives
    expect(
      foldOccurrences([n('x', [{ group: 0, branch: 0 }]), n('x', [{ group: 0, branch: 0 }])]).get('x')
    ).toHaveLength(2);
    // exclusive branches: one per branch → max 1
    expect(
      foldOccurrences([n('m', [{ group: 0, branch: 0 }]), n('m', [{ group: 0, branch: 1 }])]).get('m')
    ).toHaveLength(1);
    // witness B: branch 1 has one, branch 2 has two → the max branch's occurrences are the representatives
    const r = foldOccurrences([
      n('m', [{ group: 0, branch: 0 }], false, 1),
      n('m', [{ group: 0, branch: 1 }], false, 2),
      n('m', [{ group: 0, branch: 1 }], false, 3)
    ]);
    expect(r.get('m')!.map((o) => o.line)).toEqual([2, 3]);
  });
  it('adds unconditional occurrences to the selected branch max', () => {
    const r = foldOccurrences([n('m'), n('m', [{ group: 0, branch: 0 }]), n('m', [{ group: 0, branch: 1 }])]);
    expect(r.get('m')).toHaveLength(2);
  });
  it('drops repeatable occurrences and handles nested groups', () => {
    expect(foldOccurrences([n('x', [], true)]).get('x') ?? []).toHaveLength(0);
    const nested = foldOccurrences([
      n('m', [
        { group: 0, branch: 0 },
        { group: 1, branch: 0 }
      ]),
      n('m', [
        { group: 0, branch: 0 },
        { group: 1, branch: 1 }
      ])
    ]);
    expect(nested.get('m')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement `foldOccurrences`, verify PASS.**
- [ ] **Step 3: Source collection in `routes.ts`** — beside the `headings` assembly, build per route:
  - Recursive contribution of a file = its own non-component nodes, plus for each `component` node: resolved (existing resolver map) → the component file's contribution with the component node's `path` **prepended** (group ids offset per instantiation to stay unique) and `repeatable` OR-ed in; unresolved/adapter/meta/depth-truncated → mark `fullyResolved = false`, contribute nothing.
  - Landmarks/ids: run `foldOccurrences` over the composed nodes → `landmarks`/`ids` representative maps (transitive-component `<header>`/`<footer>` nodes are dropped before the fold per spec — only chain files contribute those, and only `topLevel` ones).
  - `nestedLandmarks`: chain-file landmark nodes with `inLandmark` set, plus page-side top-level landmark kinds when the layout's `slotInLandmark` is set (kind ∈ banner/main/complementary/contentinfo).
  - `idCandidates`: every `id` node key (repeatable and all branches included) + component contributions + `Project` app.html ids (extend the `project.ts` app.html handling with `appHtmlIds: string[]` — literal `id="…"` regex over the same already-read content; wire it through the fold call site).
  - `idRefs`: all `idref` nodes of chain + resolved components (skip repeatable? No — a ref inside `{#each}` still needs its target; keep them).
  - `fullyResolved`: no unresolved component anywhere, no `unknowableContent` in any composed file, no dynamic id (an `id` attribute with an expression value — have Task 15 emit kind `'id'` with `key: ''` for expression ids; `'' in keys` → not fully resolved and excluded from candidates/duplication).
- [ ] **Step 4: Wire `a11y: ResolvedA11y[]` through `collect-all.ts` into the rule ctx** (mirror `headings` exactly), and through `RuleContext`.
- [ ] **Step 5: CLI composition test** — fixture-driven: layout with `<main>` + page with `<main>` → two representatives; layout `<label for="x">` + page `<div id="x">` → candidate satisfies; a route importing an unresolvable component → `fullyResolved: false`.
- [ ] **Step 6: `pnpm build && pnpm test` (io-budget must be unchanged), commit** — `feat(core): a11y route boundary and branch-aware fold` + `feat(cli): compose per-route a11y occurrences`

### Task 17: `a11y/duplicate-landmark`

**Files:**

- Create: `packages/core/src/rules/a11y/duplicate-landmark.ts`
- Registration + docs en/ja as in Task 4
- Test: `packages/core/test/a11y-route-rules.test.ts` (new, shared by Tasks 17–20)

**Interfaces:** consumes `ctx.a11y` (`ResolvedA11y[]`, Task 16). Produces `a11yDuplicateLandmark: Rule` (`scope: 'route'`).

- [ ] **Step 1: Failing tests** — hand-built `ResolvedA11y` fixtures with two helpers at the top of the new test file (`config`/`fails` copied from `correctness-rules.test.ts`'s pattern):

```ts
const ra = (over: Partial<ResolvedA11y>): ResolvedA11y => ({
  route: '/',
  landmarks: {},
  nestedLandmarks: [],
  ids: {},
  idRefs: [],
  idCandidates: [],
  fullyResolved: true,
  ...over
});
const ctxA11y = (a11y: ResolvedA11y[]): RuleContext => ({ heads: [], project: defaultProject, config, a11y });
```

```ts
describe('a11y/duplicate-landmark', () => {
  it('one finding per surplus representative, located at it', async () => {
    const rs = await a11yDuplicateLandmark.check(
      ctxA11y([
        ra({
          landmarks: {
            main: [
              { file: 'src/routes/+layout.svelte', line: 2 },
              { file: 'src/routes/+page.svelte', line: 5 }
            ]
          }
        })
      ])
    );
    const f = fails(rs);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ location: 'src/routes/+page.svelte', line: 5, route: '/' });
  });
  it('PASS with one main, nothing with zero landmarks', async () => {
    const one = await a11yDuplicateLandmark.check(ctxA11y([ra({ landmarks: { main: [{ file: 'f', line: 1 }] } })]));
    expect(one).toHaveLength(1);
    expect(fails(one)).toHaveLength(0);
    expect(await a11yDuplicateLandmark.check(ctxA11y([ra({})]))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement** — hand-written route rule shaped like `seoHeadingLevelSkip`: for each route, for each of `main`/`banner`/`contentinfo`, representatives beyond the first → PENALIZED per occurrence (message `` `Duplicate ${kind} landmark (${i + 1} of ${n})` ``, location/line = the occurrence); if any landmark kind present and no surplus → one PASS at the first occurrence's file; zero occurrences → emit nothing (spec Findings section).
- [ ] **Step 3: Tests PASS, register, docs en+ja** (call out cross-component detection and the by-design source/rendered divergence), **regen + stamp, verify, commit** — `feat(core): add a11y/duplicate-landmark`

### Task 18: `a11y/top-level-landmark`

Same file set/shape as Task 17 (rule file `top-level-landmark.ts`).

- [ ] **Step 1: Failing tests** — `nestedLandmarks: [{ kind: 'complementary', within: 'main', file: 'src/routes/+page.svelte', line: 9 }]` → one fail located there, message `` `${kind} landmark is nested inside ${within}` ``; empty `nestedLandmarks` **with** some landmark present → PASS; no landmarks at all → nothing.
- [ ] **Step 2: Implement, register, docs en+ja** (banner/main/complementary/contentinfo must be top-level; the layout-`<main>`-wraps-page case is the flagship example), **regen + stamp, verify, commit** — `feat(core): add a11y/top-level-landmark`

### Task 19: `a11y/id-duplication`

Same file set/shape as Task 17 (rule file `id-duplication.ts`).

- [ ] **Step 1: Failing tests** — `ids: { x: [{file:'a',line:1},{file:'b',line:2}] }` → 1 fail at `b:2`; single-occurrence ids → PASS; empty `ids` → nothing.
- [ ] **Step 2: Implement** (same surplus-representative emission as Task 17, message `` `Duplicate id "${id}"` ``), register, docs en+ja (note `{#each}` exclusion + rendered-mode catch), regen + stamp, verify, commit — `feat(core): add a11y/id-duplication`

### Task 20: `a11y/no-missing-id-ref`

Same file set/shape as Task 17 (rule file `no-missing-id-ref.ts`).

- [ ] **Step 1: Failing tests** — `fullyResolved: true, idRefs: [{ id: 'ghost', attr: 'for', file: 'f', line: 3 }], idCandidates: []` → 1 fail (message `` `for="ghost" references a missing id` ``); candidate present → PASS; `fullyResolved: false` → **nothing** (not PASS); zero `idRefs` on a fully resolved route → nothing.
- [ ] **Step 2: Implement, register, docs en+ja** — the docs MUST state the narrow applicability honestly (runs only on fully statically resolvable routes; a library component anywhere in the chain skips the route) per spec. Regen + stamp, verify, commit — `feat(core): add a11y/no-missing-id-ref`

### Task 21: Rendered-mode collection (vite)

**Files:**

- Modify: `packages/vite/src/providers/rendered/collect.ts` (+ its HTML parser module, `parse-html.ts` beside it) — build `ResolvedA11y` per route from prerendered HTML
- Test: the vite package's rendered-collect test file (`grep -rln "headings" packages/vite/test` and extend it)

**Interfaces:** consumes/produces the same `ResolvedA11y` boundary; rendered mode has no source files → every occurrence's `file` is the prerendered HTML path the collector already uses for headings, `line: 0`.

- [ ] **Step 1: Failing test** — an HTML fixture with two `<main>` elements and a duplicate `id` yields `landmarks.main` length 2 and `ids.dup` length 2; `<label for="x">` with no `id="x"` anywhere and no dynamic markers → `idRefs` carries it and `fullyResolved: true` (rendered output IS the closed world — include app-shell ids naturally since they are in the document).
- [ ] **Step 2: Implement** — extend the existing HTML scan: `<main`, `role="…"` for landmark kinds; `header`/`footer` at top level of `<body>` (rendered nesting is directly visible — compute `nestedLandmarks` from actual ancestor landmarks); `id="…"`/idref attributes verbatim. No fold needed — the DOM already collapsed control flow.
- [ ] **Step 3: Wire into the vite ctx beside `headings`, run vite tests** (`pnpm --filter @svelte-vitals/vite test`), including both divergence directions from the spec Testing section (an `{#each}`-duplicated id fires here; a branch-combination duplicate does not).
- [ ] **Step 4: Commit** — `feat(vite): collect rendered-mode a11y landmarks and ids`

### Task 22: e2e, category-prose sweep, changesets, final verify

**Files:**

- Modify: `packages/cli/test/run.test.ts` (or the current e2e file) + `packages/cli/test/fixtures/basic-project/` (one route with an a11y finding)
- Modify: `AGENTS.md` ("five categories" sentence), `README.md`, docs-site prose listing categories (en + ja; `grep -rn "Security, Architecture" README.md AGENTS.md docs/src/content/docs | grep -v rules/`)
- Create: `.changeset/*.md` × 3

**Steps:**

- [ ] **Step 1: e2e** — fixture route (e.g. a `+page.svelte` with `<div role="bogus">`) produces a finding under `categories.a11y` in the json report; existing category counts stay stable. Run the cli suite.
- [ ] **Step 2: Category-prose sweep** — update every enumeration of the five categories to six (AGENTS.md, README, docs pages en+ja); `translate:stamp` each touched en docs page after updating its ja pair. No rule counts anywhere.
- [ ] **Step 3: Changesets** — `@svelte-vitals/core` minor: new `a11y` category + rules + `aria-query` dependency, **explicitly stating the combined Health score composition changes (a sixth category enters the average, so existing projects' Health numbers shift on upgrade with no code change on their side)**. `svelte-vitals` minor: a11y collection (source mode) + `app.html` doctype/id facts. `@svelte-vitals/vite` minor: rendered-mode landmark/id collection.
- [ ] **Step 4: Full verify** — `pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm check:publish && pnpm smoke` (smoke needs the fresh build; nothing new may enter the smoke's dependency set).
- [ ] **Step 5: Commit** — `feat(core): ship the Accessibility category` (sweep + changesets + e2e may be one commit or split per file scope; keep conventional prefixes).
