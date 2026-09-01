import { describe, it, expect } from 'vitest';
import { resolveRepoLocalPath } from '../src/kit-module-parse.js';
import { routeGlobToRegExp } from '../src/config-apply.js';
import { architecturePrivateScopeImport } from '../src/internal.js';
import { applyOverrides } from '../src/config-apply.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

describe('resolveRepoLocalPath (exported for private-scope-import)', () => {
  it('maps $lib/ to src/lib/', () => {
    expect(resolveRepoLocalPath('$lib/Button.svelte', 'src/routes/+page.svelte')).toBe('src/lib/Button.svelte');
  });
  it('resolves a relative specifier against the importer directory', () => {
    expect(resolveRepoLocalPath('./parts/Badge.svelte', 'src/lib/Card/Card.svelte')).toBe(
      'src/lib/Card/parts/Badge.svelte'
    );
  });
  it('returns undefined for a bare package and for an unknown alias', () => {
    expect(resolveRepoLocalPath('lodash', 'src/lib/C.svelte')).toBeUndefined();
    expect(resolveRepoLocalPath('$app/state', 'src/lib/C.svelte')).toBeUndefined();
    expect(resolveRepoLocalPath('$myalias/lib/x', 'src/lib/C.svelte')).toBeUndefined();
  });
  it('returns undefined when .. escapes the repo root', () => {
    expect(resolveRepoLocalPath('../../../../x', 'src/lib/C.svelte')).toBeUndefined();
  });
});

describe('routeGlobToRegExp (exported for private-scope-import)', () => {
  it('matches ** across segments but not zero segments in a middle position', () => {
    const re = routeGlobToRegExp('src/routes/**/components');
    expect(re.test('src/routes/a/components')).toBe(true);
    expect(re.test('src/routes/a/b/components')).toBe(true);
    expect(re.test('src/routes/components')).toBe(false);
  });
  it('treats SvelteKit bracket segments in the PATTERN as literal, not a character class', () => {
    // The brackets sit in the pattern here (not just the subject), so this is false if the
    // escaping pass is removed: an unescaped `[id]` compiles to a one-character class
    // matching 'i' or 'd', which does not match the four-character literal string '[id]'.
    expect(routeGlobToRegExp('src/routes/[id]/parts').test('src/routes/[id]/parts')).toBe(true);
  });
});

const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

const comp = (over: Partial<ComponentFacts>): ComponentFacts => ({
  file: 'src/lib/C.svelte',
  eachBlocks: [],
  effects: [],
  htmlTags: [],
  javascriptUrls: [],
  loc: 10,
  propCount: 0,
  imports: [],
  importSpans: [],
  namespaceImports: [],
  constableStates: [],
  mutatedProps: [],
  stalePropDerivations: [],
  rawableStates: [],
  nonreactiveBuiltinStates: [],
  checkableBindValues: [],
  basePathLinks: [],
  orphanEffects: [],
  orphanLifecycleCalls: [],
  browserGlobalRefs: [],
  moduleStateDecls: [],
  suppressions: [],
  commentLinks: [],
  ...over
});

/** Context with `scopes` declared globally. */
const scoped = (components: ComponentFacts[], scopes: string[]): RuleContext => ({
  components,
  heads: [],
  project: defaultProject,
  config: defineConfig({ rules: { 'architecture/private-scope-import': { options: { scopes } } } })
});

const SCOPES = ['**/parts', 'src/routes/**/components'];

describe('architecture/private-scope-import', () => {
  it('emits nothing when scopes is not declared', async () => {
    const c = comp({
      file: 'src/routes/other/+page.svelte',
      importSpans: [{ source: '../../lib/Card/parts/Badge.svelte', line: 3 }]
    });
    const ctx: RuleContext = { components: [c], heads: [], project: defaultProject, config: defineConfig({}) };
    expect(await architecturePrivateScopeImport.check(ctx)).toEqual([]);
  });

  it('flags an import of a parts/ unit from outside the owning unit', async () => {
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      importSpans: [{ source: '../Card/parts/Badge.svelte', line: 7 }]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.id).toBe('architecture/private-scope-import');
    expect(rs[0]!.category).toBe('architecture');
    expect(rs[0]!.severity).toBe('info');
    expect(rs[0]!.location).toBe('src/lib/Other/Other.svelte');
    expect(rs[0]!.line).toBe(7);
    expect(rs[0]!.message).toContain('src/lib/Card/parts/Badge.svelte');
    expect(rs[0]!.message).toContain('src/lib/Card');
    expect(rs[0]!.fix?.description.length).toBeGreaterThan(0);
    expect(rs[0]!.fix?.snippet).toBeUndefined();
  });

  // Deliberately the opposite of performance/heavy-import, which skips a type-only import
  // because its claim is bundle weight. This rule's claim is coupling, and importing only a
  // type couples just as tightly — rename or delete the unit and the importer still breaks.
  // Pinned so the two rules cannot be "made consistent" without this failing.
  it('flags a type-only import of a private unit, unlike the bundle-weight rules', async () => {
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      importSpans: [{ source: '../Card/parts/Badge.svelte', line: 7, type: true }]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.line).toBe(7);
  });

  it('passes an import of a parts/ unit from inside the owning unit', async () => {
    const c = comp({ file: 'src/lib/Card/Card.svelte', importSpans: [{ source: './parts/Badge.svelte', line: 2 }] });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
    // Pinned wording: a PASS must read as a pass, not echo the violation message.
    expect(rs[0]!.message).toBe('No private-scope imports');
    // Same location the penalized branch uses (design 2026-08-08-pass-result-location-design.md;
    // this rule's inline PASS literal was missed by the design spike's grep, added afterward).
    expect(rs[0]!.location).toBe('src/lib/Card/Card.svelte');
  });

  it('passes a sibling import within the same parts/ directory', async () => {
    const c = comp({
      file: 'src/lib/Card/parts/Badge/Badge.svelte',
      importSpans: [{ source: '../Label/Label.svelte', line: 2 }]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });

  it('scopes a route components/ directory to that route subtree', async () => {
    const inside = comp({
      file: 'src/routes/search/itemList/+page.svelte',
      importSpans: [{ source: './components/Search/Search.svelte', line: 4 }]
    });
    const outside = comp({
      file: 'src/routes/other/+page.svelte',
      importSpans: [{ source: '../search/itemList/components/Search/Search.svelte', line: 4 }]
    });
    expect(fails(await architecturePrivateScopeImport.check(scoped([inside], SCOPES)))).toHaveLength(0);
    expect(fails(await architecturePrivateScopeImport.check(scoped([outside], SCOPES)))).toHaveLength(1);
  });

  it('leaves src/lib/components unconstrained', async () => {
    const c = comp({
      file: 'src/routes/+page.svelte',
      importSpans: [{ source: '$lib/components/Button/Button.svelte', line: 1 }]
    });
    expect(await architecturePrivateScopeImport.check(scoped([c], SCOPES))).toEqual([]);
  });

  it('takes the deepest marker when scopes nest', async () => {
    // Boundary is src/lib/A/parts/B, so an importer in src/lib/A is outside it.
    const c = comp({
      file: 'src/lib/A/A.svelte',
      importSpans: [{ source: './parts/B/parts/C/C.svelte', line: 5 }]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('src/lib/A/parts/B');
  });

  it('reports one finding per violating import', async () => {
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      importSpans: [
        { source: '../Card/parts/Badge.svelte', line: 3 },
        { source: '../Card/parts/Label.svelte', line: 4 }
      ]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(2);
    expect(fails(rs).map((r) => r.line)).toEqual([3, 4]);
  });

  it('stays silent on specifiers it cannot resolve', async () => {
    const c = comp({
      file: 'src/routes/+page.svelte',
      importSpans: [
        { source: 'lodash', line: 1 },
        { source: '$app/state', line: 2 },
        { source: '$myalias/lib/Card/parts/Badge.svelte', line: 3 },
        { source: '../../../../elsewhere/parts/X.svelte', line: 4 }
      ]
    });
    expect(await architecturePrivateScopeImport.check(scoped([c], SCOPES))).toEqual([]);
  });

  it('falls back to line 0 when importSpans is absent', async () => {
    // Facts from before importSpans existed carry no such field; strip it to reach the fallback.
    const { importSpans: _absent, ...older } = comp({
      file: 'src/lib/Other/Other.svelte',
      imports: ['../Card/parts/Badge.svelte']
    });
    const c = older as ComponentFacts;
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.line).toBeUndefined();
  });

  it('emits nothing when ctx.components is unset', async () => {
    const ctx: RuleContext = {
      heads: [],
      project: defaultProject,
      config: defineConfig({ rules: { 'architecture/private-scope-import': { options: { scopes: SCOPES } } } })
    };
    expect(await architecturePrivateScopeImport.check(ctx)).toEqual([]);
  });

  it('treats a top-level marker as repo-root scoped, so nothing is outside it', async () => {
    // A marker at a top-level segment leaves the boundary empty — the repo root — and
    // every importer is inside it. The rule still recognises the import as scoped, so it
    // seeds a pass rather than emitting nothing.
    const c = comp({ file: 'src/lib/C.svelte', importSpans: [{ source: '../../parts/X.svelte', line: 1 }] });
    const rs = await architecturePrivateScopeImport.check(scoped([c], ['parts']));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });

  it('flags a type-only import the same as a value import (the coupling survives even though the import is erased at build)', async () => {
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      importSpans: [{ source: '../Card/parts/types.js', line: 3 }]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('src/lib/Card/parts/types.js');
  });

  describe('inline suppression', () => {
    it('suppresses a violation whose directive sits on the import line, so the file passes', async () => {
      const c = comp({
        file: 'src/lib/Other/Other.svelte',
        importSpans: [{ source: '../Card/parts/Badge.svelte', line: 7 }],
        suppressions: [{ line: 7, ruleIds: ['architecture/private-scope-import'] }]
      });
      const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
      expect(fails(rs)).toHaveLength(0);
      expect(rs).toHaveLength(1);
      expect(rs[0]!.message).toBe('No private-scope imports');
    });

    it('does not suppress when the directive is on an unrelated line', async () => {
      const c = comp({
        file: 'src/lib/Other/Other.svelte',
        importSpans: [{ source: '../Card/parts/Badge.svelte', line: 7 }],
        suppressions: [{ line: 12, ruleIds: ['architecture/private-scope-import'] }]
      });
      const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
      expect(fails(rs)).toHaveLength(1);
      expect(rs[0]!.line).toBe(7);
    });
  });

  describe('a trailing /** on a scopes glob', () => {
    // '**/parts/**' is how a glob would be written elsewhere in this project's own
    // config, but a trailing '/**' compiles to '(/.*)?' — it also matches the
    // marker's own subdirectories, which used to make the deepest-match rule pick a
    // descendant of the marker as the boundary instead of the marker itself: a false
    // positive against the OWNER. Confirmed repro (design review): with
    // scopes: ['**/parts/**'], src/lib/Card/Card.svelte importing
    // ./parts/Badge/Badge.svelte was penalized as private to src/lib/Card/parts.
    // '**/parts/**' must normalise to behave exactly like '**/parts'.
    const TRAILING = ['**/parts/**'];
    const BARE = ['**/parts'];

    it('does not flag the owner importing its own nested parts/ unit', async () => {
      const c = comp({
        file: 'src/lib/Card/Card.svelte',
        importSpans: [{ source: './parts/Badge/Badge.svelte', line: 2 }]
      });
      const trailing = await architecturePrivateScopeImport.check(scoped([c], TRAILING));
      const bare = await architecturePrivateScopeImport.check(scoped([c], BARE));
      expect(fails(trailing)).toHaveLength(0);
      expect(trailing).toEqual(bare);
    });

    it('still flags an import of the parts/ unit from outside its owner', async () => {
      const c = comp({
        file: 'src/lib/Other/Other.svelte',
        importSpans: [{ source: '../Card/parts/Badge.svelte', line: 7 }]
      });
      const trailing = await architecturePrivateScopeImport.check(scoped([c], TRAILING));
      const bare = await architecturePrivateScopeImport.check(scoped([c], BARE));
      expect(fails(trailing)).toHaveLength(1);
      expect(trailing).toEqual(bare);
    });
  });
});

describe('architecture/private-scope-import per-path options', () => {
  it('applies scopes declared in a files:-scoped override, and its severity too', async () => {
    const cfg = {
      overrides: [
        {
          files: 'src/lib/**',
          rules: {
            'architecture/private-scope-import': {
              severity: 'warning' as const,
              options: { scopes: ['**/parts'] }
            }
          }
        }
      ]
    };
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      importSpans: [{ source: '../Card/parts/Badge.svelte', line: 3 }]
    });
    const ctx: RuleContext = {
      components: [c],
      heads: [],
      project: defaultProject,
      config: defineConfig(cfg)
    };
    const rs = await architecturePrivateScopeImport.check(ctx);
    // Options resolved during the run: the scope is only in effect because of the override.
    expect(fails(rs)).toHaveLength(1);
    // Severity resolved in the post-pass, matched by the same files glob on the same location.
    const applied = applyOverrides(rs, defineConfig(cfg));
    expect(applied.find((r) => r.detection.value === 'absent')?.severity).toBe('warning');
  });

  it('leaves a file outside the override untouched', async () => {
    const cfg = {
      overrides: [
        { files: 'src/lib/**', rules: { 'architecture/private-scope-import': { options: { scopes: ['**/parts'] } } } }
      ]
    };
    const c = comp({
      file: 'src/routes/+page.svelte',
      importSpans: [{ source: '../lib/Card/parts/Badge.svelte', line: 3 }]
    });
    const ctx: RuleContext = { components: [c], heads: [], project: defaultProject, config: defineConfig(cfg) };
    expect(await architecturePrivateScopeImport.check(ctx)).toEqual([]);
  });
});
