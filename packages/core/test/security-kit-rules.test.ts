import { describe, it, expect } from 'vitest';
import {
  securityHandlerStateWrite,
  securityServerModuleState,
  securitySharedStateImport,
  seoSsrDisabled
} from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { KitModuleFacts } from '../src/kit-module.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/types.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (kitModules: KitModuleFacts[], over: Partial<RuleContext> = {}): RuleContext => ({
  kitModules,
  ...base,
  ...over
});
const kit = (over: Partial<KitModuleFacts>): KitModuleFacts => ({
  file: 'src/routes/+page.server.ts',
  kind: 'server',
  moduleStateReassignments: [],
  importedStateWrites: [],
  importedStateWritesOutsideHandlers: [],
  runesModuleImports: [],
  lifecycleCalls: [],
  browserGlobalRefs: [],
  suppressions: [],
  ...over
});

describe('security/handler-state-write handler writes imported state', () => {
  it('flags a handler write as critical', async () => {
    const rs = await securityHandlerStateWrite.check(
      ctx([kit({ importedStateWrites: [{ name: 'user', line: 3, via: 'set-call' }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('critical');
    expect(rs[0]!.category).toBe('security');
    expect(rs[0]!.route).toBe('src/routes/+page.server.ts');
    expect(rs[0]!.line).toBe(3);
    expect(rs[0]!.message).toContain('"user"');
  });
  it('emits nothing without signal and in rendered mode', async () => {
    expect(await securityHandlerStateWrite.check(ctx([kit({})]))).toHaveLength(0);
    expect(await securityHandlerStateWrite.check(base as RuleContext)).toHaveLength(0);
  });
  it('is silenced by an inline suppression', async () => {
    const rs = await securityHandlerStateWrite.check(
      ctx([
        kit({
          importedStateWrites: [{ name: 'user', line: 3, via: 'assignment' }],
          suppressions: [{ line: 3, ruleIds: ['security/handler-state-write'] }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('security/server-module-state server module-scope state', () => {
  it('flags a handler reassignment as warning with the handler message', async () => {
    const rs = await securityServerModuleState.check(
      ctx([kit({ moduleStateReassignments: [{ name: 'user', line: 8, inHandler: true }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.message).toContain('request handler');
  });
  it('uses the softer message for helper-function reassignment', async () => {
    const rs = await securityServerModuleState.check(
      ctx([kit({ moduleStateReassignments: [{ name: 'last', line: 3, inHandler: false }] })])
    );
    expect(fails(rs)[0]!.message).toContain('from a function');
  });
});

const stateModule = (file: string): ComponentFacts => ({
  file,
  eachBlocks: [],
  effects: [],
  htmlTags: [],
  javascriptUrls: [],
  loc: 0,
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
  orphanEffects: [],
  orphanLifecycleCalls: [],
  browserGlobalRefs: [],
  moduleStateDecls: [{ name: 'user', line: 1 }],
  suppressions: []
});

describe('security/shared-state-import shared runes-state import on the server', () => {
  const imp = { source: '$lib/quiz.svelte.js', resolved: 'src/lib/quiz.svelte.js', names: ['quizState'], line: 1 };

  it('flags a read-only import of a module-scope $state module (stale/boot-time message)', async () => {
    const rs = await securitySharedStateImport.check(
      ctx([kit({ runesModuleImports: [imp] })], { components: [stateModule('src/lib/quiz.svelte.js')] })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.line).toBe(1);
    expect(rs[0]!.message).toContain('boot-time');
  });
  it('uses the mutation message when the binding is written outside handlers', async () => {
    const rs = await securitySharedStateImport.check(
      ctx(
        [
          kit({
            runesModuleImports: [imp],
            importedStateWritesOutsideHandlers: [{ name: 'quizState', line: 5 }]
          })
        ],
        { components: [stateModule('src/lib/quiz.svelte.js')] }
      )
    );
    expect(fails(rs)[0]!.message).toContain('mutates');
  });
  it('matches the .svelte.ts sibling of a .js-resolved import', async () => {
    const rs = await securitySharedStateImport.check(
      ctx([kit({ runesModuleImports: [imp] })], { components: [stateModule('src/lib/quiz.svelte.ts')] })
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('does not double-report a binding already flagged by security/handler-state-write, and skips non-state modules', async () => {
    const covered = await securitySharedStateImport.check(
      ctx(
        [
          kit({
            runesModuleImports: [imp],
            importedStateWrites: [{ name: 'quizState', line: 5, via: 'set-call' }]
          })
        ],
        { components: [stateModule('src/lib/quiz.svelte.js')] }
      )
    );
    expect(fails(covered)).toHaveLength(0);
    const noState = await securitySharedStateImport.check(
      ctx([kit({ runesModuleImports: [imp] })], {
        components: [{ ...stateModule('src/lib/quiz.svelte.js'), moduleStateDecls: [] }]
      })
    );
    expect(fails(noState)).toHaveLength(0);
  });
});

describe('seo/ssr-disabled SSR disabled', () => {
  it('flags a leaf route with the per-route message as an seo warning', async () => {
    const rs = await seoSsrDisabled.check(
      ctx([kit({ file: 'src/routes/dash/+page.ts', kind: 'universal', ssrDisabled: { line: 1 } })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.category).toBe('seo');
    expect(rs[0]!.line).toBe(1);
    expect(rs[0]!.message).toContain('this route');
  });
  it('uses the app-wide message for the root layout', async () => {
    const rs = await seoSsrDisabled.check(
      ctx([kit({ file: 'src/routes/+layout.ts', kind: 'universal', ssrDisabled: { line: 2 } })])
    );
    expect(fails(rs)[0]!.message).toContain('whole app');
  });
  it('does not fire for hooks.server or +server files (ssr is a page option)', async () => {
    const rs = await seoSsrDisabled.check(
      ctx([
        kit({ file: 'src/hooks.server.ts', kind: 'server', ssrDisabled: { line: 1 } }),
        kit({ file: 'src/routes/api/+server.ts', kind: 'server', ssrDisabled: { line: 1 } })
      ])
    );
    expect(rs).toHaveLength(0);
  });
  it('emits nothing without the flag, honours suppression, and no-ops in rendered mode', async () => {
    expect(await seoSsrDisabled.check(ctx([kit({})]))).toHaveLength(0);
    const suppressed = await seoSsrDisabled.check(
      ctx([kit({ ssrDisabled: { line: 3 }, suppressions: [{ line: 3, ruleIds: ['seo/ssr-disabled'] }] })])
    );
    expect(fails(suppressed)).toHaveLength(0);
    expect(await seoSsrDisabled.check(base as RuleContext)).toHaveLength(0);
  });
});
