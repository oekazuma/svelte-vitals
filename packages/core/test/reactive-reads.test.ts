import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (src: string) => parseComponentFacts(src, 'src/lib/C.svelte');
const effectOver = (body: string) => `$effect(() => {\n  ${body}\n});`;

describe('reactive reads in effects', () => {
  it('takes a module export as reactive only when it is an import or an instance', () => {
    const src = [
      '<script module>',
      '  const a = make();',
      '  export { a };',
      '</script>',
      '<script>',
      effectOver('console.log(a.value);'),
      '</script>'
    ].join('\n');
    expect(facts(src).effects.map((e) => e.mountOnly)).toEqual([true]);
  });

  it('reads object values and computed keys, and not plain keys or a constructor call', () => {
    const src = [
      '<script>',
      'let count = $state(0);',
      effectOver('if (flag) console.log(1);'),
      effectOver('new Map();'),
      effectOver('console.log({ count: 1 });'),
      effectOver('console.log({ a: count });'),
      effectOver('console.log({ [count]: 1 });'),
      '</script>'
    ].join('\n');
    expect(facts(src).effects.map((e) => e.mountOnly)).toEqual([true, true, true, false, false]);
  });
});

describe('stale prop candidates', () => {
  it('skips an initializer that awaits', () => {
    expect(facts('<script>\n  let { size } = $props();\n  let px = await size;\n</script>\n{px}').stalePropDerivations).toEqual([]);
  });
});
