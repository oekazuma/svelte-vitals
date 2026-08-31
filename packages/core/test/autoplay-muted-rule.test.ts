import { describe, it, expect } from 'vitest';
import { correctnessAutoplayMuted } from '../src/rules/correctness/autoplay-muted.js';
import { emptyComponentFacts } from '../src/component.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, videosAutoplayNoMuted: ComponentFacts['videosAutoplayNoMuted']): ComponentFacts {
  return { ...emptyComponentFacts(file), videosAutoplayNoMuted };
}

describe('correctness/autoplay-muted', () => {
  it('flags an autoplay video without muted at warning severity', async () => {
    const results = await correctnessAutoplayMuted.check(ctx([comp('src/routes/+page.svelte', [{ line: 3 }])]));
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/routes/+page.svelte');
    expect(penalized[0]!.line).toBe(3);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toContain('audible autoplay');
    expect(penalized[0]!.fix?.snippet).toContain('muted');
  });

  it('flags each fact independently', async () => {
    const results = await correctnessAutoplayMuted.check(
      ctx([comp('src/routes/+page.svelte', [{ line: 3 }, { line: 9 }])])
    );
    expect(results.filter((r) => r.detection.presence === 'none')).toHaveLength(2);
  });

  it('emits nothing without the fact', async () => {
    expect(await correctnessAutoplayMuted.check(ctx([comp('src/routes/+page.svelte', [])]))).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/autoplay-muted')).toBe(true);
    expect(explainRule('correctness/autoplay-muted')?.severity).toBe('warning');
  });
});
