import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (src: string) => parseComponentFacts(src, 'src/lib/C.svelte');

describe('parseComponentFacts wiring', () => {
  it('skips duplicate <dt> checks in an SVG-namespace component', () => {
    const dl = '<dl><dt>a</dt><dd>1</dd><dt>a</dt><dd>2</dd></dl>';
    expect(facts(dl).duplicateDts).toHaveLength(1);
    expect(facts(`<svelte:options namespace="svg" />\n${dl}`).duplicateDts).toEqual([]);
  });

  it('orders base-path links by line across script goto calls and template anchors', () => {
    const src = [
      '<script>',
      "  import { goto } from '$app/navigation';",
      '  function go() {',
      "    goto('/a');",
      '  }',
      '</script>',
      '<a href="/b">b</a>'
    ].join('\n');
    expect(facts(src).basePathLinks.map((l) => l.line)).toEqual([4, 7]);
  });

  it('drops a stale prop derivation the template writes', () => {
    const script = '<script>\n  let { size } = $props();\n  let px = size * 2;\n</script>\n<p>{px}</p>';
    expect(facts(script).stalePropDerivations.map((d) => d.name)).toEqual(['px']);
    expect(facts(`${script}\n<button onclick={() => (px = 0)}>r</button>`).stalePropDerivations).toEqual([]);
  });

  it('takes module-script instances and their aliases as reactive in an effect', () => {
    const effectOver = (name: string) =>
      `<script>\n  $effect(() => {\n    console.log(${name}.value);\n  });\n</script>`;
    const newed = `<script module>\n  const store = new Store();\n</script>\n${effectOver('store')}`;
    const aliased = `<script module>\n  const store = new Store();\n  const s = store;\n</script>\n${effectOver('s')}`;
    expect([facts(newed), facts(aliased)].map((f) => f.effects.map((e) => e.mountOnly))).toEqual([[false], [false]]);
  });

  it('reads an $effect body only from an inline function', () => {
    const src = [
      '<script>',
      '  let count = $state(0);',
      '  let source = $state(1);',
      '  $effect(function () {',
      '    count = source;',
      '  });',
      '  $effect(handler);',
      '</script>'
    ].join('\n');
    expect(facts(src).effects.map((e) => [e.assignsOnlyState, e.mountOnly])).toEqual([
      [true, false],
      [false, false]
    ]);
  });

  it('takes a $state named anywhere in a component prop as handed on, and names no destructured $state', () => {
    expect(facts('<script>\n  let list = $state([]);\n</script>\n<Child items={[list]} />').constableStates).toEqual(
      []
    );
    expect(facts('<script>\n  let { a } = $state({ a: 1 });\n</script>\n{a}').constableStates).toEqual([]);
  });
});
