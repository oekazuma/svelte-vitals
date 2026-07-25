import { describe, it, expect } from 'vitest';
import { correctnessBasePathNavigation } from '../src/rules/correctness/base-path-navigation.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { emptyKitModuleFacts } from '../src/kit-module-collect.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { BasePathLinkFact, ComponentFacts } from '../src/component.js';
import type { KitModuleFacts } from '../src/kit-module.js';
import type { Project } from '../src/types.js';

const config = defineConfig({});
const withBase: Project = { ...defaultProject, kitPathsBase: { value: '/docs', file: 'svelte.config.js' } };

function ctx(project: Project, components: ComponentFacts[] = [], kitModules: KitModuleFacts[] = []): RuleContext {
  return { heads: [], project, config, components, kitModules } as RuleContext;
}

const comp = (file: string, basePathLinks: BasePathLinkFact[]): ComponentFacts => ({
  ...emptyComponentFacts(file),
  basePathLinks
});

const kit = (file: string, basePathLinks: BasePathLinkFact[]): KitModuleFacts => ({
  ...emptyKitModuleFacts(file, 'server'),
  basePathLinks
});

describe('correctness/base-path-navigation', () => {
  it('emits nothing when the project has no base path, even with facts present', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(defaultProject, [comp('src/routes/+page.svelte', [{ kind: 'href', path: '/about', line: 3 }])])
    );
    expect(results).toEqual([]);
  });

  it('flags an href with the href-specific message at warning severity', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(withBase, [comp('src/routes/+page.svelte', [{ kind: 'href', path: '/about', line: 3 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/routes/+page.svelte');
    expect(penalized[0]!.line).toBe(3);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toBe(
      `<a href="/about"> is root-relative — under this project's kit.paths.base it points at the domain root, outside the app, and 404s in production. Use resolve('/about') from '$app/paths'.`
    );
    expect(penalized[0]!.fix?.description).toContain('$app/paths');
  });

  it('flags goto with the goto-specific message', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(withBase, [comp('src/lib/Nav.svelte', [{ kind: 'goto', path: '/dashboard', line: 7 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.message).toBe(
      `goto('/dashboard') is root-relative — it navigates outside this project's kit.paths.base and 404s in production. Use goto(resolve('/dashboard')) with resolve from '$app/paths'.`
    );
  });

  it('flags redirect on the Kit-module channel', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(withBase, [], [kit('src/routes/+page.server.ts', [{ kind: 'redirect', path: '/login', line: 4 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/routes/+page.server.ts');
    expect(penalized[0]!.message).toBe(
      `redirect(…, '/login') is root-relative — the Location header points outside this project's kit.paths.base and 404s in production. Use resolve('/login') from '$app/paths'.`
    );
  });

  it('fires on a dynamic base (fact present, value unknown)', async () => {
    const dynamic: Project = { ...defaultProject, kitPathsBase: { file: 'svelte.config.js' } };
    const results = await correctnessBasePathNavigation.check(
      ctx(dynamic, [comp('src/routes/+page.svelte', [{ kind: 'href', path: '/about', line: 1 }])])
    );
    expect(results.filter((r) => r.detection.presence === 'none')).toHaveLength(1);
  });

  it('reports both channels in one run', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(
        withBase,
        [comp('src/routes/+page.svelte', [{ kind: 'href', path: '/a', line: 1 }])],
        [kit('src/routes/+page.server.ts', [{ kind: 'redirect', path: '/b', line: 2 }])]
      )
    );
    expect(results.filter((r) => r.detection.presence === 'none')).toHaveLength(2);
  });

  it('passes with a PASS result when every finding is suppressed', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(withBase, [
        {
          ...comp('src/routes/+page.svelte', [{ kind: 'href', path: '/about', line: 3 }]),
          suppressions: [{ line: 3, ruleIds: ['correctness/base-path-navigation'] }]
        }
      ])
    );
    expect(results.filter((r) => r.detection.presence === 'own')).toHaveLength(1);
    expect(results.filter((r) => r.detection.presence === 'none')).toHaveLength(0);
  });

  it('emits nothing for files with no links', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(withBase, [comp('src/routes/+page.svelte', [])], [kit('src/routes/+page.server.ts', [])])
    );
    expect(results).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/base-path-navigation')).toBe(true);
    expect(explainRule('correctness/base-path-navigation')?.severity).toBe('warning');
  });
});
