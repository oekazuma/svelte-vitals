import { describe, it, expect } from 'vitest';
import { architectureDocLinkTarget } from '../src/rules/architecture/doc-link-target.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/types.js';

const ROOT = 'https://x.test/c/pkg/ui/';
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const passes = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'own');

const comp = (links: ComponentFacts['commentLinks']): ComponentFacts =>
  ({ file: 'src/lib/A/A.svelte', commentLinks: links, suppressions: [] }) as unknown as ComponentFacts;

const ctx = (links: ComponentFacts['commentLinks'], sourceFiles: string[], roots: string[]): RuleContext =>
  ({
    heads: [],
    project: defaultProject,
    components: [comp(links)],
    sourceFiles,
    config: defineConfig(
      roots.length ? { rules: { 'architecture/doc-link-target': { options: { urlRoots: roots } } } } : {}
    )
  }) as RuleContext;

describe('architecture/doc-link-target', () => {
  it('reports a declared-prefix link whose target does not exist', async () => {
    const rs = await architectureDocLinkTarget.check(
      ctx([{ url: `${ROOT}src/lib/Gone`, line: 4 }], ['src/lib/A/A.svelte'], [ROOT])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.line).toBe(4);
    expect(fails(rs)[0]!.route).toBe('src/lib/A/A.svelte');
  });

  it('emits nothing when no urlRoots is declared', async () => {
    // The L3 guarantee: inert until the project declares its own prefix.
    expect(await architectureDocLinkTarget.check(ctx([{ url: `${ROOT}src/lib/Gone`, line: 4 }], [], []))).toEqual([]);
  });

  it('is silent when the target is a directory, which is how every measured reference resolves', async () => {
    // `sourceFiles` lists files only, so a directory exists iff some entry sits under it.
    const rs = await architectureDocLinkTarget.check(
      ctx([{ url: `${ROOT}src/lib/Card`, line: 1 }], ['src/lib/Card/Card.svelte'], [ROOT])
    );
    expect(fails(rs)).toEqual([]);
    expect(passes(rs)).toHaveLength(1);
  });

  it('is silent when the target is a file', async () => {
    const rs = await architectureDocLinkTarget.check(
      ctx([{ url: `${ROOT}src/lib/Card/Card.svelte`, line: 1 }], ['src/lib/Card/Card.svelte'], [ROOT])
    );
    expect(fails(rs)).toEqual([]);
  });

  it('ignores a URL under no declared prefix', async () => {
    // An external host, a slug with no slash, and a URL with no path — all measured, none may report.
    const rs = await architectureDocLinkTarget.check(
      ctx(
        [
          { url: 'https://other.test/a/b', line: 1 },
          { url: 'guide', line: 2 },
          { url: 'https://x.test', line: 3 }
        ],
        ['src/lib/A/A.svelte'],
        [ROOT]
      )
    );
    expect(rs).toEqual([]);
  });

  it('takes the longest matching prefix, whatever order they are declared in', async () => {
    // Under first-match-wins the short root strips less, leaving `pkg/ui/src/lib/Card` — which is not a
    // project-relative path, so a real reference would be reported as broken.
    const short = 'https://x.test/c/';
    const files = ['src/lib/Card/Card.svelte'];
    const link = [{ url: `${ROOT}src/lib/Card`, line: 1 }];
    for (const roots of [
      [short, ROOT],
      [ROOT, short]
    ]) {
      expect(fails(await architectureDocLinkTarget.check(ctx(link, files, roots))), roots.join()).toEqual([]);
    }
  });

  it('resolves the same reference under a second declared root', async () => {
    const staging = 'https://staging.test/c/pkg/ui/';
    const rs = await architectureDocLinkTarget.check(
      ctx([{ url: `${staging}src/lib/Gone`, line: 1 }], ['src/lib/Card/Card.svelte'], [ROOT, staging])
    );
    expect(fails(rs)).toHaveLength(1);
  });

  it('emits nothing for a component whose comments hold no declared-prefix link', async () => {
    expect(await architectureDocLinkTarget.check(ctx([], ['src/lib/A/A.svelte'], [ROOT]))).toEqual([]);
  });

  it('emits nothing when no file inventory was collected', async () => {
    // `sourceFiles` is optional and absent in rendered (plugin) mode. Without the guard every reference
    // would look broken there, because an empty inventory contains no target.
    const bare = {
      heads: [],
      project: defaultProject,
      components: [comp([{ url: `${ROOT}src/lib/Card`, line: 1 }])],
      config: defineConfig({ rules: { 'architecture/doc-link-target': { options: { urlRoots: [ROOT] } } } })
    } as RuleContext;
    expect(await architectureDocLinkTarget.check(bare)).toEqual([]);
  });
});
