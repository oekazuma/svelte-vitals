import { describe, it, expect } from 'vitest';
import { architectureDirectoryNaming } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const fails = (rs: Result[]) => rs.filter((r) => r.location !== undefined);
const project = (rs: Result[]) => rs.filter((r) => r.route === undefined && r.location === undefined);

const ctx = (sourceFiles: string[], options?: Record<string, unknown>): RuleContext => ({
  sourceFiles,
  heads: [],
  project: defaultProject,
  config: defineConfig(options ? { rules: { 'architecture/directory-naming': { options } } } : {})
});

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
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/Fair/a.ts'], CAMEL));
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.id).toBe('architecture/directory-naming');
    expect(fails(rs)[0]!.category).toBe('architecture');
    expect(fails(rs)[0]!.severity).toBe('info');
    expect(fails(rs)[0]!.location).toBe('src/lib/Fair/a.ts');
    expect(fails(rs)[0]!.message).toContain('src/lib/Fair');
    expect(fails(rs)[0]!.message).toContain('camelCase');
    expect(fails(rs)[0]!.fix?.description).toContain('Rename');
  });

  it('emits no pass result for a conforming directory', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/fair/a.ts'], CAMEL));
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
      ctx(['src/lib/Card/a.ts', 'src/lib/fairSearch/b.ts'], { directories: { 'src/lib/**': 'camelCase|PascalCase' } })
    );
    expect(rs).toEqual([]);
  });

  it('prefers a direct child over a deeper file as the location', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/Fair/aaa/deep.ts', 'src/lib/Fair/zzz.ts'], CAMEL));
    expect(fails(rs)[0]!.location).toBe('src/lib/Fair/zzz.ts');
  });

  it('picks the same location whatever order sourceFiles arrives in', async () => {
    const rs = await architectureDirectoryNaming.check(ctx(['src/lib/Fair/zzz.ts', 'src/lib/Fair/bbb.ts'], CAMEL));
    expect(fails(rs)[0]!.location).toBe('src/lib/Fair/bbb.ts');
  });

  it('never checks the bare prefix of a trailing-double-star key', async () => {
    // 'src/routes' and 'src/lib' are names SvelteKit chooses; the project cannot rename them.
    // Under PascalCase the container would be reported if the guard were missing, so the count
    // and the reported directory together prove the guard fired.
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/routes/hallList/+page.svelte'], { directories: { 'src/routes/**': 'PascalCase' } })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('src/routes/hallList');
    expect(fails(rs).some((r) => r.message.startsWith('src/routes must'))).toBe(false);
  });
});

describe('architecture/directory-naming — route syntax', () => {
  const CAMEL = { directories: { 'src/routes/**': 'camelCase' } };

  it('checks the identifier inside a parameter directory', async () => {
    const ok = await architectureDirectoryNaming.check(ctx(['src/routes/[hallId=integer]/+page.svelte'], CAMEL));
    expect(ok).toEqual([]);
    const bad = await architectureDirectoryNaming.check(ctx(['src/routes/[Hall_Id]/+page.svelte'], CAMEL));
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
      ctx(['src/lib/fair/a.ts'], { directories: { 'src/lib/**': 'camelCase', 'src/nowhere/*': 'camelCase' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
    expect(project(rs)[0]!.message).toContain('matched no directory');
  });

  it('reports a declaration whose every match is excluded', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/tests/fixtures/fair/a.ts'], {
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
      ctx(['src/lib/fair/a.ts'], { directories: { 'src/**': 'camelCase', 'src/lib/*': 'camelCase' } })
    );
    expect(project(rs)).toEqual([]);
  });

  it('folds several into one finding, so suppressing it is one decision', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/fair/a.ts'], {
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
      ctx(['src/lib/api/Hall/a.ts'], { directories: { 'src/lib/api/*': 'camelcase', 'src/**': 'camelCase' } })
    );
    // 'src/lib/api/*' would win on specificity, but it names no known casing and is dropped,
    // so 'src/**' governs src/lib/api/Hall and reports it.
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.message).toContain('src/lib/api/Hall');
  });

  it('reports a wholly mistyped value as checking nothing', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/api/hall/a.ts'], { directories: { 'src/lib/api/*': 'camelcase' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("unknown casing name 'camelcase'");
    expect(project(rs)[0]!.message).toContain('checks nothing');
  });

  it('keeps a partly mistyped value operative and reports it without "checks nothing"', async () => {
    const rs = await architectureDirectoryNaming.check(
      ctx(['src/lib/Fair/a.ts'], { directories: { 'src/lib/**': 'camelCase|kebabCase' } })
    );
    // camelCase still governs, so the violation is still reported...
    expect(fails(rs)).toHaveLength(1);
    // ...and the typo is surfaced without claiming the declaration is inert.
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("unknown casing name 'kebabCase'");
    expect(project(rs)[0]!.message).not.toContain('checks nothing');
  });
});
