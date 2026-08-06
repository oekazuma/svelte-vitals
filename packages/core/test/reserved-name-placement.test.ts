import { describe, expect, it } from 'vitest';
import { architectureReservedNamePlacement } from '../src/rules/architecture/reserved-name-placement.js';
import type { Config } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

const ID = 'architecture/reserved-name-placement';

/** A context carrying only what this rule reads: `sourceFiles` and `config`. */
function ctx(files: string[], options: Record<string, unknown>, extra: Partial<Config> = {}): RuleContext {
  const config = { rules: { [ID]: { options } }, ...extra } as unknown as Config;
  return { sourceFiles: files, config } as unknown as RuleContext;
}

async function run(files: string[], options: Record<string, unknown>, extra: Partial<Config> = {}) {
  return await architectureReservedNamePlacement.check(ctx(files, options, extra));
}

describe('architecture/reserved-name-placement', () => {
  // Testing item 4
  it('never reports a name that is in no map, on a run that is otherwise reporting', async () => {
    const results = await run(['src/routes/about/e2e/a.ts', 'src/routes/about/utils/b.ts', 'src/lib/e2e/c.ts'], {
      placements: { e2e: 'src/routes/**' }
    });
    expect(results.map((r) => r.route)).toEqual(['src/lib/e2e']);
  });

  // Testing item 5
  it('reports a declared name in an undeclared position, with route on the directory and location on a file inside it', async () => {
    const results = await run(['src/lib/e2e/a.ts'], { placements: { e2e: 'src/routes/**' } });
    expect(results).toHaveLength(1);
    expect(results[0]?.route).toBe('src/lib/e2e');
    expect(results[0]?.location).toBe('src/lib/e2e/a.ts');
    expect(results[0]?.severity).toBe('info');
    expect(results[0]?.category).toBe('architecture');
  });

  // Testing item 12
  it('exclude removes a subtree that reports without it', async () => {
    const files = ['src/lib/legacy/e2e/a.ts'];
    const without = await run(files, { placements: { e2e: 'src/routes/**' } });
    expect(without).toHaveLength(1);
    const withExclude = await run(files, {
      placements: { e2e: 'src/routes/**' },
      exclude: ['src/lib/legacy/**']
    });
    expect(withExclude).toEqual([]);
  });

  // Testing item 13 — both silences, because they are two different code paths.
  it('reports nothing when the rule is declared with no map, on a tree that would otherwise report', async () => {
    const results = await run(['src/lib/e2e/a.ts'], {});
    expect(results).toEqual([]);
  });

  it('reports nothing when no config layer mentions the rule at all', async () => {
    const config = { rules: {} } as unknown as Config;
    const results = await architectureReservedNamePlacement.check({
      sourceFiles: ['src/lib/e2e/a.ts'],
      config
    } as unknown as RuleContext);
    expect(results).toEqual([]);
  });

  it('reports nothing on a --route run, where no file inventory exists', async () => {
    const config = { rules: { [ID]: { options: { placements: { e2e: 'src/routes/**' } } } } } as unknown as Config;
    const results = await architectureReservedNamePlacement.check({
      sourceFiles: undefined,
      config
    } as unknown as RuleContext);
    expect(results).toEqual([]);
  });

  // Testing item 15
  it('distinguishes a bare prefix from a /** suffix as the family compiler defines', async () => {
    const files = ['src/routes/e2e/a.ts'];
    const bare = await run(files, { placements: { e2e: 'src/routes' } });
    expect(bare).toEqual([]);
    const suffixed = await run(files, { placements: { e2e: 'src/routes/**' } });
    expect(suffixed).toHaveLength(1);
    expect(suffixed[0]?.route).toBe('src/routes/e2e');
  });
});
