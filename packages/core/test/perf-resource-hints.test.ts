import { describe, it, expect } from 'vitest';
import { perf003PreloadAs, perf004FontPreloadCrossorigin } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { RuleContext } from '../src/rule.js';

const headWith = (tags: Array<Partial<HeadTag>>): ResolvedHead => ({
  route: '/x',
  source: 'rendered',
  file: 'x',
  tags: tags.map((t) => ({ presence: 'own', value: 'static', ...t }) as HeadTag)
});
const ctx = (head: ResolvedHead): RuleContext => ({ heads: [head], project: defaultProject, config: defineConfig({}) });
const failing = (rs: Awaited<ReturnType<typeof perf003PreloadAs.check>>) =>
  rs.filter((r) => r.detection.presence === 'none');

describe('PERF003 preload missing as', () => {
  it('flags a preload link with no as', async () => {
    const rs = await perf003PreloadAs.check(ctx(headWith([{ kind: 'link', rel: 'preload' }])));
    expect(failing(rs)).toHaveLength(1);
  });
  it('passes a preload link that has an as', async () => {
    const rs = await perf003PreloadAs.check(
      ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true, as: 'style' }]))
    );
    expect(failing(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // one passing result seeds the route
  });
  it('does not fire on a dynamically-bound as (present)', async () => {
    const rs = await perf003PreloadAs.check(ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true }])));
    expect(failing(rs)).toHaveLength(0);
  });
  it('emits nothing when there is no preload link', async () => {
    const rs = await perf003PreloadAs.check(ctx(headWith([{ kind: 'link', rel: 'stylesheet' }])));
    expect(rs).toHaveLength(0);
  });
});

describe('PERF004 font preload missing crossorigin', () => {
  it('flags as=font preload without crossorigin', async () => {
    const rs = await perf004FontPreloadCrossorigin.check(
      ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true, as: 'font' }]))
    );
    expect(failing(rs)).toHaveLength(1);
  });
  it('passes as=font preload with crossorigin', async () => {
    const rs = await perf004FontPreloadCrossorigin.check(
      ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true, as: 'font', hasCrossorigin: true }]))
    );
    expect(failing(rs)).toHaveLength(0);
  });
  it('ignores a non-font preload', async () => {
    const rs = await perf004FontPreloadCrossorigin.check(
      ctx(headWith([{ kind: 'link', rel: 'preload', hasAs: true, as: 'script' }]))
    );
    expect(rs).toHaveLength(0); // not relevant → no signal
  });
});
