import { describe, it, expect } from 'vitest';
import {
  correct001EachKey,
  correct002EffectDerived,
  correct003EffectAsOnMount,
  correct004UnmutatedState,
  correct005PropMutation,
  correct006OrphanEffect,
  correct007OrphanLifecycle,
  correct008BrowserGlobals,
  correct009InstanceBrowserGlobals
} from '../src/index.js';
import { defineConfig, defaultProject, type Result } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { KitModuleFacts } from '../src/kit-module.js';
import type { RuleContext } from '../src/rule.js';
import { parseComponentFacts } from '../src/component-parse.js';

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
  orphanEffects: [],
  orphanLifecycleCalls: [],
  browserGlobalRefs: [],
  moduleStateDecls: [],
  suppressions: [],
  ...over
});

const kitFacts = (over: Partial<KitModuleFacts>): KitModuleFacts => ({
  file: 'src/routes/+page.ts',
  kind: 'universal',
  moduleStateReassignments: [],
  importedStateWrites: [],
  importedStateWritesOutsideHandlers: [],
  runesModuleImports: [],
  lifecycleCalls: [],
  browserGlobalRefs: [],
  suppressions: [],
  ...over
});

describe('correctness/each-key keyed each block', () => {
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

describe('correctness/effect-as-derived effect used to derive state', () => {
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
  it('passes the mount-signal pattern when suppressed via inline directive (issue #92)', async () => {
    const rs = await correct002EffectDerived.check(
      ctx([
        comp({
          effects: [{ line: 5, assignsOnlyState: true, mountOnly: false }],
          suppressions: [{ line: 5, ruleIds: ['correctness/effect-as-derived'] }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('correctness/effect-as-onmount effect used as onMount', () => {
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

describe('correctness/unmutated-state unmutated $state', () => {
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

describe('correctness/prop-mutation mutated non-bindable prop', () => {
  it('flags a mutated prop (one finding per mutation, with line and name)', async () => {
    const rs = await correct005PropMutation.check(ctx([comp({ mutatedProps: [{ name: 'user', line: 4 }] })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.line).toBe(4);
    expect(rs[0]!.message).toContain('user');
  });
  it('reports one finding per distinct mutation occurrence', async () => {
    const rs = await correct005PropMutation.check(
      ctx([
        comp({
          mutatedProps: [
            { name: 'a', line: 2 },
            { name: 'b', line: 3 }
          ]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(2);
  });
  it('is no-signal when there are no mutated props', async () => {
    const rs = await correct005PropMutation.check(ctx([comp({ mutatedProps: [] })]));
    expect(rs).toHaveLength(0);
  });
});

describe('correctness/orphan-effect orphan $effect', () => {
  it('flags a top-level module $effect as critical', async () => {
    const rs = await correct006OrphanEffect.check(
      ctx([comp({ file: 'src/lib/store.svelte.ts', orphanEffects: [{ line: 2, kind: 'top-level' }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('critical');
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.route).toBe('src/lib/store.svelte.ts');
    expect(rs[0]!.line).toBe(2);
    expect(rs[0]!.message).toContain('effect_orphan');
  });
  it('names the class in the constructor-instantiated message', async () => {
    const rs = await correct006OrphanEffect.check(
      ctx([
        comp({
          orphanEffects: [{ line: 8, kind: 'constructor-instantiated', className: 'QuizStateManager' }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('QuizStateManager');
    expect(rs[0]!.message).toContain('constructor');
  });
  it('emits nothing for a component with no orphan effects', async () => {
    expect(await correct006OrphanEffect.check(ctx([comp({})]))).toHaveLength(0);
  });
  it('emits nothing when the component channel is unset (rendered mode)', async () => {
    expect(await correct006OrphanEffect.check(base as RuleContext)).toHaveLength(0);
  });
  it('end-to-end: real module source yields a critical finding; a suppression silences its line', async () => {
    const src =
      '// svelte-vitals-disable-next-line correctness/orphan-effect\n$effect(() => {});\n$effect.pre(() => {});';
    const facts = parseComponentFacts(src, 'src/lib/store.svelte.ts');
    const rs = await correct006OrphanEffect.check(ctx([{ file: 'src/lib/store.svelte.ts', ...facts }]));
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.line).toBe(3);
  });
  it('tolerates facts built without orphanEffects (older external constructors)', async () => {
    const legacy = comp({}) as ComponentFacts & { orphanEffects?: undefined };
    delete (legacy as Record<string, unknown>).orphanEffects;
    expect(await correct006OrphanEffect.check(ctx([legacy]))).toHaveLength(0);
  });
});

describe('correctness/orphan-lifecycle lifecycle call outside component initialisation', () => {
  it('flags a module top-level call as critical with the module message', async () => {
    const rs = await correct007OrphanLifecycle.check(
      ctx([
        comp({ file: 'src/lib/s.svelte.ts', orphanLifecycleCalls: [{ name: 'onMount', line: 2, kind: 'top-level' }] })
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('critical');
    expect(rs[0]!.category).toBe('correctness');
    expect(rs[0]!.line).toBe(2);
    expect(rs[0]!.message).toContain('onMount()');
    expect(rs[0]!.message).toContain('lifecycle_outside_component');
  });
  it('names the class in the constructor-instantiated message', async () => {
    const rs = await correct007OrphanLifecycle.check(
      ctx([
        comp({
          orphanLifecycleCalls: [{ name: 'getContext', line: 7, kind: 'constructor-instantiated', className: 'Store' }]
        })
      ])
    );
    expect(fails(rs)[0]!.message).toContain('"Store"');
    expect(fails(rs)[0]!.message).toContain('getContext()');
  });
  it('uses the load/handler message for kit inHandler calls and the module message otherwise', async () => {
    const rs = await correct007OrphanLifecycle.check({
      ...ctx([]),
      kitModules: [
        kitFacts({ lifecycleCalls: [{ name: 'getContext', line: 3, inHandler: true }] }),
        kitFacts({
          file: 'src/hooks.server.ts',
          kind: 'server',
          lifecycleCalls: [{ name: 'onMount', line: 2, inHandler: false }]
        })
      ]
    });
    expect(fails(rs)).toHaveLength(2);
    expect(fails(rs)[0]!.message).toContain('load/handler');
    expect(fails(rs)[1]!.message).toContain('module evaluation');
  });
  it('reads both channels in one run and honours suppressions on each', async () => {
    const rs = await correct007OrphanLifecycle.check({
      ...ctx([
        comp({
          orphanLifecycleCalls: [{ name: 'onMount', line: 2, kind: 'top-level' }],
          suppressions: [{ line: 2, ruleIds: ['correctness/orphan-lifecycle'] }]
        })
      ]),
      kitModules: [
        kitFacts({
          lifecycleCalls: [{ name: 'getContext', line: 3, inHandler: true }],
          suppressions: [{ line: 3, ruleIds: ['correctness/orphan-lifecycle'] }]
        })
      ]
    });
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(2); // two PASS units (signal present, all findings suppressed)
  });
  it('emits nothing without signal or in rendered mode', async () => {
    expect(await correct007OrphanLifecycle.check(ctx([comp({})]))).toHaveLength(0);
    expect(await correct007OrphanLifecycle.check(base as RuleContext)).toHaveLength(0);
  });
});

describe('correctness/server-browser-global browser global in server module code', () => {
  it('flags a module-context read as critical with the module message', async () => {
    const rs = await correct008BrowserGlobals.check(
      ctx([
        comp({
          file: 'src/lib/store.svelte.ts',
          browserGlobalRefs: [{ name: 'window', line: 1, context: 'module' }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('critical');
    expect(rs[0]!.message).toContain('window');
    expect(rs[0]!.message).toContain('is not defined');
  });
  it('ignores instance-context refs (correctness/instance-browser-global territory) and reads the kit channel', async () => {
    const rs = await correct008BrowserGlobals.check({
      ...ctx([comp({ browserGlobalRefs: [{ name: 'window', line: 3, context: 'instance' }] })]),
      kitModules: [kitFacts({ browserGlobalRefs: [{ name: 'localStorage', line: 3, inHandler: true }] })]
    });
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.route).toBe('src/routes/+page.ts');
    expect(fails(rs)[0]!.message).toContain('load/handler');
  });
  it('is silenced by suppressions and emits nothing in rendered mode', async () => {
    const rs = await correct008BrowserGlobals.check(
      ctx([
        comp({
          browserGlobalRefs: [{ name: 'window', line: 2, context: 'module' }],
          suppressions: [{ line: 2, ruleIds: ['correctness/server-browser-global'] }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
    expect(await correct008BrowserGlobals.check(base as RuleContext)).toHaveLength(0);
  });
});

describe('correctness/instance-browser-global browser global during component initialisation', () => {
  it('flags an instance-context read as warning', async () => {
    const rs = await correct009InstanceBrowserGlobals.check(
      ctx([
        comp({
          file: 'src/lib/Widget.svelte',
          browserGlobalRefs: [{ name: 'localStorage', line: 4, context: 'instance' }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.line).toBe(4);
    expect(rs[0]!.message).toContain('localStorage');
  });
  it('ignores module-context refs and files without instance refs', async () => {
    expect(
      fails(
        await correct009InstanceBrowserGlobals.check(
          ctx([comp({ browserGlobalRefs: [{ name: 'window', line: 1, context: 'module' }] })])
        )
      )
    ).toHaveLength(0);
    expect(await correct009InstanceBrowserGlobals.check(ctx([comp({})]))).toHaveLength(0);
  });
});
