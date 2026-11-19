import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (script: string) => parseComponentFacts(`<script>\n${script}\n</script>`, 'src/lib/C.svelte');
const constable = (script: string) => facts(script).constableStates.map((s) => s.name);
const rawable = (script: string) => facts(script).rawableStates.map((s) => s.name);

describe('state writes', () => {
  it('keeps a $state that is only read, called, touched through a shadowing binding, or written through a reassigned local', () => {
    const script = [
      'let shown = $state({ flag: true });',
      'const neg = !shown.flag;',
      'const kind = typeof shown.flag;',
      'let fn = $state(() => 1);',
      'fn();',
      'let hidden = $state([]);',
      'function f(hidden) {',
      '  [hidden] = [[1]];',
      '  return hidden;',
      '}',
      'let list = $state([]);',
      'const api = {',
      '  get empty() {',
      '    return !list.length;',
      '  },',
      '  items() {',
      '    return list.items;',
      '  }',
      '};',
      'let rows = $state({ a: 1 });',
      'for (const key in rows) console.log(key.toUpperCase());',
      'let hours = $state([{ n: 0 }]);',
      'let h = hours[0];',
      'h = { n: 0 };',
      'h.n = 1;'
    ].join('\n');
    expect(constable(script)).toEqual(['shown', 'fn', 'hidden', 'list', 'rows', 'hours']);
  });

  it('drops a $state written, handed out or mutated through a local holding part of it', () => {
    const script = [
      'let arr = $state([]);',
      '[arr] = [[1]];',
      'let days = $state([{ n: 0 }]);',
      'let d = days[0];',
      'const z = d + 1;',
      'const dk = typeof d;',
      'd.n = 1;',
      'let store = $state({ items: [] });',
      'class Store {',
      '  get items() {',
      '    return store.items;',
      '  }',
      '}',
      'let ctx = $state({});',
      "setContext('k', { ctx });",
      'let pair = $state([]);',
      'const both = [pair, 1];',
      'let kept = $state([]);',
      'function get() {',
      '  return kept;',
      '}'
    ].join('\n');
    expect(constable(script)).toEqual([]);
  });

  it('drops a $state mutated through a local bound to the whole of it, directly or through another such local', () => {
    expect(constable('let s = $state([]);\nconst d = s;\nd.push(1);')).toEqual([]);
    expect(constable('let s = $state({ n: 0 });\nlet d = s;\nconst e = d;\ne.n = 1;')).toEqual([]);
    expect(constable('let s = $state({ n: 0 });\nlet d = s;\nd = { n: 1 };\nd.n = 2;')).toEqual(['s']);
  });

  it('drops a $state mutated through a chain of locals each declared after the code that reads it', () => {
    const script = [
      'let s = $state({ m: { m: { m: { n: 0 } } } });',
      'function outer() {',
      '  function inner() {',
      '    const x = y.m;',
      '    x.n = 1;',
      '  }',
      '  const y = z.m;',
      '  inner();',
      '}',
      'const z = s.m;',
      'outer();'
    ].join('\n');
    expect(constable(script)).toEqual([]);
  });

  it('keeps a mutation made through a local before a destructuring or a loop rebinds it', () => {
    expect(constable('let s = $state({ items: [] });\nlet d = s.items;\nd.push(1);\nfor (d of [[]]) {}')).toEqual([]);
    expect(constable('let s = $state([]);\nlet d = s;\nd.push(1);\n[d] = [[]];')).toEqual([]);
  });

  const marked = (script: string, markup: string) =>
    parseComponentFacts(`<script>\n${script}\n</script>\n${markup}`, 'src/lib/C.svelte').constableStates.map(
      (s) => s.name
    );

  it('follows a script local holding a $state, or part of it, into a template handler', () => {
    expect(marked('let s = $state([]);\nconst d = s;', '<button onclick={() => d.push(1)}>x</button>')).toEqual([]);
    expect(
      marked('let s = $state([{ n: 0 }]);\nconst d = s[0];', '<button onclick={() => (d.n = 1)}>x</button>')
    ).toEqual([]);
    expect(
      marked('let s = $state([]);\nconst d = s;', '<button onclick={() => { const e = d; e.push(1); }}>x</button>')
    ).toEqual([]);
    expect(
      marked('let s = $state([]);\nlet d = s;', '<button onclick={() => { d = []; d.push(1); }}>x</button>')
    ).toEqual(['s']);
    expect(
      marked('let s = $state([]);\nlet d = s;\n[d] = [[]];', '<button onclick={() => d.push(1)}>x</button>')
    ).toEqual(['s']);
  });

  it('keeps a script mutation through a local that a template handler rebinds', () => {
    expect(
      marked(
        'let s = $state({ items: [] });\nlet d = s.items;\nd.push(1);',
        '<button onclick={() => (d = [])}>x</button>'
      )
    ).toEqual([]);
    expect(
      marked('let s = $state([]);\nlet d = s;\nd.push(1);', '<button onclick={() => (d = [])}>x</button>')
    ).toEqual([]);
  });

  it('keeps a script local apart from a template binding of the same name', () => {
    expect(
      marked(
        'let s = $state([{ n: 0 }]);\nconst d = s[0];\nd.n = 1;',
        '<button onclick={() => { let d = []; d = [1]; }}>x</button>'
      )
    ).toEqual([]);
    expect(
      marked(
        'let s = $state([{ n: 0 }]);\nconst d = s[0];',
        '{#each [{ n: 0 }] as d}<button onclick={() => d.n++}>x</button>{/each}'
      )
    ).toEqual(['s']);
    expect(
      marked(
        'let s = $state({ n: 0 });\nconst d = s;',
        '{#each [1] as x}{@const d = { n: x }}<button onclick={() => d.n++}>x</button>{/each}'
      )
    ).toEqual(['s']);
    expect(
      marked(
        'let s = $state([{ n: 0 }]);\nlet d = { n: 0 };\nfunction f() {\n  d.n = 1;\n}',
        '<button onclick={() => { const d = s[0]; }}>x</button>'
      )
    ).toEqual(['s']);
    expect(
      marked('let s = $state([]);\nfunction f() {\n  const d = s;\n}', '<button onclick={() => d.push(1)}>x</button>')
    ).toEqual(['s']);
  });

  it('takes a reassigned parameter for itself, not for the top-level $state of that name', () => {
    const script = [
      "let value = $state('');",
      'function createField(value) {',
      '  value = value.trim();',
      '  let current = $state(value);',
      '  return () => current;',
      '}'
    ].join('\n');
    expect(constable(script)).toEqual(['value', 'current']);
  });

  it('reads past a bare return, and through a for…of item in a template handler', () => {
    expect(constable('let list = $state([]);\nfunction f() {\n  if (x) return;\n  return list;\n}')).toEqual([]);
    const src =
      '<script>\n  let days = $state([{}]);\n</script>\n<button onclick={() => { for (const d of days) d.done = true; }}>x</button>';
    expect(parseComponentFacts(src, 'src/lib/C.svelte').constableStates).toEqual([]);
  });

  it('takes a $state as raw only when every write replaces it whole', () => {
    const script = [
      'let only = $state([]);',
      'only = [1];',
      'let mixed = $state([]);',
      'mixed.push(1);',
      'mixed = [];'
    ].join('\n');
    expect(rawable(script)).toEqual(['only']);
  });
});
