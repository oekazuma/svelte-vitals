import { describe, it, expect } from 'vitest';
import { seoTitleLength, seoDescriptionLength } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { RuleContext } from '../src/rule.js';

const headWith = (tag: Partial<HeadTag> & Pick<HeadTag, 'kind'>, value: HeadTag['value'] = 'static'): ResolvedHead => ({
  route: '/x',
  source: 'rendered',
  file: 'x',
  tags: [{ presence: 'own', value, ...tag } as HeadTag]
});
const ctx = (head: ResolvedHead): RuleContext => ({ heads: [head], project: defaultProject, config: defineConfig({}) });
const fails = (rs: Awaited<ReturnType<typeof seoTitleLength.check>>) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

const title = (text?: string) => headWith({ kind: 'title', ...(text !== undefined ? { text } : {}) });
const desc = (text?: string) =>
  headWith({ kind: 'meta', name: 'description', ...(text !== undefined ? { text } : {}) });

describe('seo/title-length title length', () => {
  it('flags a too-short title', async () => {
    expect(fails(await seoTitleLength.check(ctx(title('Home'))))).toHaveLength(1);
  });
  it('flags a too-long title', async () => {
    expect(fails(await seoTitleLength.check(ctx(title('x'.repeat(61)))))).toHaveLength(1);
  });
  it('passes an in-range title', async () => {
    const rs = await seoTitleLength.check(ctx(title('A perfectly reasonable page title here')));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a dynamic/absent title', async () => {
    expect(await seoTitleLength.check(ctx(title(undefined)))).toHaveLength(0);
    // A dynamic title carries no captured text → length is unknowable, emit nothing.
    expect(await seoTitleLength.check(ctx(headWith({ kind: 'title' }, 'dynamic')))).toHaveLength(0);
  });
});

describe('seo/description-length description length', () => {
  it('flags a too-short description', async () => {
    expect(fails(await seoDescriptionLength.check(ctx(desc('Too short.'))))).toHaveLength(1);
  });
  it('flags a too-long description', async () => {
    expect(fails(await seoDescriptionLength.check(ctx(desc('x'.repeat(161)))))).toHaveLength(1);
  });
  it('passes an in-range description', async () => {
    const rs = await seoDescriptionLength.check(ctx(desc('x'.repeat(100))));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a dynamic/absent description', async () => {
    expect(await seoDescriptionLength.check(ctx(desc(undefined)))).toHaveLength(0);
    // A dynamic description carries no captured text → length is unknowable, emit nothing.
    expect(
      await seoDescriptionLength.check(ctx(headWith({ kind: 'meta', name: 'description' }, 'dynamic')))
    ).toHaveLength(0);
  });
});
