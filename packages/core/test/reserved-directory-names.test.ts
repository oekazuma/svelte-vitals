import { describe, it, expect } from 'vitest';
import { architectureReservedDirectoryNames } from '../src/index.js';
import { isUnitDir } from '../src/rules/architecture/reserved-directory-names.js';
import { childFiles } from '../src/rules/architecture/declarations.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const fails = (rs: Result[]) => rs.filter((r) => r.location !== undefined);

const ctx = (sourceFiles: string[], options?: Record<string, unknown>): RuleContext => ({
  sourceFiles,
  heads: [],
  project: defaultProject,
  config: defineConfig(options ? { rules: { 'architecture/reserved-directory-names': { options } } } : {})
});

describe('isUnitDir', () => {
  const filesIn = (files: string[]) => childFiles(files);

  it('is true for a PascalCase directory holding its same-named file, whatever the extension', () => {
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/Card.svelte']))).toBe(true);
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/Card.ts']))).toBe(true);
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/Card.svelte.ts']))).toBe(true);
  });

  it('is false for a PascalCase directory with no same-named file', () => {
    expect(isUnitDir('src/lib/Icons', filesIn(['src/lib/Icons/Star.svelte']))).toBe(false);
  });

  it('is false when the same-named file is not an immediate child', () => {
    // The file that gives a unit its identity sits beside its subdirectories, never inside one.
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/parts/Card.svelte']))).toBe(false);
  });

  it('is false for a directory whose name does not begin A-Z', () => {
    expect(isUnitDir('src/lib/card', filesIn(['src/lib/card/card.ts']))).toBe(false);
  });
});

describe('architecture/reserved-directory-names — inertness', () => {
  it('emits nothing when nothing is declared', async () => {
    expect(await architectureReservedDirectoryNames.check(ctx(['src/lib/Card/helpers/a.ts']))).toEqual([]);
  });

  it('emits nothing when sourceFiles is absent', async () => {
    const c: RuleContext = {
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/reserved-directory-names': { options: { unitScopes: { 'src/**': 'parts' } } } }
      })
    };
    expect(await architectureReservedDirectoryNames.check(c)).toEqual([]);
  });
});

describe('architecture/reserved-directory-names — unitScopes', () => {
  const UNITS = { unitScopes: { 'src/**': 'parts|tests' } };

  it("reports a unit's child whose name is not declared", async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/helpers/a.ts'], UNITS)
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.id).toBe('architecture/reserved-directory-names');
    expect(fails(rs)[0]!.severity).toBe('info');
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/helpers');
    expect(fails(rs)[0]!.location).toBe('src/lib/Card/helpers/a.ts');
    expect(fails(rs)[0]!.message).toContain('src/lib/Card/helpers');
    expect(fails(rs)[0]!.message).toContain('parts, tests');
    expect(fails(rs)[0]!.fix?.description).toContain('Rename');
  });

  it('accepts a declared name and emits no pass result', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/Badge/Badge.svelte'], UNITS)
    );
    expect(rs).toEqual([]);
  });

  it('reports a PascalCase child too — the set is closed, not lowercase-only', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/Badge/Badge.svelte'], UNITS)
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/Badge');
  });

  it('says nothing about a non-unit directory, so one naming mistake stays one finding', async () => {
    // 'Icons' is PascalCase but has no Icons.* file, so it is not a unit here. Its PascalCase
    // children must NOT each be measured against the vocabulary — that cascade is what the unit
    // definition exists to prevent, and the sibling rule reports 'Icons' itself.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Icons/Star/Star.svelte', 'src/lib/Icons/Moon/Moon.svelte'], UNITS)
    );
    expect(rs).toEqual([]);
  });

  it('gives each offending child its own identity', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/one/a.ts', 'src/lib/Card/two/b.ts'], UNITS)
    );
    expect(
      fails(rs)
        .map((r) => r.route)
        .sort()
    ).toEqual(['src/lib/Card/one', 'src/lib/Card/two']);
  });
});

describe('architecture/reserved-directory-names — scopes', () => {
  it("reports a named parent's child whose name is not declared", async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/api/a.ts', 'src/lib/widgets/b.ts'], { scopes: { 'src/lib': 'api|db' } })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/widgets');
  });

  it('does not require the parent to be a unit', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/api/a.ts'], { scopes: { 'src/lib': 'api' } })
    );
    expect(rs).toEqual([]);
  });

  it('drops a value that names nothing, so it cannot govern with an empty set', async () => {
    // `validateRuleOptions` accepts any non-empty string, so this is reachable configuration. Left
    // in the running, the key wins on specificity and then admits nothing, reporting every child
    // against a requirement naming no name. Dropping it leaves the position ungoverned instead.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/api/a.ts', 'src/lib/widgets/b.ts'], { scopes: { 'src/lib': '|' } })
    );
    expect(fails(rs)).toEqual([]);
  });
});

describe('architecture/reserved-directory-names — precedence across the two maps', () => {
  // The two declarations name DIFFERENT sets, so which one governed is visible in the message.
  const TREE = ['src/lib/Card/Card.svelte', 'src/lib/Card/tests/a.ts'];

  it('lets a narrow scopes key beat a broad unitScopes key', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(TREE, { scopes: { 'src/lib/*': 'parts' }, unitScopes: { 'src/**': 'parts|tests' } })
    );
    // 'src/lib/*' has three segments to 'src/**''s two, so it governs — and it does not list
    // 'tests', so tests/ is reported.
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/tests');
    expect(fails(rs)[0]!.message).toMatch(/declared here: parts\.$/);
  });

  it('lets a narrow unitScopes key beat a broad scopes key', async () => {
    // The reverse direction. Plain kind-precedence would satisfy the test above on its own, so this
    // is what pins that specificity is what decides: here `scopes` would report tests/ if it won.
    //
    // The broad key is `src/lib/**` rather than `src/**` on purpose. `src/**` would also govern
    // `src/lib`, whose only child is `Card` — not a declared name — adding a violation that has
    // nothing to do with the comparison under test. A trailing `/**` never governs its own bare
    // prefix, so `src/lib/**` reaches `src/lib/Card` without reaching `src/lib`.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(TREE, { scopes: { 'src/lib/**': 'parts' }, unitScopes: { 'src/lib/*': 'parts|tests' } })
    );
    expect(rs).toEqual([]);
  });

  it('falls to scopes when the two globs are identical', async () => {
    // Byte-identical globs are the ONLY pair the four steps cannot separate — step 4 is
    // lexicographic on the whole key. A fixture using two different globs of the same length
    // resolves at step 4 instead and never reaches this decision.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(TREE, { scopes: { 'src/lib/*': 'parts' }, unitScopes: { 'src/lib/*': 'parts|tests' } })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/tests');
  });
});

describe('architecture/reserved-directory-names — exclude', () => {
  it('prunes an excluded parent, so its children are not checked', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/helpers/a.ts'], {
        unitScopes: { 'src/**': 'parts' },
        exclude: ['src/lib/Card']
      })
    );
    expect(fails(rs)).toEqual([]);
  });

  it('prunes an excluded child, leaving its siblings checked', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/helpers/a.ts', 'src/lib/Card/misc/b.ts'], {
        unitScopes: { 'src/**': 'parts' },
        exclude: ['**/helpers']
      })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/misc');
  });

  it('prunes an excluded parent when the exclusion reaches the parent alone', async () => {
    // The override's scope matches the parent and not the child, so the child's own resolution
    // carries no exclusion. Only the parent-level check can prune here — with a top-level glob the
    // per-child check would cover for it, which is why that fixture cannot pin this.
    const rs = await architectureReservedDirectoryNames.check({
      sourceFiles: ['src/lib/Card/Card.svelte', 'src/lib/Card/helpers/a.ts'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/reserved-directory-names': { options: { unitScopes: { 'src/**': 'parts' } } } },
        overrides: [
          {
            files: 'src/lib/Card',
            rules: { 'architecture/reserved-directory-names': { options: { exclude: ['src/lib/Card'] } } }
          }
        ]
      })
    });
    expect(fails(rs)).toEqual([]);
  });

  it('prunes a child named by an exclusion that only the parent can see', async () => {
    const rs = await architectureReservedDirectoryNames.check({
      sourceFiles: ['src/lib/Card/Card.svelte', 'src/lib/Card/legacy/a.ts'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/reserved-directory-names': { options: { unitScopes: { 'src/**': 'parts' } } } },
        overrides: [
          {
            files: 'src/lib/Card',
            rules: {
              'architecture/reserved-directory-names': { options: { exclude: ['src/lib/Card/legacy'] } }
            }
          }
        ]
      })
    });
    expect(fails(rs)).toEqual([]);
  });
});

const project = (rs: Result[]) => rs.filter((r) => r.route === undefined && r.location === undefined);

describe('architecture/reserved-directory-names — declarations that check nothing', () => {
  it('reports a glob that matched no directory', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], { unitScopes: { 'src/**': 'parts', 'src/nowhere/*': 'parts' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
    expect(project(rs)[0]!.message).toContain('matched no directory');
  });

  it('reports a declaration whose every match is excluded', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/tests/Card/Card.svelte'], {
        unitScopes: { 'src/**/tests/*': 'parts' },
        exclude: ['**/tests']
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('matched only excluded directories');
  });

  it('reports a unitScopes key that matched directories but never a unit', async () => {
    // 'src/lib/*' matches src/lib/grouping, which holds no same-named file and so is not a unit.
    // The unit test IS this map's identification criterion, so the key identified nothing.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/grouping/a.ts'], { unitScopes: { 'src/lib/*': 'parts' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('never a unit');
  });

  it('does not report a unitScopes key that governed a unit whose children all conform', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/Badge/Badge.svelte'], {
        unitScopes: { 'src/**': 'parts' }
      })
    );
    expect(project(rs)).toEqual([]);
  });

  it('does not report a key that matched but lost the specificity comparison', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], { unitScopes: { 'src/**': 'parts', 'src/lib/*': 'parts' } })
    );
    // 'src/**' loses to 'src/lib/*' at src/lib/Card, the only unit here, so it wins nowhere. It
    // still identified that directory, so calling it a declaration that checks nothing would be a
    // lie. Recording only the winner would leave it unused, and — because it also matches the
    // surviving non-unit src/lib — it would be reported as having matched directories but never a
    // unit. One file is what makes that outcome reachable; a second unit it could win at hides the
    // whole distinction.
    expect(project(rs)).toEqual([]);
  });

  it('reports a value that names nothing at all', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], { unitScopes: { 'src/**': '|' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('names no directory name at all');
  });

  it('reports the same glob declared in both maps', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], { scopes: { 'src/lib/*': 'parts' }, unitScopes: { 'src/lib/*': 'parts' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('declared in both');
  });

  it('reports the same glob when the collision is assembled across config layers', async () => {
    // The likeliest way it arises: these options merge additively, so a base config and an
    // overrides entry can produce the pair without either author seeing both halves. The check
    // reads the per-directory resolution too, which is where an override's contribution appears.
    const rs = await architectureReservedDirectoryNames.check({
      sourceFiles: ['src/lib/Card/Card.svelte'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/reserved-directory-names': { options: { scopes: { 'src/lib/*': 'parts' } } } },
        overrides: [
          {
            files: 'src/**',
            rules: { 'architecture/reserved-directory-names': { options: { unitScopes: { 'src/lib/*': 'parts' } } } }
          }
        ]
      })
    });
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('declared in both');
  });

  it('does not report a key declared only inside an overrides entry as inert', async () => {
    // The inherited limitation: deciding whether an overrides-only key matched anything means
    // intersecting that entry's scope with the directory set.
    const rs = await architectureReservedDirectoryNames.check({
      sourceFiles: ['src/lib/Card/Card.svelte'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        overrides: [
          {
            files: 'src/**',
            rules: {
              'architecture/reserved-directory-names': { options: { unitScopes: { 'src/nowhere/*': 'parts' } } }
            }
          }
        ]
      })
    });
    expect(project(rs)).toEqual([]);
  });

  it('says nothing about a declared name the tree never uses', async () => {
    // The set says what may appear, not what must. A deliberately-held-open slot is a legitimate
    // state, unlike the sibling rule's unknown casing name, which is a typo by definition because
    // that vocabulary belongs to the rule rather than to the project.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/Badge/Badge.svelte'], {
        unitScopes: { 'src/**': 'parts|functions|stores|neverUsed' }
      })
    );
    expect(rs).toEqual([]);
  });

  it('folds several into one finding, so suppressing it is one decision', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], {
        unitScopes: { 'src/**': 'parts', 'src/nowhere/*': 'parts', 'src/elsewhere/*': 'parts' }
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/elsewhere/*'");
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
  });
});
