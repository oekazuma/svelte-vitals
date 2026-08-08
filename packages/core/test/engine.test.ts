import { describe, expect, it } from 'vitest';
import { runRules } from '../src/engine.js';
import {
  architectureDirectoryNaming,
  architectureReservedDirectoryNames,
  architectureReservedNamePlacement,
  architectureUnitEntryFile,
  defaultProject,
  defineConfig
} from '../src/index.js';
import type { Rule, RuleContext } from '../src/rule.js';

const ctx = { heads: [], project: {}, config: { rules: {} } } as unknown as RuleContext;

function ruleThatCounts(id: string, counts: Record<string, number>): Rule {
  return {
    id,
    title: id,
    category: 'architecture',
    severity: 'info',
    scope: 'component',
    rationale: '',
    async check(c: RuleContext) {
      c.recordExamined?.(counts);
      return [];
    }
  } as unknown as Rule;
}

function ruleThatDoesNot(id: string): Rule {
  return {
    id,
    title: id,
    category: 'architecture',
    severity: 'info',
    scope: 'component',
    rationale: '',
    async check() {
      return [];
    }
  } as unknown as Rule;
}

describe('runRules examined counts', () => {
  it('keys a rule’s counts by its id', async () => {
    const { examined } = await runRules([ruleThatCounts('a/one', { 'x → y': 3 })], ctx);
    expect(examined).toEqual({ 'a/one': { 'x → y': 3 } });
  });

  it('gives a rule that reports nothing no entry at all', async () => {
    const { examined } = await runRules([ruleThatDoesNot('a/two')], ctx);
    expect(Object.hasOwn(examined, 'a/two')).toBe(false);
  });

  it('keeps two rules’ counts apart', async () => {
    const { examined } = await runRules([ruleThatCounts('a/one', { g: 1 }), ruleThatCounts('a/two', { g: 2 })], ctx);
    expect(examined).toEqual({ 'a/one': { g: 1 }, 'a/two': { g: 2 } });
  });

  it('still returns the results', async () => {
    const { results } = await runRules([ruleThatDoesNot('a/two')], ctx);
    expect(results).toEqual([]);
  });
});

// Issue #387: reserved-name-placement already reported examined counts; the three glob-configured
// siblings did not, so a run configuring all four produced one entry and silence for the rest. This
// runs the four real rules together and pins that every one of them now reports.
describe('runRules examined counts — the four architecture directory rules together', () => {
  it('gives every configured sibling its own entry, keyed on its own declaration identity', async () => {
    const realCtx: RuleContext = {
      sourceFiles: [
        'src/lib/Card/Card.svelte',
        'src/lib/Card/parts/Badge.svelte',
        'src/routes/blog/+page.svelte',
        'src/lib/svc/api/api.ts'
      ],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        rules: {
          'architecture/reserved-name-placement': { options: { capitalisedUnitPlacements: { parts: 'src/**' } } },
          'architecture/reserved-directory-names': { options: { unitScopes: { 'src/**': 'parts' } } },
          'architecture/directory-naming': { options: { directories: { 'src/routes/*': 'camelCase' } } },
          'architecture/unit-entry-file': { options: { units: { 'src/lib/svc/*': '.ts' } } }
        }
      })
    };
    const { examined } = await runRules(
      [
        architectureReservedNamePlacement,
        architectureReservedDirectoryNames,
        architectureDirectoryNaming,
        architectureUnitEntryFile
      ],
      realCtx
    );
    expect(Object.keys(examined).sort()).toEqual([
      'architecture/directory-naming',
      'architecture/reserved-directory-names',
      'architecture/reserved-name-placement',
      'architecture/unit-entry-file'
    ]);
    expect(examined['architecture/reserved-name-placement']?.['capitalisedUnitPlacements.parts → src/**']).toBe(1);
    expect(examined['architecture/reserved-directory-names']?.['src/**']).toBe(1);
    expect(examined['architecture/directory-naming']?.['src/routes/*']).toBe(1);
    expect(examined['architecture/unit-entry-file']?.['src/lib/svc/*']).toBe(1);
  });
});
