import { describe, it, expect } from 'vitest';
import { correct001EachKey, correct002EffectDerived } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: { detection: { presence: string; value: string } }[]) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
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
  ...over
});

describe('CORRECT001 keyed each block', () => {
  it('flags an unkeyed {#each}', async () => {
    const rs = await correct001EachKey.check(ctx([comp({ eachBlocks: [{ hasKey: false, line: 3 }] })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.route).toBe('src/lib/C.svelte');
    expect(rs[0]!.line).toBe(3);
  });
  it('passes a keyed {#each}', async () => {
    const rs = await correct001EachKey.check(ctx([comp({ eachBlocks: [{ hasKey: true, line: 3 }] })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a component with no {#each}', async () => {
    expect(await correct001EachKey.check(ctx([comp({})]))).toHaveLength(0);
  });
  it('emits nothing when the component channel is unset (rendered mode)', async () => {
    expect(await correct001EachKey.check(base as RuleContext)).toHaveLength(0);
  });
});

describe('CORRECT002 effect used to derive state', () => {
  it('flags an $effect that only assigns state', async () => {
    const rs = await correct002EffectDerived.check(ctx([comp({ effects: [{ line: 5, assignsOnlyState: true }] })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('$derived');
  });
  it('passes an $effect that does real work', async () => {
    const rs = await correct002EffectDerived.check(ctx([comp({ effects: [{ line: 5, assignsOnlyState: false }] })]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a component with no $effect', async () => {
    expect(await correct002EffectDerived.check(ctx([comp({})]))).toHaveLength(0);
  });
});
