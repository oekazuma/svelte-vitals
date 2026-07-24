import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const nrb = (src: string) => parseComponentFacts(src, 'A.svelte').nonreactiveBuiltinStates;

const script = (body: string, template = '<p>x</p>') => `<script>\n${body}\n</script>\n${template}`;

describe('nonreactiveBuiltinStates — records', () => {
  it('records each built-in type when mutated in a function', () => {
    const cases: [string, string, string][] = [
      ['Map', 'new Map()', 'm.set("k", 1);'],
      ['Set', 'new Set()', 'm.add(1);'],
      ['Date', 'new Date()', 'm.setHours(0);'],
      ['URLSearchParams', 'new URLSearchParams()', 'm.append("k", "v");']
    ];
    for (const [type, ctor, mutation] of cases) {
      const src = script(`let m = $state(${ctor});\nfunction f() {\n  ${mutation}\n}`);
      expect(nrb(src), type).toEqual([{ name: 'm', type, line: 2 }]);
    }
  });

  it('records URL via property write and via deep searchParams mutation', () => {
    const href = script(`let u = $state(new URL("https://x.dev"));\nfunction f() {\n  u.href = "https://y.dev";\n}`);
    expect(nrb(href)).toEqual([{ name: 'u', type: 'URL', line: 2 }]);
    const deep = script(
      `let u = $state(new URL("https://x.dev"));\nfunction f() {\n  u.searchParams.set("k", "v");\n}`
    );
    expect(nrb(deep)).toEqual([{ name: 'u', type: 'URL', line: 2 }]);
  });

  it('records constructor-with-arguments and template inline-handler mutations', () => {
    const withArgs = script(`let m = $state(new Map(entries));\nfunction f() {\n  m.clear();\n}`);
    expect(nrb(withArgs)).toEqual([{ name: 'm', type: 'Map', line: 2 }]);
    const inline = script(`let s = $state(new Set());`, '<button onclick={() => s.add(1)}>x</button>');
    expect(nrb(inline)).toEqual([{ name: 's', type: 'Set', line: 2 }]);
  });

  it('records a mutation inside $effect and keeps the migrated self-assign hack flagged', () => {
    const effect = script(`let m = $state(new Map());\n$effect(() => {\n  m.set("k", 1);\n});`);
    expect(nrb(effect)).toEqual([{ name: 'm', type: 'Map', line: 2 }]);
    const selfAssign = script(`let m = $state(new Map());\nfunction f() {\n  m.set("k", 1);\n  m = m;\n}`);
    expect(nrb(selfAssign)).toEqual([{ name: 'm', type: 'Map', line: 2 }]);
  });
});

describe('nonreactiveBuiltinStates — exclusions', () => {
  it('does not record reassign-only or mutate-then-fresh-reassign usage', () => {
    const reassignOnly = script(`let d = $state(new Date());\nfunction f() {\n  d = new Date();\n}`);
    expect(nrb(reassignOnly)).toEqual([]);
    const freshReassign = script(`let m = $state(new Map());\nfunction f() {\n  m.set("k", 1);\n  m = new Map(m);\n}`);
    expect(nrb(freshReassign)).toEqual([]);
  });

  it('does not record top-level init mutations, read-only, or escape-only usage', () => {
    const topLevel = script(`let d = $state(new Date());\nd.setHours(0, 0, 0, 0);`);
    expect(nrb(topLevel)).toEqual([]);
    const readOnly = script(`let m = $state(new Map());\nfunction f() {\n  return m.get("k") && m.has("k");\n}`);
    expect(nrb(readOnly)).toEqual([]);
    const urlRead = script(
      `let u = $state(new URL("https://x.dev"));\nfunction f() {\n  return u.searchParams.get("k");\n}`
    );
    expect(nrb(urlRead)).toEqual([]);
    const escape = script(`let m = $state(new Map());\nfunction f() {\n  register(m);\n}`);
    expect(nrb(escape)).toEqual([]);
  });

  it('does not record non-candidates', () => {
    const raw = script(`let m = $state.raw(new Map());\nfunction f() {\n  m.set("k", 1);\n}`);
    expect(nrb(raw)).toEqual([]);
    const plain = script(`const m = new Map();\nfunction f() {\n  m.set("k", 1);\n}`);
    expect(nrb(plain)).toEqual([]);
    const nested = script(`function g() {\n  let m = $state(new Map());\n  m.set("k", 1);\n}`);
    expect(nrb(nested)).toEqual([]);
    const literal = script(`let o = $state({});\nfunction f() {\n  o.x = 1;\n}`);
    expect(nrb(literal)).toEqual([]);
  });

  it('respects shadowing and type-specific method sets', () => {
    const shadowed = script(`let m = $state(new Map());\nfunction f(m) {\n  m.set("k", 1);\n}`);
    expect(nrb(shadowed)).toEqual([]);
    const wrongMethod = script(`let d = $state(new Date());\nfunction f() {\n  d.getHours();\n}`);
    expect(nrb(wrongMethod)).toEqual([]);
    const deepOnNonUrl = script(`let m = $state(new Map());\nfunction f() {\n  m.get("k").sort();\n}`);
    expect(nrb(deepOnNonUrl)).toEqual([]);
  });

  it('does not count property writes on non-URL types (URL mutates via properties, the rest via methods)', () => {
    const cases: [string, string][] = [
      ['new Map()', 'm.foo = 1;'],
      ['new Set()', 'm.foo++;'],
      ['new Date()', 'delete m.foo;'],
      ['new URLSearchParams()', 'm.foo = 1;']
    ];
    for (const [ctor, write] of cases) {
      const src = script(`let m = $state(${ctor});\nfunction f() {\n  ${write}\n}`);
      expect(nrb(src), `${ctor} / ${write}`).toEqual([]);
    }
    const url = script(`let u = $state(new URL("https://x.dev"));\nfunction f() {\n  u.hash = "#a";\n}`);
    expect(nrb(url)).toEqual([{ name: 'u', type: 'URL', line: 2 }]);
  });

  it('does not count a mutation of an {@const} alias against a same-named outer $state', () => {
    const src = script(
      `let tags = $state(new Set());`,
      `{#each groups as g}{@const tags = g.tags}<button onclick={() => tags.add("x")}>x</button>{/each}`
    );
    expect(nrb(src)).toEqual([]);
  });

  it('does not count mutations of {let}/{const} declaration-tag aliases either', () => {
    const letTag = script(
      `let tags = $state(new Set());`,
      `{#each groups as g}{let tags = g.tags}<button onclick={() => tags.add("x")}>x</button>{/each}`
    );
    expect(nrb(letTag)).toEqual([]);
    const constTag = script(
      `let tags = $state(new Set());`,
      `{#each groups as g}{const tags = g.tags}<button onclick={() => tags.add("x")}>x</button>{/each}`
    );
    expect(nrb(constTag)).toEqual([]);
  });

  it('resolves function-scoped var and nested declaration shadows', () => {
    const varShadow = script(`let m = $state(new Map());\nfunction f() {\n  var m = new Map();\n  m.set("k", 1);\n}`);
    expect(nrb(varShadow)).toEqual([]);
    const fnShadow = script(`let m = $state(new Map());\nfunction outer() {\n  function m() {}\n  m.set("k", 1);\n}`);
    expect(nrb(fnShadow)).toEqual([]);
    const classShadow = script(`let m = $state(new Map());\nfunction outer() {\n  class m {}\n  m.set("k", 1);\n}`);
    expect(nrb(classShadow)).toEqual([]);
  });
});
