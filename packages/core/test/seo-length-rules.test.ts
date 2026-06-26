import { describe, it, expect } from 'vitest';
import { seo022TitleLength, seo023DescriptionLength } from '../src/index.js';
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
const fails = (rs: Awaited<ReturnType<typeof seo022TitleLength.check>>) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

const title = (text?: string) => headWith({ kind: 'title', ...(text !== undefined ? { text } : {}) });
const desc = (text?: string) =>
  headWith({ kind: 'meta', name: 'description', ...(text !== undefined ? { text } : {}) });

describe('SEO022 title length', () => {
  it('flags a too-short title', async () => {
    expect(fails(await seo022TitleLength.check(ctx(title('Home'))))).toHaveLength(1);
  });
  it('flags a too-long title', async () => {
    expect(fails(await seo022TitleLength.check(ctx(title('x'.repeat(61)))))).toHaveLength(1);
  });
  it('passes an in-range title', async () => {
    const rs = await seo022TitleLength.check(ctx(title('A perfectly reasonable page title here')));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a dynamic/absent title', async () => {
    expect(await seo022TitleLength.check(ctx(title(undefined)))).toHaveLength(0);
    // A dynamic title carries no captured text → length is unknowable, emit nothing.
    expect(await seo022TitleLength.check(ctx(headWith({ kind: 'title' }, 'dynamic')))).toHaveLength(0);
  });
});

describe('SEO023 description length', () => {
  it('flags a too-short description', async () => {
    expect(fails(await seo023DescriptionLength.check(ctx(desc('Too short.'))))).toHaveLength(1);
  });
  it('flags a too-long description', async () => {
    expect(fails(await seo023DescriptionLength.check(ctx(desc('x'.repeat(161)))))).toHaveLength(1);
  });
  it('passes an in-range description', async () => {
    const rs = await seo023DescriptionLength.check(ctx(desc('x'.repeat(100))));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a dynamic/absent description', async () => {
    expect(await seo023DescriptionLength.check(ctx(desc(undefined)))).toHaveLength(0);
    // A dynamic description carries no captured text → length is unknowable, emit nothing.
    expect(
      await seo023DescriptionLength.check(ctx(headWith({ kind: 'meta', name: 'description' }, 'dynamic')))
    ).toHaveLength(0);
  });
});
