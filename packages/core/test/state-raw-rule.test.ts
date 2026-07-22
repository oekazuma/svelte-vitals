import { describe, it, expect } from 'vitest';
import { performanceStateRaw } from '../src/rules/perf/state-raw.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return {
    heads: [],
    project: defaultProject,
    config,
    components
  } as RuleContext;
}

function comp(file: string, rawableStates: ComponentFacts['rawableStates']): ComponentFacts {
  return { ...emptyComponentFacts(file), rawableStates };
}

describe('performance/state-raw', () => {
  it('suggests $state.raw per candidate at info severity', async () => {
    const results = await performanceStateRaw.check(ctx([comp('src/lib/Feed.svelte', [{ name: 'posts', line: 4 }])]));
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/lib/Feed.svelte');
    expect(penalized[0]!.line).toBe(4);
    expect(penalized[0]!.severity).toBe('info');
    expect(penalized[0]!.message).toBe(
      '"posts" is an object/array $state that is only ever reassigned, never mutated — $state.raw skips the deep-proxy overhead (reassignment stays reactive).'
    );
    expect(penalized[0]!.fix?.description).toBeTruthy();
    expect(penalized[0]!.fix?.snippet).toBeUndefined();
  });

  it('emits nothing without candidates', async () => {
    expect(await performanceStateRaw.check(ctx([comp('src/lib/Ok.svelte', [])]))).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'performance/state-raw')).toBe(true);
    expect(explainRule('performance/state-raw')?.severity).toBe('info');
  });
});
