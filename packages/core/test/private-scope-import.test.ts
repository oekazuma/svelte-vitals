import { describe, it, expect } from 'vitest';
import { resolveRepoLocalPath, routeGlobToRegExp } from '../src/index.js';
import { architecturePrivateScopeImport, applyOverrides } from '../src/index.js';
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
  it('treats SvelteKit bracket and paren segments as literal', () => {
    expect(routeGlobToRegExp('src/routes/**/components').test('src/routes/[id=integer]/components')).toBe(true);
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

  it('passes an import of a parts/ unit from inside the owning unit', async () => {
    const c = comp({ file: 'src/lib/Card/Card.svelte', importSpans: [{ source: './parts/Badge.svelte', line: 2 }] });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
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
      file: 'src/routes/search/hallList/+page.svelte',
      importSpans: [{ source: './components/Search/Search.svelte', line: 4 }]
    });
    const outside = comp({
      file: 'src/routes/other/+page.svelte',
      importSpans: [{ source: '../search/hallList/components/Search/Search.svelte', line: 4 }]
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
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      imports: ['../Card/parts/Badge.svelte'],
      importSpans: undefined as unknown as ComponentFacts['importSpans']
    });
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
