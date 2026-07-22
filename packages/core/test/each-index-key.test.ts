import { describe, it, expect } from 'vitest';
import { correctnessEachIndexKey } from '../src/rules/correctness/each-index-key.js';
import { correctnessEachKey } from '../src/rules/correctness/each-key.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, eachBlocks: ComponentFacts['eachBlocks']): ComponentFacts {
  return { ...emptyComponentFacts(file), eachBlocks };
}

describe('correctness/each-index-key', () => {
  it('flags each index-keyed block at its line', async () => {
    const results = await correctnessEachIndexKey.check(
      ctx([
        comp('src/lib/List.svelte', [
          { hasKey: true, line: 3, indexKey: true },
          { hasKey: true, line: 9 }
        ])
      ])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/lib/List.svelte');
    expect(penalized[0]!.line).toBe(3);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toBe(
      '{#each} is keyed by its index — identity follows position, exactly like an unkeyed block, but the key makes it look safe.'
    );
  });

  it('emits nothing for components without the flag', async () => {
    const results = await correctnessEachIndexKey.check(ctx([comp('src/lib/Ok.svelte', [{ hasKey: true, line: 1 }])]));
    expect(results).toEqual([]);
  });

  it('does not overlap with each-key on a mixed component', async () => {
    const facts = comp('src/lib/Mixed.svelte', [
      { hasKey: false, line: 2 },
      { hasKey: true, line: 5, indexKey: true }
    ]);
    const unkeyed = (await correctnessEachKey.check(ctx([facts]))).filter((r) => r.detection.presence === 'none');
    const indexKeyed = (await correctnessEachIndexKey.check(ctx([facts]))).filter(
      (r) => r.detection.presence === 'none'
    );
    expect(unkeyed.map((r) => r.line)).toEqual([2]);
    expect(indexKeyed.map((r) => r.line)).toEqual([5]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/each-index-key')).toBe(true);
    expect(explainRule('correctness/each-index-key')?.title).toBe('Index used as each key');
  });
});
