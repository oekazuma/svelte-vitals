import { describe, it, expect } from 'vitest';
import { perf012MinifyDisabled } from '../src/rules/perf/perf012-minify-disabled.js';
import { defaultProject, defaultConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

function ctx(viteMinifyDisabled?: { file: string; line: number }): RuleContext {
  return {
    heads: [],
    project: { ...defaultProject, ...(viteMinifyDisabled ? { viteMinifyDisabled } : {}) },
    config: defaultConfig
  } as RuleContext;
}

describe('PERF012 minify disabled', () => {
  it('emits nothing when the fact is unset', async () => {
    expect(await perf012MinifyDisabled.check(ctx())).toEqual([]);
  });

  it('emits one warning finding at the config file and line', async () => {
    const results = await perf012MinifyDisabled.check(ctx({ file: 'vite.config.ts', line: 5 }));
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.id).toBe('PERF012');
    expect(r.category).toBe('performance');
    expect(r.severity).toBe('warning');
    expect(r.detection).toEqual({ presence: 'none', value: 'absent' });
    expect(r.location).toBe('vite.config.ts');
    expect(r.line).toBe(5);
    expect(r.route).toBeUndefined();
    expect(r.message).toBe(
      'JS/CSS minification is disabled (build.minify: false) — production bundles ship unminified and several times larger.'
    );
    expect(r.fix?.description).toBeTruthy();
    expect(r.docsUrl).toContain('perf012');
  });

  it('is registered with project scope', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    const rule = allRules.find((r) => r.id === 'PERF012');
    expect(rule).toBeDefined();
    expect(rule?.scope).toBe('project');
    expect(explainRule('perf012')?.title).toBe('Minification disabled');
  });
});
