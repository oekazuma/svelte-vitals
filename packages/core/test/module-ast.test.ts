import { describe, it, expect } from 'vitest';
import { parse } from 'svelte/compiler';
import {
  browserOnlyRanges,
  collectDerivedGuardBindings,
  collectNamedImportAliases,
  collectProgramBindings,
  collectSvelteLifecycleImports,
  matchLifecycleCall,
  parseModuleProgram,
  scopeIntroducedNames
} from '../src/module-ast.js';
import { parseKitModuleFacts } from '../src/kit-module-parse.js';

const program = (src: string) => parseModuleProgram(src, 'src/lib/x.ts').program;

describe('collectProgramBindings', () => {
  it('binds imports, declarations and a legacy $: assignment, and nothing else at the top level', () => {
    const src = [
      "import def, { named } from 'm';",
      "import * as ns from 'n';",
      '$: legacy = 1;',
      '$: compound += 1;',
      '$: {',
      '  blockAssigned = 1;',
      '}',
      'foo: labelled = 1;',
      'let a,',
      '  { b, c: [d] } = obj;',
      'export const e = 1;',
      'function f() {}',
      'class G {}',
      'export function h() {}',
      'export default function () {}',
      'x = 1;'
    ].join('\n');
    expect([...collectProgramBindings(program(src))].sort()).toEqual([
      'G',
      'a',
      'b',
      'd',
      'def',
      'e',
      'f',
      'h',
      'legacy',
      'named',
      'ns'
    ]);
  });
});

describe('collectProgramBindings — default exports', () => {
  it('binds the name of a default-exported class', () => {
    expect([...collectProgramBindings(program('export default class K {}'))]).toEqual(['K']);
  });
});

describe('collectDerivedGuardBindings', () => {
  it('takes a top-level const or let whose value is a browser guard', () => {
    const src = [
      'const canUse = browser && x;',
      'let canLet = browser;',
      'var canVar = browser;',
      'export const exported = browser;',
      'const notGuard = 1;',
      'const { destructured } = browser;',
      'let noInit;',
      'const either = browser || other;',
      "const both = browser || typeof window !== 'undefined';",
      "const objectEq = typeof window == 'object';",
      "const looseNe = typeof window != 'undefined';",
      "const fnEq = typeof matchMedia === 'function';",
      "const fnNe = typeof matchMedia !== 'function';",
      "const untracked = typeof notAGlobal === 'undefined';",
      'const dynamicKind = typeof window === kind;'
    ].join('\n');
    expect([...collectDerivedGuardBindings(program(src), new Set(['browser']))].sort()).toEqual([
      'both',
      'canLet',
      'canUse',
      'exported',
      'fnEq',
      'looseNe',
      'objectEq'
    ]);
  });
});

describe('browser-global scan — early-return guards', () => {
  it('stops after a browser guard whose branch ends in return or throw, and only then', () => {
    const src = [
      "import { browser } from '$app/environment';",
      'export function GET() {',
      '  if (!browser) return;',
      '  window.a;',
      '}',
      'export function POST() {',
      '  if (!browser) throw new Error();',
      '  window.b;',
      '}',
      'export function PUT() {',
      '  if (!browser) {',
      "    console.log('server');",
      '    return;',
      '  }',
      '  window.c;',
      '}',
      'export function HEAD() {',
      '  if (!browser) {',
      "    console.log('server');",
      '    throw new Error();',
      '  }',
      '  window.h;',
      '}',
      'export function PATCH() {',
      '  if (!browser) {',
      "    console.log('server');",
      '  }',
      '  document.d;',
      '}',
      'export function DELETE() {',
      '  if (!browser) {}',
      '  document.e;',
      '}',
      'export function OPTIONS() {',
      "  if (!browser) console.log('server');",
      '  document.f;',
      '}'
    ].join('\n');
    expect(parseKitModuleFacts(src, 'src/routes/api/+server.ts').browserGlobalRefs).toEqual([
      { name: 'document', line: 28, inHandler: true },
      { name: 'document', line: 32, inHandler: true },
      { name: 'document', line: 36, inHandler: true }
    ]);
  });
});

describe('browser-global scan — typeof G === undefined || …', () => {
  it('treats only G as safe on the right, and every DOM-only global when G is DOM-only', () => {
    const src = [
      'export function GET() {',
      "  const a = typeof localStorage === 'undefined' || localStorage.getItem('k');",
      "  const b = typeof localStorage === 'undefined' || document.title;",
      "  const c = typeof window === 'undefined' || document.title;",
      "  const d = typeof window == 'undefined' || document.cookie;",
      "  const e = typeof window !== 'undefined' || document.body;",
      "  const f = 'undefined' === typeof window || document.head;",
      "  const g = typeof window === 'object' || document.links;",
      "  const h = typeof window.x === 'undefined' || document.forms;",
      "  const i = typeof notTracked === 'undefined' || document.images;",
      '}'
    ].join('\n');
    expect(parseKitModuleFacts(src, 'src/routes/api/+server.ts').browserGlobalRefs).toEqual([
      { name: 'document', line: 3, inHandler: true },
      { name: 'document', line: 6, inHandler: true },
      { name: 'document', line: 8, inHandler: true },
      { name: 'window', line: 9, inHandler: true },
      { name: 'document', line: 9, inHandler: true },
      { name: 'document', line: 10, inHandler: true }
    ]);
  });
});

describe('browserOnlyRanges', () => {
  const ranges = (src: string) => {
    const { program, wrapped } = parseModuleProgram(src, 'src/lib/x.ts');
    return browserOnlyRanges(program, new Set(['browser'])).map(([a, b]) => wrapped.slice(a, b));
  };

  it('selects the arm each guard form proves browser-only, through derived consts, typeof tests and && / ||', () => {
    const src = [
      "import { browser } from '$app/environment';",
      'const onClient = browser;',
      'const onServer = !browser;',
      'const both = browser && ready;',
      'const either = browser || ready;',
      'let mutable = browser;',
      'const { destructured } = browser;',
      'const notGuard = compute();',
      'if (browser) a1();',
      'else s1();',
      'if (!browser) s2();',
      'else a2();',
      'if (onClient) a3();',
      'if (onServer) s3();',
      'else a4();',
      'if (both) a5();',
      'if (either) s4();',
      'if (mutable) s5();',
      'x = browser ? a6() : s6();',
      'y = browser && a7();',
      'z = !browser || a8();',
      'w = browser || s7();',
      'v = !browser && s8();',
      "if (typeof window !== 'undefined') a9();",
      "if (typeof window === 'undefined') s9();",
      'else a10();',
      "if (typeof window == 'undefined') s10();",
      'else a11();',
      "if (typeof window != 'undefined') a12();",
      "if (typeof window === 'object') a13();",
      "if (typeof window !== 'object') s11();",
      'else a14();',
      "if (typeof localStorage !== 'undefined') s12();",
      'if (typeof window === kind) s13();',
      'if (browser && loaded) a15();',
      'if (ready && browser) a16();',
      'if (browser || !browser) s14();',
      'if (!browser || !ready) s15();',
      'else a17();',
      'if (browser || onClient) a20();',
      '{',
      "  if (!browser) throw new Error('client only');",
      '  a18();',
      '  a19();',
      '}',
      'function f(browser) {',
      '  if (browser) s16();',
      '}'
    ].join('\n');
    expect(ranges(src)).toEqual([
      'ready',
      'a1();',
      'a2();',
      'a3();',
      'a4();',
      'a5();',
      'a6()',
      'a7()',
      'a8()',
      'a9();',
      'a10();',
      'a11();',
      'a12();',
      'a13();',
      'a14();',
      'a15();',
      'loaded',
      'a16();',
      'a17();',
      '!ready',
      'a20();',
      'a18();\n  a19();'
    ]);
  });

  it('covers the rest of the program after a top-level guard that throws on the server', () => {
    const src = [
      "import { browser } from '$app/environment';",
      "if (!browser) throw new Error('client only');",
      'a();',
      'b();'
    ].join('\n');
    expect(ranges(src)).toEqual(['a();\nb();']);
  });
});

describe('browser-global scan — read positions', () => {
  it('reports reads in every expression position, and not labels or bare re-exports', () => {
    const src = [
      "import { browser } from '$app/environment';",
      "export { confirm } from './dialogs';",
      'export function GET() {',
      '  const n1 = !navigator.onLine;',
      '  const n2 = cache[location.href];',
      '  const n3 = { [screen.width]: 1 };',
      '  const n4 = (document satisfies object).title;',
      '  const n5 = history!.length;',
      '  const n6 = alert<string>;',
      '  const n7 = typeof window.x;',
      '  const n8 = !sessionStorage;',
      '  prompt: for (const x of [1]) {',
      '    if (x) break prompt;',
      '    continue prompt;',
      '  }',
      '}'
    ].join('\n');
    expect(parseKitModuleFacts(src, 'src/routes/api/+server.ts').browserGlobalRefs).toEqual([
      { name: 'navigator', line: 4, inHandler: true },
      { name: 'location', line: 5, inHandler: true },
      { name: 'screen', line: 6, inHandler: true },
      { name: 'document', line: 7, inHandler: true },
      { name: 'history', line: 8, inHandler: true },
      { name: 'alert', line: 9, inHandler: true },
      { name: 'window', line: 10, inHandler: true },
      { name: 'sessionStorage', line: 11, inHandler: true }
    ]);
  });

  it('stops the top-level scan after a guard that throws on the server', () => {
    const src = [
      "import { browser } from '$app/environment';",
      "if (!browser) throw new Error('client only');",
      'const w = window.innerWidth;',
      'export function load() {}'
    ].join('\n');
    expect(parseKitModuleFacts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
  });
});

type AnyNode = { type: string; [key: string]: unknown };
const nodesOf = (root: unknown, type: string): AnyNode[] => {
  const out: AnyNode[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if ((n as AnyNode).type === type) out.push(n as AnyNode);
    for (const [k, v] of Object.entries(n)) if (k !== 'loc' && k !== 'metadata') walk(v);
  };
  walk(root);
  return out;
};
const introduced = (root: unknown, type: string) => nodesOf(root, type).map((n) => [...scopeIntroducedNames(n)].sort());

describe('scopeIntroducedNames', () => {
  it('binds parameters, catch params, block declarations and loop variables', () => {
    const src = [
      'function f(a, { b, c: [d] }, ...e) {}',
      'const g = function (h = 1) {};',
      'const i = ({ j, ...k }) => {};',
      'try {',
      '} catch ({ message: m }) {}',
      'for (let r = 0; ; ) {}',
      'for (const s of []) {}',
      'for (const t in {}) {}',
      'for (u of []) {}',
      'if (x) {',
      '  let l;',
      '  const [n] = [];',
      '  function o() {}',
      '  class P {}',
      '  var q;',
      '  x = 1;',
      '}'
    ].join('\n');
    const p = program(src);
    expect(introduced(p, 'FunctionDeclaration')).toEqual([['a', 'b', 'd', 'e'], []]);
    expect(introduced(p, 'FunctionExpression')).toEqual([['h']]);
    expect(introduced(p, 'ArrowFunctionExpression')).toEqual([['j', 'k']]);
    expect(introduced(p, 'CatchClause')).toEqual([['m']]);
    expect(introduced(p, 'ForStatement')).toEqual([['r']]);
    expect(introduced(p, 'ForOfStatement')).toEqual([['s'], []]);
    expect(introduced(p, 'ForInStatement')).toEqual([['t']]);
    expect(introduced(p, 'BlockStatement').filter((names) => names.length > 0)).toEqual([['P', 'l', 'n', 'o', 'q']]);
  });

  it("binds a named function or class expression's own name inside it, and a declaration's name outside it", () => {
    const p = program(
      ['const f = function self(a) {};', 'const C = class Own {};', 'const D = class {};', 'function decl() {}'].join(
        '\n'
      )
    );
    expect(introduced(p, 'FunctionExpression')).toEqual([['a', 'self']]);
    expect(introduced(p, 'ClassExpression')).toEqual([['Own'], []]);
    expect(introduced(p, 'FunctionDeclaration')).toEqual([[]]);
  });

  it('binds the template constructs that introduce names', () => {
    const ast = parse(
      [
        '{#each items as { id, label }, i}{/each}',
        '{#each rows as row}{/each}',
        '{#snippet line(a, { b })}{/snippet}',
        '{#await p then value}{:catch error}{/await}',
        '<Comp title="t" let:item let:pair={{ x }} let:tuple={[y, z]} let:entry={alias}>{@const c = 1}</Comp>'
      ].join('\n'),
      { modern: true }
    );
    expect(introduced(ast, 'EachBlock')).toEqual([['i', 'id', 'label'], ['row']]);
    expect(introduced(ast, 'SnippetBlock')).toEqual([['a', 'b']]);
    expect(introduced(ast, 'AwaitBlock')).toEqual([['error', 'value']]);
    expect(introduced(ast, 'Component')).toEqual([['alias', 'item', 'x', 'y', 'z']]);
    expect(introduced(ast, 'Fragment').filter((names) => names.length > 0)).toEqual([['c']]);
  });
});

describe('svelte lifecycle imports and calls', () => {
  it('tracks value imports of lifecycle names from svelte, by alias, and namespace member calls', () => {
    const src = [
      "import { onMount, getContext as ctx, tick, type hasContext } from 'svelte';",
      "import type { setContext } from 'svelte';",
      "import * as svelte from 'svelte';",
      "import { onDestroy } from 'not-svelte';",
      'onMount();',
      'ctx();',
      'tick();',
      'hasContext();',
      'setContext();',
      'svelte.onDestroy();',
      "svelte['onMount']();",
      'svelte.tick();',
      'other.onMount();',
      'onDestroy();'
    ].join('\n');
    const p = program(src);
    const imports = collectSvelteLifecycleImports(p);
    expect([...imports.locals]).toEqual([
      ['onMount', 'onMount'],
      ['ctx', 'getContext']
    ]);
    expect([...imports.namespaces]).toEqual(['svelte']);
    expect(nodesOf(p, 'CallExpression').map((c) => matchLifecycleCall(c, imports))).toEqual([
      { canonical: 'onMount', local: 'onMount' },
      { canonical: 'getContext', local: 'ctx' },
      undefined,
      undefined,
      undefined,
      { canonical: 'onDestroy', local: 'svelte' },
      undefined,
      undefined,
      undefined,
      undefined
    ]);
  });

  it('collects value-imported aliases of the named exports from one module only', () => {
    const src = [
      "import { goto as go, invalidate } from '$app/navigation';",
      "import { goto } from 'other';",
      "import type { goto as typed } from '$app/navigation';",
      "import { type goto as typed2 } from '$app/navigation';",
      "import * as nav from '$app/navigation';",
      "import goto2 from '$app/navigation';"
    ].join('\n');
    expect([...collectNamedImportAliases(program(src), '$app/navigation', new Set(['goto']))]).toEqual(['go']);
  });
});
