import { describe, it, expect } from 'vitest';
import { seoTitleLength, seoDescriptionLength, applyOverrides } from '../src/index.js';
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

describe('seo length rule options', () => {
  const cfgCtx = (head: ResolvedHead, cfg: Parameters<typeof defineConfig>[0]): RuleContext => ({
    heads: [head],
    project: defaultProject,
    config: defineConfig(cfg)
  });
  const opts = { rules: { 'seo/title-length': { options: { min: 10, max: 20 } } } };

  it('pins the built-in title bounds', async () => {
    expect(fails(await seoTitleLength.check(ctx(title('a'.repeat(29)))))).toHaveLength(1);
    expect(fails(await seoTitleLength.check(ctx(title('a'.repeat(30)))))).toHaveLength(0);
    expect(fails(await seoTitleLength.check(ctx(title('a'.repeat(60)))))).toHaveLength(0);
    expect(fails(await seoTitleLength.check(ctx(title('a'.repeat(61)))))).toHaveLength(1);
  });
  it('pins the built-in description bounds', async () => {
    expect(fails(await seoDescriptionLength.check(ctx(desc('a'.repeat(69)))))).toHaveLength(1);
    expect(fails(await seoDescriptionLength.check(ctx(desc('a'.repeat(70)))))).toHaveLength(0);
    expect(fails(await seoDescriptionLength.check(ctx(desc('a'.repeat(160)))))).toHaveLength(0);
    expect(fails(await seoDescriptionLength.check(ctx(desc('a'.repeat(161)))))).toHaveLength(1);
  });
  it('honours configured title bounds', async () => {
    expect(fails(await seoTitleLength.check(cfgCtx(title('a'.repeat(15)), opts)))).toHaveLength(0);
    expect(fails(await seoTitleLength.check(cfgCtx(title('a'.repeat(25)), opts)))).toHaveLength(1);
  });
  it('quotes the configured bounds in the message and recommendation', async () => {
    const rs = fails(await seoTitleLength.check(cfgCtx(title('a'.repeat(25)), opts)));
    expect(rs[0]!.message).toContain('10–20');
    expect(rs[0]!.recommendation).toContain('10–20');
  });
  it('honours a per-route bound', async () => {
    const scoped = { overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { min: 1, max: 5 } } } }] };
    expect(fails(await seoTitleLength.check(cfgCtx(title('a'.repeat(40)), scoped)))).toHaveLength(1);
    expect(fails(await seoTitleLength.check(cfgCtx(title('abc'), scoped)))).toHaveLength(0);
  });
  it('a files:-scoped override applies both its severity and its options (Finding 1 parity)', async () => {
    // headWith() gives the head file 'x' and no tag-level file, so tag.file ?? head.file === 'x'
    // — the same string the finding's `location` carries, and what a files: 'x' override targets.
    const cfg = {
      overrides: [
        { files: 'x', rules: { 'seo/title-length': { severity: 'warning' as const, options: { min: 5, max: 10 } } } }
      ]
    };
    const rs = await seoTitleLength.check(cfgCtx(title('a'.repeat(26)), cfg));
    const failing = fails(rs);
    expect(failing).toHaveLength(1);
    // Options resolved during the run: the configured 5–10 bounds, not the built-in 30–60.
    expect(failing[0]!.message).toContain('5–10');
    // Severity resolved in the post-pass, matched by the same `files` glob on the same location.
    const out = applyOverrides(rs, defineConfig(cfg));
    expect(out.find((r) => r.detection.value === 'absent')?.severity).toBe('warning');
  });

  it('a files:-scoped "off" override also removes a PASS seed its own options produced (Finding F, second review)', async () => {
    // headWith() gives the head file 'x' and no tag-level file, matching a files: 'x' override.
    const cfg = {
      overrides: [
        { files: 'x', rules: { 'seo/title-length': { severity: 'off' as const, options: { min: 1, max: 100 } } } }
      ]
    };
    // 80 chars fails the built-in 30-60 bounds, but passes the override's widened 1-100 bounds.
    const rs = await seoTitleLength.check(cfgCtx(title('a'.repeat(80)), cfg));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
    // The passing seed must carry a `location` so the same `files: 'x'` override that
    // supplied its options can also match it in the post-pass and remove it via 'off'.
    const out = applyOverrides(rs, defineConfig(cfg));
    expect(out).toHaveLength(0);
  });
});
