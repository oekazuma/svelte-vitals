import { describe, it, expect } from 'vitest';
import { perf011LoadWaterfall } from '../src/rules/perf/perf011-load-waterfall.js';
import { perf013SequentialAwaits } from '../src/rules/perf/perf013-sequential-awaits.js';
import { emptyKitModuleFacts } from '../src/kit-module-collect.js';
import { defaultProject, defaultConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { KitModuleFacts } from '../src/kit-module.js';

function ctx(modules: KitModuleFacts[]): RuleContext {
  return { heads: [], project: defaultProject, config: defaultConfig, kitModules: modules } as RuleContext;
}

function mod(
  file: string,
  kind: KitModuleFacts['kind'],
  loadWaterfalls?: KitModuleFacts['loadWaterfalls']
): KitModuleFacts {
  return { ...emptyKitModuleFacts(file, kind), ...(loadWaterfalls ? { loadWaterfalls } : {}) };
}

describe('PERF011 load waterfall', () => {
  it('flags dependent lines in universal files only', async () => {
    const results = await perf011LoadWaterfall.check(
      ctx([
        mod('src/routes/+page.ts', 'universal', { dependentLines: [3, 7], independentLines: [] }),
        mod('src/routes/admin/+page.server.ts', 'server', { dependentLines: [4], independentLines: [] })
      ])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized.map((r) => ({ file: r.location, line: r.line }))).toEqual([
      { file: 'src/routes/+page.ts', line: 3 },
      { file: 'src/routes/+page.ts', line: 7 }
    ]);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toContain('client-side request waterfall');
    expect(penalized[0]!.fix?.description).toBeTruthy();
  });

  it('emits nothing without dependent lines', async () => {
    const results = await perf011LoadWaterfall.check(
      ctx([mod('src/routes/+page.ts', 'universal', { dependentLines: [], independentLines: [2] })])
    );
    expect(results).toEqual([]);
  });
});

describe('PERF013 sequential independent awaits', () => {
  it('flags independent lines in both kinds at info severity', async () => {
    const results = await perf013SequentialAwaits.check(
      ctx([
        mod('src/routes/+page.ts', 'universal', { dependentLines: [], independentLines: [3] }),
        mod('src/routes/+page.server.ts', 'server', { dependentLines: [], independentLines: [5] })
      ])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized.map((r) => ({ file: r.location, line: r.line }))).toEqual([
      { file: 'src/routes/+page.ts', line: 3 },
      { file: 'src/routes/+page.server.ts', line: 5 }
    ]);
    expect(penalized[0]!.severity).toBe('info');
    expect(penalized[0]!.message).toContain('Promise.all');
  });

  it('is registered along with PERF011', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'PERF011')).toBe(true);
    expect(allRules.some((r) => r.id === 'PERF013')).toBe(true);
    expect(explainRule('perf011')?.severity).toBe('warning');
    expect(explainRule('perf013')?.severity).toBe('info');
  });
});
