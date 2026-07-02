import { describe, it, expect } from 'vitest';
import {
  correct001EachKey,
  correct002EffectDerived,
  correct003EffectAsOnMount,
  correct004UnmutatedState
} from '../src/index.js';
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
  namespaceImports: [],
  constableStates: [],
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
    const rs = await correct002EffectDerived.check(
      ctx([comp({ effects: [{ line: 5, assignsOnlyState: true, mountOnly: false }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('$derived');
  });
  it('passes an $effect that does real work', async () => {
    const rs = await correct002EffectDerived.check(
      ctx([comp({ effects: [{ line: 5, assignsOnlyState: false, mountOnly: false }] })])
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing for a component with no $effect', async () => {
    expect(await correct002EffectDerived.check(ctx([comp({})]))).toHaveLength(0);
  });
});

describe('CORRECT003 effect used as onMount', () => {
  it('flags a mount-only $effect', async () => {
    const rs = await correct003EffectAsOnMount.check(
      ctx([comp({ effects: [{ line: 4, assignsOnlyState: false, mountOnly: true }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.message).toContain('onMount');
  });
  it('passes an $effect that reads reactive state', async () => {
    const rs = await correct003EffectAsOnMount.check(
      ctx([comp({ effects: [{ line: 4, assignsOnlyState: false, mountOnly: false }] })])
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1); // a passing seed (applies=true, no findings)
  });
  it('is no-signal when there are no effects', async () => {
    const rs = await correct003EffectAsOnMount.check(ctx([comp({ effects: [] })]));
    expect(rs).toHaveLength(0);
  });
});

describe('CORRECT004 unmutated $state', () => {
  it('flags a constable $state (one finding per state, with line)', async () => {
    const rs = await correct004UnmutatedState.check(ctx([comp({ constableStates: [{ name: 'title', line: 2 }] })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.line).toBe(2);
    expect(rs[0]!.message).toContain('title');
  });
  it('reports one finding per distinct constable state', async () => {
    const rs = await correct004UnmutatedState.check(
      ctx([
        comp({
          constableStates: [
            { name: 'a', line: 2 },
            { name: 'b', line: 3 }
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(2);
  });
  it('is no-signal when there are no constable states', async () => {
    const rs = await correct004UnmutatedState.check(ctx([comp({ constableStates: [] })]));
    expect(rs).toHaveLength(0);
  });
});
