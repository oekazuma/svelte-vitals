import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const moduleFacts = (src: string) => parseComponentFacts(src, 'src/lib/x.svelte.ts');

describe('runes module facts', () => {
  it('reports $effect and $effect.pre only, by the $effect binding itself', () => {
    const src = [
      '$effect(() => {});',
      '$effect.pre(() => {});',
      '$effect.tracking();',
      'foo.pre(() => {});',
      'x.$effect.pre(() => {});',
      "$effect['pre'](() => {});",
      'pre(() => {});'
    ].join('\n');
    expect(moduleFacts(src).orphanEffects.map((e) => e.line)).toEqual([1, 2]);
  });

  it('reports a top-level instance of a class whose constructor runs $effect, in line order', () => {
    const src = [
      'class A {',
      '  m() {',
      '    $effect(() => {});',
      '  }',
      '}',
      'class B {',
      '  constructor() {',
      '    $effect(() => {});',
      '  }',
      '}',
      'export default class {',
      '  constructor() {',
      '    $effect(() => {});',
      '  }',
      '}',
      'new A();',
      'if (x) new B();',
      'new B();',
      'export const b = new B();',
      '$effect(() => {});'
    ].join('\n');
    expect(moduleFacts(src).orphanEffects).toEqual([
      { line: 18, kind: 'constructor-instantiated', className: 'B' },
      { line: 19, kind: 'constructor-instantiated', className: 'B' },
      { line: 20, kind: 'top-level' }
    ]);
  });

  it('reports a namespace import used other than through static members, type members and renamed exports', () => {
    const src = [
      "import * as X from 'pkg-x';",
      "import * as Y from 'pkg-y';",
      "import * as Z from 'pkg-z';",
      "import * as W from 'pkg-w';",
      "import * as V from 'pkg-v';",
      "import * as U from 'pkg-u';",
      'const a = X[k];',
      'const b = Y[0];',
      'const c = obj[Z];',
      'export { W };',
      'export { foo as V };',
      'interface I {',
      '  U(): void;',
      '}'
    ].join('\n');
    expect(moduleFacts(src).namespaceImports).toEqual([
      { source: 'pkg-x', line: 1 },
      { source: 'pkg-y', line: 2 },
      { source: 'pkg-z', line: 3 },
      { source: 'pkg-w', line: 4 }
    ]);
  });

  it('records module $state and instances of classes with a $state field, in line order', () => {
    const src = [
      'class Store {',
      '  count = $state(0);',
      '  inc() {}',
      '}',
      'class Plain {',
      '  x = 1;',
      '  m() {}',
      '}',
      'export const store = new Store();',
      'const plain = new Plain();',
      'const other = 1;',
      'const { a } = new Store();',
      'let late = $state(0);',
      'let { b } = $state({ b: 1 });',
      'export default class {',
      '  n = $state(0);',
      '}'
    ].join('\n');
    expect(moduleFacts(src).moduleStateDecls).toEqual([
      { name: 'store', line: 9 },
      { name: 'Store', line: 12 },
      { name: 'late', line: 13 }
    ]);
  });
});
