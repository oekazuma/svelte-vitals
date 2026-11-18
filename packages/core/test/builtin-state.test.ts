import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const reported = (script: string) =>
  parseComponentFacts(`<script>\n${script}\n</script>`, 'src/lib/C.svelte').nonreactiveBuiltinStates.map((s) => s.name);

describe('non-reactive built-in $state', () => {
  it('reports a built-in mutated inside a function or a class body', () => {
    const script = [
      'let inClass = $state(new Map());',
      'class Store {',
      "  x = inClass.set('a', 1);",
      '}',
      'let inExpr = $state(new Set());',
      'const K = class {',
      "  y = inExpr.add('a');",
      '};',
      "let bumped = $state(new URL('https://a.test'));",
      'function bump() {',
      '  bumped.port++;',
      '}',
      "let deleted = $state(new URL('https://a.test'));",
      'function drop() {',
      '  delete deleted.hash;',
      '}'
    ].join('\n');
    expect(reported(script)).toEqual(['inClass', 'inExpr', 'bumped', 'deleted']);
  });

  it('does not report one reassigned whole, mutated only at the top level, only read, or written deep below a Map', () => {
    const script = [
      'let swapped = $state(new Map());',
      'function a() {',
      '  swapped.set(1, 2);',
      '  swapped = other;',
      '}',
      'let objPat = $state(new Map());',
      'function b() {',
      '  objPat.set(1, 2);',
      '  ({ objPat } = next);',
      '}',
      'let arrPat = $state(new Map());',
      'function c() {',
      '  arrPat.set(1, 2);',
      '  [arrPat] = next;',
      '}',
      "let top = $state(new URL('https://a.test'));",
      "top.hash = 'x';",
      "let read = $state(new URL('https://a.test'));",
      'function d() {',
      '  const neg = !read.hash;',
      '  return read.searchParams;',
      '}',
      'let deep = $state(new Map());',
      'function e() {',
      "  deep.meta.set('a', 1);",
      '}'
    ].join('\n');
    expect(reported(script)).toEqual([]);
  });
});
