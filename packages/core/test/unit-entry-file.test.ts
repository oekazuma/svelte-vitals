import { describe, it, expect } from 'vitest';
import { architectureUnitEntryFile, applyOverrides, computeScore, summarize } from '../src/internal.js';
import { runRules } from '../src/engine.js';
import { defineConfig, defaultProject, type Config } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const ID = 'architecture/unit-entry-file';

const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const passes = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'own' && r.detection.value === 'static');

/** A RuleContext carrying a source-file inventory and the rule's options. */
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
  const { results, examined } = await runRules([architectureUnitEntryFile], ctx(sourceFiles, options, extra));
  return { results, examined: examined[ID] ?? {} };
}

const PASCAL = { pascalCaseUnits: { 'src/**': '.svelte' } };

describe('architecture/unit-entry-file — inertness', () => {
  it('emits nothing when no declaration is given', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/Badge.svelte']));
    expect(rs).toEqual([]);
  });

  it('emits nothing when sourceFiles is absent', async () => {
    const c: RuleContext = {
      heads: [],
      project: defaultProject,
      config: defineConfig({ rules: { 'architecture/unit-entry-file': { options: PASCAL } } })
    };
    expect(await architectureUnitEntryFile.check(c)).toEqual([]);
  });
});

describe('architecture/unit-entry-file — pascalCaseUnits', () => {
  it('reports a PascalCase directory with no same-named entry file', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/Badge.svelte'], PASCAL));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.id).toBe('architecture/unit-entry-file');
    expect(rs[0]!.category).toBe('architecture');
    expect(rs[0]!.severity).toBe('info');
    expect(rs[0]!.location).toBe('src/lib/Card/Badge.svelte');
    expect(rs[0]!.line).toBeUndefined();
    expect(rs[0]!.message).toContain('src/lib/Card');
    expect(rs[0]!.message).toContain('src/lib/Card/Card.svelte');
    expect(rs[0]!.fix?.description).toContain('camelCase');
    expect(rs[0]!.fix?.snippet).toBeUndefined();
  });

  it('passes a conforming unit, keyed on the entry file with no route', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/Badge.svelte'], PASCAL)
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
    expect(passes(rs)[0]!.route).toBeUndefined();
    expect(passes(rs)[0]!.location).toBe('src/lib/Card/Card.svelte');
  });

  it('skips a directory whose basename does not begin A-Z', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/searchForm/x.svelte', 'src/routes/[itemId=integer]/+page.svelte'], PASCAL)
    );
    // No directory in this tiny tree is PascalCase, so no violation and no pass is reported, and
    // 'src/**' never identified a unit here — it is correctly reported inert, a real consequence
    // of the pascalCaseUnits inertness fix rather than a bug in this test's premise (see the
    // "inert declarations" describe block below).
    expect(rs.filter((r) => r.route !== undefined)).toEqual([]);
    const inert = rs.filter((r) => r.route === undefined);
    expect(inert).toHaveLength(1);
    expect(inert[0]!.message).toContain('src/**');
  });

  it('checks a directory whose only children are directories', async () => {
    // src/lib/Card holds only parts/, so a "parents of files" derivation would miss it.
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/parts/x.svelte'], PASCAL));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('src/lib/Card');
  });

  it('reports a case-mismatched entry file', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/card.svelte'], PASCAL));
    expect(fails(rs)).toHaveLength(1);
  });

  it('prefers a direct child over a deeper file as the location', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/aaa/deep.svelte', 'src/lib/Card/zzz.svelte'], PASCAL)
    );
    // 'aaa/deep.svelte' sorts first overall, but 'zzz.svelte' is the direct child.
    expect(fails(rs)[0]!.location).toBe('src/lib/Card/zzz.svelte');
  });

  it('falls back to the subtree when there is no direct child', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/parts/Badge.svelte'], PASCAL));
    expect(fails(rs)[0]!.location).toBe('src/lib/Card/parts/Badge.svelte');
  });

  it('picks the same location whatever order sourceFiles arrives in', async () => {
    // `collectSourceFiles` sorts, but the location a finding reports at is what a baseline and
    // `--diff` are keyed on, so it must not be decided by an adapter's traversal order. Both
    // inputs below are given unsorted, and each would pick the wrong file without the rule's
    // own sort: `.find()` would take zzz over bbb, and the fallback would take z over a.
    const direct = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/zzz.svelte', 'src/lib/Card/bbb.svelte', 'src/lib/Card/aaa/deep.svelte'], PASCAL)
    );
    expect(fails(direct)[0]!.location).toBe('src/lib/Card/bbb.svelte');

    const fallback = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/parts/z.svelte', 'src/lib/Card/parts/a.svelte'], PASCAL)
    );
    expect(fails(fallback)[0]!.location).toBe('src/lib/Card/parts/a.svelte');
  });

  it('does not treat a PascalCase root as a unit for a key ending in /**', async () => {
    // The casing gate cannot save this one: `Components` IS PascalCase, so without the guard
    // the container would be asked for Components/Components.svelte.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/Components/Card/Card.svelte'], { pascalCaseUnits: { 'src/Components/**': '.svelte' } })
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
  });
});

describe('architecture/unit-entry-file — identity', () => {
  it('gives a nested violating directory its own identity', async () => {
    // src/lib/Card has no direct child, so it falls back to the subtree for its location; its
    // nested child src/lib/Card/Badge takes that very same file as its direct child. Both
    // violations must stay distinguishable in `id::route::location`.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Badge/x.ts'], { pascalCaseUnits: { 'src/lib/**': '.svelte' } })
    );
    expect(fails(rs)).toHaveLength(2);
    // Both resolve to the same file, so `location` alone cannot tell them apart — and
    // `id::route::location` is what a baseline entry is keyed on.
    expect(fails(rs).map((r) => r.location)).toEqual(['src/lib/Card/Badge/x.ts', 'src/lib/Card/Badge/x.ts']);
    expect(
      fails(rs)
        .map((r) => r.route)
        .sort()
    ).toEqual(['src/lib/Card', 'src/lib/Card/Badge']);
  });
});

describe('architecture/unit-entry-file — units', () => {
  const FN = { units: { 'src/**/functions/*': '.ts' } };

  it('reports a declared unit with no entry file', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/x/functions/getFoo/other.ts'], FN));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('src/lib/x/functions/getFoo/getFoo.ts');
  });

  it('passes a declared unit that has its entry file', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/x/functions/getFoo/getFoo.ts'], FN));
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
  });

  it('uses the units Fix text, which never mentions camelCase', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/x/functions/getFoo/other.ts'], FN));
    expect(rs[0]!.fix?.description).not.toContain('camelCase');
    expect(rs[0]!.fix?.description).toContain('units');
  });

  it('does not match zero segments for a middle ** — the domain level is never a unit', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/api/voice/types.ts', 'src/lib/api/voice/fetchVoice/fetchVoice.ts'], {
        units: { 'src/lib/api/**/*': '.ts' }
      })
    );
    // src/lib/api/voice must NOT be treated as a unit; only the fetch unit is, and it conforms.
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
    expect(passes(rs)[0]!.location).toBe('src/lib/api/voice/fetchVoice/fetchVoice.ts');
  });

  it('takes the key with more path segments', async () => {
    // Both keys match src/lib/x/stores/s. The one with more segments expects `.ts`, which exists;
    // the one with fewer would expect `.svelte.ts` and report a violation.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/x/stores/s/s.ts'], {
        units: { 'src/**/stores/*': '.svelte.ts', 'src/lib/x/stores/*': '.ts' }
      })
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
  });

  it('takes the lexicographically first among equal-length keys', async () => {
    // Both keys are 9 characters and both match src/a/b/c. '*' (0x2A) sorts before 'a'
    // (0x61), so 'src/*/b/*' wins and `.ts` is expected — which exists.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/a/b/c/c.ts'], { units: { 'src/a/*/*': '.svelte', 'src/*/b/*': '.ts' } })
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
  });

  it('does not call a key inert when it matched but lost the tie-break', async () => {
    // 'src/**/stores/*' matches and loses to the key with more segments; it has still done work.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/x/stores/s/s.ts'], {
        units: { 'src/**/stores/*': '.svelte.ts', 'src/lib/x/stores/*': '.ts' }
      })
    );
    // A project-scoped inert finding carries neither `route` nor `location`; a pass now carries
    // `location` alone, so `route === undefined` by itself no longer isolates the inert case.
    expect(rs.filter((r) => r.route === undefined && r.location === undefined)).toEqual([]);
  });

  it('prefers units over pascalCaseUnits for a directory matched by both', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Thing/Thing.ts'], { units: { 'src/lib/*': '.ts' }, ...PASCAL })
    );
    // units expects .ts and it exists, so the directory conforms despite pascalCaseUnits wanting .svelte.
    expect(fails(rs)).toHaveLength(0);
  });

  it('does not treat the container itself as a unit for a key ending in /**', async () => {
    // A trailing /** also matches its bare prefix, so without a guard the functions/
    // container would be asked for a nonsensical functions/functions.ts.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/functions/getFoo/getFoo.ts'], { units: { 'src/lib/functions/**': '.ts' } })
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
    expect(passes(rs)[0]!.location).toBe('src/lib/functions/getFoo/getFoo.ts');
  });

  it('does not treat the container as a unit when a trailing /** has a wildcard prefix', async () => {
    // barePrefix must be compiled, not compared: no real directory equals the glob
    // 'src/**/functions', so a string comparison never fires and the container leaks through.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/functions/getFoo/getFoo.ts'], { units: { 'src/**/functions/**': '.ts' } })
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
  });

  it('does not treat a PascalCase container as a unit when a trailing /** has a wildcard prefix', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Components/Card/Card.svelte'], { pascalCaseUnits: { 'src/*/Components/**': '.svelte' } })
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
  });
});

describe('architecture/unit-entry-file — exclude', () => {
  it('exempts an excluded directory and its whole subtree', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/tests/Fixtures/dummy.ts'], {
        ...PASCAL,
        exclude: ['**/tests']
      })
    );
    // Fixtures/ is PascalCase but sits under an excluded tests/, so it is not a unit.
    expect(fails(rs)).toHaveLength(0);
  });

  it('outranks both declarations', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Badge.svelte', 'src/lib/Widget/Widget.svelte'], {
        ...PASCAL,
        units: { 'src/lib/*': '.svelte' },
        exclude: ['src/lib/Card']
      })
    );
    // Card/ holds Badge.svelte and no Card.svelte, so both declarations would report it — the
    // exclusion is what stops them. Widget/ is there so both keys still govern something: without
    // it they would be inert, and this test would be about inert declarations instead.
    expect(fails(rs)).toHaveLength(0);
    // A project-scoped inert finding carries neither `route` nor `location`; the Widget pass now
    // carries `location` alone, so `route === undefined` by itself no longer isolates the inert case.
    expect(rs.filter((r) => r.route === undefined && r.location === undefined)).toEqual([]);
    expect(passes(rs)).toHaveLength(1);
  });
});

describe('architecture/unit-entry-file — inert declarations', () => {
  it('reports a key that matched no directory, as a project-scoped finding', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte'], { ...PASCAL, units: { 'src/nowhere/*': '.ts' } })
    );
    // A project-scoped inert finding carries neither `route` nor `location`; a pass now carries
    // `location` alone, so `route === undefined` by itself no longer isolates the inert case.
    const inert = rs.filter((r) => r.route === undefined && r.location === undefined);
    expect(inert).toHaveLength(1);
    expect(inert[0]!.location).toBeUndefined();
    expect(inert[0]!.message).toContain('src/nowhere/*');
    expect(inert[0]!.detection.presence).toBe('none');
    expect(inert[0]!.detection.value).toBe('absent');
  });

  it('does not report a key that matched at least one directory', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/Card.svelte'], PASCAL));
    expect(rs.filter((r) => r.route === undefined && r.location === undefined)).toEqual([]);
  });

  it('reports a pascalCaseUnits key that matched only non-PascalCase directories as inert', async () => {
    // Forgetting the /** leaves a key that matches one lowercase directory: it identifies no
    // unit, so it has done no work, and calling it used would hide a typo the user wants told.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/components/Button/Button.svelte'], { pascalCaseUnits: { 'src/lib/components': '.svelte' } })
    );
    const inert = rs.filter((r) => r.route === undefined);
    expect(inert).toHaveLength(1);
    expect(inert[0]!.message).toContain('src/lib/components');
  });

  it('reports all inert declarations as a single finding, so they cannot share a baseline key', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte'], { ...PASCAL, units: { 'src/nowhere/*': '.ts', 'src/elsewhere/*': '.ts' } })
    );
    // A project-scoped inert finding carries neither `route` nor `location`; the Card pass now
    // carries `location` alone, so `route === undefined` by itself no longer isolates the inert case.
    const inert = rs.filter((r) => r.route === undefined && r.location === undefined);
    expect(inert).toHaveLength(1);
    expect(inert[0]!.message).toContain('src/elsewhere/*');
    expect(inert[0]!.message).toContain('src/nowhere/*');
  });

  it('does not check inertness for a key declared only in an overrides entry', async () => {
    const c: RuleContext = {
      sourceFiles: ['src/lib/Card/Card.svelte'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        overrides: [
          {
            files: 'src/lib/**',
            rules: { 'architecture/unit-entry-file': { options: { units: { 'src/nowhere/*': '.ts' } } } }
          }
        ]
      })
    };
    expect((await architectureUnitEntryFile.check(c)).filter((r) => r.route === undefined)).toEqual([]);
  });
});

describe('architecture/unit-entry-file — per-path options', () => {
  it('applies a files:-scoped override, and its severity too', async () => {
    const cfg = {
      overrides: [
        {
          files: 'src/lib/**',
          rules: {
            'architecture/unit-entry-file': {
              severity: 'warning' as const,
              options: { pascalCaseUnits: { 'src/**': '.svelte' } }
            }
          }
        }
      ]
    };
    const c: RuleContext = {
      sourceFiles: ['src/lib/Card/Badge.svelte'],
      heads: [],
      project: defaultProject,
      config: defineConfig(cfg)
    };
    const rs = await architectureUnitEntryFile.check(c);
    expect(fails(rs)).toHaveLength(1);
    const applied = applyOverrides(rs, defineConfig(cfg));
    expect(applied.find((r) => r.detection.value === 'absent')?.severity).toBe('warning');
  });
});

describe('architecture/unit-entry-file — specificity', () => {
  it("keeps the documented example's outcome under the segment-count metric", async () => {
    // The rule page's own example. Every key here has the narrower glob as the longer string too,
    // so the metric change must be a no-op for it — that is what makes the change safe to ship.
    const EXAMPLE = {
      units: {
        'src/lib/api/**/*': '.ts',
        'src/**/functions/*': '.ts',
        'src/**/functions/*/*': '.ts',
        'src/**/stores/*': '.svelte.ts'
      }
    };
    // Every key must govern something here. With a fixture that exercises only some of them, the
    // rule reports the rest as declarations that check nothing — a real finding that has nothing
    // to do with the metric, and one `fails()` counts.
    const rs = await architectureUnitEntryFile.check(
      ctx(
        [
          'src/lib/functions/getFoo/getFoo.ts',
          'src/lib/functions/getFoo/helper/helper.ts',
          'src/lib/api/item/fetchItem/fetchItem.ts',
          'src/lib/stores/searchState/searchState.svelte.ts'
        ],
        EXAMPLE
      )
    );
    // All four documented keys now govern a real unit, so nothing is inert and every unit conforms.
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(4);
  });

  it('lets a single-star declaration narrow a double-star one at the same depth', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/widgets/Card/Card.svelte'], {
        units: { 'src/lib/widgets/*': '.ts', 'src/lib/widgets/**': '.svelte' }
      })
    );
    // Both keys are four segments; the single-star one has no `**` and now wins, so the unit is
    // asked for Card.ts and reported. Under raw length 'src/lib/widgets/**' was the longer string,
    // won, matched the .svelte that is there, and the narrower declaration did nothing at all.
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('src/lib/widgets/Card/Card.ts');
  });
});

describe('architecture/unit-entry-file — declarations shadowed by exclude', () => {
  it('reports a units key whose every match is excluded', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/tests/fixtures/getFoo/index.ts'], {
        units: { 'src/**/tests/fixtures/*': '.ts' },
        exclude: ['**/tests']
      })
    );
    const project = rs.filter((r) => r.route === undefined);
    expect(project).toHaveLength(1);
    expect(project[0]!.message).toContain('src/**/tests/fixtures/*');
    expect(project[0]!.message).toContain('matched only excluded directories');
  });

  it('distinguishes a shadowed declaration from one that matched nothing', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/tests/fixtures/getFoo/index.ts'], {
        units: { 'src/**/tests/fixtures/*': '.ts', 'src/nowhere/*': '.ts' },
        exclude: ['**/tests']
      })
    );
    const message = rs.find((r) => r.route === undefined)!.message;
    expect(message).toContain("'src/**/tests/fixtures/*' (matched only excluded directories)");
    expect(message).toContain("'src/nowhere/*' (matched no directory)");
  });

  it('does not blame exclude for a key the casing gate disqualified', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/searchForm/a.ts', 'src/lib/tests/Card/Card.svelte'], {
        pascalCaseUnits: { 'src/lib/*': '.svelte' },
        exclude: ['**/tests']
      })
    );
    // 'src/lib/*' matched src/lib/searchForm (surviving, but lowercase, so it identified nothing)
    // and src/lib/tests (excluded). It is inert either way, but the exclusion is not the reason,
    // and saying so would send the reader to remove an exclusion that changes nothing.
    const inert = rs.filter((r) => r.route === undefined);
    expect(inert).toHaveLength(1);
    expect(inert[0]!.message).toContain('matched no directory');
    expect(inert[0]!.message).not.toContain('excluded');
  });

  it('still counts a key that matched but lost the tie-break', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/functions/getFoo/getFoo.ts'], {
        units: { 'src/**/functions/*': '.ts', 'src/**': '.ts' }
      })
    );
    // 'src/**' loses to 'src/**/functions/*' on src/lib/functions/getFoo, but it governs
    // src/lib and src/lib/functions, so it has done work either way and must not be reported.
    // A project-scoped inert finding carries neither `route` nor `location`; the pass this
    // config produces now carries `location` alone, so `route === undefined` alone would
    // wrongly catch it too.
    expect(rs.filter((r) => r.route === undefined && r.location === undefined)).toEqual([]);
  });
});

const CONFIG = defineConfig({});

describe('architecture/unit-entry-file — a pass is evidence, not a score key', () => {
  it('emits a pass with no route, so a conforming unit adds nothing to the denominator', async () => {
    // A .ts unit entry is the case that exposed this: no other rule keys a plain .ts file, so the
    // pass was inventing a fresh 100 for every conforming unit.
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/api/api.ts'], { units: { 'src/lib/*': '.ts' } }));
    expect(rs).toHaveLength(1);
    expect(rs[0]!.detection).toEqual({ presence: 'own', value: 'static' });
    expect(rs[0]!.route).toBeUndefined();
    expect(rs[0]!.location).toBe('src/lib/api/api.ts');
  });

  it('does the same for a .svelte entry, so the fix is not narrowed to the reported symptom', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte'], { pascalCaseUnits: { 'src/lib/**': '.svelte' } })
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]!.route).toBeUndefined();
    expect(rs[0]!.location).toBe('src/lib/Card/Card.svelte');
  });

  it('gives each conforming unit a distinct location, so their finding keys do not collapse', async () => {
    // `findingKey` is `id::route::location`; with neither field, N units would share one key.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/api/api.ts', 'src/lib/db/db.ts'], { units: { 'src/lib/*': '.ts' } })
    );
    expect(rs.map((r) => r.location).sort()).toEqual(['src/lib/api/api.ts', 'src/lib/db/db.ts']);
  });

  it('still counts toward summary.passed for every unit checked, route-less or not', async () => {
    // Spec testing item 7: the pass no longer seeds a score key, but it must still be visible
    // to `summarize` as evidence the rule ran and checked N units.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/api/api.ts', 'src/lib/db/db.ts'], { units: { 'src/lib/*': '.ts' } })
    );
    expect(summarize(rs, CONFIG).passed).toBe(2);
  });

  it('leaves a conforming tree scoring identically to a run with the rule disabled', () => {
    const passes: Result[] = [
      {
        id: 'architecture/unit-entry-file',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'own', value: 'static' },
        location: 'src/lib/api/api.ts',
        message: 'Unit entry file',
        recommendation: 'r'
      }
    ];
    const other = [
      {
        id: 'architecture/component-size',
        category: 'architecture' as const,
        severity: 'info' as const,
        detection: { presence: 'none' as const, value: 'absent' as const },
        route: 'src/lib/A.svelte',
        message: 'm',
        recommendation: 'r'
      }
    ];
    expect(computeScore([...other, ...passes], CONFIG).score).toBe(computeScore(other, CONFIG).score);
  });
});

// Issue #387: the count answers "how many units did this declaration judge", keyed on the same bare
// glob the inert-declaration note above already names — one namespace shared by both maps, since a
// directory a `units` key wins is a directory `pascalCaseUnits` never judged, even if its own key
// also matched there.
describe('architecture/unit-entry-file — examined counts', () => {
  it('counts every unit a declaration judged, conforming or not', async () => {
    const { examined } = await runWithCounts(['src/lib/api/api.ts', 'src/lib/db/x.ts'], {
      units: { 'src/lib/*': '.ts' }
    });
    // api/ has its entry file (pass), db/ does not (violation) — both were judged.
    expect(examined['src/lib/*']).toBe(2);
  });

  it('reports a count even when every judged unit conforms, with only passes', async () => {
    const { examined, results } = await runWithCounts(['src/lib/api/api.ts'], { units: { 'src/lib/*': '.ts' } });
    expect(examined['src/lib/*']).toBe(1);
    expect(fails(results)).toEqual([]);
  });

  it('reports zero for a declaration that matches no directory, alongside its existing diagnostic', async () => {
    const { examined, results } = await runWithCounts(['src/lib/Card/Card.svelte'], {
      ...PASCAL,
      units: { 'src/nowhere/*': '.ts' }
    });
    expect(examined['src/nowhere/*']).toBe(0);
    const inert = results.filter((r) => r.route === undefined && r.location === undefined);
    expect(inert).toHaveLength(1);
    expect(inert[0]!.message).toContain('src/nowhere/*');
  });

  it('does not count a key that matched but lost the tie-break', async () => {
    const { examined } = await runWithCounts(['src/lib/x/stores/s/s.ts'], {
      units: { 'src/**/stores/*': '.svelte.ts', 'src/lib/x/stores/*': '.ts' }
    });
    expect(examined['src/lib/x/stores/*']).toBe(1);
    expect(examined['src/**/stores/*']).toBe(0);
  });

  // The rule's own precedence, not a specificity tie-break: `units` wins outright over
  // `pascalCaseUnits` for any directory both match, so the casing key did not judge it — even though
  // it matched (and would count as "used" for the inert-declaration note above).
  it('does not count the pascalCaseUnits key at a directory units already won', async () => {
    const { examined } = await runWithCounts(['src/lib/Thing/Thing.ts'], {
      units: { 'src/lib/*': '.ts' },
      ...PASCAL
    });
    expect(examined['src/lib/*']).toBe(1);
    expect(examined['src/**']).toBe(0);
  });

  it('counts a pascalCaseUnits key when it alone governs', async () => {
    const { examined } = await runWithCounts(['src/lib/Card/Badge.svelte'], PASCAL);
    expect(examined['src/**']).toBe(1);
  });

  it('does not count an excluded unit', async () => {
    // A second, non-excluded unit on the same declaration keeps the key from also going globally
    // unused (which would add an unrelated 'matched no directory' note to the count under test).
    const { examined, results } = await runWithCounts(['src/lib/Card/Badge.svelte', 'src/lib/Other/Other.svelte'], {
      ...PASCAL,
      exclude: ['src/lib/Card']
    });
    // Only Other/ is judged: Card/ is excluded before the check ever runs.
    expect(examined['src/**']).toBe(1);
    expect(fails(results)).toEqual([]);
  });

  it('does not count a declaration that exists only in an overrides layer', async () => {
    // The entry must be EMPTY, not absent — the rule still runs and counts, it just has nothing
    // globally resolved. `runWithCounts`'s `?? {}` fallback can't distinguish the two, so this
    // asserts against the raw `examined` map instead.
    const { examined } = await runRules(
      [architectureUnitEntryFile],
      ctx(['src/lib/Card/Card.svelte'], undefined, {
        overrides: [{ files: 'src/lib/**', rules: { [ID]: { options: { units: { 'src/nowhere/*': '.ts' } } } } }]
      } as never)
    );
    expect(Object.hasOwn(examined, ID)).toBe(true);
    expect(examined[ID]).toEqual({});
  });

  it('reports no counts at all on a run with no file inventory', async () => {
    const config = defineConfig({ rules: { [ID]: { options: PASCAL } } });
    const seen: Record<string, number>[] = [];
    await architectureUnitEntryFile.check({
      sourceFiles: undefined,
      heads: [],
      project: defaultProject,
      config,
      recordExamined: (c: Record<string, number>) => void seen.push(c)
    });
    expect(seen).toEqual([]);
  });

  it('reports no counts at all when no config layer mentions the rule', async () => {
    const config = defineConfig({});
    const seen: Record<string, number>[] = [];
    await architectureUnitEntryFile.check({
      sourceFiles: ['src/lib/Card/Card.svelte'],
      heads: [],
      project: defaultProject,
      config,
      recordExamined: (c: Record<string, number>) => void seen.push(c)
    });
    expect(seen).toEqual([]);
  });
});
