import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const raw = (src: string) => parseComponentFacts(src, 'A.svelte').rawableStates;
const constable = (src: string) => parseComponentFacts(src, 'A.svelte').constableStates;

const script = (body: string, template = '<p>x</p>') => `<script>\n${body}\n</script>\n${template}`;

describe('rawableStates — records', () => {
  it('records a reassigned-only object literal (script reassign)', () => {
    const src = script(`let data = $state({});\nfunction refresh(next) {\n  data = next;\n}`);
    expect(raw(src)).toEqual([{ name: 'data', line: 2 }]);
  });

  it('records an immutable-update array (own-RHS reference is not an escape)', () => {
    const src = script(`let list = $state([]);\nfunction add(x) {\n  list = [...list, x];\n}`);
    expect(raw(src)).toEqual([{ name: 'list', line: 2 }]);
  });

  it('records when the reassignment happens in a template inline handler', () => {
    const src = script(`let list = $state([]);`, '<button onclick={() => (list = [...list, 1])}>x</button>');
    expect(raw(src)).toEqual([{ name: 'list', line: 2 }]);
  });

  it('allows read-only each bodies and template reads', () => {
    const src = script(
      `let list = $state([]);\nfunction set(next) {\n  list = next;\n}`,
      '{#each list as item (item.id)}<li>{item.name}</li>{/each}<p>{list.length}</p>'
    );
    expect(raw(src)).toEqual([{ name: 'list', line: 2 }]);
  });
});

describe('rawableStates — exclusions', () => {
  it('excludes never-written state (unmutated-state territory) — disjointness pinned', () => {
    const src = script(`let cfg = $state({ a: 1 });`, '<p>{cfg.a}</p>');
    expect(raw(src)).toEqual([]);
    expect(constable(src)).toEqual([{ name: 'cfg', line: 2 }]);
  });

  it('excludes mutation in all its forms', () => {
    for (const stmt of ['obj.a = 1;', 'obj.n++;', 'delete obj.k;', 'obj.items.push(1);']) {
      const src = script(`let obj = $state({});\nfunction f() {\n  obj = {};\n  ${stmt}\n}`);
      expect(raw(src), stmt).toEqual([]);
    }
  });

  it('excludes escapes: call argument, component prop, bind:', () => {
    const arg = script(`let obj = $state({});\nfunction f() {\n  obj = {};\n  register(obj);\n}`);
    expect(raw(arg)).toEqual([]);
    const prop = script(`let obj = $state({});\nfunction f() {\n  obj = {};\n}`, '<Child data={obj} />');
    expect(raw(prop)).toEqual([]);
    const bound = script(`let obj = $state({});\nfunction f() {\n  obj = {};\n}`, '<input bind:value={obj} />');
    expect(raw(bound)).toEqual([]);
  });

  it('excludes aliasing references', () => {
    const decl = script(`let obj = $state({});\nfunction f() {\n  obj = {};\n}\nconst inner = obj;`);
    expect(raw(decl)).toEqual([]);
    const otherRhs = script(`let obj = $state({});\nlet cache;\nfunction f() {\n  obj = {};\n  cache = obj;\n}`);
    expect(raw(otherRhs)).toEqual([]);
    const helperReturn = script(
      `let obj = $state({});\nfunction f() {\n  obj = {};\n}\nfunction get() {\n  return obj;\n}`
    );
    expect(raw(helperReturn)).toEqual([]);
    const handlerAlias = script(
      `let obj = $state({});\nlet cache;\nfunction f() {\n  obj = {};\n}`,
      '<button onclick={() => (cache = obj)}>x</button>'
    );
    expect(raw(handlerAlias)).toEqual([]);
    const nested = script(`let obj = $state({});\nlet cache;\nfunction f() {\n  obj = (cache = obj);\n}`);
    expect(raw(nested)).toEqual([]);
    const intoState = script(`let list = $state([]);\nfunction f() {\n  list = [];\n}\nlet copy = $state([...list]);`);
    expect(raw(intoState).map((r) => r.name)).not.toContain('list');
  });

  it('excludes each-context taint (editable lists)', () => {
    const bind = script(
      `let list = $state([]);\nfunction set(next) {\n  list = next;\n}`,
      '{#each list as item (item.id)}<input bind:value={item.text} />{/each}'
    );
    expect(raw(bind)).toEqual([]);
    const childProp = script(
      `let list = $state([]);\nfunction set(next) {\n  list = next;\n}`,
      '{#each list as item (item.id)}<Row {item} />{/each}'
    );
    expect(raw(childProp)).toEqual([]);
    const memberWrite = script(
      `let list = $state([]);\nfunction set(next) {\n  list = next;\n}`,
      '{#each list as item (item.id)}<button onclick={() => (item.done = true)}>x</button>{/each}'
    );
    expect(raw(memberWrite)).toEqual([]);
  });

  it('excludes non-candidates: raw already, non-literal, primitive, non-top-level', () => {
    expect(raw(script(`let a = $state.raw({});\nfunction f() {\n  a = {};\n}`))).toEqual([]);
    expect(raw(script(`let b = $state(new Map());\nfunction f() {\n  b = new Map();\n}`))).toEqual([]);
    expect(raw(script(`let c = $state(0);\nfunction f() {\n  c = 1;\n}`))).toEqual([]);
    expect(raw(script(`function g() {\n  let d = $state({});\n  d = {};\n}`))).toEqual([]);
  });

  it('does not let a shadowed local disqualify', () => {
    const src = script(`let obj = $state({});\nfunction f() {\n  obj = {};\n}\nfunction g(obj) {\n  obj.x = 1;\n}`);
    expect(raw(src)).toEqual([{ name: 'obj', line: 2 }]);
  });
});
