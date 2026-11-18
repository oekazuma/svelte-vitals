import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (markup: string) => parseComponentFacts(markup, 'src/lib/C.svelte');
const eachLines = (blocks: string[]) => facts(blocks.join('\n')).eachBlocks.map((b) => b.line);

describe('identity-free each blocks', () => {
  it('skips lists built from a length and blocks with no item, and nothing else', () => {
    const skipped = [
      '{#each Array(n) as _}x{/each}',
      '{#each Array.from({ length: n, x: 1 }) as _}x{/each}',
      "{#each { 'length': 8 } as _}x{/each}",
      '{#each [a].fill(0) as _}x{/each}',
      '{#each items}x{/each}'
    ];
    const kept = [
      '{#each Foo(n) as _}x{/each}',
      '{#each Foo.from({ length: n }) as _}x{/each}',
      '{#each Array.of({ length: n }) as _}x{/each}',
      '{#each Array.from({ size: n }) as _}x{/each}',
      '{#each { size: 8 } as _}x{/each}',
      '{#each { [length]: 8 } as _}x{/each}',
      '{#each [...items, x].fill(0) as _}x{/each}',
      '{#each [...Array(3), ...items] as _}x{/each}',
      '{#each getItems() as x}x{/each}'
    ];
    expect(eachLines([...skipped, ...kept])).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });
});

describe('index keys', () => {
  it('takes a key as the index only when it converts the index alone', () => {
    const keys = [
      'String(i)',
      'i.toString()',
      '`${i}`',
      "'' + i",
      'foo(i)',
      'String(i, 10)',
      'i.valueOf()',
      'i.toString(16)',
      'keyOf(item)',
      '`${i}${j}`',
      "i - ''"
    ];
    const blocks = keys.map((k) => `{#each items as item, i (${k})}x{/each}`);
    expect(facts(blocks.join('\n')).eachBlocks.map((b) => b.indexKey ?? false)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    ]);
  });
});

describe('dnd zones', () => {
  const zoneChild = (zone: string) =>
    facts(`<div ${zone}>\n  <div role="listitem" aria-label="a"></div>\n</div>`).ariaElements!.map(
      (e) => e.hasAction ?? false
    );

  it('takes a dndzone action as a zone unless its last word on autoAriaDisabled is a literal true', () => {
    expect(zoneChild('use:dndzone={opts}')).toEqual([true]);
    expect(zoneChild('use:dndzone={{ autoAriaDisabled: true, [k]: false }}')).toEqual([true]);
    expect(zoneChild('use:dndzone={{ autoAriaDisabled: true, items }}')).toEqual([false]);
    expect(zoneChild('dndzone="x"')).toEqual([false]);
    expect(zoneChild('use:tooltip={opts}')).toEqual([false]);
  });
});
