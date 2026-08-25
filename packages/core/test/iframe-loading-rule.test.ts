import { describe, it, expect } from 'vitest';
import { performanceIframeLoading } from '../src/rules/perf/iframe-loading.js';
import { parseComponentFacts } from '../src/component-parse.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { ComponentFacts } from '../src/component.js';

const config = defineConfig({});

function ctx(components: ComponentFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config, components } as RuleContext;
}

function comp(file: string, src: string): ComponentFacts {
  return { ...emptyComponentFacts(file), ...parseComponentFacts(src, file) };
}

const check = async (src: string) => {
  const results = await performanceIframeLoading.check(ctx([comp('src/routes/+page.svelte', src)]));
  return {
    penalized: results.filter((r) => r.detection.presence === 'none'),
    passed: results.filter((r) => r.detection.presence !== 'none')
  };
};

describe('performance/iframe-loading', () => {
  it('flags an iframe without a loading attribute at info severity', async () => {
    const { penalized } = await check('<iframe src="/embed" title="Embed"></iframe>');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.severity).toBe('info');
    expect(penalized[0]!.line).toBe(1);
    expect(penalized[0]!.message).toBe('<iframe> without a loading attribute loads eagerly even when offscreen');
  });

  it('passes any literal loading value — the author made a choice', async () => {
    const lazy = await check('<iframe src="/embed" title="Embed" loading="lazy"></iframe>');
    const eager = await check('<iframe src="/embed" title="Embed" loading="eager"></iframe>');
    expect(lazy.penalized).toEqual([]);
    expect(lazy.passed).toHaveLength(1);
    expect(eager.penalized).toEqual([]);
  });

  it('passes an expression-valued loading — unknowable', async () => {
    const { penalized, passed } = await check('<iframe src="/embed" title="Embed" loading={l}></iframe>');
    expect(penalized).toEqual([]);
    expect(passed).toHaveLength(1);
  });

  it('passes a spread — it could supply loading', async () => {
    const { penalized } = await check('<iframe src="/embed" title="Embed" {...rest}></iframe>');
    expect(penalized).toEqual([]);
  });

  it('flags each offending iframe independently', async () => {
    const { penalized } = await check('<iframe src="/a" title="A"></iframe>\n<iframe src="/b" title="B"></iframe>');
    expect(penalized).toHaveLength(2);
    expect(penalized.map((r) => r.line)).toEqual([1, 2]);
  });

  it('emits nothing for a component without iframes', async () => {
    const { penalized, passed } = await check('<img src="/a.jpg" alt="" />');
    expect(penalized).toEqual([]);
    expect(passed).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'performance/iframe-loading')).toBe(true);
    expect(explainRule('performance/iframe-loading')?.severity).toBe('info');
  });
});
