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
      'h = hours[1];',
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
