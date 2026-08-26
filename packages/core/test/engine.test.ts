import { describe, expect, it } from 'vitest';
import { runRules } from '../src/engine.js';
import { defineConfig } from '../src/index.js';
import {
  architectureDirectoryNaming,
  architectureReservedDirectoryNames,
  architectureReservedNamePlacement,
  architectureUnitEntryFile,
  defaultProject
} from '../src/internal.js';
import type { Rule, RuleContext } from '../src/rule.js';

const ctx: RuleContext = { heads: [], project: defaultProject, config: defineConfig() };

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
  };
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
  };
}

function ruleThatFindsOne(id: string): Rule {
  return {
    id,
    title: id,
    category: 'architecture',
    severity: 'info',
    scope: 'component',
    rationale: '',
    async check() {
      return [
        {
          id,
          category: 'architecture',
          severity: 'info',
          message: 'x',
          detection: { presence: 'none', value: 'absent' }
        }
      ];
    }
  };
}

/** `sync` throws before ever returning a promise; the default (async) rejects the promise `check` returns. */
function ruleThatThrows(id: string, message: string, mode: 'sync' | 'async' = 'async'): Rule {
  return {
    id,
    title: id,
    category: 'architecture',
    severity: 'info',
    scope: 'component',
    rationale: '',
    check:
      mode === 'sync'
        ? () => {
            throw new Error(message);
          }
        : async () => {
            throw new Error(message);
          }
  };
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

describe('runRules — a throwing rule is isolated', () => {
  it('does not throw itself, and leaves the healthy rules’ results intact', async () => {
    const { results, failedRules } = await runRules(
      [ruleThatFindsOne('a/before'), ruleThatThrows('a/boom', 'kaboom'), ruleThatFindsOne('a/after')],
      ctx
    );
    expect(results.map((r) => r.id)).toEqual(['a/before', 'a/after']);
    expect(failedRules).toEqual([{ id: 'a/boom', message: 'kaboom' }]);
  });

  it('reports the failed rule’s id and message in failedRules', async () => {
    const { failedRules } = await runRules([ruleThatThrows('a/boom', 'kaboom')], ctx);
    expect(failedRules).toEqual([{ id: 'a/boom', message: 'kaboom' }]);
  });

  it('keeps a healthy rule’s examined counts when a sibling throws', async () => {
    const { examined, failedRules } = await runRules(
      [ruleThatCounts('a/fine', { g: 1 }), ruleThatThrows('a/boom', 'kaboom')],
      ctx
    );
    expect(examined).toEqual({ 'a/fine': { g: 1 } });
    expect(failedRules.map((f) => f.id)).toEqual(['a/boom']);
  });

  it('isolates a rule that throws synchronously, not just one that rejects its promise', async () => {
    const { results, failedRules } = await runRules([ruleThatThrows('a/sync-boom', 'sync kaboom', 'sync')], ctx);
    expect(results).toEqual([]);
    expect(failedRules).toEqual([{ id: 'a/sync-boom', message: 'sync kaboom' }]);
  });

  it('isolates a rule that rejects its promise (the default async throw)', async () => {
    const { failedRules } = await runRules([ruleThatThrows('a/async-boom', 'async kaboom', 'async')], ctx);
    expect(failedRules).toEqual([{ id: 'a/async-boom', message: 'async kaboom' }]);
  });

  it('gives failedRules an empty array when nothing failed', async () => {
    const { failedRules } = await runRules([ruleThatDoesNot('a/fine')], ctx);
    expect(failedRules).toEqual([]);
  });
});
