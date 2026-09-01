import { describe, it, expect } from 'vitest';
import { correctnessNonreactiveBuiltinState } from '../src/rules/correctness/nonreactive-builtin-state.js';
import { emptyComponentFacts } from '../src/component.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, nonreactiveBuiltinStates: ComponentFacts['nonreactiveBuiltinStates']): ComponentFacts {
  return { ...emptyComponentFacts(file), nonreactiveBuiltinStates };
}

describe('correctness/nonreactive-builtin-state', () => {
  it('flags each binding with the type-interpolated message at warning severity', async () => {
    const results = await correctnessNonreactiveBuiltinState.check(
      ctx([comp('src/lib/Tags.svelte', [{ name: 'tags', type: 'Set', line: 3 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/lib/Tags.svelte');
    expect(penalized[0]!.line).toBe(3);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toBe(
      '"tags" is a plain Set in $state — its mutations are not tracked, so the UI silently stops updating when it changes. Use SvelteSet from \'svelte/reactivity\'.'
    );
    expect(penalized[0]!.fix?.description).toContain('svelte/reactivity');
    expect(penalized[0]!.fix?.snippet).toBeUndefined();
  });

  it('emits nothing without the fact', async () => {
    expect(await correctnessNonreactiveBuiltinState.check(ctx([comp('src/lib/Ok.svelte', [])]))).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/nonreactive-builtin-state')).toBe(true);
    expect(explainRule('correctness/nonreactive-builtin-state')?.severity).toBe('warning');
  });
});
