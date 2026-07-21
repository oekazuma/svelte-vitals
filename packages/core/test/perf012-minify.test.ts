import { describe, it, expect } from 'vitest';
import { perf012MinifyDisabled } from '../src/rules/perf/minify-disabled.js';
import { defaultProject, defaultConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

function ctx(viteMinifyDisabled?: { file?: string; line?: number }): RuleContext {
  return {
    heads: [],
    project: { ...defaultProject, ...(viteMinifyDisabled ? { viteMinifyDisabled } : {}) },
    config: defaultConfig
  } as RuleContext;
}

describe('performance/minify-disabled minify disabled', () => {
  it('emits nothing when the fact is unset', async () => {
    expect(await perf012MinifyDisabled.check(ctx())).toEqual([]);
  });

  it('emits one warning finding at the config file and line', async () => {
    const results = await perf012MinifyDisabled.check(ctx({ file: 'vite.config.ts', line: 5 }));
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.id).toBe('performance/minify-disabled');
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
    expect(r.docsUrl).toContain('performance/minify-disabled');
  });

  it('omits the line and explains build-time provenance when only the file is known', async () => {
    const results = await perf012MinifyDisabled.check(ctx({ file: 'vite.config.ts' }));
    expect(results[0]!.line).toBeUndefined();
    expect(results[0]!.location).toBe('vite.config.ts');
    expect(results[0]!.message).toContain('resolved from the actual build');
  });

  it('omits the location and names the inline config when no file is known', async () => {
    const results = await perf012MinifyDisabled.check(ctx({}));
    expect(results[0]!.location).toBeUndefined();
    expect(results[0]!.line).toBeUndefined();
    expect(results[0]!.message).toContain('inline (programmatic) Vite config');
  });

  it('is registered with project scope', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    const rule = allRules.find((r) => r.id === 'performance/minify-disabled');
    expect(rule).toBeDefined();
    expect(rule?.scope).toBe('project');
    expect(explainRule('performance/minify-disabled')?.title).toBe('Minification disabled');
  });
});
