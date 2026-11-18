import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (script: string[], lang = '') =>
  parseComponentFacts(`<script${lang}>\n${script.join('\n')}\n</script>`, 'src/lib/C.svelte');
const constable = (script: string[], lang = '') => facts(script, lang).constableStates.map((s) => s.name);

describe('rune detection', () => {
  it('lets a function return a $state holding a primitive without handing it on', () => {
    const states: [string, string][] = [
      ['n', '0'],
      ['absent', ''],
      ['regex', '/x/'],
      ['tpl', '`x`'],
      ['tplExpr', '`${a}`'],
      ['neg', '-1'],
      ['negVar', '-x'],
      ['undef', 'undefined']
    ];
    const script = states.flatMap(([name, init], i) => [
      `let ${name} = $state(${init});`,
      `function get${i}() {`,
      `  return ${name};`,
      '}'
    ]);
    expect(constable(script)).toEqual(['n', 'absent', 'tpl', 'neg', 'undef']);
  });

  it('takes $state, $state.raw and $state.frozen as state, and no other .raw call', () => {
    expect(
      constable(['let cache = foo.raw([]);', 'let frozen = $state.frozen({});', 'let raw = $state.raw([]);'])
    ).toEqual(['frozen', 'raw']);
  });

  it('takes $derived.by as reactive in an effect, and no other call', () => {
    const script = [
      'let x = compute();',
      'let d = $derived.by(() => 1);',
      'let y = foo.by(() => 1);',
      'let z = $derived.other(() => 1);',
      ...['x', 'd', 'y', 'z'].map((v) => `$effect(() => {\n  console.log(${v}.value);\n});`)
    ];
    expect(facts(script).effects.map((e) => e.mountOnly)).toEqual([true, false, true, true]);
  });

  it('reads props from a single destructured $props() call, with only $bindable defaults exempt', () => {
    const mutated = (script: string[]) => facts(script).mutatedProps.map((m) => m.name);
    expect(
      mutated([
        'let { items = [], made = make(), loaded } = $props();',
        'let { a } = load();',
        'items.push(1);',
        'made.push(1);',
        'loaded.push(1);',
        'a.push(1);'
      ])
    ).toEqual(['items', 'made', 'loaded']);
    expect(mutated(['let { a } = $props();', 'let { b } = $props();', 'a.push(1);'])).toEqual([]);
    expect(mutated(['let [first] = $props();', 'first.push(1);'])).toEqual([]);
    expect(mutated(['export let items;', 'export const fixed = [];', 'fixed.push(1);', 'items.push(1);'])).toEqual([
      'items'
    ]);
  });

  it('holds a $state as an object only for an object value or object type', () => {
    expect(
      constable(
        [
          'let typed = $state<string[]>();',
          'const p = { typed };',
          'let pick = $state(flag && []);',
          'const q = [pick];'
        ],
        ' lang="ts"'
      )
    ).toEqual(['typed', 'pick']);
  });

  it('takes only a $state() call as a state-raw candidate', () => {
    expect(facts(['let r = make([]);', 'r = [1];']).rawableStates).toEqual([]);
  });
});
