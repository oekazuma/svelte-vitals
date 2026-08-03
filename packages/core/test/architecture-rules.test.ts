import { describe, it, expect } from 'vitest';
import { architectureComponentSize, architecturePropCount } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (components: ComponentFacts[]): RuleContext => ({ components, ...base });
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

describe('architecture/component-size component size', () => {
  it('flags a component over the line limit', async () => {
    const rs = await architectureComponentSize.check(ctx([comp({ loc: 500 })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('architecture');
    expect(rs[0]!.severity).toBe('info');
    expect(rs[0]!.message).toContain('500');
  });
  it('passes a small component', async () => {
    const rs = await architectureComponentSize.check(ctx([comp({ loc: 50 })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('passes a component at exactly the line limit', async () => {
    const rs = await architectureComponentSize.check(ctx([comp({ loc: 200 })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('flags a component one line over the limit', async () => {
    const rs = await architectureComponentSize.check(ctx([comp({ loc: 201 })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('201');
    expect(rs[0]!.message).toContain('over 200');
  });
  it('emits nothing when the component channel is unset (rendered mode)', async () => {
    expect(await architectureComponentSize.check(base as RuleContext)).toHaveLength(0);
  });
  it('skips an unanalyzable component (loc 0 = read/parse failure), not a PASS', async () => {
    expect(await architectureComponentSize.check(ctx([comp({ loc: 0 })]))).toHaveLength(0);
  });
});

describe('architecture/prop-count prop count', () => {
  it('flags a component with too many props', async () => {
    const rs = await architecturePropCount.check(ctx([comp({ propCount: 15 })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('15');
  });
  it('passes a component with few props', async () => {
    const rs = await architecturePropCount.check(ctx([comp({ propCount: 3 })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('passes a component at exactly the threshold', async () => {
    const rs = await architecturePropCount.check(ctx([comp({ propCount: 6 })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('flags a component one prop over the threshold', async () => {
    const rs = await architecturePropCount.check(ctx([comp({ propCount: 7 })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('7');
    expect(rs[0]!.message).toContain('over 6');
  });
  it('emits nothing for a component with no countable props', async () => {
    expect(await architecturePropCount.check(ctx([comp({ propCount: 0 })]))).toHaveLength(0);
  });
});

describe('architecture rule options', () => {
  const ctxWith = (cfg: Parameters<typeof defineConfig>[0], components: ComponentFacts[]): RuleContext => ({
    components,
    heads: [],
    project: defaultProject,
    config: defineConfig(cfg)
  });

  it('pins the built-in prop-count threshold', async () => {
    expect(fails(await architecturePropCount.check(ctx([comp({ propCount: 6 })])))).toHaveLength(0);
    expect(fails(await architecturePropCount.check(ctx([comp({ propCount: 7 })])))).toHaveLength(1);
  });
  it('pins the built-in component-size threshold', async () => {
    expect(fails(await architectureComponentSize.check(ctx([comp({ loc: 200 })])))).toHaveLength(0);
    expect(fails(await architectureComponentSize.check(ctx([comp({ loc: 201 })])))).toHaveLength(1);
  });
  it('honours a configured prop-count max', async () => {
    const cfg = { rules: { 'architecture/prop-count': { options: { max: 10 } } } };
    expect(fails(await architecturePropCount.check(ctxWith(cfg, [comp({ propCount: 8 })])))).toHaveLength(0);
    expect(fails(await architecturePropCount.check(ctxWith(cfg, [comp({ propCount: 11 })])))).toHaveLength(1);
  });
  it('honours a per-path prop-count max', async () => {
    const cfg = {
      rules: { 'architecture/prop-count': { options: { max: 10 } } },
      overrides: [{ files: 'src/lib/**', rules: { 'architecture/prop-count': { options: { max: 4 } } } }]
    };
    const lib = comp({ file: 'src/lib/Button.svelte', propCount: 6 });
    const route = comp({ file: 'src/routes/+page.svelte', propCount: 6 });
    expect(fails(await architecturePropCount.check(ctxWith(cfg, [lib])))).toHaveLength(1);
    expect(fails(await architecturePropCount.check(ctxWith(cfg, [route])))).toHaveLength(0);
  });
  it('reports the configured threshold in the message and recommendation', async () => {
    const cfg = { rules: { 'architecture/prop-count': { options: { max: 10 } } } };
    const rs = fails(await architecturePropCount.check(ctxWith(cfg, [comp({ propCount: 11 })])));
    expect(rs[0]!.message).toContain('over 10');
    expect(rs[0]!.recommendation).toContain('10');
  });

  it('honours a configured component-size max', async () => {
    const cfg = { rules: { 'architecture/component-size': { options: { max: 400 } } } };
    // A regression that ignored the resolved `o.max` and kept using the built-in
    // MAX_LOC (200) constant would flag this pass case and pass this fail case,
    // so both sides of the boundary must be asserted against the configured value.
    expect(fails(await architectureComponentSize.check(ctxWith(cfg, [comp({ loc: 400 })])))).toHaveLength(0);
    expect(fails(await architectureComponentSize.check(ctxWith(cfg, [comp({ loc: 401 })])))).toHaveLength(1);
  });
  it('reports the configured component-size threshold in the message and recommendation', async () => {
    const cfg = { rules: { 'architecture/component-size': { options: { max: 400 } } } };
    const rs = fails(await architectureComponentSize.check(ctxWith(cfg, [comp({ loc: 401 })])));
    expect(rs[0]!.message).toContain('over 400');
    expect(rs[0]!.recommendation).toContain('400');
  });
});
