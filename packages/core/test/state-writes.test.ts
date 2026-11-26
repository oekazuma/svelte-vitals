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

  it('drops a $state handed out through a local holding it or part of it', () => {
    expect(constable('let items = $state([]);\nconst list = items;\nsave(list);')).toEqual([]);
    expect(constable('let items = $state([]);\nconst list = items;\nfunction get() {\n  return list;\n}')).toEqual([]);
    expect(constable("let items = $state([{ n: 0 }]);\nconst d = items;\nsetContext('k', { d });")).toEqual([]);
    expect(
      constable(
        'let items = $state({ list: [] });\nconst d = items.list;\nconst api = {\n  get list() {\n    return d;\n  }\n};'
      )
    ).toEqual([]);
    expect(constable('let items = $state([]);\nfor (const d of items) save(d);')).toEqual([]);
    expect(constable('let days = $state([]);\nfor (const day of days) send(day.id);')).toEqual([]);
    expect(
      constable(
        'let items = $state([]);\nconst all = items;\nlet list = items;\nlist = all;\nfunction get() {\n  return list;\n}'
      )
    ).toEqual([]);
  });

  it('keeps a $state whose local holds a part of it or a primitive copy when returned or placed, or is rebound before it is handed out', () => {
    expect(constable('let n = $state(0);\nconst m = n;\nfunction get() {\n  return m;\n}')).toEqual(['n']);
    expect(constable('let items = $state([{ n: 0 }]);\nconst d = items[0];\nfunction get() {\n  return d;\n}')).toEqual(
      ['items']
    );
    expect(constable("let items = $state([{ n: 0 }]);\nconst d = items[0];\nsetContext('k', { d });")).toEqual([
      'items'
    ]);
    expect(constable('let items = $state([]);\nlet list = items;\nlist = [];\nsave(list);')).toEqual(['items']);
    expect(
      constable('let items = $state([]);\nlet list = items;\nlist = items[0];\nfunction get() {\n  return list;\n}')
    ).toEqual(['items']);
    expect(
      constable('let items = $state([[]]);\nlet list = items;\nlist = list[0];\nfunction get() {\n  return list;\n}')
    ).toEqual(['items']);
    expect(
      constable(
        "let items = $state([{ n: 0 }]);\nconst d = items[0];\nlet list = items;\nlist = d;\nsetContext('k', { list });"
      )
    ).toEqual(['items']);
  });

  it('drops a $state mutated through a local bound to the whole of it, directly or through another such local', () => {
    expect(constable('let s = $state([]);\nconst d = s;\nd.push(1);')).toEqual([]);
    expect(constable('let s = $state({ n: 0 });\nlet d = s;\nconst e = d;\ne.n = 1;')).toEqual([]);
    expect(constable('let s = $state({ n: 0 });\nlet d = s;\nd = { n: 1 };\nd.n = 2;')).toEqual(['s']);
  });

  it('drops a $state mutated through a local rebound to another part of the same $state', () => {
    expect(constable('let hours = $state([{ n: 0 }, { n: 1 }]);\nlet h = hours[0];\nh = hours[1];\nh.n = 1;')).toEqual(
      []
    );
    const walk = [
      'let list = $state({ head: { seen: false, next: null } });',
      'let node = list.head;',
      'while (node) {',
      '  node.seen = true;',
      '  node = node.next;',
      '}'
    ].join('\n');
    expect(constable(walk)).toEqual([]);
    const walkInFunction = [
      'let list = $state({ head: { seen: false, next: null } });',
      'function walk() {',
      '  let node = list.head;',
      '  while (node) {',
      '    node.seen = true;',
      '    node = node.next;',
      '  }',
      '}'
    ].join('\n');
    expect(constable(walkInFunction)).toEqual([]);
    expect(
      constable('let a = $state([{ n: 0 }]);\nlet b = $state([{ n: 0 }]);\nlet h = a[0];\nh = b[0];\nh.n = 1;')
    ).toEqual(['a', 'b']);
  });

  it('drops a $state mutated through locals that rebind each other within it', () => {
    expect(constable('let s = $state([{ n: 0 }]);\nlet a = s[0];\nconst b = a;\na = b;\nb.n = 1;')).toEqual([]);
    const walk = [
      'let list = $state({ head: { seen: false, next: null } });',
      'let cur = list.head;',
      'while (cur) {',
      '  const next = cur.next;',
      '  cur.seen = true;',
      '  cur = next;',
      '}'
    ].join('\n');
    expect(constable(walk)).toEqual([]);
  });

  it('does not follow a local rebound through a parameter that shadows the $state', () => {
    const script = [
      'let s = $state([{ n: 0 }]);',
      'let h = s[0];',
      'function detach(s) {',
      '  h = s[0];',
      '  h.n = 1;',
      '}'
    ].join('\n');
    expect(constable(script)).toEqual(['s']);
    const local = [
      'function f() {',
      '  let s = $state([{ n: 0 }]);',
      '  let h = s[0];',
      '  function detach(s) {',
      '    h = s[0];',
      '    h.n = 1;',
      '  }',
      '}'
    ].join('\n');
    expect(constable(local)).toEqual(['s']);
  });

  it('keeps a $state whose same-named parameter is what a local holds and writes through', () => {
    expect(constable('let s = $state([[]]);\nfunction use(s) {\n  const d = s[0];\n  d.push(1);\n}')).toEqual(['s']);
    expect(constable('let s = $state([[]]);\nfunction use(s) {\n  const d = s;\n  d.push(1);\n}')).toEqual(['s']);
    expect(
      constable('function f() {\n  let s = $state([]);\n  function g(s) {\n    const d = s;\n    d.push(1);\n  }\n}')
    ).toEqual(['s']);
    expect(
      constable('let s = $state([{ n: 0 }]);\nconst d = s[0];\nfunction f(d) {\n  const e = d;\n  e.n = 1;\n}')
    ).toEqual(['s']);
  });

  it('keeps a $state whose name or local is shadowed where it is written, passed, returned, placed or handed out by a getter', () => {
    const items = 'let items = $state([]);\nconst list = items;\n';
    expect(constable(`${items}function f(list) {\n  list.push(1);\n}`)).toEqual(['items']);
    expect(constable(`${items}function f(list) {\n  save(list);\n}`)).toEqual(['items']);
    expect(constable(`${items}function f(list) {\n  return list;\n}`)).toEqual(['items']);
    expect(constable(`${items}function f(list) {\n  setContext('k', { list });\n}`)).toEqual(['items']);
    expect(constable(`${items}const api = {\n  get rows() {\n    const list = [];\n    return list;\n  }\n};`)).toEqual(
      ['items']
    );
    expect(
      constable(
        'let items = $state([]);\nconst api = {\n  get rows() {\n    const items = [];\n    return items;\n  }\n};'
      )
    ).toEqual(['items']);
    expect(
      constable('let s = $state([{ n: 0 }]);\nconst d = s[0];\nfunction f() {\n  const d = { n: 0 };\n  d.n = 1;\n}')
    ).toEqual(['s']);
  });

  it('keeps following a local holding a $state when a same-named local elsewhere is rebound', () => {
    expect(
      constable('let s = $state([{ n: 0 }]);\nconst d = s[0];\nd.n = 1;\nfunction f() {\n  let d = [];\n  d = [1];\n}')
    ).toEqual([]);
    const placed = [
      'let items = $state([]);',
      'let x = [[]];',
      'const list = items;',
      'function f() {',
      '  let list = [];',
      '  list = x[0];',
      '}',
      "setContext('k', { list });"
    ].join('\n');
    expect(constable(placed)).toEqual([]);
  });

  it('keeps same-named bindings of different $states apart', () => {
    const local = 'function f() {\n  let b = $state([]);\n  const d = b;\n  d.push(1);\n}';
    const top = 'let a = $state([]);\nconst d = a;';
    expect(constable(`${local}\n${top}`)).toEqual(['a']);
    expect(constable(`${top}\n${local}`)).toEqual(['a']);
    expect(
      constable(
        'let s = $state([]);\nlet other = $state([{ x: 0 }]);\nfunction f() {\n  const s = other[0];\n  s.x = 1;\n}'
      )
    ).toEqual(['s']);
  });

  it('drops a $state declared in a function and mutated through a local rebound within it', () => {
    const script = [
      'function f() {',
      '  let s = $state([{ n: 0 }, { n: 1 }]);',
      '  let h = s[0];',
      '  h = s[1];',
      '  h.n = 1;',
      '}'
    ].join('\n');
    expect(constable(script)).toEqual([]);
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

  it('follows a local through the writes made before a statement rebinds it outside its $state', () => {
    const s = 'let s = $state({ items: [] });\nlet d = s.items;\n';
    expect(constable(`${s}d.push(1);\nd = [];`)).toEqual([]);
    expect(constable(`${s}const e = d;\nd = [];\ne.push(1);`)).toEqual([]);
    expect(constable(`${s}for (const x of xs) {\n  d.push(x);\n  d = [];\n}`)).toEqual([]);
    expect(
      constable('let s = $state({ items: [] });\nfunction f() {\n  let d = s.items;\n  d.push(1);\n  d = [];\n}')
    ).toEqual([]);
  });

  it('follows a local past a rebinding that may not run before the write', () => {
    const s = 'let s = $state({ items: [] });\nlet d = s.items;\n';
    expect(constable(`${s}if (c) d = [];\nd.push(1);`)).toEqual([]);
    expect(constable(`${s}while (c) {\n  d = [];\n}\nd.push(1);`)).toEqual([]);
    expect(constable(`${s}function reset() {\n  d = [];\n}\nd.push(1);`)).toEqual([]);
    expect(constable(`${s}d = [];\nd = s.items;\nd.push(1);`)).toEqual([]);
  });

  it('stops following a local where a rebinding outside its $state always runs first, or in a function another scope rebinds it for', () => {
    const s = 'let s = $state({ items: [] });\nlet d = s.items;\n';
    expect(constable(`${s}d = [];\nd.push(1);`)).toEqual(['s']);
    expect(constable(`${s}d = [];\nconst e = d;\ne.push(1);`)).toEqual(['s']);
    expect(constable(`${s}d = [];\nfunction add() {\n  d.push(1);\n}`)).toEqual(['s']);
    expect(constable(`${s}function add() {\n  d.push(1);\n}\nd = [];`)).toEqual(['s']);
    expect(constable(`${s}function add() {\n  d.push(1);\n}\nfunction reset() {\n  d = [];\n}`)).toEqual(['s']);
  });

  it('stops following a local in the body of a loop that rebinds it outside its $state, and after such a destructuring', () => {
    const s = 'let s = $state({ items: [] });\nlet d = s.items;\n';
    expect(constable(`${s}for (d of [[]]) d.push(1);`)).toEqual(['s']);
    expect(constable(`${s}[d] = [[]];\nd.push(1);`)).toEqual(['s']);
    expect(constable(`${s}for (d of [[]]) {}\nd.push(1);`)).toEqual([]);
  });

  it('follows a local that a loop or a destructuring rebinds within its $state, as a part of it', () => {
    expect(
      constable('let s = $state({ items: [{ n: 0 }] });\nlet d = s.items[0];\nfor (d of s.items) d.n = 1;')
    ).toEqual([]);
    expect(constable('let s = $state([[]]);\nlet d = s[0];\n[d] = s;\nd.push(1);')).toEqual([]);
    expect(
      constable('let items = $state([[]]);\nlet list = items;\n[list] = items;\nfunction get() {\n  return list;\n}')
    ).toEqual(['items']);
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

  it('drops a $state handed out in the template through a script local holding it', () => {
    const script = 'let items = $state([{ done: false }]);\nconst list = items;';
    expect(marked(script, '<Child items={list} />')).toEqual([]);
    expect(marked(script, '<button onclick={() => save(list)}>x</button>')).toEqual([]);
    expect(marked(script, '<div use:act={list}></div>')).toEqual([]);
    expect(marked(script, '{#each list as item}<button onclick={() => (item.done = true)}>x</button>{/each}')).toEqual(
      []
    );
    expect(marked('let items = $state([]);\nlet list = items;\nlist = [];', '<Child items={list} />')).toEqual([
      'items'
    ]);
  });

  it('drops a $state that a template handler returns, places or hands out from a getter, directly or through a script local holding it', () => {
    const script = 'let items = $state([]);\nconst list = items;';
    expect(marked(script, '<button onclick={() => { return list; }}>x</button>')).toEqual([]);
    expect(marked(script, '<button onclick={() => { const own = list; return own; }}>x</button>')).toEqual([]);
    expect(marked(script, "<button onclick={() => setContext('k', { items })}>x</button>")).toEqual([]);
    expect(marked(script, "<button onclick={() => setContext('k', { list })}>x</button>")).toEqual([]);
    expect(marked(script, '<button onclick={() => ({ get value() { return list; } })}>x</button>')).toEqual([]);
  });

  it('keeps a $state that a template handler returns or places as a copy or a part, or after rebinding its local to a part', () => {
    expect(marked('let n = $state(0);', '<button onclick={() => { return n; }}>x</button>')).toEqual(['n']);
    expect(marked('let n = $state(0);', '<button onclick={() => ({ get value() { return n; } })}>x</button>')).toEqual([
      'n'
    ]);
    expect(
      marked('let n = $state(0);\nconst m = n;', '<button onclick={() => ({ get value() { return m; } })}>x</button>')
    ).toEqual(['n']);
    expect(marked('let n = $state(0);', "<button onclick={() => setContext('k', { n })}>x</button>")).toEqual(['n']);
    expect(
      marked('let items = $state([{ n: 0 }]);\nconst d = items[0];', '<button onclick={() => { return d; }}>x</button>')
    ).toEqual(['items']);
    expect(
      marked(
        'let items = $state([{ n: 0 }]);\nlet list = items;',
        '<button onclick={() => { list = items[0]; }}>a</button><button onclick={() => { return list; }}>b</button>'
      )
    ).toEqual(['items']);
    expect(
      marked(
        'let items = $state([[]]);\nlet list = items;',
        '<button onclick={() => { list = list[0]; }}>a</button><button onclick={() => { return list; }}>b</button>'
      )
    ).toEqual(['items']);
  });

  it('follows a script local rebound to another part of the same $state into a template handler', () => {
    expect(
      marked(
        'let s = $state([{ n: 0 }, { n: 1 }]);\nlet d = s[0];',
        '<button onclick={() => { d = s[1]; d.n = 1; }}>x</button>'
      )
    ).toEqual([]);
    expect(
      marked(
        'let s = $state([{ n: 0 }, { n: 1 }]);\nlet d = s[0];\nd = s[1];',
        '<button onclick={() => (d.n = 1)}>x</button>'
      )
    ).toEqual([]);
  });

  it('follows a handler local rebound through a script local holding the $state', () => {
    expect(
      marked(
        'let s = $state([{ n: 0 }, { n: 1 }]);\nconst e = s;',
        '<button onclick={() => { let d = e[0]; d = e[1]; d.n = 1; }}>x</button>'
      )
    ).toEqual([]);
  });

  it('does not follow a local rebound through another local that some handler rebinds, in any handler order', () => {
    const script = 'let s = $state([{ n: 0 }]);\nlet e = s;\nlet d = s[0];';
    const through = '<button onclick={() => { d = e[0]; d.n = 1; }}>x</button>';
    const elsewhere = '<button onclick={() => (e = [])}>y</button>';
    expect(marked(script, through + elsewhere)).toEqual(['s']);
    expect(marked(script, elsewhere + through)).toEqual(['s']);
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

  it('does not follow into a template handler a script local that the script rebinds outside its $state', () => {
    expect(
      marked(
        'let s = $state({ items: [] });\nlet d = s.items;\nd = [];',
        '<button onclick={() => d.push(1)}>x</button>'
      )
    ).toEqual(['s']);
    expect(
      marked(
        'let s = $state({ items: [] });\nlet d = s.items;\nd.push(1);\nd = [];',
        '<button onclick={() => d.push(2)}>x</button>'
      )
    ).toEqual([]);
  });

  it('follows into a template handler a script local that a loop rebinds within its $state', () => {
    expect(
      marked(
        'let s = $state({ items: [{ n: 0 }] });\nlet d = s.items[0];',
        '<button onclick={() => { for (d of s.items) d.n = 1; }}>x</button>'
      )
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

  it('reads a block header and an element attribute outside the bindings they introduce, and a let: pattern inside them', () => {
    const script = 'let s = $state({ items: [] });\nconst d = s;';
    expect(marked(script, '{#each d.items.reverse() as d}{d}{/each}')).toEqual([]);
    expect(marked('let items = $state([]);', '<div slot="row" let:row={{ items }}>{items}</div>')).toEqual(['items']);
    expect(marked(script, '<div slot="row" let:d onclick={() => d.items.push(1)}>{d}</div>')).toEqual([]);
  });

  it('keeps a template handler local apart from a template binding of the same name', () => {
    const each = '{#each [{ n: 0 }] as d}<button onclick={() => d.n++}>b</button>{/each}';
    expect(
      marked('let s = $state([{ n: 0 }]);', `<button onclick={() => { const d = s[0]; }}>a</button>\n${each}`)
    ).toEqual(['s']);
    expect(
      marked('let s = $state([{ n: 0 }]);', `<button onclick={() => { const d = s; }}>a</button>\n${each}`)
    ).toEqual(['s']);
  });

  it('keeps a $state declared in a function apart from a top-level variable of its name', () => {
    const script = 'let count = 0;\nfunction make() {\n  let count = $state(0);\n  return () => count;\n}';
    expect(constable(`${script}\ncount++;`)).toEqual(['count']);
    expect(marked(script, '<button onclick={() => count++}>x</button>')).toEqual(['count']);
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

  it('keeps a $state holding a primitive whose methods are called, directly, through a local or in the template', () => {
    expect(constable('let n = $state(0);\nn.toFixed(2);')).toEqual(['n']);
    expect(constable("let s = $state('a');\nconst t = s;\nt.toUpperCase();\ns.length.toString();")).toEqual(['s']);
    expect(marked('let n = $state(0);', '<p>{n.toFixed(2)}</p>')).toEqual(['n']);
    expect(marked('let n = $state(0);', '<button onclick={() => n.toFixed(2)}>x</button>')).toEqual(['n']);
  });

  it('drops a $state holding a primitive once it is reassigned, or when a same-named $state holds an object', () => {
    expect(constable('let s = $state(null);\ns = [];\ns.push(1);')).toEqual([]);
    expect(constable('let s = $state(0);\nfunction f() {\n  let s = $state([]);\n}\ns.push(1);')).toEqual([]);
  });

  it('reads a loop that rebinds a $state without declaring it as a reassignment', () => {
    expect(constable('let s = $state(null);\nfor (s of rows) s.run();')).toEqual([]);
    expect(constable('let s = $state(null);\nfor (s in rows) {}')).toEqual([]);
    expect(constable('let s = $state(null);\nfor ([s] of rows) {}')).toEqual([]);
    expect(constable('let s = $state(null);\nfunction f() {\n  for (let s of rows) s.run();\n}')).toEqual(['s']);
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
