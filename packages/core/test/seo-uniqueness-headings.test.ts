import { describe, it, expect } from 'vitest';
import { seoDuplicateTitle, seoDuplicateDescription, seoHeadingLevelSkip } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { ResolvedHeadings } from '../src/headings.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { project: defaultProject, config };
const fails = (rs: { detection: { presence: string; value: string } }[]) =>
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
});
