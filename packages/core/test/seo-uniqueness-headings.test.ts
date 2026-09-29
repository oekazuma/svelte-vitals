import { describe, it, expect } from 'vitest';
import { seoDuplicateTitle, seoDuplicateDescription, seoHeadingLevelSkip } from '../src/internal.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { HeadingInfo, ResolvedHeadings } from '../src/headings.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { project: defaultProject, config };
const fails = <R extends { detection: { presence: string; value: string } }>(rs: R[]) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

const titleHead = (route: string, text?: string): ResolvedHead => ({
  route,
  source: 'rendered',
  file: route,
  // A static tag always carries captured text; omitting text models a dynamic title.
  tags: [
    {
      kind: 'title',
      presence: 'own',
      value: text !== undefined ? 'static' : 'dynamic',
      ...(text !== undefined ? { text } : {})
    } as HeadTag
  ]
});
const descHead = (route: string, text?: string): ResolvedHead => ({
  route,
  source: 'rendered',
  file: route,
  tags: [
    {
      kind: 'meta',
      name: 'description',
      presence: 'own',
      value: text !== undefined ? 'static' : 'dynamic',
      ...(text !== undefined ? { text } : {})
    } as HeadTag
  ]
});
const ctx = (heads: ResolvedHead[]): RuleContext => ({ heads, ...base });

describe('seo/duplicate-title duplicate title', () => {
  it('flags two routes sharing a title', async () => {
    const rs = await seoDuplicateTitle.check(ctx([titleHead('/a', 'Same Title'), titleHead('/b', 'Same Title')]));
    expect(fails(rs)).toHaveLength(2);
  });
  it('passes unique titles', async () => {
    const rs = await seoDuplicateTitle.check(ctx([titleHead('/a', 'Title A'), titleHead('/b', 'Title B')]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(2);
  });
  it('ignores routes with a dynamic/absent title (no captured text)', async () => {
    const rs = await seoDuplicateTitle.check(ctx([titleHead('/a', 'Only One'), titleHead('/b', undefined)]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // only /a is evaluated
  });
  it('treats whitespace-only differences as duplicates', async () => {
    const rs = await seoDuplicateTitle.check(ctx([titleHead('/a', 'A  B'), titleHead('/b', ' A B ')]));
    expect(fails(rs)).toHaveLength(2);
  });
});

describe('seo/duplicate-description duplicate description', () => {
  it('flags two routes sharing a description', async () => {
    const rs = await seoDuplicateDescription.check(ctx([descHead('/a', 'Same desc'), descHead('/b', 'Same desc')]));
    expect(fails(rs)).toHaveLength(2);
  });
  it('passes unique descriptions', async () => {
    const rs = await seoDuplicateDescription.check(ctx([descHead('/a', 'Desc A'), descHead('/b', 'Desc B')]));
    expect(fails(rs)).toHaveLength(0);
  });
});

const headings = (levels: number[]): ResolvedHeadings => ({
  route: '/a',
  headings: levels.map((level) => ({ level, line: 0, file: 'x' }))
});
const headingsCtx = (h: ResolvedHeadings[]): RuleContext => ({ heads: [], headings: h, ...base });

describe('seo/heading-level-skip heading order', () => {
  it('passes a well-ordered outline', async () => {
    const rs = await seoHeadingLevelSkip.check(headingsCtx([headings([1, 2, 3, 2])]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
    // ResolvedHeadings has no route-level file (unlike ResolvedHead) — the first heading's
    // file stands in as the route's attributed file (design
    // 2026-08-08-pass-result-location-design.md).
    expect(rs[0]!.location).toBe('x');
  });
  it('flags a skipped level (h2 to h4)', async () => {
    const rs = await seoHeadingLevelSkip.check(headingsCtx([headings([1, 2, 4])]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('h2');
    expect(rs[0]!.message).toContain('h4');
  });
  it('emits nothing for a route with no headings', async () => {
    expect(await seoHeadingLevelSkip.check(headingsCtx([headings([])]))).toHaveLength(0);
  });
  it('walks each arm of an exclusive block on its own', async () => {
    const at = (level: number, branch?: number, file = 'x') => ({
      level,
      line: level,
      file,
      ...(branch !== undefined ? { path: [{ group: 0, branch }] } : {})
    });
    const route = (hs: ReturnType<typeof at>[]): ResolvedHeadings => ({ route: '/a', headings: hs });
    // {#if}<h1>{:else}<h3>{/if}: the <h3> is never preceded by the <h1>.
    expect(fails(await seoHeadingLevelSkip.check(headingsCtx([route([at(1, 0), at(3, 1)])])))).toHaveLength(0);
    // <h1>{#if}<h2>{:else}<h4>{/if}: the else arm still skips from the <h1>.
    const rs = await seoHeadingLevelSkip.check(headingsCtx([route([at(1), at(2, 0), at(4, 1)])]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('<h1> to <h4>');
    // Separate blocks both render, in whichever file they sit.
    const other = { ...at(3, 1), path: [{ group: 1, branch: 1 }] };
    expect(fails(await seoHeadingLevelSkip.check(headingsCtx([route([at(1, 0, 'l'), other])])))).toHaveLength(1);
    // Route-wide groups: a layout's {@render children()} arm excludes its error arm from the page's outline.
    expect(fails(await seoHeadingLevelSkip.check(headingsCtx([route([at(1, 1, 'l'), at(3, 0, 'p')])])))).toHaveLength(
      0
    );
  });
  it('ignores a component heading with no document-order position', async () => {
    // Chain outline h1->h2->h3 is well-ordered; a componentHeadings h6 would create
    // a skip (h3 -> h6) if it were appended to the walk, but it must not be.
    const withComponent: ResolvedHeadings = {
      ...headings([1, 2, 3]),
      componentHeadings: [{ level: 6, line: 0, file: 'child.svelte' }]
    };
    const rs = await seoHeadingLevelSkip.check(headingsCtx([withComponent]));
    expect(fails(rs)).toHaveLength(0);
  });
  it('places component headings in document order among the route file headings', async () => {
    const at = (level: number, order: number[], file = 'page.svelte'): HeadingInfo => ({ level, line: 0, file, order });
    const route = (component: HeadingInfo): ResolvedHeadings => ({
      route: '/r',
      headings: [at(1, [10]), at(3, [50])],
      componentHeadings: [component]
    });
    // A component's <h2> between the page's <h1> and <h3> closes the gap; after the <h3> it does not.
    expect(fails(await seoHeadingLevelSkip.check(headingsCtx([route(at(2, [20, 5], 'Card.svelte'))])))).toHaveLength(0);
    const late = fails(await seoHeadingLevelSkip.check(headingsCtx([route(at(2, [60, 5], 'Card.svelte'))])));
    expect(late.map((r) => r.message)).toEqual(['Heading level skipped (<h1> to <h3>)']);
    // A component heading is never the one reported: its skip is the component's, not the route outline's.
    const skipping = fails(
      await seoHeadingLevelSkip.check(
        headingsCtx([
          { route: '/r', headings: [at(1, [10]), at(2, [50])], componentHeadings: [at(4, [60, 5], 'Card.svelte')] }
        ])
      )
    );
    expect(skipping).toEqual([]);
    // One in an arm of its own (a closed dialog) closes no gap; one in the flagged heading's arm does.
    const dialog = (path: HeadingInfo['path'], pagePath?: HeadingInfo['path']) =>
      seoHeadingLevelSkip.check(
        headingsCtx([
          {
            route: '/r',
            headings: [at(1, [10]), { ...at(3, [50]), ...(pagePath ? { path: pagePath } : {}) }],
            componentHeadings: [{ ...at(2, [20, 5], 'Dialog.svelte'), path }]
          }
        ])
      );
    expect(fails(await dialog([{ group: 0, branch: 0 }])).map((r) => r.message)).toEqual([
      'Heading level skipped (<h1> to <h3>)'
    ]);
    expect(fails(await dialog([{ group: 0, branch: 0 }], [{ group: 0, branch: 0 }]))).toEqual([]);
    // An arm marked `always` (every arm has a heading, or the use decides it) closes the gap too.
    expect(fails(await dialog([{ group: 0, branch: 0, always: true }]))).toEqual([]);
  });
});
