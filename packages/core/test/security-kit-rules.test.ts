import { describe, it, expect } from 'vitest';
import { sec003LoadStateWrite, sec004ServerModuleState } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
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
