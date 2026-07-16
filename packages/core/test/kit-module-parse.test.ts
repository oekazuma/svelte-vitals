import { describe, it, expect } from 'vitest';
import { parseKitModuleFacts } from '../src/kit-module-parse.js';

const facts = (src: string, file = 'src/routes/+page.server.ts') => parseKitModuleFacts(src, file);

describe('parseKitModuleFacts — module-scope reassignments (SEC004)', () => {
  it('flags the docs NEVER example: module let assigned from an action', () => {
    const src = [
      'let user;',
      'export function load() {',
      '  return { user };',
      '}',
      'export const actions = {',
      '  default: async ({ request }) => {',
      '    const data = await request.formData();',
      '    user = { name: data.get("name") };',
      '  }',
      '};'
    ].join('\n');
    expect(facts(src).moduleStateReassignments).toEqual([{ name: 'user', line: 8, inHandler: true }]);
  });
  it('flags compound and ??= reassignment and ++ from a load handler', () => {
    const src =
      'let hits = 0;\nlet cached;\nexport const load = async () => {\n  hits++;\n  cached ??= await fetch("/x");\n};';
    expect(facts(src).moduleStateReassignments).toEqual([
      { name: 'hits', line: 4, inHandler: true },
      { name: 'cached', line: 5, inHandler: true }
    ]);
  });
  it('flags a helper-function reassignment as inHandler: false', () => {
    const src = 'let last;\nfunction remember(v) {\n  last = v;\n}\nexport function load() {\n  remember(1);\n}';
    expect(facts(src).moduleStateReassignments).toEqual([{ name: 'last', line: 3, inHandler: false }]);
  });
  it('does not flag top-level initialisation, const mutation, or shadowed locals', () => {
    const src = [
      'let config = null;',
      'config = { ready: true };',
      'const cache = new Map();',
      'export function load() {',
      '  cache.set("k", 1);',
      '  let config = 2;',
      '  config = 3;',
      '}'
    ].join('\n');
    expect(facts(src).moduleStateReassignments).toEqual([]);
  });
  it('identifies actions members and HTTP-method handlers (satisfies unwrapped)', () => {
    const src = 'let n = 0;\nexport const GET = (() => {\n  n = 1;\n}) satisfies RequestHandler;';
    expect(facts(src, 'src/routes/api/+server.ts').moduleStateReassignments).toEqual([
      { name: 'n', line: 3, inHandler: true }
    ]);
  });
  it('identifies a hooks.server handle handler', () => {
    const src =
      'let lastPath;\nexport const handle = async ({ event, resolve }) => {\n  lastPath = event.url.pathname;\n  return resolve(event);\n};';
    expect(facts(src, 'src/hooks.server.ts').moduleStateReassignments).toEqual([
      { name: 'lastPath', line: 3, inHandler: true }
    ]);
  });
  it('collects suppressions against unwrapped line numbers', () => {
    const src = 'let user;\nexport function load() {\n  // svelte-vitals-disable-next-line SEC004\n  user = 1;\n}';
    const f = facts(src);
    expect(f.moduleStateReassignments).toEqual([{ name: 'user', line: 4, inHandler: true }]);
    expect(f.suppressions).toEqual([{ line: 4, ruleIds: ['SEC004'] }]);
  });
});
