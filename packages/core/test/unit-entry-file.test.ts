import { describe, it, expect } from 'vitest';
import { architectureUnitEntryFile, applyOverrides } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const passes = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'own' && r.detection.value === 'static');

/** A RuleContext carrying a source-file inventory and the rule's options. */
const ctx = (sourceFiles: string[], options?: Record<string, unknown>): RuleContext => ({
  sourceFiles,
  heads: [],
  project: defaultProject,
  config: defineConfig(options ? { rules: { 'architecture/unit-entry-file': { options } } } : {})
});

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

  it('passes a conforming unit, keyed on the entry file with no location', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/Badge.svelte'], PASCAL)
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
    expect(passes(rs)[0]!.route).toBe('src/lib/Card/Card.svelte');
    expect(passes(rs)[0]!.location).toBeUndefined();
  });

  it('skips a directory whose basename does not begin A-Z', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/fairSearch/x.svelte', 'src/routes/[hallId=integer]/+page.svelte'], PASCAL)
    );
    expect(rs).toEqual([]);
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
    expect(passes(rs)[0]!.route).toBe('src/lib/api/voice/fetchVoice/fetchVoice.ts');
  });

  it('takes the longest matching key', async () => {
    // Both keys match src/lib/x/stores/s. The longer one expects `.ts`, which exists; the
    // shorter one would expect `.svelte.ts` and report a violation.
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
    // 'src/**/stores/*' matches and loses to the longer key; it has still done work.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/x/stores/s/s.ts'], {
        units: { 'src/**/stores/*': '.svelte.ts', 'src/lib/x/stores/*': '.ts' }
      })
    );
    expect(rs.filter((r) => r.route === undefined)).toEqual([]);
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
    expect(passes(rs)[0]!.route).toBe('src/lib/functions/getFoo/getFoo.ts');
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
      ctx(['src/lib/Card/Badge.svelte'], { ...PASCAL, units: { 'src/lib/*': '.svelte' }, exclude: ['src/lib/Card'] })
    );
    expect(rs).toEqual([]);
  });
});

describe('architecture/unit-entry-file — inert declarations', () => {
  it('reports a key that matched no directory, as a project-scoped finding', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte'], { ...PASCAL, units: { 'src/nowhere/*': '.ts' } })
    );
    const inert = rs.filter((r) => r.route === undefined);
    expect(inert).toHaveLength(1);
    expect(inert[0]!.location).toBeUndefined();
    expect(inert[0]!.message).toContain('src/nowhere/*');
    expect(inert[0]!.detection.presence).toBe('none');
    expect(inert[0]!.detection.value).toBe('absent');
  });

  it('does not report a key that matched at least one directory', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/Card.svelte'], PASCAL));
    expect(rs.filter((r) => r.route === undefined)).toEqual([]);
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
