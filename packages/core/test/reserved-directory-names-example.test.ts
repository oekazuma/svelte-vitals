import { describe, it, expect } from 'vitest';
import { architectureReservedDirectoryNames } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

/** The example from docs/src/content/docs/rules/architecture/reserved-directory-names.md. */
const EXAMPLE = {
  scopes: { 'src/lib': 'api|components|features|effect|db' },
  unitScopes: { 'src/**': 'parts|functions|stores|types|tests|styleGuide' }
};

/** A tree shaped like the convention the example describes. */
const TREE = [
  'src/lib/api/user/fetchUser/fetchUser.ts',
  'src/lib/components/Card/Card.svelte',
  'src/lib/components/Card/parts/Badge/Badge.svelte',
  'src/lib/components/Card/functions/formatTitle/formatTitle.ts',
  'src/lib/components/Card/tests/Card.test.ts',
  'src/lib/components/Card/styleGuide/Card.styleGuide.svelte',
  'src/lib/features/blog/index.ts',
  'src/lib/effect/OnVisible/OnVisible.svelte',
  'src/lib/db/types/user.ts'
];

const run = (sourceFiles: string[], options: Record<string, unknown>) =>
  architectureReservedDirectoryNames.check({
    sourceFiles,
    heads: [],
    project: defaultProject,
    config: defineConfig({ rules: { 'architecture/reserved-directory-names': { options } } })
  } as RuleContext);

describe('the documented example', () => {
  it('is silent on a conforming tree — and silence is proof here, not absence of proof', async () => {
    // For most rules a silent example proves nothing: globs that miss everything are silent too.
    // This rule closes that gap itself — a declaration that identified nothing is reported — so an
    // example producing no result at all has also shown every one of its keys did work.
    expect(await run(TREE, EXAMPLE)).toEqual([]);
  });

  it('reports a name the convention does not admit, under a unit', async () => {
    const rs = await run([...TREE, 'src/lib/components/Card/helpers/a.ts'], EXAMPLE);
    const messages = rs.filter((r) => r.location !== undefined).map((r) => r.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('src/lib/components/Card/helpers');
    expect(messages[0]).toContain('parts, functions, stores, types, tests, styleGuide');
  });

  it('reports a name the convention does not admit, at a named position', async () => {
    const rs = await run([...TREE, 'src/lib/widgets/a.ts'], EXAMPLE);
    const messages = rs.filter((r) => r.location !== undefined).map((r) => r.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('src/lib/widgets');
    expect(messages[0]).toContain('api, components, features, effect, db');
  });

  it('never exercises the precedence comparison, which is why test 1 of the plan carries it', async () => {
    // The `scopes` key names a directory that is not a unit, and no `scopes` key names a unit, so
    // the two declarations never compete on this configuration.
    const rs = await run(TREE, EXAMPLE);
    expect(rs).toEqual([]);
  });
});

describe('the documented exclude example', () => {
  const GENERATED = ['src/lib/components/Card/generated/a.ts'];

  it('reports the generated directory without the exclusion', async () => {
    const rs = await run([...TREE, ...GENERATED], EXAMPLE);
    expect(rs.filter((r) => r.location !== undefined)).toHaveLength(1);
  });

  it('is silent with the exclusion in place', async () => {
    const rs = await run([...TREE, ...GENERATED], { ...EXAMPLE, exclude: ['**/generated'] });
    expect(rs.filter((r) => r.location !== undefined)).toEqual([]);
  });
});
