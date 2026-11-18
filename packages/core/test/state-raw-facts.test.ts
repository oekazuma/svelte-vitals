import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const rawable = (script: string[], markup: string[]) =>
  parseComponentFacts(`<script>\n${script.join('\n')}\n</script>\n${markup.join('\n')}`, 'src/lib/C.svelte').rawableStates.map(
    (s) => s.name
  );

/** `let name = $state([]); name = [1];` — a candidate whose only write replaces it whole. */
const replaced = (name: string) => [`let ${name} = $state([]);`, `${name} = [1];`];

describe('state-raw candidates', () => {
  it('keeps a whole-replaced $state raw past member names, keys, pattern holes, class directives and shadowing', () => {
    const script = [
      ...replaced('named'),
      'const viaProp = obj.named;',
      'const viaKey = { named: 1 };',
      'const { named: renamed } = obj;',
      ...replaced('holey'),
      'const [, w] = arr;',
      ...replaced('dirClass'),
      ...replaced('paramShadow'),
      ...replaced('eachShadow'),
      ...replaced('outerShadow')
    ];
    const markup = [
      '<div class:on={dirClass.length > 0}></div>',
      '<button onclick={(paramShadow) => (cache = paramShadow)}>x</button>',
      '{#each rows as eachShadow}<button onclick={() => (cache = eachShadow)}>x</button>{/each}',
      '{#each others as outerShadow}{#each outerShadow as item}<button onclick={() => (item.x = 1)}>x</button>{/each}{/each}'
    ];
    expect(rawable(script, markup)).toEqual(['named', 'holey', 'dirClass', 'paramShadow', 'eachShadow', 'outerShadow']);
  });

  it('drops one read in script, referenced from a pattern, reassigned by destructuring or whose each index escapes', () => {
    const script = [
      ...replaced('lengthRead'),
      'const n = lengthRead.length;',
      ...replaced('indexed'),
      'const v = obj[indexed];',
      ...replaced('computedKey'),
      'const o = { [computedKey]: 1 };',
      ...replaced('valued'),
      'const p = { a: valued };',
      ...replaced('destructured'),
      'const { [destructured]: d } = obj;',
      ...replaced('arrDefault'),
      'const [x = arrDefault] = arr;',
      ...replaced('nestedDefault'),
      'const [[y = nestedDefault] = []] = arr;',
      ...replaced('restDefault'),
      'const [...[z = restDefault]] = arr;',
      'let patterned = $state([]);',
      '[patterned] = [[1]];',
      ...replaced('picked')
    ];
    const markup = ['{#each picked as item, i}<button onclick={() => choose(i)}>x</button>{/each}'];
    expect(rawable(script, markup)).toEqual([]);
  });
});
