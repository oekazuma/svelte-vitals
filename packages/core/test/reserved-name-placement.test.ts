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

type Results = Awaited<ReturnType<typeof run>>;
/** The misplaced-directory findings. A run may also carry the project-scoped declaration note. */
const violations = (results: Results) => results.filter((r) => r.route !== undefined);
const projectScoped = (results: Results) => results.filter((r) => r.route === undefined && r.location === undefined);

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
    const results = violations(await run(['src/lib/e2e/a.ts'], { placements: { e2e: 'src/routes/**' } }));
    expect(results).toHaveLength(1);
    expect(results[0]?.route).toBe('src/lib/e2e');
    expect(results[0]?.location).toBe('src/lib/e2e/a.ts');
    expect(results[0]?.severity).toBe('info');
    expect(results[0]?.category).toBe('architecture');
  });

  // Testing item 12
  it('exclude removes a subtree that reports without it', async () => {
    // This tree holds no src/routes either way, so both runs also carry the declaration note.
    const files = ['src/lib/legacy/e2e/a.ts'];
    const without = await run(files, { placements: { e2e: 'src/routes/**' } });
    expect(violations(without)).toHaveLength(1);
    const withExclude = await run(files, {
      placements: { e2e: 'src/routes/**' },
      exclude: ['src/lib/legacy/**']
    });
    expect(violations(withExclude)).toEqual([]);
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

  // A tree with one capitalised unit, one lowercase unit and one same-case non-unit of each kind.
  const UNIT_TREE = [
    'src/lib/Card/Card.svelte',
    'src/lib/Card/parts/a.svelte',
    'src/lib/Card/tests/a.ts',
    'src/lib/formatDate/formatDate.ts',
    'src/lib/formatDate/parts/b.svelte',
    'src/lib/formatDate/tests/b.ts',
    'src/lib/Icons/other.svelte',
    'src/lib/Icons/parts/c.svelte',
    'src/lib/helpers/format.ts',
    'src/lib/helpers/tests/d.ts'
  ];

  // Testing item 1
  it('reports a capitalised-unit-only name under a lowercase unit and is silent under a capitalised one', async () => {
    const results = await run(UNIT_TREE, { capitalisedUnitPlacements: { parts: 'src/**' } });
    expect(results.map((r) => r.route)).toEqual(['src/lib/Icons/parts', 'src/lib/formatDate/parts']);
  });

  // Testing item 2
  it('is silent for an any-case name under both kinds of unit, in one run', async () => {
    const results = await run(UNIT_TREE, { anyCaseUnitPlacements: { tests: 'src/**' } });
    expect(results.map((r) => r.route)).toEqual(['src/lib/helpers/tests']);
  });

  // Testing item 7
  it('requires the entry file in both predicates, not just the letter', async () => {
    const cap = await run(UNIT_TREE, { capitalisedUnitPlacements: { parts: 'src/**' } });
    expect(cap.map((r) => r.route)).toContain('src/lib/Icons/parts'); // Icons/ holds no Icons.*
    const any = await run(UNIT_TREE, { anyCaseUnitPlacements: { tests: 'src/**' } });
    expect(any.map((r) => r.route)).toContain('src/lib/helpers/tests'); // helpers/ holds no helpers.*
  });

  // Testing item 3
  it('is silent in every declared position of a name declared in more than one map, in one run', async () => {
    const results = await run(
      [
        'src/lib/Card/Card.svelte',
        'src/lib/Card/functions/a.ts',
        'src/lib/features/checkout/functions/b.ts',
        'src/routes/about/functions/c.ts',
        'src/lib/orphan/functions/d.ts'
      ],
      {
        capitalisedUnitPlacements: { functions: 'src/**' },
        placements: { functions: 'src/lib/features/*|src/routes/**' }
      }
    );
    expect(results.map((r) => r.route)).toEqual(['src/lib/orphan/functions']);
  });

  // Testing item 6
  it('honours each unit map glob, and matches it against the unit itself rather than an ancestor', async () => {
    // Both halves of "the glob is honoured": a unit outside the glob reports, under both maps.
    const outside = await run(
      [
        'src/lib/Card/Card.svelte',
        'src/lib/Card/parts/a.svelte',
        'src/app/Panel/Panel.svelte',
        'src/app/Panel/parts/b.svelte',
        'src/app/formatDate/formatDate.ts',
        'src/app/formatDate/tests/c.ts'
      ],
      {
        capitalisedUnitPlacements: { parts: 'src/lib/**' },
        anyCaseUnitPlacements: { tests: 'src/lib/**' }
      }
    );
    expect(outside.map((r) => r.route)).toEqual(['src/app/Panel/parts', 'src/app/formatDate/tests']);

    // The match subject: a unit AT src/lib/Card is permitted by `src/lib/**` and reported by `src/lib`.
    const tree = ['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'];
    expect(await run(tree, { capitalisedUnitPlacements: { parts: 'src/lib/**' } })).toEqual([]);
    const bare = await run(tree, { capitalisedUnitPlacements: { parts: 'src/lib' } });
    // `src/lib` matches only itself, never a unit, so it also earns the unit note: it cannot reach
    // `src/lib/Card` any more than it can reach the misplaced `parts/` the violation is about.
    expect(violations(bare).map((r) => r.route)).toEqual(['src/lib/Card/parts']);
    const bareNotes = projectScoped(bare);
    expect(bareNotes).toHaveLength(1);
    expect(bareNotes[0]?.message).toContain('reaches no unit');
    expect(bareNotes[0]?.message).not.toContain('matched directories but never a unit');
  });

  // Testing item 8 — the silence half.
  it('lets an empty value in one map ungovern the name in every map', async () => {
    const tree = [
      'src/lib/Card/Card.svelte',
      'src/lib/Card/functions/a.ts',
      'src/lib/features/checkout/checkout.ts',
      'src/lib/features/checkout/functions/b.ts',
      'src/lib/orphan/functions/c.ts'
    ];
    // Without the empty value, the orphan reports.
    const governed = await run(tree, { anyCaseUnitPlacements: { functions: 'src/**' } });
    expect(governed.map((r) => r.route)).toEqual(['src/lib/orphan/functions']);

    // With it, `functions` is ungoverned everywhere — a value-level drop would report the two
    // positions the emptied `placements` entry used to cover.
    const dropped = await run(tree, {
      anyCaseUnitPlacements: { functions: 'src/**' },
      placements: { functions: '|' }
    });
    expect(violations(dropped)).toEqual([]);

    // Strengthens against a check that reads only `placements`' own emptiness and leaves the other
    // two maps to `matches()`: here the empty value sits in `anyCaseUnitPlacements` while
    // `placements` carries an ordinary glob that does not reach this directory. A per-map check
    // would report it as an ordinary placements violation instead of dropping it everywhere.
    const crossMap = await run(['src/lib/orphan/functions/a.ts'], {
      placements: { functions: 'src/routes/**' },
      anyCaseUnitPlacements: { functions: '|' }
    });
    expect(violations(crossMap)).toEqual([]);
  });

  // Testing item 14 — the override glob must match the reserved-name directory and NOT its parent,
  // or the two resolution subjects agree on every assertion and this proves nothing.
  it('scopes the empty-value drop to the resolved option set an overrides layer produces', async () => {
    const results = await run(
      ['src/lib/orphan/parts/a.svelte', 'src/parts/b.svelte'],
      { placements: { parts: 'src/lib/Card' } },
      {
        overrides: [{ files: 'src/**/parts', rules: { [ID]: { options: { placements: { parts: '|' } } } } }]
      } as never
    );
    // 'src/**/parts' reaches src/lib/orphan/parts (silenced) and misses src/parts (still reporting).
    expect(violations(results).map((r) => r.route)).toEqual(['src/parts']);
  });

  // Testing item 8 — the reported half.
  it('reports an emptied declaration rather than dropping it in silence', async () => {
    const results = await run(['src/routes/about/e2e/a.ts'], { placements: { e2e: '|' } });
    expect(violations(results)).toEqual([]);
    expect(projectScoped(results)).toHaveLength(1);
    expect(projectScoped(results)[0]?.message).toContain('e2e');
  });

  // Testing item 9
  it('carries every bad declaration in one project-scoped finding, not one each', async () => {
    const results = await run(['src/routes/about/e2e/a.ts'], {
      placements: { e2e: '|', stores: '|', types: 'src/nowhere/**' }
    });
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.route).toBeUndefined();
    expect(notes[0]?.location).toBeUndefined();
    for (const name of ['e2e', 'stores', 'types']) expect(notes[0]?.message).toContain(name);
  });

  // Testing item 10
  it('classifies a dead glob per alternative, not per name', async () => {
    const results = await run(['src/routes/about/e2e/a.ts'], {
      placements: { e2e: 'src/route/**|src/routes/**' }
    });
    expect(violations(results)).toEqual([]); // the good alternative works
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain('src/route/**');
    expect(notes[0]?.message).not.toContain('src/routes/**');
    // No `exclude` is declared at all, so a glob reaching nothing must say so — not be mislabelled
    // as excluded, which would be true of nothing in this tree.
    expect(notes[0]?.message).toContain('matched no directory');
  });

  // Testing item 11
  it('reports a unit-map glob whose reach holds no unit at all', async () => {
    const results = await run(['src/lib/features/checkout/parts/a.svelte', 'src/lib/features/checkout/x.ts'], {
      capitalisedUnitPlacements: { parts: 'src/lib/features/*' }
    });
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain('reaches no unit');
    expect(notes[0]?.message).not.toContain('matched directories but never a unit');
  });

  it('classifies an alternative whose every match was excluded as excluded, not as unmatched', async () => {
    const results = await run(['src/lib/legacy/Card/Card.svelte', 'src/lib/legacy/Card/parts/a.svelte'], {
      capitalisedUnitPlacements: { parts: 'src/lib/legacy/**' },
      exclude: ['src/lib/legacy/**']
    });
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain('excluded');
  });

  // The glob's only possible match is the reserved-name directory's parent, and that parent is what
  // `exclude` prunes here — so this must be classified excluded, not silently dropped.
  it('classifies an alternative as excluded when its glob names exactly the excluded parent', async () => {
    const results = await run(['src/routes/e2e/a.ts'], {
      placements: { e2e: 'src/routes' },
      exclude: ['src/routes/**']
    });
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain('excluded');
  });

  // The child was excluded on its own; `src/routes` — the only directory the glob reaches — stays
  // live, so neither reason is true of this declaration.
  it('says nothing when only the reserved-name directory itself, not its parent, is excluded', async () => {
    const results = await run(['src/routes/e2e/a.ts'], {
      placements: { e2e: 'src/routes' },
      exclude: ['src/routes/e2e']
    });
    expect(results).toEqual([]);
  });

  // The unit reason is claimed last: "the exclusion pruned everything" is the more specific answer
  // when a glob reaches nothing live at all, and it must win over the unit note in that case.
  it('prefers the excluded reason when a glob reaches nothing live', async () => {
    const results = await run(['src/lib/legacy/parts/a.svelte', 'src/routes/+page.svelte'], {
      capitalisedUnitPlacements: { parts: 'src/lib/legacy/*' },
      exclude: ['src/lib/legacy/**']
    });
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain('matched only excluded directories');
    expect(notes[0]?.message).not.toContain('reaches no unit');
  });

  // Every map is consulted at a position, not only up to the first that permits it. Here the two maps
  // carry the same glob, so a short-circuiting union records work for `placements` alone and leaves the
  // `capitalisedUnitPlacements` entry looking untouched — and its only other match is the excluded
  // subtree, which is what turns that omission into a note claiming the entry only ever met excluded
  // directories. It qualified src/lib/Card.
  it('records work for every map at a position, not only the first one that permits it', async () => {
    const results = await run(
      [
        'src/lib/Card/Card.svelte',
        'src/lib/Card/parts/a.svelte',
        'src/lib/legacy/Panel/Panel.svelte',
        'src/lib/legacy/Panel/parts/b.svelte'
      ],
      {
        placements: { parts: 'src/lib/**' },
        capitalisedUnitPlacements: { parts: 'src/lib/**' },
        exclude: ['src/lib/legacy/**']
      }
    );
    expect(results).toEqual([]);
  });

  // A declaration a correct project simply has not used yet is not a dead one, and the glob it names
  // does match directories — so neither reason the classification can give would be true.
  it('says nothing about a declaration whose glob reaches directories the name never appeared in', async () => {
    const results = await run(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'], {
      capitalisedUnitPlacements: { parts: 'src/lib/**' },
      placements: { stores: 'src/lib/**' }
    });
    expect(results).toEqual([]);
  });

  // Only globally resolved alternatives are classified. `src/nowhere/**` reaches no directory, and
  // would be reported as dead if the per-directory resolved maps fed the classification.
  it('says nothing about a dead glob that arrives only through an overrides layer', async () => {
    const results = await run(['src/lib/e2e/a.ts'], { placements: { e2e: 'src/lib' } }, {
      overrides: [{ files: 'src/**', rules: { [ID]: { options: { placements: { stores: 'src/nowhere/**' } } } } }]
    } as never);
    expect(results).toEqual([]);
  });

  // An alternative is identified by its map too, so one glob copied into two maps is two
  // declarations: `placements` permits this position, the capitalised-unit copy checks nothing.
  it('classifies one glob declared in two maps as two alternatives', async () => {
    const results = await run(['src/lib/orphan/parts/a.svelte'], {
      placements: { parts: 'src/lib/**' },
      capitalisedUnitPlacements: { parts: 'src/lib/**' }
    });
    expect(violations(results)).toEqual([]);
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain("'capitalisedUnitPlacements.parts → src/lib/**'");
    expect(notes[0]?.message).toContain('reaches no unit');
    expect(notes[0]?.message).not.toContain("'placements"); // the placements copy did work
  });

  // Every glob that matched a permitted position has done work, not only the one that governs it.
  // `src/*/*` also reaches the excluded src/legacy/e2e, so recording one match would leave the other
  // looking untouched and blame the exclusion for it.
  it('records work for every glob a position matched, not only the governing one', async () => {
    const results = await run(['src/lib/orphan/e2e/a.ts', 'src/legacy/e2e/b.ts'], {
      placements: { e2e: 'src/lib/**|src/*/*' },
      exclude: ['src/legacy/**']
    });
    expect(results).toEqual([]);
  });

  // `exclude` resolves at the reserved-name directory, so an `overrides` layer supplies it like any
  // other option. The override's glob names the reserved-name directory, not the parent.
  it('honours an exclude that only an overrides layer supplies', async () => {
    const files = ['src/lib/orphan/parts/a.svelte', 'src/routes/about/+page.svelte'];
    const options = { placements: { parts: 'src/routes/**' } };
    expect(violations(await run(files, options)).map((r) => r.route)).toEqual(['src/lib/orphan/parts']);

    const excluded = await run(files, options, {
      overrides: [{ files: 'src/**/parts', rules: { [ID]: { options: { exclude: ['src/lib/**'] } } } }]
    } as never);
    expect(excluded).toEqual([]);
  });

  it('does not call a declaration excluded when its glob reaches a live directory', async () => {
    const results = await run(['src/lib/Panel/Panel.svelte', 'src/lib/legacy/parts/b.svelte', 'src/lib/other/x.ts'], {
      capitalisedUnitPlacements: { parts: 'src/lib/*' },
      exclude: ['src/lib/legacy/**']
    });
    const notes = projectScoped(results);
    for (const n of notes) expect(n.message).not.toContain('matched only excluded directories');
  });

  // The wildcard shape of the excluded reason: this glob finds its match by wildcard and every match
  // is then pruned, where the fixture above names the excluded directory literally.
  it('calls a placements declaration excluded when every directory its glob reaches is excluded', async () => {
    const results = await run(['src/lib/legacy/e2e/a.ts', 'src/routes/+page.svelte'], {
      placements: { e2e: 'src/lib/legacy/*' },
      exclude: ['src/lib/legacy/**']
    });
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain('matched only excluded directories');
  });

  it('says nothing about a unit-map glob that reaches a live unit the name has not used yet', async () => {
    const results = await run(['src/lib/Card/Card.svelte', 'src/lib/db/types/t.ts'], {
      anyCaseUnitPlacements: { types: 'src/**' },
      placements: { types: 'src/lib/db' }
    });
    expect(projectScoped(results)).toEqual([]);
  });

  it('reports a unit-map glob that reaches no unit of its kind', async () => {
    const results = await run(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'], {
      capitalisedUnitPlacements: { parts: 'src/lib' }
    });
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain('reaches no unit');
    expect(notes[0]?.message).not.toContain('matched directories but never a unit');
  });

  // `parts/` sits under `src/lib/other`, not a unit, so this is a genuine violation and the
  // alternative is genuinely unused — unlike a fixture where the name already sits under the one
  // unit the glob reaches, which `record()` marks used before the classification ever runs. The
  // corrected glob still reaches the live unit `src/lib/Card`, so the classification must stay silent.
  it('says nothing once that glob is corrected to reach the unit', async () => {
    const results = await run(['src/lib/Card/Card.svelte', 'src/lib/other/parts/a.svelte', 'src/lib/other/x.ts'], {
      capitalisedUnitPlacements: { parts: 'src/lib/**' }
    });
    expect(violations(results)).toHaveLength(1);
    expect(projectScoped(results)).toEqual([]);
  });

  it('does not let one unit map borrow the other kind of unit', async () => {
    const cap = await run(['src/lib/formatDate/formatDate.ts', 'src/lib/formatDate/parts/a.svelte'], {
      capitalisedUnitPlacements: { parts: 'src/**' }
    });
    const capNotes = projectScoped(cap);
    expect(capNotes).toHaveLength(1);
    expect(capNotes[0]?.message).toContain('reaches no unit');
    expect(capNotes[0]?.message).not.toContain('matched directories but never a unit');
    // The any-case half needs `parts/` somewhere that is NOT the lowercase unit: under it, `record()`
    // marks the alternative used and the classification never runs, which pins nothing.
    const any = await run(['src/lib/formatDate/formatDate.ts', 'src/lib/other/parts/a.svelte', 'src/lib/other/x.ts'], {
      anyCaseUnitPlacements: { parts: 'src/**' }
    });
    expect(projectScoped(any)).toEqual([]);
  });

  it('honours the bare-prefix guard when looking for a unit', async () => {
    // `src/lib/Card/**` does not reach `src/lib/Card` itself, which is the only capitalised unit here.
    const results = await run(['src/lib/Card/Card.svelte', 'src/lib/Card/parts/a.svelte'], {
      capitalisedUnitPlacements: { parts: 'src/lib/Card/**' }
    });
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain('reaches no unit');
    expect(notes[0]?.message).not.toContain('matched directories but never a unit');
  });

  it('reports a unit-map glob whose only unit of the kind is excluded', async () => {
    const results = await run(
      ['src/lib/legacy/Card/Card.svelte', 'src/lib/utils/parts/a.svelte', 'src/lib/utils/x.ts'],
      {
        capitalisedUnitPlacements: { parts: 'src/lib/**' },
        exclude: ['src/lib/legacy/**']
      }
    );
    const notes = projectScoped(results);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.message).toContain('reaches no unit');
    expect(notes[0]?.message).not.toContain('matched directories but never a unit');
  });

  // The declared position is elsewhere (`src/other/**`), so this alternative is genuinely unused —
  // and it reaches the live `src/other/thing`, so neither of the other two reasons claims it either.
  // It is exactly the shape the unit pass would otherwise reach for, which is why `placements` must
  // be excluded from that pass rather than merely never triggering it by chance.
  it('never gives a placements declaration the unit note', async () => {
    const results = await run(['src/lib/e2e/a.ts', 'src/other/thing/b.ts'], {
      placements: { e2e: 'src/other/**' }
    });
    for (const n of projectScoped(results)) expect(n.message).not.toContain('reaches no unit');
  });
});
