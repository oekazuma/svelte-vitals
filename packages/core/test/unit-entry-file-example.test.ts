import { describe, it, expect } from 'vitest';
import { architectureUnitEntryFile } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

/** The configuration documented on the rule page. */
const EXAMPLE = {
  units: {
    'src/lib/api/**/*': '.ts',
    'src/**/functions/*': '.ts',
    'src/**/functions/*/*': '.ts',
    'src/**/stores/*': '.svelte.ts'
  },
  pascalCaseUnits: { 'src/**': '.svelte' },
  // 'src/routes/FAQ' is excluded because it is a route segment, not a component unit: the broad
  // pascalCaseUnits root (`src/**`) is otherwise blind to that distinction and would demand
  // 'FAQ/FAQ.svelte', whose only other remedy — renaming the directory — would change the site's
  // URL (see the rule page's guidance on narrowing rather than renaming a route segment).
  exclude: ['**/tests', '**/styleGuide', '**/types', '**/e2e', 'src/routes/FAQ']
};

/** A compliant tree: one of every unit kind the example declares, all well-formed. */
const COMPLIANT = [
  // component unit, with a nested part and the reserved folders around it
  'src/lib/features/catalog/PriceTable/PriceTable.svelte',
  'src/lib/features/catalog/PriceTable/types.ts',
  'src/lib/features/catalog/PriceTable/tests/PriceTable.test.ts',
  'src/lib/features/catalog/PriceTable/tests/Fixtures/dummy.ts',
  'src/lib/features/catalog/PriceTable/styleGuide/PriceTable.styleGuide.svelte',
  'src/lib/features/catalog/PriceTable/parts/PriceBadge/PriceBadge.svelte',
  // function unit and a helper nested inside it
  'src/lib/features/catalog/PriceTable/functions/formatDate/formatDate.ts',
  'src/lib/features/catalog/PriceTable/functions/formatDate/pad/pad.ts',
  // store unit
  'src/lib/features/catalog/PriceTable/stores/createItem/createItem.svelte.ts',
  // api: a domain holding a shared type, a fetch unit, and a helper nested in it
  'src/lib/api/voice/types.ts',
  'src/lib/api/voice/fetchVoice/fetchVoice.ts',
  'src/lib/api/voice/fetchVoice/toQuery/toQuery.ts',
  // a camelCase grouping, which is not a unit and must not be reported
  'src/lib/features/catalog/searchForm/SearchBox/SearchBox.svelte',
  // a route tree, including a matcher segment and an e2e folder
  'src/routes/search/itemList/+page.svelte',
  'src/routes/search/itemList/components/Search/Search.svelte',
  'src/routes/search/itemList/e2e/index.spec.ts',
  'src/routes/[itemId=integer]/+page.svelte',
  // a PascalCase route segment, excluded above rather than expected to hold FAQ/FAQ.svelte
  'src/routes/FAQ/+page.svelte'
];

const ctx = (sourceFiles: string[]): RuleContext => ({
  sourceFiles,
  heads: [],
  project: defaultProject,
  config: defineConfig({ rules: { 'architecture/unit-entry-file': { options: EXAMPLE } } })
});

const fails = (rs: Result[]) => rs.filter((r) => r.detection.value === 'absent');
const passes = (rs: Result[]) => rs.filter((r) => r.detection.value === 'static');

describe('the documented example configuration', () => {
  it('check 1: reports nothing on a compliant tree', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    expect(fails(rs).map((r) => r.message)).toEqual([]);
  });

  it('check 2: examines a known number of directories — zero findings must not mean zero work', async () => {
    // The pass count IS the examined count: every unit the example declares emits one. Asserted
    // exactly, not just non-zero, because a declaration that quietly narrows is the failure mode
    // this whole task exists to catch.
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    expect(passes(rs)).toHaveLength(9);
  });

  it('check 3: examines every unit kind the example declares, not just some', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    // A pass no longer carries `route` (it would be a fresh score key no other rule produces);
    // `location` is what identifies which entry file each pass examined.
    const examined = passes(rs).map((r) => r.location);
    // One assertion per declaration key, so a key that silently matches nothing fails here.
    expect(examined).toContain('src/lib/features/catalog/PriceTable/PriceTable.svelte'); // pascalCaseUnits
    expect(examined).toContain('src/lib/features/catalog/PriceTable/parts/PriceBadge/PriceBadge.svelte'); // nested PascalCase
    expect(examined).toContain('src/lib/features/catalog/PriceTable/functions/formatDate/formatDate.ts'); // functions/*
    expect(examined).toContain('src/lib/features/catalog/PriceTable/functions/formatDate/pad/pad.ts'); // functions/*/*
    expect(examined).toContain('src/lib/features/catalog/PriceTable/stores/createItem/createItem.svelte.ts'); // stores/*
    expect(examined).toContain('src/lib/api/voice/fetchVoice/fetchVoice.ts'); // api fetch unit
    expect(examined).toContain('src/lib/api/voice/fetchVoice/toQuery/toQuery.ts'); // api nested helper
    expect(examined).toContain('src/routes/search/itemList/components/Search/Search.svelte'); // route component
    expect(examined).toContain('src/lib/features/catalog/searchForm/SearchBox/SearchBox.svelte'); // unit inside a camelCase grouping
  });

  it('check 3b: does not examine what the example must leave alone', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    // Messages as well as routes: a wrongly-examined directory reports at a nested child, so its
    // own name appears only in the message.
    const touched = [...fails(rs), ...passes(rs)].map((r) => `${r.route ?? ''}\n${r.message}`).join('\n');
    // The api domain level, reserved folders, camelCase groupings and matcher segments.
    expect(touched).not.toContain('src/lib/api/voice/types.ts');
    expect(touched).not.toContain('tests/');
    expect(touched).not.toContain('styleGuide/');
    expect(touched).not.toContain('e2e/');
    expect(touched).not.toContain('searchForm/searchForm');
    expect(touched).not.toContain('[itemId=integer]');
  });

  it('reports on a non-compliant tree, so the checks above are not vacuous', async () => {
    const broken = [
      ...COMPLIANT,
      'src/lib/features/catalog/Orphan/Something.svelte', // PascalCase, no Orphan.svelte
      'src/lib/features/catalog/PriceTable/functions/getThing/other.ts' // declared unit, no getThing.ts
    ];
    const rs = await architectureUnitEntryFile.check(ctx(broken));
    const messages = fails(rs).map((r) => r.message);
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.includes('src/lib/features/catalog/Orphan/Orphan.svelte'))).toBe(true);
    expect(messages.some((m) => m.includes('getThing/getThing.ts'))).toBe(true);
  });

  it('every declaration in the example matches something, so none is inert', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    // A project-scoped inert finding carries neither `route` nor `location`; the compliant
    // tree's passes now carry `location` alone, so `route === undefined` alone would wrongly
    // catch them too.
    expect(rs.filter((r) => r.route === undefined && r.location === undefined)).toEqual([]);
  });
});
