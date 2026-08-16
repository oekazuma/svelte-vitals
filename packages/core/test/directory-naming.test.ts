import { describe, it, expect } from 'vitest';
import { architectureDirectoryNaming } from '../src/internal.js';
import { runRules } from '../src/engine.js';
import { defineConfig, defaultProject, type Config } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const ID = 'architecture/directory-naming';

const fails = (rs: Result[]) => rs.filter((r) => r.location !== undefined);
const project = (rs: Result[]) => rs.filter((r) => r.route === undefined && r.location === undefined);

const ctx = (sourceFiles: string[], options?: Record<string, unknown>, extra: Partial<Config> = {}): RuleContext => ({
  sourceFiles,
  heads: [],
  project: defaultProject,
  config: defineConfig({
    ...(options ? { rules: { [ID]: { options } } } : {}),
    ...extra
  })
});

/** Runs through the engine so `recordExamined` is wired up, returning the counts alongside the results. */
async function runWithCounts(sourceFiles: string[], options?: Record<string, unknown>, extra: Partial<Config> = {}) {
  const { results, examined } = await runRules([architectureDirectoryNaming], ctx(sourceFiles, options, extra));
  return { results, examined: examined[ID] ?? {} };
}

describe('architecture/directory-naming — inertness', () => {
  it('emits nothing when no declaration is given', async () => {
    expect(await architectureDirectoryNaming.check(ctx(['src/lib/Bad_Name/a.ts']))).toEqual([]);
  });

  it('emits nothing when sourceFiles is absent', async () => {
    const c: RuleContext = {
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/directory-naming': { options: { directories: { 'src/**': 'camelCase' } } } }
      })
    };
    expect(await architectureDirectoryNaming.check(c)).toEqual([]);
  });
});

describe('architecture/directory-naming — violations', () => {
  const CAMEL = { directories: { 'src/lib/**': 'camelCase' } };

  it('reports a directory that does not match the declared casing', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/Dialog/a.ts'], CAMEL));
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.id).toBe('architecture/directory-naming');
    expect(fails(rs)[0]!.category).toBe('architecture');
    expect(fails(rs)[0]!.severity).toBe('info');
    expect(fails(rs)[0]!.location).toBe('src/lib/Dialog/a.ts');
    expect(fails(rs)[0]!.message).toContain('src/lib/Dialog');
    expect(fails(rs)[0]!.message).toContain('camelCase');
    expect(fails(rs)[0]!.fix?.description).toContain('Rename');
  });

  it('emits no pass result for a conforming directory', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/dialog/a.ts'], CAMEL));
    expect(rs).toEqual([]);
  });

  it('lists every allowed casing in the message', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/some_thing/a.ts'], { directories: { 'src/lib/**': 'camelCase|PascalCase' } })
    );
    expect(fails(rs)[0]!.message).toContain('camelCase or PascalCase');
  });

  it('accepts either casing when the value names both', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/Card/a.ts', 'src/lib/searchForm/b.ts'], { directories: { 'src/lib/**': 'camelCase|PascalCase' } })
    );
    expect(rs).toEqual([]);
  });

  it('prefers a direct child over a deeper file as the location', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/Dialog/aaa/deep.ts', 'src/lib/Dialog/zzz.ts'], CAMEL)
    );
    expect(fails(rs)[0]!.location).toBe('src/lib/Dialog/zzz.ts');
  });

  it('picks the same location whatever order sourceFiles arrives in', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/Dialog/zzz.ts', 'src/lib/Dialog/bbb.ts'], CAMEL));
    expect(fails(rs)[0]!.location).toBe('src/lib/Dialog/bbb.ts');
  });

  it('never checks the bare prefix of a trailing-double-star key', async () => {
    // 'src/routes' and 'src/lib' are names SvelteKit chooses; the project cannot rename them.
    // Under PascalCase the container would be reported if the guard were missing, so the count
    // and the reported directory together prove the guard fired.
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/routes/itemList/+page.svelte'], { directories: { 'src/routes/**': 'PascalCase' } })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('src/routes/itemList');
    expect(fails(rs).some((r) => r.message.startsWith('src/routes must'))).toBe(false);
  });

  it('gives a nested violating directory its own identity', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/Bad_Name/Also_Bad/a.ts'], { directories: { 'src/lib/**': 'camelCase' } })
    );
    expect(fails(rs)).toHaveLength(2);
    // Both resolve to the same file, so `location` alone cannot tell them apart — and
    // `id::route::location` is what a baseline entry is keyed on.
    expect(fails(rs).map((r) => r.location)).toEqual([
      'src/lib/Bad_Name/Also_Bad/a.ts',
      'src/lib/Bad_Name/Also_Bad/a.ts'
    ]);
    expect(
      fails(rs)
        .map((r) => r.route)
        .sort()
    ).toEqual(['src/lib/Bad_Name', 'src/lib/Bad_Name/Also_Bad']);
  });
});

describe('architecture/directory-naming — route syntax', () => {
  const CAMEL = { directories: { 'src/routes/**': 'camelCase' } };

  it('checks the identifier inside a parameter directory', async () => {
    const ok = await architectureDirectoryNaming.check(ctx(['src/routes/[itemId=integer]/+page.svelte'], CAMEL));
    expect(ok).toEqual([]);
    const bad = await architectureDirectoryNaming.check(ctx(['src/routes/[Item_Id]/+page.svelte'], CAMEL));
    expect(fails(bad)).toHaveLength(1);
  });

  it('checks the identifier inside a group directory', async () => {
    expect(await architectureDirectoryNaming.check(ctx(['src/routes/(app)/+page.svelte'], CAMEL))).toEqual([]);
  });

  it('skips a compound segment entirely', async () => {
    expect(await architectureDirectoryNaming.check(ctx(['src/routes/[a]-[b]/+page.svelte'], CAMEL))).toEqual([]);
  });

  it('skips a directory whose name carries no letter', async () => {
    expect(await architectureDirectoryNaming.check(ctx(['src/routes/blog/2024/+page.svelte'], CAMEL))).toEqual([]);
  });
});

describe('architecture/directory-naming — exclude', () => {
  it('prunes the directory and everything beneath it', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/tests/Bad_Name/a.ts'], { directories: { 'src/lib/**': 'camelCase' }, exclude: ['**/tests'] })
    );
    expect(fails(rs)).toEqual([]);
  });
});

describe('architecture/directory-naming — declarations that do not check what they say', () => {
  it('reports a glob that matched no directory', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/dialog/a.ts'], { directories: { 'src/lib/**': 'camelCase', 'src/nowhere/*': 'camelCase' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
    expect(project(rs)[0]!.message).toContain('matched no directory');
  });

  it('reports a declaration whose every match is excluded', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/tests/fixtures/dialog/a.ts'], {
        directories: { 'src/**/tests/fixtures/*': 'camelCase' },
        exclude: ['**/tests']
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('matched only excluded directories');
  });

  it('keeps a key that matched only skipped directories out of the finding', async () => {
    // '[a]-[b]' is skipped as a compound segment, but the key still identified the directory.
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/routes/[a]-[b]/+page.svelte'], { directories: { 'src/routes/*': 'camelCase' } })
    );
    expect(project(rs)).toEqual([]);
  });

  it('keeps a key that matched but lost the tie-break out of the finding', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/dialog/a.ts'], { directories: { 'src/lib/**': 'camelCase', 'src/lib/*': 'camelCase' } })
    );
    // 'src/lib/**' never governs anything here: the bare-prefix guard keeps it off src/lib, and at
    // src/lib/dialog it loses to the single-star key on the `**` count. It still identified that
    // directory, so calling it a declaration that checks nothing would be a lie.
    expect(project(rs)).toEqual([]);
  });

  it('folds several into one finding, so suppressing it is one decision', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/dialog/a.ts'], {
        directories: { 'src/lib/**': 'camelCase', 'src/nowhere/*': 'camelCase', 'src/elsewhere/*': 'camelCase' }
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/elsewhere/*'");
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
  });
});

describe('architecture/directory-naming — the casing vocabulary', () => {
  it('drops a wholly mistyped value from matching, so a broader valid key still governs', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/api/Item/a.ts'], { directories: { 'src/lib/api/*': 'camelcase', 'src/**': 'camelCase' } })
    );
    // 'src/lib/api/*' would win on specificity, but it names no known casing and is dropped,
    // so 'src/**' governs src/lib/api/Item and reports it.
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('src/lib/api/Item');
    // The message names the casing the governing declaration asked for. If the mistyped key were
    // left in the running it would win on specificity and contribute an empty casing set, and the
    // message would name no casing at all.
    expect(fails(rs)[0]!.message).toContain('camelCase');
  });

  it('reports a wholly mistyped value as checking nothing', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/api/item/a.ts'], { directories: { 'src/lib/api/*': 'camelcase' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("unknown casing name 'camelcase'");
    expect(project(rs)[0]!.message).toContain('checks nothing');
    // Nothing is checked, so nothing is reported about a directory either.
    expect(fails(rs)).toEqual([]);
  });

  it('keeps a partly mistyped value operative and reports it without "checks nothing"', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/Dialog/a.ts'], { directories: { 'src/lib/**': 'camelCase|kebabCase' } })
    );
    // camelCase still governs, so the violation is still reported...
    expect(fails(rs)).toHaveLength(1);
    // ...and the typo is surfaced without claiming the declaration is inert.
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("unknown casing name 'kebabCase'");
    expect(project(rs)[0]!.message).not.toContain('checks nothing');
  });

  it('reports a value naming no casing at all as checking nothing', async () => {
    // '|' splits into two blank parts, so parseCasings finds neither a known nor an unknown name.
    // Without a dedicated case this value is dropped from matching, never lands in usedKeys, and
    // then fails the unclassified filter's own known.length > 0 guard too — silently checking
    // nothing while never being reported for it.
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/api/item/a.ts'], { directories: { 'src/lib/api/*': '|' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/lib/api/*'");
    expect(project(rs)[0]!.message).toContain('checks nothing');
    // Nothing is checked, so nothing is reported about a directory either.
    expect(fails(rs)).toEqual([]);
  });
});

// Issue #387: the count answers "how many directories did this declaration judge", keyed on the same
// bare glob the project-scoped notes above already name.
describe('architecture/directory-naming — examined counts', () => {
  it('counts every directory a declaration judged, conforming or not', async () => {
    const { examined } = await runWithCounts(['src/lib/dialog/a.ts', 'src/lib/Bad_Name/b.ts'], {
      directories: { 'src/lib/*': 'camelCase' }
    });
    // 'dialog' conforms, 'Bad_Name' is reported — both were judged.
    expect(examined['src/lib/*']).toBe(2);
  });

  it('reports a count even when every judged directory conforms, with no finding', async () => {
    const { examined, results } = await runWithCounts(['src/lib/dialog/a.ts'], {
      directories: { 'src/lib/*': 'camelCase' }
    });
    expect(examined['src/lib/*']).toBe(1);
    expect(results).toEqual([]);
  });

  it('reports zero for a declaration that matches no directory, alongside its existing diagnostic', async () => {
    const { examined, results } = await runWithCounts(['src/lib/dialog/a.ts'], {
      directories: { 'src/lib/*': 'camelCase', 'src/nowhere/*': 'camelCase' }
    });
    expect(examined['src/nowhere/*']).toBe(0);
    expect(project(results)).toHaveLength(1);
    expect(project(results)[0]!.message).toContain("'src/nowhere/*'");
    expect(project(results)[0]!.message).toContain('matched no directory');
  });

  it('does not count a key that matched but lost the tie-break', async () => {
    const { examined } = await runWithCounts(['src/lib/dialog/a.ts'], {
      directories: { 'src/lib/**': 'camelCase', 'src/lib/*': 'camelCase' }
    });
    // 'src/lib/**' never wins here (bare-prefix guard, then loses on ** count) but it matched.
    expect(examined['src/lib/*']).toBe(1);
    expect(examined['src/lib/**']).toBe(0);
  });

  // The rule's own decision, distinct from the tie-break above: a compound segment was matched and
  // won the tie-break, but `decodeSegment` finds no single identifier in it, so no casing check ever
  // ran there. "Matched but not judged" reads 0, the same as "never matched" — the design's vocabulary
  // for "examined" is places judged, not places identified.
  it('does not count a directory skipped for being a compound route segment', async () => {
    const { examined, results } = await runWithCounts(['src/routes/[a]-[b]/+page.svelte'], {
      directories: { 'src/routes/*': 'camelCase' }
    });
    expect(examined['src/routes/*']).toBe(0);
    expect(project(results)).toEqual([]);
  });

  it('does not count an excluded directory', async () => {
    const { examined, results } = await runWithCounts(['src/lib/tests/Bad_Name/a.ts'], {
      directories: { 'src/lib/**': 'camelCase' },
      exclude: ['**/tests']
    });
    expect(examined['src/lib/**']).toBe(0);
    expect(fails(results)).toEqual([]);
  });

  it('does not count a declaration that exists only in an overrides layer', async () => {
    // The entry must be EMPTY, not absent — the rule still runs and counts, it just has nothing
    // globally resolved. `runWithCounts`'s `?? {}` fallback can't distinguish the two, so this
    // asserts against the raw `examined` map instead.
    const { examined } = await runRules(
      [architectureDirectoryNaming],
      ctx(['src/lib/dialog/a.ts'], undefined, {
        overrides: [
          { files: 'src/**', rules: { [ID]: { options: { directories: { 'src/nowhere/*': 'camelCase' } } } } }
        ]
      } as never)
    );
    expect(Object.hasOwn(examined, ID)).toBe(true);
    expect(examined[ID]).toEqual({});
  });

  it('reports no counts at all on a run with no file inventory', async () => {
    const config = defineConfig({ rules: { [ID]: { options: { directories: { 'src/lib/*': 'camelCase' } } } } });
    const seen: Record<string, number>[] = [];
    await architectureDirectoryNaming.check({
      sourceFiles: undefined,
      heads: [],
      project: defaultProject,
      config,
      recordExamined: (c: Record<string, number>) => void seen.push(c)
    } as unknown as RuleContext);
    expect(seen).toEqual([]);
  });

  it('reports no counts at all when no config layer mentions the rule', async () => {
    const config = defineConfig({});
    const seen: Record<string, number>[] = [];
    await architectureDirectoryNaming.check({
      sourceFiles: ['src/lib/dialog/a.ts'],
      heads: [],
      project: defaultProject,
      config,
      recordExamined: (c: Record<string, number>) => void seen.push(c)
    } as unknown as RuleContext);
    expect(seen).toEqual([]);
  });
});
