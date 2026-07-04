# Vite Component-Scoped Rule Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@svelte-vitals/vite`'s build mode the 10 component-scoped rules it's currently missing (CORRECT001–004, SEC001–002, ARCH001–002, PERF009–010) by extracting the CLI's `.svelte`-source parser into `@svelte-vitals/core` and adding a thin file-scanning collector to the vite package.

**Architecture:** `parseComponentFacts` (~280 lines of `svelte/compiler` AST-walking) and a small bucket of generic AST utilities it shares with the CLI's SEO parser move from `packages/cli/src/providers/source/parse.ts` into two new pure modules in `@svelte-vitals/core`. The CLI's existing glob-and-read wrapper (`collectComponentFacts`) is updated to call the relocated function; a new, much smaller glob-and-read wrapper is added to `@svelte-vitals/vite` (no `Runtime` abstraction needed — vite always runs in Node) and wired into `analyze()`'s `RuleContext`.

**Tech Stack:** TypeScript, `svelte/compiler`, `tinyglobby`, vitest, pnpm workspaces (`@svelte-vitals/core`, `@svelte-vitals/vite`, `svelte-vitals` CLI package).

**Branch:** `vite-component-rules` (already checked out; work happens here).

## Global Constraints

- `@svelte-vitals/core` must stay free of `node:` imports, I/O, and runtime-specific globals (its own `index.ts` header comment: "No `node:` imports, no I/O, no runtime-specific globals"). `svelte/compiler`'s `parse()` is a pure string→AST function and does not violate this.
- No behavior change anywhere in the CLI package (`svelte-vitals`) from this refactor — only import paths and file locations move. Every existing CLI/core test's assertions stay exactly as they are; only their import lines change.
- The new vite-side collector does **not** use the `Runtime` abstraction — implement it directly with `tinyglobby` + `node:fs/promises` (both patterns already used elsewhere in `packages/vite/src`).
- The 10 newly-covered rules are **enabled by default** in vite's build mode — no new opt-in flag.
- Dev overlay is explicitly **out of scope** — it stays SEO/Performance-only; only vite's build-mode `analyze()` gets the new coverage.
- `packages/vite/src/plugin.ts` needs **no changes** — `closeBundle`'s existing call into `analyze()` picks up the new coverage automatically.

---

## Task 1: Extract shared Svelte-AST utilities into `@svelte-vitals/core`

**Files:**
- Create: `packages/core/src/svelte-ast.ts`
- Test: `packages/core/test/svelte-ast.test.ts`

**Interfaces:**
- Produces: `CHILD_NODE_KEYS: string[]`, `valueFromNodes(nodes) => Value`, `textFromNodes(nodes) => string | undefined`, `attrText(attributes, name) => string | undefined`, `attrValue(attributes, name) => Value`, `lineOf(source, offset) => number`, `findAttr(attributes, name) => Node | undefined`, `attrValueOf(attr) => Value`, `attrTextOf(attr) => string | undefined` — all moved verbatim from `packages/cli/src/providers/source/parse.ts`, unchanged signatures/behavior. `Value` is consumed from `./types.js` (already in core).

This task only adds a new, self-contained file to core — nothing else in the repo references it yet, so nothing else changes.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/svelte-ast.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  valueFromNodes,
  textFromNodes,
  attrText,
  attrValue,
  lineOf,
  findAttr,
  attrValueOf,
  attrTextOf
} from '../src/svelte-ast.js';

describe('valueFromNodes', () => {
  it('is dynamic when any node is an ExpressionTag', () => {
    expect(valueFromNodes([{ type: 'ExpressionTag' }])).toBe('dynamic');
  });
  it('is static when there is non-whitespace text', () => {
    expect(valueFromNodes([{ type: 'Text', data: 'hello' }])).toBe('static');
  });
  it('is absent when empty or whitespace-only', () => {
    expect(valueFromNodes([])).toBe('absent');
    expect(valueFromNodes([{ type: 'Text', data: '   ' }])).toBe('absent');
  });
  it('is absent for a non-array', () => {
    expect(valueFromNodes(undefined as unknown as never[])).toBe('absent');
  });
});

describe('textFromNodes', () => {
  it('returns the literal text when fully static', () => {
    expect(textFromNodes([{ type: 'Text', data: 'hello' }])).toBe('hello');
  });
  it('returns undefined when any node is an ExpressionTag', () => {
    expect(textFromNodes([{ type: 'ExpressionTag' }])).toBeUndefined();
  });
  it('returns undefined for whitespace-only text', () => {
    expect(textFromNodes([{ type: 'Text', data: '  ' }])).toBeUndefined();
  });
});

describe('findAttr', () => {
  it('finds an attribute by name', () => {
    const attrs = [{ type: 'Attribute', name: 'href', value: true }];
    expect(findAttr(attrs, 'href')).toBe(attrs[0]);
  });
  it('returns undefined when absent', () => {
    expect(findAttr([{ type: 'Attribute', name: 'href', value: true }], 'src')).toBeUndefined();
  });
  it('returns undefined for a non-array', () => {
    expect(findAttr(undefined as unknown as never[], 'href')).toBeUndefined();
  });
});

describe('attrText', () => {
  it('returns the literal string of a static attribute', () => {
    const attrs = [{ type: 'Attribute', name: 'name', value: [{ type: 'Text', data: 'description' }] }];
    expect(attrText(attrs, 'name')).toBe('description');
  });
  it('returns empty string for a boolean attribute', () => {
    const attrs = [{ type: 'Attribute', name: 'disabled', value: true }];
    expect(attrText(attrs, 'disabled')).toBe('');
  });
  it('returns undefined for a dynamic attribute', () => {
    const attrs = [{ type: 'Attribute', name: 'name', value: { type: 'ExpressionTag' } }];
    expect(attrText(attrs, 'name')).toBeUndefined();
  });
  it('returns undefined when the attribute is absent', () => {
    expect(attrText([], 'name')).toBeUndefined();
  });
});

describe('attrValue', () => {
  it('is dynamic for content={expr}', () => {
    const attrs = [{ type: 'Attribute', name: 'content', value: { type: 'ExpressionTag' } }];
    expect(attrValue(attrs, 'content')).toBe('dynamic');
  });
  it('is static for a literal content', () => {
    const attrs = [{ type: 'Attribute', name: 'content', value: [{ type: 'Text', data: 'hi' }] }];
    expect(attrValue(attrs, 'content')).toBe('static');
  });
  it('is absent when the attribute is missing or boolean', () => {
    expect(attrValue([], 'content')).toBe('absent');
    expect(attrValue([{ type: 'Attribute', name: 'content', value: true }], 'content')).toBe('absent');
  });
});

describe('attrValueOf / attrTextOf', () => {
  it('attrValueOf mirrors attrValue for a single attribute node', () => {
    expect(attrValueOf({ value: { type: 'ExpressionTag' } })).toBe('dynamic');
    expect(attrValueOf({ value: [{ type: 'Text', data: 'hi' }] })).toBe('static');
    expect(attrValueOf({ value: true })).toBe('absent');
  });
  it('attrTextOf returns the literal text or undefined if dynamic/absent', () => {
    expect(attrTextOf({ value: [{ type: 'Text', data: 'hi' }] })).toBe('hi');
    expect(attrTextOf({ value: [{ type: 'ExpressionTag' }] })).toBeUndefined();
    expect(attrTextOf({ value: true })).toBeUndefined();
  });
});

describe('lineOf', () => {
  it('computes the 1-based line for an offset', () => {
    expect(lineOf('a\nb\nc', 2)).toBe(2);
    expect(lineOf('a\nb\nc', 4)).toBe(3);
  });
  it('returns 0 for an unknown/invalid offset', () => {
    expect(lineOf('abc', undefined)).toBe(0);
    expect(lineOf('abc', -1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- svelte-ast`
Expected: FAIL — `../src/svelte-ast.js` does not exist yet.

- [ ] **Step 3: Create `packages/core/src/svelte-ast.ts`**

```ts
import type { Value } from './types.js';

// The Svelte AST is structurally complex and only partially typed for our needs,
// so traversal uses `any`. The node-type strings below are verified against
// svelte 5 output (see Slice 0 AST probe): <title> is `TitleElement` (not a
// RegularElement), and `{expr}` is `ExpressionTag`.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/**
 * All keys that can bear child nodes in a Svelte AST node.
 * Covers if/each/await blocks (pending/then/catch/fallback) as well as
 * the standard fragment, nodes, consequent, alternate, and body keys.
 */
export const CHILD_NODE_KEYS = [
  'fragment',
  'nodes',
  'consequent',
  'alternate',
  'body',
  'pending',
  'then',
  'catch',
  'fallback'
];

/**
 * Determine a value's kind from a list of child/text nodes (design §4, §11):
 *   - any ExpressionTag present  → 'dynamic' (e.g. {data.title}); we do NOT
 *     follow the expression — that would turn this into runtime analysis.
 *   - non-whitespace Text only   → 'static'
 *   - empty / whitespace only    → 'absent'
 */
export function valueFromNodes(nodes: Node[]): Value {
  if (!Array.isArray(nodes)) return 'absent';
  if (nodes.some((n) => n?.type === 'ExpressionTag')) return 'dynamic';
  const text = nodes
    .filter((n) => n?.type === 'Text')
    .map((n) => String(n.data ?? ''))
    .join('');
  return text.trim().length > 0 ? 'static' : 'absent';
}

/** The literal text of a node list when fully static (no ExpressionTag), else undefined. */
export function textFromNodes(nodes: Node[]): string | undefined {
  if (!Array.isArray(nodes) || nodes.some((n) => n?.type === 'ExpressionTag')) return undefined;
  const text = nodes
    .filter((n) => n?.type === 'Text')
    .map((n) => String(n.data ?? ''))
    .join('');
  return text.trim().length > 0 ? text : undefined;
}

/** Static string of an attribute (e.g. name="description"), or undefined if dynamic/absent. */
export function attrText(attributes: Node[], name: string): string | undefined {
  const attr = findAttr(attributes, name);
  if (!attr) return undefined;
  const v = attr.value;
  if (v === true) return '';
  if (Array.isArray(v)) {
    return v
      .filter((n: Node) => n?.type === 'Text')
      .map((n: Node) => String(n.data ?? ''))
      .join('');
  }
  return undefined; // single ExpressionTag → not a literal
}

/** Value kind of an attribute's content (e.g. the `content` of a <meta>). */
export function attrValue(attributes: Node[], name: string): Value {
  const attr = findAttr(attributes, name);
  if (!attr) return 'absent';
  const v = attr.value;
  if (v === true) return 'absent'; // boolean attribute, no content
  if (Array.isArray(v)) return valueFromNodes(v);
  if (v && v.type === 'ExpressionTag') return 'dynamic'; // content={expr}
  return 'absent';
}

export function lineOf(source: string, offset: unknown): number {
  if (typeof offset !== 'number' || offset < 0) return 0;
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) if (source[i] === '\n') line++;
  return line;
}

export function findAttr(attributes: Node[], name: string): Node | undefined {
  if (!Array.isArray(attributes)) return undefined;
  return attributes.find((a) => a?.type === 'Attribute' && a.name === name);
}

/** Value kind of a single attribute (e.g. a component prop). */
export function attrValueOf(attr: Node): Value {
  const v = attr?.value;
  if (v === true) return 'absent';
  if (Array.isArray(v)) return valueFromNodes(v);
  if (v && v.type === 'ExpressionTag') return 'dynamic';
  return 'absent';
}

/** Literal static text of a single attribute node (e.g. a component prop), or undefined if dynamic/absent. */
export function attrTextOf(attr: Node): string | undefined {
  const v = attr?.value;
  if (!Array.isArray(v) || v.some((n: Node) => n?.type === 'ExpressionTag')) return undefined;
  const text = v
    .filter((n: Node) => n?.type === 'Text')
    .map((n: Node) => String(n.data ?? ''))
    .join('');
  return text.trim().length > 0 ? text : undefined;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- svelte-ast`
Expected: PASS — all cases green.

- [ ] **Step 5: Run the full core package suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: all PASS (this file isn't imported anywhere else yet, so nothing else is affected).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/svelte-ast.ts packages/core/test/svelte-ast.test.ts
git commit -m "feat(core): extract shared Svelte-AST utilities from the CLI parser"
```

---

## Task 2: Extract `parseComponentFacts` into `@svelte-vitals/core`

**Files:**
- Create: `packages/core/src/component-parse.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/package.json`
- Move: `packages/cli/test/parse-component-facts.test.ts` → `packages/core/test/component-parse.test.ts` (minus one `describe` block — see Task 3)

**Interfaces:**
- Consumes: `CHILD_NODE_KEYS`, `lineOf`, `findAttr`, `attrTextOf` from `./svelte-ast.js` (Task 1). `EachBlockFact`, `EffectFact`, `SourceSpan`, `SuppressionDirective` from `./component.js` (already in core, pre-existing).
- Produces: `parseComponentFacts(source: string, filename: string) => { eachBlocks, effects, htmlTags, javascriptUrls, loc, propCount, imports, namespaceImports, constableStates, suppressions }` — same signature and return shape as the CLI's current version (this task is a relocation, not a rewrite).

- [ ] **Step 1: Move the test file (write first, following TDD's "test defines the contract" spirit — this file already exists and passes against the CLI's current location, so this step establishes it failing against the new location before the source module exists)**

Create `packages/core/test/component-parse.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

describe('parseComponentFacts — each blocks (CORRECT001)', () => {
  it('detects keyed vs unkeyed {#each}', () => {
    const keyed = parseComponentFacts('{#each items as item (item.id)}<li>{item.name}</li>{/each}', 'C.svelte');
    expect(keyed.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
    const unkeyed = parseComponentFacts('{#each items as item}<li>{item}</li>{/each}', 'C.svelte');
    expect(unkeyed.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
  });
  it('ignores a constant inline array literal (fixed length, never reorders)', () => {
    const c = parseComponentFacts('{#each [1, 2, 3] as n}<li>{n}</li>{/each}', 'C.svelte');
    expect(c.eachBlocks).toEqual([]);
  });
  it('still flags an each over a spread array literal (dynamic length)', () => {
    const c = parseComponentFacts('{#each [...items] as n}<li>{n}</li>{/each}', 'C.svelte');
    expect(c.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
  });
});

describe('parseComponentFacts — $effect (CORRECT002)', () => {
  const facts = (script: string) => parseComponentFacts(`<script>${script}</script>`, 'C.svelte').effects;

  it('flags an $effect whose body only assigns $state', () => {
    const e = facts('let count = $state(0); let double = $state(0); $effect(() => { double = count * 2; });');
    expect(e).toEqual([{ line: 1, assignsOnlyState: true, mountOnly: false }]);
  });
  it('does not flag an $effect that does other work', () => {
    const e = facts('let count = $state(0); $effect(() => { console.log(count); });');
    expect(e).toEqual([{ line: 1, assignsOnlyState: false, mountOnly: false }]);
  });
  it('does not flag assignment to a non-$state variable', () => {
    const e = facts('let count = $state(0); let plain = 0; $effect(() => { plain = count; });');
    expect(e[0]!.assignsOnlyState).toBe(false);
  });
  it('reports no effects when there are none', () => {
    expect(facts('let count = $state(0);')).toEqual([]);
  });
  it('treats $state.raw as a state declaration', () => {
    const e = facts('let big = $state.raw([]); $effect(() => { big = []; });');
    expect(e[0]!.assignsOnlyState).toBe(true);
  });
  it('does not treat $state.snapshot as a state declaration', () => {
    // `snap` is a snapshot read, not reactive state — assigning it is not the derive smell.
    const e = facts('let count = $state(0); let snap = $state.snapshot(count); $effect(() => { snap = count; });');
    expect(e[0]!.assignsOnlyState).toBe(false);
  });
  it('does not flag a compound assignment (accumulation, not derivation)', () => {
    // `+=` reads the previous value, so it can't become a self-referential $derived.
    const e = facts('let total = $state(0); let count = $state(0); $effect(() => { total += count; });');
    expect(e[0]!.assignsOnlyState).toBe(false);
  });
  it('flags an assign-only $effect.pre', () => {
    const e = facts('let count = $state(0); let double = $state(0); $effect.pre(() => { double = count * 2; });');
    expect(e).toEqual([{ line: 1, assignsOnlyState: true, mountOnly: false }]);
  });
  it('ignores non-effect $effect readers ($effect.tracking / $effect.root)', () => {
    const e = facts('let count = $state(0); const t = $effect.tracking(); $effect.root(() => {});');
    expect(e).toEqual([]);
  });
});

describe('parseComponentFacts — security (SEC001/SEC002)', () => {
  it('collects {@html} occurrences', () => {
    const f = parseComponentFacts('<div>{@html body}</div>', 'C.svelte');
    expect(f.htmlTags).toEqual([{ line: 1 }]);
  });
  it('flags a literal javascript: URL in href/src (case-insensitive)', () => {
    expect(parseComponentFacts('<a href="javascript:alert(1)">x</a>', 'C.svelte').javascriptUrls).toEqual([
      { line: 1 }
    ]);
    expect(parseComponentFacts('<iframe src="JavaScript:void(0)"></iframe>', 'C.svelte').javascriptUrls).toEqual([
      { line: 1 }
    ]);
  });
  it('does not flag a normal URL or a dynamic href', () => {
    expect(parseComponentFacts('<a href="https://example.com">x</a>', 'C.svelte').javascriptUrls).toEqual([]);
    expect(parseComponentFacts('<a href={url}>x</a>', 'C.svelte').javascriptUrls).toEqual([]);
  });
  it('flags a javascript: URL on a <svelte:element>', () => {
    const c = parseComponentFacts('<svelte:element this="a" href="javascript:alert(1)">x</svelte:element>', 'C.svelte');
    expect(c.javascriptUrls).toEqual([{ line: 1 }]);
  });
  it('does not flag a mixed value whose rendered URL is not statically known', () => {
    // Leading expression: the real URL is `{base}javascript:..`, not a javascript: URL.
    expect(parseComponentFacts('<a href="{base}javascript:foo">x</a>', 'C.svelte').javascriptUrls).toEqual([]);
    // `javascript:` followed by an expression: still dynamic, so we don't claim it statically.
    expect(parseComponentFacts('<a href="javascript:{evil}">x</a>', 'C.svelte').javascriptUrls).toEqual([]);
  });
  it('reports no security facts for a plain component', () => {
    const f = parseComponentFacts('<p>hi</p>', 'C.svelte');
    expect(f.htmlTags).toEqual([]);
    expect(f.javascriptUrls).toEqual([]);
  });
});

describe('parseComponentFacts — architecture (ARCH001/ARCH002)', () => {
  it('counts source lines (loc), not over-counting a trailing newline', () => {
    expect(parseComponentFacts('<p>a</p>\n<p>b</p>\n<p>c</p>', 'C.svelte').loc).toBe(3);
    expect(parseComponentFacts('<p>a</p>\n<p>b</p>\n<p>c</p>\n', 'C.svelte').loc).toBe(3);
  });
  it('counts destructured props from $props()', () => {
    expect(parseComponentFacts('<script>let { a, b, c } = $props();</script>', 'C.svelte').propCount).toBe(3);
  });
  it('reports 0 props for a rest element or non-destructured $props()', () => {
    expect(parseComponentFacts('<script>let { a, ...rest } = $props();</script>', 'C.svelte').propCount).toBe(0);
    expect(parseComponentFacts('<script>let props = $props();</script>', 'C.svelte').propCount).toBe(0);
  });
  it('returns 0 when any $props() shape is uncountable (mixed patterns)', () => {
    const src = '<script>let { a, b } = $props(); let other = $props();</script>';
    expect(parseComponentFacts(src, 'C.svelte').propCount).toBe(0);
  });
  it('returns 0 when more than one $props() is destructured (ambiguous)', () => {
    const src = '<script>let { a } = $props(); let { b, c } = $props();</script>';
    expect(parseComponentFacts(src, 'C.svelte').propCount).toBe(0);
  });
  it('reports 0 props when there is no $props()', () => {
    expect(parseComponentFacts('<p>hi</p>', 'C.svelte').propCount).toBe(0);
  });
});

describe('parseComponentFacts — imports (PERF009)', () => {
  it('collects import specifiers from the instance script', () => {
    const src = "<script>import _ from 'lodash'; import { onMount } from 'svelte';</script>";
    expect(parseComponentFacts(src, 'C.svelte').imports).toEqual(['lodash', 'svelte']);
  });
  it('collects imports from the module script too', () => {
    const src = "<script module>import x from 'a';</script><script>import y from 'b';</script>";
    expect(parseComponentFacts(src, 'C.svelte').imports.sort()).toEqual(['a', 'b']);
  });
  it('records subpath specifiers verbatim (not normalized)', () => {
    expect(parseComponentFacts("<script>import d from 'lodash/debounce';</script>", 'C.svelte').imports).toEqual([
      'lodash/debounce'
    ]);
  });
  it('reports no imports for a component without a script', () => {
    expect(parseComponentFacts('<p>hi</p>', 'C.svelte').imports).toEqual([]);
  });
});

describe('parseComponentFacts — namespace imports (PERF010)', () => {
  const ns = (script: string) => parseComponentFacts(`<script>${script}</script>`, 'C.svelte').namespaceImports;

  it('captures a bare value namespace import with its source', () => {
    expect(ns("import * as _ from 'lodash';").map((n) => n.source)).toEqual(['lodash']);
  });
  it('captures namespace imports from a module script too', () => {
    const c = parseComponentFacts(
      `<script module>import * as a from 'apkg';</script><script>import * as b from 'bpkg';</script>`,
      'C.svelte'
    );
    expect(c.namespaceImports.map((n) => n.source).sort()).toEqual(['apkg', 'bpkg']);
  });
  it('excludes type-only, named/default, and non-bare namespace imports', () => {
    expect(
      parseComponentFacts(`<script lang="ts">import type * as T from 'tpkg';</script>`, 'C.svelte').namespaceImports
    ).toEqual([]);
    expect(ns("import { debounce } from 'lodash';")).toEqual([]);
    expect(ns("import x from 'xpkg';")).toEqual([]);
    expect(ns("import * as u from './utils';")).toEqual([]);
    expect(ns("import * as e from '$lib/env';")).toEqual([]);
  });
  it('records a 1-based line', () => {
    const [only] = parseComponentFacts(
      `<script>\nimport * as _ from 'lodash';\n</script>`,
      'C.svelte'
    ).namespaceImports;
    expect(only!.line).toBeGreaterThan(0);
  });
});

describe('parseComponentFacts — mount-only $effect (CORRECT003)', () => {
  const facts = (script: string) => parseComponentFacts(`<script>${script}</script>`, 'C.svelte').effects;

  it('marks an effect with only member-call side effects as mountOnly', () => {
    expect(facts('$effect(() => { document.title = "Home"; });')[0]!.mountOnly).toBe(true);
    expect(facts('$effect(() => { el.focus(); });')[0]!.mountOnly).toBe(true);
    expect(facts('$effect(() => analytics.pageView());')[0]!.mountOnly).toBe(true);
  });
  it('is not mountOnly when the body reads reactive state/derived/props', () => {
    expect(facts('let count = $state(0); $effect(() => { console.log(count); });')[0]!.mountOnly).toBe(false);
    expect(facts('let d = $derived(1); $effect(() => { console.log(d); });')[0]!.mountOnly).toBe(false);
    expect(facts('let { title } = $props(); $effect(() => { document.title = title; });')[0]!.mountOnly).toBe(false);
  });
  it('captures reactive names through defaults and nested destructuring (no false positive)', () => {
    // `title` has a default → its binding is an AssignmentPattern, still a reactive prop.
    expect(facts("let { title = 'x' } = $props(); $effect(() => { document.title = title; });")[0]!.mountOnly).toBe(
      false
    );
    // nested destructuring binds `b`.
    expect(facts('let { a: { b } } = $props(); $effect(() => { el.textContent = b; });')[0]!.mountOnly).toBe(false);
  });
  it('is not mountOnly for a store subscription or a bare call', () => {
    expect(facts('$effect(() => { console.log($page); });')[0]!.mountOnly).toBe(false);
    expect(facts('$effect(() => helper());')[0]!.mountOnly).toBe(false);
  });
  it('is not mountOnly for an empty body', () => {
    expect(facts('$effect(() => {});')[0]!.mountOnly).toBe(false);
  });
  it('does not treat a non-computed property name matching a reactive binding as a read', () => {
    // `obj.count` accesses a property named `count`; it does not read the reactive `count`.
    expect(facts('let count = $state(0); $effect(() => { obj.count = 5; });')[0]!.mountOnly).toBe(true);
    // but a computed access `obj[count]` DOES read the reactive index.
    expect(facts('let count = $state(0); $effect(() => { obj[count] = 5; });')[0]!.mountOnly).toBe(false);
  });
  it('covers $effect.pre', () => {
    expect(facts('$effect.pre(() => { el.focus(); });')[0]!.mountOnly).toBe(true);
  });
});

describe('parseComponentFacts — constable $state (CORRECT004)', () => {
  const names = (src: string) => parseComponentFacts(src, 'C.svelte').constableStates.map((s) => s.name);

  it('flags a $state that is only read', () => {
    expect(names('<script>let title = $state("Hi");</script><h1>{title}</h1>')).toEqual(['title']);
    expect(names('<script>let cfg = $state({ a: 1 });</script><p>{cfg.a}</p>')).toEqual(['cfg']);
  });
  it('does not flag a $state written in the script', () => {
    expect(names('<script>let n = $state(0); function inc() { n++; }</script>')).toEqual([]);
    expect(names('<script>let o = $state({}); o.x = 1;</script>')).toEqual([]);
    expect(names('<script>let a = $state([]); a.push(1);</script>')).toEqual([]);
    expect(names('<script>let x = $state(0); use(x);</script>')).toEqual([]);
  });
  it('does not flag a $state mutated in an inline handler', () => {
    expect(names('<script>let n = $state(0);</script><button onclick={() => n++}>+</button>')).toEqual([]);
  });
  it('does not flag a bound $state', () => {
    expect(names('<script>let name = $state("");</script><input bind:value={name} />')).toEqual([]);
  });
  it('does not flag a $state passed as a component prop', () => {
    expect(names('<script>let data = $state({});</script><Child d={data} />')).toEqual([]);
  });
  it('still flags a $state only read in a slot child or DOM attribute', () => {
    expect(names('<script>let label = $state("x");</script><Card>{label}</Card>')).toEqual(['label']);
    expect(names('<script>let ph = $state("x");</script><input value={ph} />')).toEqual(['ph']);
  });
  it('does not flag a $state written via a destructuring assignment', () => {
    expect(names('<script>let count = $state(0); ({ count } = obj);</script>')).toEqual([]);
  });
  it('does not flag a $state property deleted with `delete`', () => {
    expect(names('<script>let m = $state({}); delete m.k;</script>')).toEqual([]);
  });
  it('does not flag a $state passed as a member-expression call argument', () => {
    expect(names('<script>let u = $state({}); save(u.profile);</script>')).toEqual([]);
  });
  it('does not flag a $state mutated via a member update expression', () => {
    expect(names('<script>let s = $state({ n: 0 }); function inc() { s.n++; }</script>')).toEqual([]);
  });
  it('does not flag a $state passed as a spread call argument', () => {
    expect(names('<script>let a = $state([]); send(...a);</script>')).toEqual([]);
    expect(names('<script>let o = $state({}); merge(...o.items);</script>')).toEqual([]);
  });
  it('does not flag a $state passed as a prop to a dynamic component', () => {
    expect(names('<script>let d = $state({});</script><svelte:component this={C} d={d} />')).toEqual([]);
  });
  it('still flags a genuinely read-only $state used in a template expression', () => {
    expect(names('<script>let t = $state("x");</script><p>{t}</p>')).toEqual(['t']);
  });
});

describe('parseComponentFacts — suppression directives (issue #92)', () => {
  it('captures a script-side disable-next-line with a rule id', () => {
    const src = '<script>\n// svelte-vitals-disable-next-line CORRECT002\n$effect(() => { x = 1; });\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([{ line: 3, ruleIds: ['CORRECT002'] }]);
  });
  it('captures multiple comma-separated rule ids', () => {
    const src = '<script>\n// svelte-vitals-disable-next-line CORRECT002, SEC001\nx = 1;\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([
      { line: 3, ruleIds: ['CORRECT002', 'SEC001'] }
    ]);
  });
  it('captures a blanket disable-next-line with no rule id', () => {
    const src = '<script>\n// svelte-vitals-disable-next-line\nx = 1;\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([{ line: 3, ruleIds: undefined }]);
  });
  it('captures a template-side HTML comment directive', () => {
    const src = '<!-- svelte-vitals-disable-next-line SEC001 -->\n<div>{@html body}</div>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([{ line: 2, ruleIds: ['SEC001'] }]);
  });
  it('does not match a same-line trailing comment', () => {
    const src = '<script>\nx = 1; // svelte-vitals-disable-next-line CORRECT002\n</script>';
    expect(parseComponentFacts(src, 'C.svelte').suppressions).toEqual([]);
  });
  it('reports no suppressions for a component without any directive', () => {
    expect(parseComponentFacts('<p>hi</p>', 'C.svelte').suppressions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: FAIL — `../src/component-parse.js` does not exist yet.

- [ ] **Step 3: Add the `svelte` dependency to `packages/core/package.json`**

Add a `"dependencies"` key (core currently has none):

```json
  "dependencies": {
    "svelte": "catalog:"
  },
```

Insert it after the `"sideEffects": false,` line and before `"exports"`.

- [ ] **Step 4: Create `packages/core/src/component-parse.ts`**

```ts
import { parse } from 'svelte/compiler';
import type { EachBlockFact, EffectFact, SourceSpan, SuppressionDirective } from './component.js';
import { CHILD_NODE_KEYS, lineOf, findAttr, attrTextOf } from './svelte-ast.js';

// The Svelte AST is structurally complex and only partially typed for our needs,
// so traversal uses `any`. The node-type strings below are verified against
// svelte 5 output (see Slice 0 AST probe): <title> is `TitleElement` (not a
// RegularElement), and `{expr}` is `ExpressionTag`.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/**
 * Whether an `{#each}` iterates a constant inline array literal (`{#each [a, b] as x}`).
 * Such a list has a fixed length and never reorders, so a key can't help — flagging it
 * would be a false positive. A spread element (`[...xs]`) makes it dynamic again, so it
 * is NOT treated as constant.
 */
function isConstantListEach(node: Node): boolean {
  const expr = node?.expression;
  return (
    expr?.type === 'ArrayExpression' &&
    Array.isArray(expr.elements) &&
    !expr.elements.some((el: Node) => el?.type === 'SpreadElement')
  );
}

/** Recursively collect every `{#each}` block in the template (Correctness CORRECT001). */
function collectEachBlocks(node: Node, source: string, acc: EachBlockFact[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectEachBlocks(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'EachBlock' && !isConstantListEach(node)) {
    acc.push({ hasKey: node.key != null, line: lineOf(source, node.start) });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectEachBlocks(node[key], source, acc);
  }
}

/** Generic ESTree walk over a `<script>` program: visit every node with a `.type`. */
function walkEstree(node: Node, visit: (n: Node) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walkEstree(child, visit);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    walkEstree(node[key], visit);
  }
}

/**
 * Whether a CallExpression *creates an effect*: `$effect(...)` or `$effect.pre(...)`.
 * Excludes the non-effect `$effect.*` readers (`$effect.tracking()`, `$effect.root()`),
 * which would otherwise be recorded as effects and seed spurious CORRECT002 pass units.
 */
function isEffectCall(node: Node): boolean {
  const c = node?.callee;
  if (c?.type === 'Identifier') return c.name === '$effect';
  if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === '$effect') {
    return c.property?.type === 'Identifier' && c.property.name === 'pre';
  }
  return false;
}

/**
 * Whether a CallExpression is a `$state` *declaration* form: `$state(...)`,
 * `$state.raw(...)`, or `$state.frozen(...)` — but NOT readers like
 * `$state.snapshot(...)`, which would otherwise pollute the state-name set (CORRECT002).
 */
function isStateDeclaration(node: Node): boolean {
  const c = node?.callee;
  if (c?.type === 'Identifier') return c.name === '$state';
  if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === '$state') {
    return c.property?.type === 'Identifier' && (c.property.name === 'raw' || c.property.name === 'frozen');
  }
  return false;
}

/** True when a function's body does nothing but assign to `$state` identifiers (CORRECT002). */
function bodyOnlyAssignsState(fn: Node, stateNames: Set<string>): boolean {
  // Only a plain `=` is a derive candidate. Compound assignments (`+=`, `*=`, `??=`, …)
  // read the previous value, so they accumulate rather than derive and can't become a
  // self-referential `$derived` — flagging them would be a false positive.
  const isStateAssign = (expr: Node): boolean =>
    expr?.type === 'AssignmentExpression' &&
    expr.operator === '=' &&
    expr.left?.type === 'Identifier' &&
    stateNames.has(expr.left.name);
  const body = fn?.body;
  if (!body) return false;
  if (body.type !== 'BlockStatement') return isStateAssign(body); // arrow with expression body
  if (body.body.length === 0) return false;
  return body.body.every((s: Node) => s?.type === 'ExpressionStatement' && isStateAssign(s.expression));
}

/** `$derived(...)` or `$derived.by(...)` declaration form. */
function isDerivedDeclaration(node: Node): boolean {
  const c = node?.callee;
  if (c?.type === 'Identifier') return c.name === '$derived';
  if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === '$derived') {
    return c.property?.type === 'Identifier' && c.property.name === 'by';
  }
  return false;
}

/**
 * Add every name a binding target introduces to `acc`, recursing through all
 * destructuring forms: defaults (`{ a = 1 }`), nested (`{ a: { b } }`), arrays,
 * and rest. Missing a bound prop would drop it from `reactiveNames` and risk a
 * false-positive CORRECT003 flag, so this must cover the full pattern grammar.
 */
function addBoundNames(id: Node, acc: Set<string>): void {
  if (!id) return;
  switch (id.type) {
    case 'Identifier':
      acc.add(id.name);
      break;
    case 'ObjectPattern':
      for (const p of id.properties ?? []) {
        if (p?.type === 'Property') addBoundNames(p.value, acc);
        else if (p?.type === 'RestElement') addBoundNames(p.argument, acc);
      }
      break;
    case 'ArrayPattern':
      for (const el of id.elements ?? []) addBoundNames(el, acc);
      break;
    case 'AssignmentPattern':
      addBoundNames(id.left, acc);
      break;
    case 'RestElement':
      addBoundNames(id.argument, acc);
      break;
  }
}

/** The base identifier name of a (possibly nested) member expression or identifier, else undefined. */
function rootObjectName(node: Node): string | undefined {
  let cur = node;
  while (cur?.type === 'MemberExpression') cur = cur.object;
  return cur?.type === 'Identifier' ? cur.name : undefined;
}

/**
 * Add state names that are WRITTEN or ESCAPED (CORRECT004 rules 1–4): reassignment,
 * update, member/element assignment, method call on the state, or the state passed
 * as a call argument. Run over the instance program AND the template fragment
 * (inline handlers mutate state in the template).
 */
function collectStateWrites(root: Node, stateNames: Set<string>, acc: Set<string>): void {
  walkEstree(root, (n: Node) => {
    if (n?.type === 'AssignmentExpression') {
      if (n.left?.type === 'Identifier' && stateNames.has(n.left.name)) acc.add(n.left.name);
      else if (n.left?.type === 'MemberExpression') {
        const r = rootObjectName(n.left);
        if (r && stateNames.has(r)) acc.add(r);
      } else if (n.left?.type === 'ObjectPattern' || n.left?.type === 'ArrayPattern') {
        // Destructuring-assignment target, e.g. `({ count } = obj)` or `[count] = arr`.
        const bound = new Set<string>();
        addBoundNames(n.left, bound);
        for (const name of bound) if (stateNames.has(name)) acc.add(name);
      }
    } else if (n?.type === 'UpdateExpression') {
      const r = rootObjectName(n.argument);
      if (r && stateNames.has(r)) acc.add(r); // x++, x.count++, x[i]++
    } else if (n?.type === 'UnaryExpression' && n.operator === 'delete') {
      const r = rootObjectName(n.argument);
      if (r && stateNames.has(r)) acc.add(r);
    } else if (n?.type === 'CallExpression') {
      if (n.callee?.type === 'MemberExpression') {
        const r = rootObjectName(n.callee);
        if (r && stateNames.has(r)) acc.add(r); // x.push(), x.foo()
      }
      for (const a of n.arguments ?? []) {
        // Unwrap a spread argument (`f(...x)`, `f(...x.items)`) to its expression.
        const arg = a?.type === 'SpreadElement' ? a.argument : a;
        const r = rootObjectName(arg);
        if (r && stateNames.has(r)) acc.add(r); // f(x), f(x.a), f(...x)
      }
    }
  });
}

/**
 * Component-like nodes whose attributes are props passed INTO another component
 * (an escape), as opposed to `SvelteElement` (`<svelte:element this={...}>`), whose
 * attributes are DOM-attribute reads on a dynamically-named element — not an escape.
 */
const COMPONENT_LIKE_TYPES = new Set(['Component', 'SvelteComponent', 'SvelteSelf']);

/**
 * Add state names ESCAPED via the template (CORRECT004 rules 5–6): a `bind:` on any
 * element, or passed as a prop to a component (static `<Foo>`, or dynamic
 * `<svelte:component>`/`<svelte:self>`). Slot children / DOM-attribute reads do
 * not escape. `CHILD_NODE_KEYS` omits `attributes`, so inspect them explicitly.
 */
function collectTemplateEscapes(node: Node, stateNames: Set<string>, acc: Set<string>): void {
  if (Array.isArray(node)) {
    for (const c of node) collectTemplateEscapes(c, stateNames, acc);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (Array.isArray(node.attributes)) {
    for (const attr of node.attributes) {
      if (attr?.type === 'BindDirective') {
        const r = rootObjectName(attr.expression);
        if (r && stateNames.has(r)) acc.add(r);
      } else if (COMPONENT_LIKE_TYPES.has(node.type)) {
        walkEstree(attr, (m: Node) => {
          if (m?.type === 'Identifier' && stateNames.has(m.name)) acc.add(m.name);
        });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectTemplateEscapes(node[key], stateNames, acc);
  }
}

const RUNE_NAMES = new Set(['$state', '$derived', '$effect', '$props', '$bindable', '$inspect', '$host']);

/**
 * Whether an $effect callback body reads a reactive value (CORRECT003, conservative):
 * a reactive name, a `$`-prefixed store subscription, or any bare-identifier call.
 */
function bodyReadsReactive(fn: Node, reactiveNames: Set<string>): boolean {
  let reads = false;
  const IGNORED_KEYS = new Set(['type', 'start', 'end', 'loc', 'range']);
  // Dedicated walk (not the generic walkEstree) so a non-computed property NAME
  // (`obj.count`, `{ count: 5 }`) that happens to match a reactive binding isn't
  // misread as a reactive read — only value/computed positions count.
  const visit = (n: Node): void => {
    if (reads || !n) return;
    if (Array.isArray(n)) {
      for (const c of n) visit(c);
      return;
    }
    if (typeof n !== 'object' || typeof n.type !== 'string') return;
    if (n.type === 'Identifier') {
      if (reactiveNames.has(n.name) || (n.name.startsWith('$') && !RUNE_NAMES.has(n.name))) reads = true;
      return;
    }
    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier') {
      reads = true; // bare-identifier call may read reactive state internally
      return;
    }
    if (n.type === 'MemberExpression') {
      visit(n.object);
      if (n.computed) visit(n.property); // `obj[count]` reads count; `obj.count` does not
      return;
    }
    if (n.type === 'Property') {
      if (n.computed) visit(n.key);
      visit(n.value);
      return;
    }
    for (const key of Object.keys(n)) {
      if (!IGNORED_KEYS.has(key)) visit(n[key]);
    }
  };
  visit(fn.body);
  return reads;
}

/** Empty effect callback body (`() => {}` or no body). */
function bodyIsEmpty(fn: Node): boolean {
  const body = fn?.body;
  if (!body) return true;
  if (body.type === 'BlockStatement') return (body.body ?? []).length === 0;
  return false;
}

/** Attributes whose value navigates/executes — a literal `javascript:` here is an XSS vector (SEC002). */
const URL_ATTRS = ['href', 'src', 'action', 'formaction'];

/** Recursively collect Security facts: `{@html}` tags and literal `javascript:` URLs (SEC001/SEC002). */
function collectSecurityFacts(node: Node, source: string, htmlTags: SourceSpan[], jsUrls: SourceSpan[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectSecurityFacts(child, source, htmlTags, jsUrls);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'HtmlTag') htmlTags.push({ line: lineOf(source, node.start) });
  // RegularElement = static <a>/<iframe>/…; SvelteElement = <svelte:element this="a" …>.
  if ((node.type === 'RegularElement' || node.type === 'SvelteElement') && Array.isArray(node.attributes)) {
    for (const name of URL_ATTRS) {
      const attr = findAttr(node.attributes, name);
      if (!attr) continue;
      // Fully-literal value only. A dynamic `href={url}` OR a mixed `href="{base}javascript:.."`
      // yields undefined — we can't know the rendered URL statically, so we don't flag it.
      const value = attrTextOf(attr);
      if (value !== undefined && /^\s*javascript:/i.test(value)) {
        jsUrls.push({ line: lineOf(source, attr.start ?? node.start) });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectSecurityFacts(node[key], source, htmlTags, jsUrls);
  }
}

/** Whether a CallExpression is a bare `$props()` call. */
function isPropsCall(node: Node): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === '$props';
}

/** Named props destructured from `$props()`, or 0 when unknowable (ARCH002). */
function countProps(program: Node): number {
  let count = 0;
  let seen = 0;
  // Unknowable when: a non-destructured / `...rest` $props(), or more than one $props()
  // call (a normal component has exactly one) — either way we can't trust a count.
  let uncountable = false;
  walkEstree(program, (n) => {
    if (n.type !== 'VariableDeclarator' || !n.init || !isPropsCall(n.init)) return;
    seen++;
    const props = n.id?.type === 'ObjectPattern' ? n.id.properties : undefined;
    if (!Array.isArray(props) || props.some((p: Node) => p?.type === 'RestElement')) {
      uncountable = true;
      return;
    }
    count = props.filter((p: Node) => p?.type === 'Property').length;
  });
  return uncountable || seen > 1 ? 0 : count;
}

/** Source line count, not over-counting a single trailing newline (ARCH001). */
function countLines(source: string): number {
  if (source.length === 0) return 0;
  return source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
}

/** Module specifiers of every `import` in an ESTree program (Bundle PERF009). */
function collectImportSources(program: Node, acc: string[]): void {
  walkEstree(program, (n) => {
    if (n.type === 'ImportDeclaration' && typeof n.source?.value === 'string') acc.push(n.source.value);
  });
}

/** A specifier is "bare" (a node_modules package) when it is not relative/absolute/alias-local. */
function isBareSpecifier(s: string): boolean {
  return !/^[./$#]/.test(s);
}

/** Value `import * as X from '<bare pkg>'` namespace imports (type-only excluded) — Bundle PERF010. */
function collectNamespaceImports(program: Node, source: string, acc: { source: string; line: number }[]): void {
  walkEstree(program, (n) => {
    if (n.type !== 'ImportDeclaration' || n.importKind === 'type') return;
    const spec = n.source?.value;
    if (typeof spec !== 'string' || !isBareSpecifier(spec)) return;
    if (Array.isArray(n.specifiers) && n.specifiers.some((s: Node) => s?.type === 'ImportNamespaceSpecifier')) {
      acc.push({ source: spec, line: lineOf(source, n.start) });
    }
  });
}

const JS_DIRECTIVE = /^\s*\/\/\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*$/;
const HTML_DIRECTIVE =
  /^\s*<!--\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*-->\s*$/;

/**
 * Inline `svelte-vitals-disable-next-line` directives (issue #92). A plain text scan, not an
 * AST walk, so `<script>` (`//`) and template (`<!-- -->`) comments are covered uniformly. The
 * directive must be the entire content of its line; the suppressed line is directive-line + 1.
 */
function collectSuppressions(source: string): SuppressionDirective[] {
  const out: SuppressionDirective[] = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    const m = JS_DIRECTIVE.exec(line) ?? HTML_DIRECTIVE.exec(line);
    if (!m) return;
    const ruleIds = m[1]?.split(',').map((s) => s.trim().toUpperCase());
    out.push({ line: i + 2, ruleIds });
  });
  return out;
}

/** Parse a component's reactivity/correctness + security + architecture facts (CLI/static + vite build mode). */
export function parseComponentFacts(
  source: string,
  filename: string
): {
  eachBlocks: EachBlockFact[];
  effects: EffectFact[];
  htmlTags: SourceSpan[];
  javascriptUrls: SourceSpan[];
  loc: number;
  propCount: number;
  imports: string[];
  namespaceImports: { source: string; line: number }[];
  constableStates: { name: string; line: number }[];
  suppressions: SuppressionDirective[];
} {
  const ast = parse(source, { modern: true, filename }) as Node;
  const eachBlocks: EachBlockFact[] = [];
  collectEachBlocks(ast.fragment ?? ast, source, eachBlocks);
  const htmlTags: SourceSpan[] = [];
  const javascriptUrls: SourceSpan[] = [];
  collectSecurityFacts(ast.fragment ?? ast, source, htmlTags, javascriptUrls);
  const loc = countLines(source);
  const suppressions = collectSuppressions(source);

  // Imports live in either the instance (<script>) or module (<script module>) program.
  const imports: string[] = [];
  const namespaceImports: { source: string; line: number }[] = [];
  if (ast.module?.content) {
    collectImportSources(ast.module.content, imports);
    collectNamespaceImports(ast.module.content, source, namespaceImports);
  }

  const effects: EffectFact[] = [];
  const constableStates: { name: string; line: number }[] = [];
  let propCount = 0;
  const program = ast.instance?.content;
  if (program) {
    collectImportSources(program, imports);
    collectNamespaceImports(program, source, namespaceImports);
    propCount = countProps(program);
    const stateNames = new Set<string>();
    const reactiveNames = new Set<string>();
    const stateDecls: { name: string; line: number }[] = [];
    walkEstree(program, (n) => {
      if (n.type !== 'VariableDeclarator' || !n.init) return;
      if (isStateDeclaration(n.init) && n.id?.type === 'Identifier') {
        stateNames.add(n.id.name);
        stateDecls.push({ name: n.id.name, line: lineOf(source, n.start) });
      }
      if (isStateDeclaration(n.init) || isDerivedDeclaration(n.init) || isPropsCall(n.init))
        addBoundNames(n.id, reactiveNames);
    });
    walkEstree(program, (n) => {
      if (n.type !== 'CallExpression' || !isEffectCall(n)) return;
      const fn = n.arguments?.[0];
      const isFn = fn?.type === 'ArrowFunctionExpression' || fn?.type === 'FunctionExpression';
      effects.push({
        line: lineOf(source, n.start),
        assignsOnlyState: isFn ? bodyOnlyAssignsState(fn, stateNames) : false,
        mountOnly: isFn ? !bodyIsEmpty(fn) && !bodyReadsReactive(fn, reactiveNames) : false
      });
    });
    const writtenOrEscaped = new Set<string>();
    collectStateWrites(program, stateNames, writtenOrEscaped);
    if (ast.fragment) {
      collectStateWrites(ast.fragment, stateNames, writtenOrEscaped);
      collectTemplateEscapes(ast.fragment, stateNames, writtenOrEscaped);
    }
    for (const d of stateDecls) {
      if (!writtenOrEscaped.has(d.name)) constableStates.push(d);
    }
  }
  return {
    eachBlocks,
    effects,
    htmlTags,
    javascriptUrls,
    loc,
    propCount,
    imports,
    namespaceImports,
    constableStates,
    suppressions
  };
}
```

- [ ] **Step 5: Add public exports to `packages/core/src/index.ts`**

Change line 23 from:

```ts
export type { EachBlockFact, EffectFact, SourceSpan, ComponentFacts, SuppressionDirective } from './component.js';
```

to (unchanged — no edit needed here; `ComponentFacts`/`SuppressionDirective` are already exported).

Add these new lines directly after that line:

```ts
export { parseComponentFacts } from './component-parse.js';
export {
  CHILD_NODE_KEYS,
  lineOf,
  findAttr,
  valueFromNodes,
  textFromNodes,
  attrText,
  attrValue,
  attrValueOf,
  attrTextOf
} from './svelte-ast.js';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- component-parse`
Expected: PASS — all cases green (identical assertions to the original CLI test file, now against the relocated function).

- [ ] **Step 7: Run the full core suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/component-parse.ts packages/core/src/index.ts packages/core/package.json packages/core/test/component-parse.test.ts
git commit -m "feat(core): extract parseComponentFacts from the CLI package"
```

(Note: `packages/cli/test/parse-component-facts.test.ts` still exists unchanged at this point — Task 3 removes the now-duplicated blocks from it. Do not delete it in this task.)

---

## Task 3: Shrink the CLI package to use `@svelte-vitals/core`'s relocated parser

**Files:**
- Modify: `packages/cli/src/providers/source/parse.ts`
- Modify: `packages/cli/src/providers/source/components.ts`
- Modify: `packages/cli/src/providers/source/adapters/svelte-meta-tags.ts`
- Modify: `packages/cli/src/providers/source/adapters/svelte-seo.ts`
- Modify: `packages/cli/test/suppression-e2e.test.ts`
- Delete: `packages/cli/test/parse-component-facts.test.ts`
- Create: `packages/cli/test/collect-component-facts.test.ts`

**Interfaces:**
- Consumes: `parseComponentFacts`, `CHILD_NODE_KEYS`, `lineOf`, `findAttr`, `valueFromNodes`, `textFromNodes`, `attrText`, `attrValue`, `attrValueOf`, `attrTextOf` from `@svelte-vitals/core` (Task 1/2).
- Produces: no change — `parseFile`, `parseHeadTags`, `attrValue`, `attrValueOf`, `attrTextOf`, `collectComponentFacts` keep their exact existing signatures; this task is a pure relocation.

This task must not change any test assertion — only import paths and file boundaries move.

- [ ] **Step 1: Replace `packages/cli/src/providers/source/parse.ts` with this exact content**

```ts
import { parse } from 'svelte/compiler';
import type { HeadTag } from '@svelte-vitals/core';
import {
  CHILD_NODE_KEYS,
  lineOf,
  findAttr,
  valueFromNodes,
  textFromNodes,
  attrText,
  attrValue
} from '@svelte-vitals/core';
import { collectImports, type ImportMap } from './imports.js';

/** A head tag parsed from one file, before layout-chain presence is assigned. */
export type ParsedTag = Omit<HeadTag, 'presence' | 'file'>;

// The Svelte AST is structurally complex and only partially typed for our needs,
// so traversal uses `any`. The node-type strings below are verified against
// svelte 5 output (see Slice 0 AST probe): <title> is `TitleElement` (not a
// RegularElement), and `{expr}` is `ExpressionTag`.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/** Recursively collect every <svelte:head> node anywhere in the template. */
function collectSvelteHeads(node: Node, acc: Node[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectSvelteHeads(child, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'SvelteHead') acc.push(node);
  // Visit the child-bearing properties used by Svelte fragments and blocks.
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectSvelteHeads(node[key], acc);
  }
}

function tagsFromHead(head: Node): ParsedTag[] {
  const tags: ParsedTag[] = [];
  const children: Node[] = head?.fragment?.nodes ?? [];
  for (const node of children) {
    if (node?.type === 'TitleElement') {
      const titleNodes = node.fragment?.nodes ?? [];
      const text = textFromNodes(titleNodes);
      tags.push({ kind: 'title', value: valueFromNodes(titleNodes), ...(text !== undefined ? { text } : {}) });
      continue;
    }
    if (node?.type !== 'RegularElement') continue;

    if (node.name === 'meta') {
      const charset = attrValue(node.attributes, 'charset');
      if (charset !== 'absent') {
        // <meta charset="…"> carries neither name nor property; model it as name:'charset' (SEO024).
        tags.push({ kind: 'meta', name: 'charset', value: charset });
        continue;
      }
      const name = attrText(node.attributes, 'name');
      const property = attrText(node.attributes, 'property');
      const content = name === 'robots' ? attrText(node.attributes, 'content') : undefined;
      const noindex = content !== undefined && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
      const contentValue = attrValue(node.attributes, 'content');
      const descText =
        name === 'description' && contentValue === 'static' ? attrText(node.attributes, 'content') : undefined;
      tags.push({
        kind: 'meta',
        ...(name ? { name } : {}),
        ...(property ? { property } : {}),
        value: contentValue,
        ...(noindex ? { noindex: true } : {}),
        ...(descText !== undefined ? { text: descText } : {})
      });
    } else if (node.name === 'link') {
      const rel = attrText(node.attributes, 'rel');
      const hasAs = findAttr(node.attributes, 'as') !== undefined;
      const asLiteral = attrText(node.attributes, 'as'); // literal keyword, or undefined for dynamic/absent
      const hasCrossorigin = findAttr(node.attributes, 'crossorigin') !== undefined;
      const hreflang = attrText(node.attributes, 'hreflang'); // literal (incl. '') or undefined for dynamic/absent
      const href = attrText(node.attributes, 'href'); // literal URL (for PERF008 origin analysis), or undefined
      tags.push({
        kind: 'link',
        ...(rel ? { rel } : {}),
        value: attrValue(node.attributes, 'href'),
        ...(hasAs ? { hasAs: true } : {}),
        ...(asLiteral ? { as: asLiteral } : {}),
        ...(hasCrossorigin ? { hasCrossorigin: true } : {}),
        // Keep a literal empty hreflang="" (present-but-invalid) so SEO026 can flag it.
        ...(hreflang !== undefined ? { hreflang } : {}),
        ...(href ? { href } : {})
      });
    } else if (node.name === 'script') {
      const type = attrText(node.attributes, 'type');
      if (type === 'application/ld+json') {
        const nodes = node.fragment?.nodes ?? [];
        const raw = textFromNodes(nodes);
        tags.push({ kind: 'jsonld', value: valueFromNodes(nodes), ...(raw !== undefined ? { jsonld: raw } : {}) });
      } else {
        // External <script src> in <svelte:head> (PERF007/PERF008). Render-blocking
        // unless defer/async/type=module; only literal src is modeled.
        const src = attrText(node.attributes, 'src');
        if (src) {
          const blocking =
            findAttr(node.attributes, 'defer') === undefined &&
            findAttr(node.attributes, 'async') === undefined &&
            type !== 'module';
          tags.push({ kind: 'script', value: 'static', href: src, ...(blocking ? { blocking: true } : {}) });
        }
      }
    }
  }
  return tags;
}

export interface ComponentUse {
  name: string;
  attributes: Node[];
  hasSpread: boolean;
}

function collectComponents(node: Node, acc: ComponentUse[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectComponents(child, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'Component' && typeof node.name === 'string') {
    const attributes: Node[] = node.attributes ?? [];
    acc.push({
      name: node.name,
      attributes,
      hasSpread: attributes.some((a) => a?.type === 'SpreadAttribute')
    });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectComponents(node[key], acc);
  }
}

export interface ParsedImage {
  hasWidth: boolean;
  hasHeight: boolean;
  hasLoading: boolean;
  hasAlt: boolean;
  lazy: boolean;
  hasSrcset: boolean;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** A page-body heading (<h1>–<h6>) parsed from one file (SEO027). */
export interface ParsedHeading {
  /** Heading level 1–6. */
  level: number;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

function collectImages(node: Node, source: string, acc: ParsedImage[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectImages(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && node.name === 'img') {
    const attrs: Node[] = node.attributes ?? [];
    const hasSpread = attrs.some((a: Node) => a?.type === 'SpreadAttribute');
    acc.push({
      hasWidth: hasSpread || Boolean(findAttr(attrs, 'width')),
      hasHeight: hasSpread || Boolean(findAttr(attrs, 'height')),
      hasLoading: hasSpread || Boolean(findAttr(attrs, 'loading')),
      hasAlt: hasSpread || Boolean(findAttr(attrs, 'alt')),
      // A literal loading="lazy" only — a spread or dynamic loading={…} must not be flagged.
      lazy: attrText(attrs, 'loading') === 'lazy',
      hasSrcset: hasSpread || Boolean(findAttr(attrs, 'srcset')),
      line: lineOf(source, node.start)
    });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectImages(node[key], source, acc);
  }
}

/** Recursively collect page-body headings (<h1>–<h6>) anywhere in the template (SEO027). */
function collectHeadings(node: Node, source: string, acc: ParsedHeading[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectHeadings(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  // Body headings only — a stray <h1> inside <svelte:head> is not a page heading.
  if (node.type === 'SvelteHead') return;
  if (node.type === 'RegularElement' && typeof node.name === 'string' && /^h[1-6]$/.test(node.name)) {
    acc.push({ level: Number(node.name[1]), line: lineOf(source, node.start) });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectHeadings(node[key], source, acc);
  }
}

export interface ParsedFile {
  headTags: ParsedTag[];
  components: ComponentUse[];
  imports: ImportMap;
  images: ParsedImage[];
  headings: ParsedHeading[];
}

/** Parse a .svelte source into its layer-1 head tags, component usages, and imports. */
export function parseFile(source: string, filename: string): ParsedFile {
  const ast = parse(source, { modern: true, filename }) as Node;
  const heads: Node[] = [];
  collectSvelteHeads(ast.fragment ?? ast, heads);
  const components: ComponentUse[] = [];
  collectComponents(ast.fragment ?? ast, components);
  const images: ParsedImage[] = [];
  collectImages(ast.fragment ?? ast, source, images);
  const headings: ParsedHeading[] = [];
  collectHeadings(ast.fragment ?? ast, source, headings);
  return {
    headTags: heads.flatMap(tagsFromHead),
    components,
    imports: collectImports(ast),
    images,
    headings
  };
}

/**
 * Parse a .svelte source and extract the head tags declared in its
 * <svelte:head> blocks (detection layer 1 — literal svelte:head, design §11).
 */
export function parseHeadTags(source: string, filename: string): ParsedTag[] {
  const ast = parse(source, { modern: true, filename }) as Node;
  const heads: Node[] = [];
  collectSvelteHeads(ast.fragment ?? ast, heads);
  return heads.flatMap(tagsFromHead);
}
```

- [ ] **Step 2: Update `packages/cli/src/providers/source/components.ts`**

Change:

```ts
import type { ComponentFacts, Runtime } from '@svelte-vitals/core';
import { parseComponentFacts } from './parse.js';
```

to:

```ts
import { parseComponentFacts, type ComponentFacts, type Runtime } from '@svelte-vitals/core';
```

(The rest of the file — the `collectComponentFacts` function body — is unchanged.)

- [ ] **Step 3: Update the two SEO adapter imports**

In `packages/cli/src/providers/source/adapters/svelte-meta-tags.ts`, change:

```ts
import { attrValueOf, attrTextOf } from '../parse.js';
```

to:

```ts
import { attrValueOf, attrTextOf } from '@svelte-vitals/core';
```

In `packages/cli/src/providers/source/adapters/svelte-seo.ts`, change the identical line the same way.

- [ ] **Step 4: Split the test file**

Create `packages/cli/test/collect-component-facts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { collectComponentFacts } from '../src/providers/source/components.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

describe('collectComponentFacts (memory runtime)', () => {
  it('scans every .svelte under src, including $lib', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': '{#each xs as x}<i>{x}</i>{/each}',
      'src/lib/Card.svelte': '<script>let n = $state(0); let d = $state(0); $effect(() => { d = n + 1; });</script>',
      'src/app.html': '<html></html>' // not .svelte → ignored
    });
    const facts = await collectComponentFacts(rt, '');
    const byFile = new Map(facts.map((f) => [f.file, f]));
    expect(byFile.get('src/routes/+page.svelte')!.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
    expect(byFile.get('src/lib/Card.svelte')!.effects[0]!.assignsOnlyState).toBe(true);
    expect(byFile.has('src/app.html')).toBe(false);
  });
});
```

Delete `packages/cli/test/parse-component-facts.test.ts` (every other case it held now lives in `packages/core/test/component-parse.test.ts`, from Task 2).

- [ ] **Step 5: Update `packages/cli/test/suppression-e2e.test.ts`'s import**

Change:

```ts
import { parseComponentFacts } from '../src/providers/source/parse.js';
import { correct002EffectDerived, sec001Html, defineConfig, defaultProject } from '@svelte-vitals/core';
```

to:

```ts
import {
  parseComponentFacts,
  correct002EffectDerived,
  sec001Html,
  defineConfig,
  defaultProject
} from '@svelte-vitals/core';
```

(No other change to this file — every test body is unaffected.)

- [ ] **Step 6: Run the full CLI and core suites**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter svelte-vitals test`
Expected: all PASS, same total test count as before this task's file split (minus the one file deleted, plus the one file added — net test count unchanged). Specifically confirm:
- `packages/cli/test/collect-component-facts.test.ts` passes (1 test).
- `packages/cli/test/suppression-e2e.test.ts` passes (3 tests, unchanged).
- No file still imports from a path that no longer exports what it needs.

- [ ] **Step 7: Run typecheck and lint for both packages**

Run: `pnpm --filter @svelte-vitals/core typecheck && pnpm --filter svelte-vitals typecheck && pnpm lint`
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/providers/source/parse.ts packages/cli/src/providers/source/components.ts packages/cli/src/providers/source/adapters/svelte-meta-tags.ts packages/cli/src/providers/source/adapters/svelte-seo.ts packages/cli/test/suppression-e2e.test.ts packages/cli/test/collect-component-facts.test.ts
git rm packages/cli/test/parse-component-facts.test.ts
git commit -m "refactor(cli): use @svelte-vitals/core's relocated component-facts parser"
```

---

## Task 4: New vite-side component-facts collector

**Files:**
- Create: `packages/vite/src/providers/source/components.ts`
- Test: `packages/vite/test/collect-component-facts.test.ts`

**Interfaces:**
- Consumes: `parseComponentFacts`, `type ComponentFacts` from `@svelte-vitals/core` (Task 2). `glob` from `tinyglobby` (already a vite dependency).
- Produces: `collectComponentFacts(root: string): Promise<ComponentFacts[]>` — used by Task 5's `analyze()`.

- [ ] **Step 1: Write the failing test**

Create `packages/vite/test/collect-component-facts.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectComponentFacts } from '../src/providers/source/components.js';

describe('collectComponentFacts (vite, real filesystem)', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'sv-vite-components-'));
    await mkdir(join(root, 'src/routes'), { recursive: true });
    await mkdir(join(root, 'src/lib'), { recursive: true });
    await writeFile(join(root, 'src/routes/+page.svelte'), '{#each xs as x}<i>{x}</i>{/each}');
    await writeFile(
      join(root, 'src/lib/Card.svelte'),
      '<script>let n = $state(0); let d = $state(0); $effect(() => { d = n + 1; });</script>'
    );
    await writeFile(join(root, 'src/app.html'), '<html></html>'); // not .svelte → ignored
  });
  afterAll(async () => rm(root, { recursive: true, force: true }));

  it('scans every .svelte file under src/, including $lib', async () => {
    const facts = await collectComponentFacts(root);
    const byFile = new Map(facts.map((f) => [f.file, f]));
    expect(byFile.get('src/routes/+page.svelte')!.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
    expect(byFile.get('src/lib/Card.svelte')!.effects[0]!.assignsOnlyState).toBe(true);
    expect(byFile.has('src/app.html')).toBe(false);
  });

  it('returns an empty array when there is no src/ directory', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'sv-vite-components-empty-'));
    expect(await collectComponentFacts(empty)).toEqual([]);
    await rm(empty, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/vite test -- collect-component-facts`
Expected: FAIL — `../src/providers/source/components.js` does not exist yet.

- [ ] **Step 3: Create `packages/vite/src/providers/source/components.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'tinyglobby';
import { parseComponentFacts, type ComponentFacts } from '@svelte-vitals/core';

/**
 * Scan every `.svelte` component under `src/` for Correctness/Security/Architecture/
 * Bundle-Performance facts (build mode only). Mirrors the CLI's `collectComponentFacts`,
 * but implemented directly against `node:fs` + `tinyglobby` instead of the CLI's
 * injectable `Runtime` — vite always runs in Node, so no swappable runtime is needed.
 */
export async function collectComponentFacts(root: string): Promise<ComponentFacts[]> {
  const files = await glob('src/**/*.svelte', { cwd: root, dot: false });
  return Promise.all(
    files.sort().map(async (rel): Promise<ComponentFacts> => {
      try {
        const source = await readFile(join(root, rel), 'utf8');
        return { file: rel, ...parseComponentFacts(source, rel) };
      } catch {
        return {
          file: rel,
          eachBlocks: [],
          effects: [],
          htmlTags: [],
          javascriptUrls: [],
          loc: 0,
          propCount: 0,
          imports: [],
          namespaceImports: [],
          constableStates: [],
          suppressions: []
        };
      }
    })
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/vite test -- collect-component-facts`
Expected: PASS — both cases green.

- [ ] **Step 5: Run the full vite package suite and typecheck**

Run: `pnpm --filter @svelte-vitals/vite test && pnpm --filter @svelte-vitals/vite typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/vite/src/providers/source/components.ts packages/vite/test/collect-component-facts.test.ts
git commit -m "feat(vite): add a build-mode component-facts collector"
```

---

## Task 5: Wire component facts into `analyze()`

**Files:**
- Modify: `packages/vite/src/analyze.ts`
- Modify: `packages/vite/test/analyze.test.ts`

**Interfaces:**
- Consumes: `collectComponentFacts(root: string)` from `./providers/source/components.js` (Task 4).
- Produces: `analyze()`'s `RuleContext` now includes `components`; no signature change to `analyze()` itself.

- [ ] **Step 1: Write the failing test**

Extend `packages/vite/test/analyze.test.ts`'s `beforeAll` to also write a `.svelte` file with a component-scoped finding, and add a new test case. Replace the file's full content with:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze } from '../src/analyze.js';

describe('analyze', () => {
  let cwd: string;
  let pages: string;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-analyze-'));
    pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    // one good page, one missing title
    await writeFile(
      join(pages, 'index.html'),
      `<html lang="en"><head><title>Home</title><meta name="description" content="d"/></head><body></body></html>`
    );
    await writeFile(
      join(pages, 'bad.html'),
      `<html lang="en"><head><meta charset="utf-8"/></head><body></body></html>`
    );
    // a component with an unkeyed {#each} (CORRECT001), for the component-scope wiring test
    await mkdir(join(cwd, 'src/lib'), { recursive: true });
    await writeFile(join(cwd, 'src/lib/List.svelte'), '{#each items as item}<li>{item}</li>{/each}');
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('runs all rules over rendered routes and computes a score', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(r.routeCount).toBe(2);
    // /bad is missing <title> (critical) -> headline capped at 79
    expect(r.score).toBeLessThanOrEqual(79);
    expect(r.results.some((x) => x.id === 'SEO001' && x.route === '/bad' && x.detection.presence === 'none')).toBe(
      true
    );
    // html lang present (en) -> SEO009 not a site issue
    const json = JSON.parse(r.jsonReport);
    expect(json.siteIssues.map((i: { id: string }) => i.id)).not.toContain('SEO009');
    // console report must carry the plugin-mode label and not the static-mode label
    expect(r.consoleReport).toContain('Svelte Vitals  ·  rendered / plugin');
    expect(r.consoleReport).not.toContain('static mode');
  });

  it('fails when findings meet failOn', async () => {
    const r = await analyze(pages, cwd, { report: false, failOn: 'critical' });
    expect(r.failed).toBe(true);
  });

  it('also runs component-scoped rules against .svelte source under src/', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(
      r.results.some(
        (x) => x.id === 'CORRECT001' && x.location === 'src/lib/List.svelte' && x.detection.presence === 'none'
      )
    ).toBe(true);
    expect(r.consoleReport).toContain('Scanned 1 component(s) under src/');
  });
});
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `pnpm --filter @svelte-vitals/vite test -- analyze`
Expected: the two pre-existing tests still PASS; the new "also runs component-scoped rules" test FAILS (no `CORRECT001` finding yet, since `analyze()` doesn't populate `components`).

- [ ] **Step 3: Update `packages/vite/src/analyze.ts`**

```ts
import {
  allRules,
  selectRules,
  applyRuleSeverities,
  runRules,
  computeScore,
  summarize,
  hasFailureAtOrAbove,
  formatConsoleReport,
  formatJsonReport,
  defineConfig,
  type Result,
  type Summary,
  type Severity
} from '@svelte-vitals/core';
import type { SvelteVitalsOptions } from './plugin.js';
import { collectRenderedHeads } from './providers/rendered/collect.js';
import { collectRenderedProject } from './providers/rendered/project.js';
import { collectComponentFacts } from './providers/source/components.js';
import { readPackageVersion } from './version.js';

export interface AnalyzeResult {
  score: number;
  summary: Summary;
  results: Result[];
  consoleReport: string;
  jsonReport: string;
  routeCount: number;
  failed: boolean;
  failOn: Severity;
}

/** Collect prerendered heads + project facts + component facts, run the core pipeline, and format reports. */
export async function analyze(
  prerenderPagesDir: string,
  cwd: string,
  options: SvelteVitalsOptions
): Promise<AnalyzeResult> {
  const config = defineConfig({
    treatDynamicAs: options.treatDynamicAs ?? 'pass',
    metaComponents: options.metaComponents ?? [],
    rules: options.rules ?? {},
    failOn: options.failOn ?? 'critical'
  });

  const { heads, headings, images, htmlLang } = await collectRenderedHeads(prerenderPagesDir);
  const project = await collectRenderedProject(cwd, htmlLang);
  const components = await collectComponentFacts(cwd);
  const results = applyRuleSeverities(
    await runRules(selectRules(allRules, config), { heads, headings, images, project, components, config }),
    config
  );

  const { score } = computeScore(results, config);
  const summary = summarize(results, config);
  const failed = hasFailureAtOrAbove(summary, config.failOn);

  const coverageNote =
    `Analyzed ${heads.length} prerendered route(s). ` +
    'SSR/dynamic routes are not covered — run `npx svelte-vitals` for those.\n' +
    `Scanned ${components.length} component(s) under src/ for Correctness/Security/Architecture/Bundle findings.`;
  const consoleReport =
    formatConsoleReport(results, config, { mode: 'rendered / plugin' }) + '\n' + coverageNote + '\n';
  const jsonReport = formatJsonReport(results, config, { version: readPackageVersion() });

  return {
    score,
    summary,
    results,
    consoleReport,
    jsonReport,
    routeCount: heads.length,
    failed,
    failOn: config.failOn
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/vite test -- analyze`
Expected: PASS — all 3 cases green.

- [ ] **Step 5: Run the full vite suite and typecheck**

Run: `pnpm --filter @svelte-vitals/vite test && pnpm --filter @svelte-vitals/vite typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/vite/src/analyze.ts packages/vite/test/analyze.test.ts
git commit -m "feat(vite): wire component-scoped rules into build-mode analyze()"
```

---

## Task 6: Documentation

**Files:**
- Modify: `docs/src/content/docs/guides/plugin-mode.md`
- Modify: `docs/src/content/docs/ja/guides/plugin-mode.md`
- Modify: `docs/src/content/docs/guides/dev-overlay.md`
- Modify: `docs/src/content/docs/ja/guides/dev-overlay.md`
- Modify: `docs/src/content/docs/guides/choosing-a-package.md`
- Modify: `docs/src/content/docs/ja/guides/choosing-a-package.md`

- [ ] **Step 1: Update `docs/src/content/docs/guides/plugin-mode.md`**

Change line 8 from:

```md
`@svelte-vitals/vite` is a Vite / SvelteKit plugin that piggybacks on `vite build`, parses the **prerendered HTML's `<head>`**, and runs the same SEO and Performance rules as the CLI. Because it inspects the real HTML output, it is library-agnostic. The build fails when findings reach the `failOn` threshold.
```

to:

```md
`@svelte-vitals/vite` is a Vite / SvelteKit plugin that piggybacks on `vite build`, parses the **prerendered HTML's `<head>`**, and runs the same SEO and Performance rules as the CLI. Because it inspects the real HTML output, it is library-agnostic. Build mode additionally scans your `.svelte` source directly under `src/` for Correctness, Security, Architecture, and the two component-scoped Performance rules (PERF009/PERF010 — heavy/namespace imports) — the same component-scoped rules the CLI runs, enabled by default. The build fails when findings reach the `failOn` threshold.
```

- [ ] **Step 2: Update `docs/src/content/docs/ja/guides/plugin-mode.md`**

Change line 8 from:

```md
`@svelte-vitals/vite` は Vite / SvelteKit プラグインで、`vite build` に便乗して**プリレンダリングされた HTML の `<head>`** を解析し、CLI と同じ SEO およびパフォーマンスルールを実行します。実際の HTML 出力を検査するため、ライブラリに依存しません。検出結果が `failOn` の閾値に達するとビルドが失敗します。
```

to:

```md
`@svelte-vitals/vite` は Vite / SvelteKit プラグインで、`vite build` に便乗して**プリレンダリングされた HTML の `<head>`** を解析し、CLI と同じ SEO およびパフォーマンスルールを実行します。実際の HTML 出力を検査するため、ライブラリに依存しません。ビルドモードではさらに、`src/` 配下の `.svelte` ソースを直接走査し、Correctness・Security・Architecture、および component スコープの2つの Performance ルール（PERF009/PERF010 — 重い import・namespace import）も検証します — CLI と同じ component スコープのルールで、デフォルトで有効です。検出結果が `failOn` の閾値に達するとビルドが失敗します。
```

- [ ] **Step 3: Update `docs/src/content/docs/guides/dev-overlay.md`**

Find the line (currently line 83):

```md
Like the overlay, this is dev-only and rendered-based: it covers the SEO `<head>` rules for the routes you visit. For a whole-project report (all routes, Performance, site checks), run `npx svelte-vitals` or `npx svelte-vitals --reporter html`.
```

Append a new sentence directly after it (same paragraph or a new one, matching the file's existing style):

```md
Component-scoped rules (Correctness, Security, Architecture, and the two Bundle-Performance rules) are build-mode-only — see [Plugin mode](/svelte-vitals/guides/plugin-mode/) — and never appear in the dev overlay, since there is no whole-project source scan on a per-request rendered view.
```

- [ ] **Step 4: Update `docs/src/content/docs/ja/guides/dev-overlay.md`**

Find the corresponding line (currently line 83):

```md
オーバーレイと同様、これは dev 専用かつレンダリングベースで、訪問したルートの SEO `<head>` ルールを対象とします。プロジェクト全体のレポート（全ルート・パフォーマンス・サイト全体のチェック）が必要な場合は `npx svelte-vitals` または `npx svelte-vitals --reporter html` を実行してください。
```

Append a new sentence directly after it:

```md
component スコープのルール（Correctness・Security・Architecture、および2つの Bundle-Performance ルール）はビルドモードのみの対応です（[プラグインモード](/svelte-vitals/ja/guides/plugin-mode/) を参照） — リクエスト単位のレンダリング済みビューにはプロジェクト全体を横断するソーススキャンが存在しないため、開発オーバーレイには表示されません。
```

- [ ] **Step 5: Update `docs/src/content/docs/guides/choosing-a-package.md`**

Change the "Categories" row (line 25) from:

```md
| Categories     | All 5 — SEO, Performance, Correctness, Security, Architecture | SEO, Performance         | SEO, Performance                  | All 5                            |
```

to:

```md
| Categories     | All 5 — SEO, Performance, Correctness, Security, Architecture | All 5 — SEO, Performance, Correctness, Security, Architecture | SEO, Performance                  | All 5                            |
```

Change the "Reads" row (line 24) from:

```md
| Reads          | Source (`.svelte` files, layout chain)                        | Prerendered HTML output  | Rendered HTML, per dev request    | Source (same engine as the CLI)  |
```

to:

```md
| Reads          | Source (`.svelte` files, layout chain)                        | Prerendered HTML output + `.svelte` source (component rules) | Rendered HTML, per dev request    | Source (same engine as the CLI)  |
```

Replace the "Why the coverage differs" section (lines 31–35) with:

```md
### Why build-mode coverage is close to the CLI's

Correctness, Security, and Architecture rules read component **source** — `$effect` bodies, `{@html}` calls, prop counts — which only exists before compilation. The CLI, MCP (which runs the CLI's own analysis engine), and the Vite plugin's **build mode** all read this source directly, so all three run the full 5-category rule set.

The dev overlay is the one path that inspects **rendered HTML only** (the response for each route you visit, with no whole-project source scan), which keeps it SEO/Performance-only, but library-agnostic and exact for the pages it covers: whatever produced the `<head>`, if it's missing from the shipped HTML, the overlay sees it. Build mode reads rendered HTML too (for the same exact-verification reason), *in addition to* the source scan — it's the only path that gets both.
```

Update the "Vite plugin — exact, build-time verification" prose (line 45) from:

```md
`@svelte-vitals/vite`'s build mode runs during `vite build` and parses the **actual prerendered HTML**, so it can't be fooled by a component the source scanner doesn't recognize — if the tag isn't in the shipped output, it fails. The trade-off is scope: only prerendered routes, and only the head/DOM-based SEO and Performance rules. See [Plugin mode](/svelte-vitals/guides/plugin-mode/).
```

to:

```md
`@svelte-vitals/vite`'s build mode runs during `vite build` and parses the **actual prerendered HTML** for SEO/Performance, so it can't be fooled by a component the source scanner doesn't recognize — if the tag isn't in the shipped output, it fails. It also scans `.svelte` source directly for Correctness, Security, Architecture, and the two component-scoped Performance rules, the same as the CLI. The remaining trade-off is route scope: only prerendered routes get the HTML-based SEO/Performance verification (component-scoped rules apply project-wide). See [Plugin mode](/svelte-vitals/guides/plugin-mode/).
```

- [ ] **Step 6: Update `docs/src/content/docs/ja/guides/choosing-a-package.md`**

Apply the same six changes in Japanese, mirroring the structure above:

Change the "カテゴリ" row (line 25) from:

```md
| カテゴリ       | 全5種 — SEO・Performance・Correctness・Security・Architecture | SEO・Performance                 | SEO・Performance                             | 全5種                               |
```

to:

```md
| カテゴリ       | 全5種 — SEO・Performance・Correctness・Security・Architecture | 全5種 — SEO・Performance・Correctness・Security・Architecture | SEO・Performance                             | 全5種                               |
```

Change the "読み取る対象" row (line 24) from:

```md
| 読み取る対象   | ソース(`.svelte`ファイル、レイアウトチェーン）                | プレレンダリング済みHTML出力     | 開発中のリクエストごとのレンダリング済みHTML | ソース(CLIと同じエンジン）          |
```

to:

```md
| 読み取る対象   | ソース(`.svelte`ファイル、レイアウトチェーン）                | プレレンダリング済みHTML出力 + `.svelte`ソース（componentルール） | 開発中のリクエストごとのレンダリング済みHTML | ソース(CLIと同じエンジン）          |
```

Replace the "なぜカバー範囲が違うのか" section (lines 31–35) with:

```md
### なぜビルドモードのカバー範囲はCLIに近いのか

Correctness・Security・Architecture のルールはコンポーネントの**ソースコード**(`$effect`の中身、`{@html}`の呼び出し、propsの数など)を読み取りますが、これらはコンパイル前にしか存在しません。CLI、MCP（CLI自身の解析エンジンをそのまま呼び出す）、そして Vite プラグインの**ビルドモード**はいずれもソースを直接読むため、この3つすべてが全5カテゴリのルールセットを実行できます。

開発オーバーレイだけが**レンダリング済みHTMLのみ**を検査する経路です(訪問した各ルートのレスポンスのみ、プロジェクト全体を横断するソーススキャンはありません)。そのためSEO/Performanceのみに限定されますが、カバーする範囲においてはライブラリ非依存かつ正確です — 何が `<head>` を生成したかに関わらず、実際に配信されるHTMLに欠けていればそれを検出します。ビルドモードも同じ理由でレンダリング済みHTMLを読み取りますが、それに**加えて**ソーススキャンも行う唯一の経路です。
```

Update the "Vite プラグイン — 正確なビルド時検証" prose (line 45) from:

```md
`@svelte-vitals/vite` のビルドモードは `vite build` 実行中に**実際にプレレンダリングされたHTML**を解析するため、ソーススキャナーが認識しないコンポーネントにごまかされることがありません — タグが出力HTMLに存在しなければ、それだけで検出されます。トレードオフは範囲の狭さです — プレレンダリングされたルートのみ、かつ `<head>`/DOMベースのSEO・Performanceルールのみが対象です。詳細は [プラグインモード](/svelte-vitals/ja/guides/plugin-mode/) を参照してください。
```

to:

```md
`@svelte-vitals/vite` のビルドモードは `vite build` 実行中にSEO/Performance検証として**実際にプレレンダリングされたHTML**を解析するため、ソーススキャナーが認識しないコンポーネントにごまかされることがありません — タグが出力HTMLに存在しなければ、それだけで検出されます。それに加えて `.svelte` ソースも直接走査し、CLIと同じ Correctness・Security・Architecture、および component スコープの2つの Performance ルールも検証します。残るトレードオフはルートの範囲です — HTMLベースのSEO/Performance検証はプレレンダリングされたルートのみが対象です（component スコープのルールはプロジェクト全体が対象）。詳細は [プラグインモード](/svelte-vitals/ja/guides/plugin-mode/) を参照してください。
```

- [ ] **Step 7: Reformat the edited files and verify**

Markdown tables (like the "Comparison" table in `choosing-a-package.md`) must have
their pipe columns aligned — hand-edited table cells rarely match Prettier's
expected column widths. Run Prettier on exactly the 6 files this task touched
before checking:

```bash
pnpm exec prettier --write docs/src/content/docs/guides/plugin-mode.md docs/src/content/docs/ja/guides/plugin-mode.md docs/src/content/docs/guides/dev-overlay.md docs/src/content/docs/ja/guides/dev-overlay.md docs/src/content/docs/guides/choosing-a-package.md docs/src/content/docs/ja/guides/choosing-a-package.md
```

Then run: `pnpm --filter docs build`
Expected: build succeeds with no MDX/Markdown errors. Also re-read the
`choosing-a-package.md` "Comparison" table after the Prettier pass to confirm the
"Vite plugin — build mode" column still reads "All 5 — SEO, Performance,
Correctness, Security, Architecture" and wasn't collapsed or reflowed oddly
(the CLI package's earlier PR in this project hit a Prettier quirk where a
`svelte`-tagged fenced code block got silently reformatted — tables are a
different mechanism, but re-reading the rendered diff costs nothing).

- [ ] **Step 8: Commit**

```bash
git add docs/src/content/docs/guides/plugin-mode.md docs/src/content/docs/ja/guides/plugin-mode.md docs/src/content/docs/guides/dev-overlay.md docs/src/content/docs/ja/guides/dev-overlay.md docs/src/content/docs/guides/choosing-a-package.md docs/src/content/docs/ja/guides/choosing-a-package.md
git commit -m "docs: document vite build-mode component-scoped rule coverage"
```

---

## Task 7: Changesets

**Files:**
- Create: `.changeset/vite-component-rules-core.md`
- Create: `.changeset/vite-component-rules-vite.md`
- Create: `.changeset/vite-component-rules-cli.md`

- [ ] **Step 1: Write the core changeset**

`.changeset/vite-component-rules-core.md`:

```md
---
'@svelte-vitals/core': minor
---

Export `parseComponentFacts` (and the Svelte-AST utilities it's built on — `attrValue`, `attrValueOf`, `attrTextOf`, `findAttr`, `lineOf`, `CHILD_NODE_KEYS`, `valueFromNodes`, `textFromNodes`, `attrText`) from the package root. This is the same `.svelte`-source parser the CLI has always used for Correctness/Security/Architecture/Bundle-Performance rules, relocated from `svelte-vitals` so `@svelte-vitals/vite` can use it too. `@svelte-vitals/core` gains a new `svelte` dependency (for `svelte/compiler`'s `parse`) — a pure parsing call, so this doesn't affect the package's runtime-agnostic status.
```

- [ ] **Step 2: Write the vite changeset**

`.changeset/vite-component-rules-vite.md`:

```md
---
'@svelte-vitals/vite': minor
---

Build mode now additionally scans `.svelte` source under `src/` and runs Correctness, Security, Architecture, and the two component-scoped Performance rules (PERF009/PERF010) — the same rules the CLI and MCP already run — enabled by default alongside the existing rendered-HTML SEO/Performance checks. The dev overlay is unchanged (still SEO/Performance-only, rendered-HTML-based). Use the existing `rules` option to opt individual rules out, e.g. `{ CORRECT002: 'off' }`.
```

- [ ] **Step 3: Write the cli changeset**

`.changeset/vite-component-rules-cli.md`:

```md
---
'svelte-vitals': patch
---

Internal refactor: component-facts source parsing (`parseComponentFacts` and its shared AST utilities) moved to `@svelte-vitals/core` so `@svelte-vitals/vite` can reuse it. No user-facing behavior change.
```

- [ ] **Step 4: Commit**

```bash
git add .changeset/vite-component-rules-core.md .changeset/vite-component-rules-vite.md .changeset/vite-component-rules-cli.md
git commit -m "chore: add changesets for vite component-scoped rule coverage"
```

---

## Final verification (run once, after all tasks)

- [ ] Run: `pnpm typecheck && pnpm test && pnpm lint`
  Expected: all green across every package.
- [ ] Run: `pnpm --filter docs build`
  Expected: docs build succeeds.
- [ ] Run: `pnpm build` (all packages) to confirm `@svelte-vitals/core`'s new `svelte` dependency and the relocated modules build cleanly end-to-end (tsup/type declarations).
- [ ] Manually confirm via `pnpm --filter @svelte-vitals/vite test -- analyze` output that the new coverage line ("Scanned N component(s) under src/...") appears in the console report.
