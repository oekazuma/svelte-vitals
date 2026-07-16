import { describe, it, expect } from 'vitest';
import { sec003LoadStateWrite, sec004ServerModuleState, sec005SharedStateImport } from '../src/index.js';
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

describe('SEC003 handler writes imported state', () => {
  it('flags a handler write as critical', async () => {
    const rs = await sec003LoadStateWrite.check(
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
    expect(await sec003LoadStateWrite.check(ctx([kit({})]))).toHaveLength(0);
    expect(await sec003LoadStateWrite.check(base as RuleContext)).toHaveLength(0);
  });
  it('is silenced by an inline suppression', async () => {
    const rs = await sec003LoadStateWrite.check(
      ctx([
        kit({
          importedStateWrites: [{ name: 'user', line: 3, via: 'assignment' }],
          suppressions: [{ line: 3, ruleIds: ['SEC003'] }]
        })
      ])
    );
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('SEC004 server module-scope state', () => {
  it('flags a handler reassignment as warning with the handler message', async () => {
    const rs = await sec004ServerModuleState.check(
      ctx([kit({ moduleStateReassignments: [{ name: 'user', line: 8, inHandler: true }] })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.message).toContain('request handler');
  });
  it('uses the softer message for helper-function reassignment', async () => {
    const rs = await sec004ServerModuleState.check(
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
  orphanEffects: [],
  orphanLifecycleCalls: [],
  browserGlobalRefs: [],
  moduleStateDecls: [{ name: 'user', line: 1 }],
  suppressions: []
});

describe('SEC005 shared runes-state import on the server', () => {
  const imp = { source: '$lib/quiz.svelte.js', resolved: 'src/lib/quiz.svelte.js', names: ['quizState'], line: 1 };

  it('flags a read-only import of a module-scope $state module (stale/boot-time message)', async () => {
    const rs = await sec005SharedStateImport.check(
      ctx([kit({ runesModuleImports: [imp] })], { components: [stateModule('src/lib/quiz.svelte.js')] })
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.line).toBe(1);
    expect(rs[0]!.message).toContain('boot-time');
  });
  it('uses the mutation message when the binding is written outside handlers', async () => {
    const rs = await sec005SharedStateImport.check(
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
    const rs = await sec005SharedStateImport.check(
      ctx([kit({ runesModuleImports: [imp] })], { components: [stateModule('src/lib/quiz.svelte.ts')] })
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('does not double-report a binding already flagged by SEC003, and skips non-state modules', async () => {
    const covered = await sec005SharedStateImport.check(
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
    const noState = await sec005SharedStateImport.check(
      ctx([kit({ runesModuleImports: [imp] })], {
        components: [{ ...stateModule('src/lib/quiz.svelte.js'), moduleStateDecls: [] }]
      })
    );
    expect(fails(noState)).toHaveLength(0);
  });
});
