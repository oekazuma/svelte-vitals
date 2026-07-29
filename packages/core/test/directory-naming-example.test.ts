import { describe, it, expect } from 'vitest';
import { architectureDirectoryNaming } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

/** The `directories` example from docs/src/content/docs/rules/architecture/directory-naming.md. */
const EXAMPLE = {
  directories: {
    'src/routes/**': 'camelCase|PascalCase',
    'src/routes/internalApi/*': 'kebab-case',
    'src/lib/features/*': 'camelCase',
    'src/lib/api/*': 'camelCase'
  }
};

/** A tree shaped like the convention the example describes. */
const TREE = [
  'src/routes/+page.svelte',
  'src/routes/search/itemList/+page.svelte',
  'src/routes/[itemId=integer]/components/PageHeader/PageHeader.svelte',
  'src/routes/internalApi/clear-cache/+server.ts',
  'src/routes/internalApi/set-cookie/fetchSetCookie/fetchSetCookie.ts',
  'src/lib/features/catalog/index.ts',
  'src/lib/api/searchItems/index.ts'
];

const run = (sourceFiles: string[], options: Record<string, unknown>) =>
  architectureDirectoryNaming.check({
    sourceFiles,
    heads: [],
    project: defaultProject,
    config: defineConfig({ rules: { 'architecture/directory-naming': { options } } })
  } as RuleContext);

describe('the documented directories example', () => {
  it('is silent on a conforming tree — and silence is proof here, not absence of proof', async () => {
    // For most rules a silent example proves nothing: globs that miss everything are silent too.
    // This rule closes that gap itself — a declaration matching no directory is reported as
    // checking nothing — so an example that produces no result at all has also demonstrated that
    // every one of its keys governs something real. The deviation tests below supply the other
    // half: that what it governs, it actually checks.
    expect(await run(TREE, EXAMPLE)).toEqual([]);
  });

  it('reports the deviations the convention forbids', async () => {
    const rs = await run(
      [
        ...TREE,
        'src/routes/internalApi/setCookie/+server.ts', // endpoint segment must be kebab-case
        'src/lib/features/UserProfile/index.ts' // feature root must be camelCase
      ],
      EXAMPLE
    );
    const messages = rs.filter((r) => r.location !== undefined).map((r) => r.message);
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.includes('src/routes/internalApi/setCookie') && m.includes('kebab-case'))).toBe(true);
    expect(messages.some((m) => m.includes('src/lib/features/UserProfile') && m.includes('camelCase'))).toBe(true);
  });

  it('narrows the routes declaration with the endpoint one rather than being overridden by it', async () => {
    // 'src/routes/internalApi/*' has four segments to 'src/routes/**''s three, so it wins. Proven by
    // a camelCase endpoint segment being reported: it satisfies the broader declaration, so it can
    // only fail if the narrower one is what governs it.
    const rs = await run([...TREE, 'src/routes/internalApi/setCookie/+server.ts'], EXAMPLE);
    const messages = rs.filter((r) => r.location !== undefined).map((r) => r.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('src/routes/internalApi/setCookie must be kebab-case');
  });

  it('lets a function unit one level below an endpoint fall back to the broader declaration', async () => {
    // 'src/routes/internalApi/*' is one segment too shallow to reach a function unit, so the
    // camelCase|PascalCase declaration governs it. A kebab-case name there proves which: it would
    // satisfy the endpoint declaration, so it can only be reported if that declaration does not
    // reach this depth.
    const rs = await run([...TREE, 'src/routes/internalApi/set-cookie/fetch-set-cookie/x.ts'], EXAMPLE);
    const messages = rs.filter((r) => r.location !== undefined).map((r) => r.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('fetch-set-cookie');
    expect(messages[0]).toContain('camelCase or PascalCase');
  });
});

describe('the documented exclude example', () => {
  const GENERATED = ['src/lib/generated/api_client/index.ts'];

  it('removes a finding that appears without it', async () => {
    const without = await run([...TREE, ...GENERATED], {
      directories: { ...EXAMPLE.directories, 'src/lib/**': 'camelCase' }
    });
    expect(without.filter((r) => r.location !== undefined)).toHaveLength(1);
  });

  it('is silent with the exclusion in place', async () => {
    const withExclude = await run([...TREE, ...GENERATED], {
      directories: { ...EXAMPLE.directories, 'src/lib/**': 'camelCase' },
      exclude: ['src/lib/generated']
    });
    expect(withExclude.filter((r) => r.location !== undefined)).toEqual([]);
  });
});
