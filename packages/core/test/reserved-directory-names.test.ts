import { describe, it, expect } from 'vitest';
import { architectureReservedDirectoryNames } from '../src/internal.js';
import { isUnitDir, isAnyCaseUnitDir } from '../src/rules/architecture/reserved-directory-names.js';
import { childFiles } from '../src/rules/architecture/declarations.js';
import { runRules } from '../src/engine.js';
import { defineConfig, defaultProject, type Config } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const ID = 'architecture/reserved-directory-names';

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
  const { results, examined } = await runRules([architectureReservedDirectoryNames], ctx(sourceFiles, options, extra));
  return { results, examined: examined[ID] ?? {} };
}

describe('isUnitDir', () => {
  const filesIn = (files: string[]) => childFiles(files);

  it('is true for a PascalCase directory holding its same-named file, whatever the extension', () => {
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/Card.svelte']))).toBe(true);
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/Card.ts']))).toBe(true);
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/Card.svelte.ts']))).toBe(true);
  });

  it('is false for a capitalised directory with no same-named file', () => {
    expect(isUnitDir('src/lib/Icons', filesIn(['src/lib/Icons/Star.svelte']))).toBe(false);
  });

  it('is false when the same-named file is not an immediate child', () => {
    // The file that gives a unit its identity sits beside its subdirectories, never inside one.
    expect(isUnitDir('src/lib/Card', filesIn(['src/lib/Card/parts/Card.svelte']))).toBe(false);
  });

  it('is false for a directory whose name does not begin A-Z', () => {
    expect(isUnitDir('src/lib/card', filesIn(['src/lib/card/card.ts']))).toBe(false);
  });

  it('is false for a dotted directory name, because only the filename is cut', () => {
    // The stem is taken to the file's FIRST dot, which is what lets `Card.svelte.ts` qualify — but
    // the directory's basename is compared whole, so `Card.v2.svelte` yields `Card`, which is not
    // `Card.v2`. Both rule pages state this outcome and contrast it with the sibling rule, which
    // builds the expected filename from the directory name plus a declared extension and therefore
    // calls the same directory a satisfied unit. Cutting the directory name too would make it a unit
    // here and leave only the documentation wrong.
    expect(isUnitDir('src/lib/Card.v2', filesIn(['src/lib/Card.v2/Card.v2.svelte']))).toBe(false);
    // And the converse: a dotted directory whose file matches it whole is still not a unit, since
    // the file's stem stops at the first dot either way.
    expect(isUnitDir('src/lib/Card.v2', filesIn(['src/lib/Card.v2/Card.svelte']))).toBe(false);
  });
});

describe('isAnyCaseUnitDir', () => {
  const filesIn = new Map<string, string[]>([
    ['src/lib/Card', ['Card.svelte']],
    ['src/lib/formatDate', ['formatDate.ts']],
    ['src/lib/counter', ['counter.svelte.ts']],
    ['src/lib/helpers', ['format.ts']],
    ['src/lib/empty', []]
  ]);

  it('accepts a capitalised unit, exactly as isUnitDir does', () => {
    expect(isAnyCaseUnitDir('src/lib/Card', filesIn)).toBe(true);
    expect(isUnitDir('src/lib/Card', filesIn)).toBe(true);
  });

  it('accepts a lowercase unit that isUnitDir rejects', () => {
    expect(isAnyCaseUnitDir('src/lib/formatDate', filesIn)).toBe(true);
    expect(isUnitDir('src/lib/formatDate', filesIn)).toBe(false);
    expect(isAnyCaseUnitDir('src/lib/counter', filesIn)).toBe(true);
    expect(isUnitDir('src/lib/counter', filesIn)).toBe(false);
  });

  it('still requires the entry file, so the letter test is the only difference', () => {
    expect(isAnyCaseUnitDir('src/lib/helpers', filesIn)).toBe(false);
    expect(isAnyCaseUnitDir('src/lib/empty', filesIn)).toBe(false);
    expect(isAnyCaseUnitDir('src/lib/unknown', filesIn)).toBe(false);
  });

  it('is exactly the letter test composed with isAnyCaseUnitDir, for every fixture here', () => {
    // Pins the relationship isUnitDir is implemented as, so a future edit to either function that
    // breaks the composition fails here instead of drifting silently.
    const startsWithAZ = (dir: string) => {
      const first = dir.slice(dir.lastIndexOf('/') + 1).charCodeAt(0);
      return first >= 65 && first <= 90;
    };
    for (const dir of [...filesIn.keys(), 'src/lib/unknown']) {
      expect(isUnitDir(dir, filesIn)).toBe(startsWithAZ(dir) && isAnyCaseUnitDir(dir, filesIn));
    }
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
    // carries no exclusion. What this pins: an exclusion reaching only the parent still prunes its
    // children — the per-child check below reads this same resolved list against the child's
    // ancestors, and the parent is always one of them.
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

  it('reports the empty value, not the collision, when the scopes side names nothing', async () => {
    // The scopes key is dropped before matching, so unitScopes really does govern. Claiming the
    // collision here would be false, and would also hide the actual error.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], { scopes: { 'src/lib/*': '|' }, unitScopes: { 'src/lib/*': 'parts' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('names no directory name at all');
    expect(project(rs)[0]!.message).not.toContain('declared in both');
  });

  it('reports the empty value, not the collision, when the unitScopes side names nothing', async () => {
    // The mirror of the case above, and it needs its own test because the two halves are guarded
    // separately. Here the scopes key governs alone, so it lands in `usedKeys` — which means reading
    // only one side of the pair for the empty-value note would leave this key with no note at all,
    // rather than merely the wrong one.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte'], { scopes: { 'src/lib/*': 'parts' }, unitScopes: { 'src/lib/*': '|' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('names no directory name at all');
    expect(project(rs)[0]!.message).not.toContain('declared in both');
  });

  it('does not claim the unitScopes entry never applies when it still governs outside the override', async () => {
    // The override is scoped to 'src/lib/Card/**' (narrow enough that it never also becomes the
    // resolved options for 'src/lib' itself), so the collision is detected only at 'src/lib/Card',
    // where 'src/**' is declared in both maps. Outside the override entirely, no `scopes` entry
    // competes, so the same `unitScopes` key still governs 'src/other/Widget' and produces a real
    // violation — which the old, unqualified wording ("the unitScopes entry never applies") would
    // have called impossible.
    const rs = await architectureReservedDirectoryNames.check({
      sourceFiles: ['src/lib/Card/Card.svelte', 'src/other/Widget/Widget.svelte', 'src/other/Widget/helpers/a.ts'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: { 'architecture/reserved-directory-names': { options: { unitScopes: { 'src/**': 'parts' } } } },
        overrides: [
          {
            files: 'src/lib/Card/**',
            rules: { 'architecture/reserved-directory-names': { options: { scopes: { 'src/**': 'api' } } } }
          }
        ]
      })
    });
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/other/Widget/helpers');
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('wins wherever both apply');
    expect(project(rs)[0]!.message).not.toContain('never applies');
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

// Issue #386: isUnitDir's letter test recognises only capitalised units, so a lowercase unit's
// children were never governed by any declaration here. anyCaseUnitScopes closes that gap with
// isAnyCaseUnitDir — the same predicate without the letter test.
describe('architecture/reserved-directory-names — anyCaseUnitScopes', () => {
  const ANY_UNITS = { anyCaseUnitScopes: { 'src/**': 'parts|tests' } };

  it("reports a lowercase .ts-entry unit's undeclared child — the issue #386 repro", async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/formatDate/formatDate.ts', 'src/lib/formatDate/helpers/a.ts'], ANY_UNITS)
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/formatDate/helpers');
    expect(fails(rs)[0]!.message).toContain('parts, tests');
  });

  it('reports no per-child finding under unitScopes alone — the gap issue #386 reports', async () => {
    // unitScopes never finds a capitalised unit in this tree, so 'helpers/' goes unmeasured and
    // silently unreported — the 43%-of-units gap the issue names. (The declaration also gets an
    // honest 'never a unit' project-scoped note for finding no capitalised unit at all, which is a
    // different, already-existing diagnostic — not the missing per-child finding pinned here.)
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/formatDate/formatDate.ts', 'src/lib/formatDate/helpers/a.ts'], {
        unitScopes: { 'src/**': 'parts|tests' }
      })
    );
    expect(fails(rs)).toEqual([]);
  });

  it("reports a lowercase .svelte.ts-entry unit's undeclared child", async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/useThing/useThing.svelte.ts', 'src/lib/useThing/helpers/a.ts'], ANY_UNITS)
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/useThing/helpers');
  });

  it('reports no per-child finding under unitScopes alone for the .svelte.ts tree either', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/useThing/useThing.svelte.ts', 'src/lib/useThing/helpers/a.ts'], {
        unitScopes: { 'src/**': 'parts|tests' }
      })
    );
    expect(fails(rs)).toEqual([]);
  });

  it('still governs a capitalised unit, exactly as unitScopes does', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/helpers/a.ts'], ANY_UNITS)
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/Card/helpers');
  });

  it('does not measure a same-case non-unit directory against the vocabulary', async () => {
    // 'helpers' holds no helpers.ts of its own, so it is not an any-case unit and its child 'deep' —
    // named outside {parts, tests} — must go unmeasured. 'formatDate' is a real any-case unit sharing
    // the same declared glob, so the key is legitimately used elsewhere and the run stays silent
    // rather than reporting a false positive on 'deep' or a dead-declaration note on the key.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/formatDate/formatDate.ts', 'src/lib/helpers/deep/a.ts'], ANY_UNITS)
    );
    expect(rs).toEqual([]);
  });
});

describe('architecture/reserved-directory-names — the unit-map partition (design 2026-08-06)', () => {
  // The same glob in both unit maps is not a collision: unitScopes's gate (isUnitDir) is a strict
  // subset of anyCaseUnitScopes's (isAnyCaseUnitDir), so at a capitalised unit both are eligible and
  // the more specific — unitScopes — governs, while anyCaseUnitScopes governs alone at a lowercase
  // unit, where unitScopes is never eligible. This lets one glob express the convention design
  // 2026-08-06 measured: capitalised units get a superset of names, lowercase units a subset.
  const PARTITION = { unitScopes: { 'src/**': 'parts|tests' }, anyCaseUnitScopes: { 'src/**': 'tests' } };

  it('lets unitScopes win the identical-glob tie at a capitalised unit', async () => {
    // 'parts' is in unitScopes's list but not anyCaseUnitScopes's. If anyCaseUnitScopes won the tie
    // instead, this would report a false positive on parts/.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/Badge/Badge.svelte'], PARTITION)
    );
    expect(rs).toEqual([]);
  });

  it('governs a lowercase unit through anyCaseUnitScopes alone, with its own narrower list', async () => {
    // formatDate/ is never eligible for unitScopes (isUnitDir requires A–Z), so anyCaseUnitScopes
    // governs alone here — and its list is 'tests' only, so parts/ is reported.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/formatDate/formatDate.ts', 'src/lib/formatDate/parts/a.ts'], PARTITION)
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/lib/formatDate/parts');
    expect(fails(rs)[0]!.message).toMatch(/declared here: tests\.$/);
  });

  it('reports neither declaration as dead, since both do real work', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(
        [
          'src/lib/Card/Card.svelte',
          'src/lib/Card/tests/a.ts',
          'src/lib/formatDate/formatDate.ts',
          'src/lib/formatDate/tests/a.ts'
        ],
        PARTITION
      )
    );
    expect(project(rs)).toEqual([]);
  });
});

describe('architecture/reserved-directory-names — anyCaseUnitScopes declarations that check nothing', () => {
  it('reports an anyCaseUnitScopes key that matched no directory', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/formatDate/formatDate.ts'], {
        anyCaseUnitScopes: { 'src/**': 'parts', 'src/nowhere/*': 'parts' }
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain("'src/nowhere/*'");
    expect(project(rs)[0]!.message).toContain('matched no directory');
  });

  it('reports an anyCaseUnitScopes key whose every match is excluded', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/tests/formatDate/formatDate.ts'], {
        anyCaseUnitScopes: { 'src/**/tests/*': 'parts' },
        exclude: ['**/tests']
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('matched only excluded directories');
  });

  it('reports an anyCaseUnitScopes key that matched directories but never a unit of either case', async () => {
    // 'grouping' holds no same-stemmed file, so it is not a unit of any case — the key identified
    // nothing, which is a stronger claim than unitScopes's 'never a unit' and gets its own wording.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/grouping/a.ts'], { anyCaseUnitScopes: { 'src/lib/*': 'parts' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('never a unit of either case');
  });

  it('reports a value that names nothing at all for anyCaseUnitScopes', async () => {
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/formatDate/formatDate.ts'], { anyCaseUnitScopes: { 'src/**': '|' } })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('names no directory name at all');
  });

  it('reports the same glob declared in scopes and anyCaseUnitScopes', async () => {
    // scopes has no eligibility gate, so it wins wherever this identical glob matches — the same
    // shape as the scopes/unitScopes collision, extended to the new map.
    const rs = await architectureReservedDirectoryNames.check(
      ctx(['src/lib/formatDate/formatDate.ts'], {
        scopes: { 'src/lib/*': 'parts' },
        anyCaseUnitScopes: { 'src/lib/*': 'parts' }
      })
    );
    expect(project(rs)).toHaveLength(1);
    expect(project(rs)[0]!.message).toContain('declared in both scopes and anyCaseUnitScopes');
  });
});

// Issue #387: the count answers "how many positions did this declaration govern", keyed on the same
// bare glob the project-scoped notes above already name — not a map-qualified label, since `scopes`,
// `unitScopes` and `anyCaseUnitScopes` can all carry the same key.
describe('architecture/reserved-directory-names — examined counts', () => {
  it('counts every position a declaration governed, whether its children conformed or not', async () => {
    const { examined } = await runWithCounts(
      ['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.ts', 'src/lib/Panel/Panel.svelte', 'src/lib/Panel/other/b.ts'],
      { unitScopes: { 'src/**': 'parts' } }
    );
    // Two units governed by 'src/**': Card (its 'parts' child is declared) and Panel (its 'other'
    // child is not, and is reported) — the count is places governed, not places clean.
    expect(examined['src/**']).toBe(2);
  });

  it('reports a count even when every governed child conforms, with no finding at all', async () => {
    const { examined, results } = await runWithCounts(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.ts'], {
      unitScopes: { 'src/**': 'parts' }
    });
    expect(examined['src/**']).toBe(1);
    expect(results).toEqual([]);
  });

  // Unlike the fourth rule, "checked nothing" is not silent for this one: the same run already
  // carries the 'matched no directory' project-scoped note. The count adds the missing number
  // alongside it rather than replacing it.
  it('reports zero for a declaration that matches no directory, alongside its existing diagnostic', async () => {
    const { examined, results } = await runWithCounts(['src/lib/Card/Card.svelte'], {
      unitScopes: { 'src/nowhere/**': 'parts' }
    });
    expect(examined['src/nowhere/**']).toBe(0);
    expect(project(results)).toHaveLength(1);
    expect(project(results)[0]!.message).toContain("'src/nowhere/**'");
    expect(project(results)[0]!.message).toContain('matched no directory');
  });

  it('does not count a key that matched but lost the specificity tie-break', async () => {
    const { examined } = await runWithCounts(['src/lib/Card/Card.svelte', 'src/lib/Card/tests/a.ts'], {
      scopes: { 'src/lib/*': 'parts' },
      unitScopes: { 'src/**': 'parts|tests' }
    });
    // 'src/lib/*' governs src/lib/Card (more segments), so 'src/**' matched there and lost. It
    // governed nothing, so it must read 0 — a loser is not a place examined for this declaration.
    expect(examined['src/lib/*']).toBe(1);
    expect(examined['src/**']).toBe(0);
  });

  // The #386 partition: the same glob key sits in both unit maps, governing a capitalised unit
  // through unitScopes and a lowercase unit through anyCaseUnitScopes. Bare-glob identity means both
  // maps' work lands under the one label — summing here is coherent with the diagnostics above, which
  // already report a collision or an unused key by that same bare string regardless of which map it
  // came from.
  it("sums both unit maps' work under one bare-glob label", async () => {
    const { examined } = await runWithCounts(
      [
        'src/lib/Card/Card.svelte',
        'src/lib/Card/tests/a.ts',
        'src/lib/formatDate/formatDate.ts',
        'src/lib/formatDate/parts/a.ts'
      ],
      { unitScopes: { 'src/**': 'parts|tests' }, anyCaseUnitScopes: { 'src/**': 'tests' } }
    );
    // Card wins through unitScopes (capitalised unit), formatDate through anyCaseUnitScopes
    // (lowercase unit, ineligible for unitScopes) — one label, two governed positions.
    expect(examined['src/**']).toBe(2);
  });

  it('does not count an excluded position', async () => {
    // Mirrors the exclude fixture above ('prunes an excluded parent'): with Card excluded, 'src/**'
    // matches only non-unit directories, so it also earns the pre-existing 'never a unit' note —
    // that diagnostic is not this test's concern, only that the excluded position is not counted.
    const { examined, results } = await runWithCounts(['src/lib/Card/Card.svelte'], {
      unitScopes: { 'src/**': 'parts' },
      exclude: ['src/lib/Card']
    });
    expect(examined['src/**']).toBe(0);
    expect(fails(results)).toEqual([]);
  });

  it('does not count a declaration that exists only in an overrides layer', async () => {
    // isMentionedAnywhere sees the rule through the overrides entry, so it runs and counts — but the
    // global resolution declares nothing, so the entry must be EMPTY, not absent. `runWithCounts`'s
    // `?? {}` fallback can't tell those apart, so this asserts against the raw `examined` map.
    const { examined } = await runRules(
      [architectureReservedDirectoryNames],
      ctx(['src/lib/Card/Card.svelte'], undefined, {
        overrides: [{ files: 'src/**', rules: { [ID]: { options: { unitScopes: { 'src/nowhere/*': 'parts' } } } } }]
      } as never)
    );
    expect(Object.hasOwn(examined, ID)).toBe(true);
    expect(examined[ID]).toEqual({});
  });

  it('reports no counts at all on a run with no file inventory', async () => {
    const config = defineConfig({ rules: { [ID]: { options: { unitScopes: { 'src/**': 'parts' } } } } });
    const seen: Record<string, number>[] = [];
    await architectureReservedDirectoryNames.check({
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
    await architectureReservedDirectoryNames.check({
      sourceFiles: ['src/lib/Card/Card.svelte'],
      heads: [],
      project: defaultProject,
      config,
      recordExamined: (c: Record<string, number>) => void seen.push(c)
    } as unknown as RuleContext);
    expect(seen).toEqual([]);
  });
});
