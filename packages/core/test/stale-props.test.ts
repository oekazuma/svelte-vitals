import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (src: string) => parseComponentFacts(src, 'src/lib/C.svelte');
const stale = (script: string, markup: string) =>
  facts(`<script>\n${script}\n</script>\n${markup}`).stalePropDerivations.map((d) => d.name);

describe('stale prop derivations', () => {
  it('takes a prop read anywhere in the initializer but a member or key name', () => {
    const script = [
      'let { size } = $props();',
      'let pair = [size, 1];',
      'let label = obj.size;',
      'let o = { size: 1 };',
      'let byKey = obj[size];',
      'let keyed = { [size]: 1 };'
    ].join('\n');
    expect(stale(script, '{pair}{label}{o}{byKey}{keyed}')).toEqual(['pair', 'byKey', 'keyed']);
  });

  it('counts only template reads that render, outside member and key names and shadowing each items', () => {
    const script = [
      'let { heading } = $props();',
      "let title = heading + '!';",
      "let viaMember = heading + '#';",
      "let inHandler = heading + '%';",
      "let viaKey = heading + '?';",
      "let viaValue = heading + '.';",
      "let inBody = heading + ',';",
      "let viaIndex = heading + ';';",
      "let shadowed = heading + ':';"
    ].join('\n');
    const markup = [
      '<div title="static"></div>',
      '{obj.viaMember}',
      '<button onclick={() => inHandler}>x</button>',
      '{({ viaKey: 1, a: viaValue }).a}',
      '{#each items as item}{inBody}{/each}',
      '{obj[viaIndex]}',
      '{#each items as shadowed}{shadowed}{/each}'
    ].join('\n');
    expect(stale(script, markup)).toEqual(['viaValue', 'inBody', 'viaIndex']);
  });
});

describe('assign-only effects', () => {
  it('does not take an empty effect body as assign-only', () => {
    const src = '<script>\n  let n = $state(0);\n  $effect(() => {});\n  $effect(() => {\n    n = 1;\n  });\n</script>';
    expect(facts(src).effects.map((e) => e.assignsOnlyState)).toEqual([false, true]);
  });
});
