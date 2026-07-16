import { describe, it, expect } from 'vitest';
import { parseKitModuleFacts, resolveRunesModuleSpecifier } from '../src/kit-module-parse.js';

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

describe('parseKitModuleFacts — imported-state writes (SEC003/SEC005)', () => {
  it('flags the docs NEVER example: store.set inside load', () => {
    const src =
      "import { user } from '$lib/user';\nexport async function load({ fetch }) {\n  user.set(await (await fetch('/api/user')).json());\n}";
    expect(facts(src).importedStateWrites).toEqual([{ name: 'user', line: 3, via: 'set-call' }]);
  });
  it('flags property assignment, update, delete, and namespace-import writes in handlers', () => {
    const src = [
      "import { state } from './shared.js';",
      "import * as s from './other.js';",
      'export const actions = {',
      '  default: async () => {',
      '    state.user = 1;',
      '    state.count++;',
      '    delete state.tmp;',
      '    s.flag = true;',
      '  }',
      '};'
    ].join('\n');
    expect(facts(src).importedStateWrites).toEqual([
      { name: 'state', line: 5, via: 'assignment' },
      { name: 'state', line: 6, via: 'assignment' },
      { name: 'state', line: 7, via: 'assignment' },
      { name: 's', line: 8, via: 'assignment' }
    ]);
  });
  it('records writes outside handlers separately (top level and helper functions)', () => {
    const src =
      "import { theme } from './theme.svelte.js';\ntheme.mode = 'dark';\nfunction reset() {\n  theme.update((t) => t);\n}";
    const f = facts(src);
    expect(f.importedStateWrites).toEqual([]);
    expect(f.importedStateWritesOutsideHandlers).toEqual([
      { name: 'theme', line: 2 },
      { name: 'theme', line: 4 }
    ]);
  });
  it('flags a destructuring-assignment target with an imported root', () => {
    const src = "import { state } from './shared.js';\nexport function load() {\n  [state.x] = [1];\n}";
    expect(facts(src).importedStateWrites).toEqual([{ name: 'state', line: 3, via: 'assignment' }]);
  });
  it('does not flag read positions inside a destructuring pattern (computed key, default value)', () => {
    const src = [
      "import { state } from './shared.js';",
      'export function load() {',
      '  let local, a;',
      '  ({ [state.key]: local } = { x: 1 });',
      '  [a = state.fallback] = [];',
      '}'
    ].join('\n');
    expect(facts(src).importedStateWrites).toEqual([]);
  });
  it('does not flag reads, non-set method calls, local shadows, or writes to non-imports', () => {
    const src = [
      "import { logger, data } from './svc.js';",
      'export function load() {',
      '  logger.info(data.value);',
      '  const data2 = { x: 1 };',
      '  data2.x = 2;',
      '  const data3 = (d) => { d.set(1); };',
      '  data3(new Map());',
      '}'
    ].join('\n');
    const f = facts(src);
    expect(f.importedStateWrites).toEqual([]);
    expect(f.importedStateWritesOutsideHandlers).toEqual([]);
  });
});

describe('parseKitModuleFacts — runes-module imports (SEC005)', () => {
  it('resolves $lib and relative specifiers to repo-relative .svelte.ts paths', () => {
    const src =
      "import { quizState } from '$lib/quiz.svelte.js';\nimport { other } from '../store.svelte.ts';\nimport type { T } from '$lib/types.svelte.ts';\nimport pkg from 'some-pkg';";
    const f = facts(src, 'src/routes/deep/+page.server.ts');
    expect(f.runesModuleImports).toEqual([
      { source: '$lib/quiz.svelte.js', resolved: 'src/lib/quiz.svelte.js', names: ['quizState'], line: 1 },
      { source: '../store.svelte.ts', resolved: 'src/routes/store.svelte.ts', names: ['other'], line: 2 }
    ]);
  });
  it('canonicalises an extensionless .svelte specifier to .svelte.ts', () => {
    expect(resolveRunesModuleSpecifier('$lib/store.svelte', 'src/routes/+page.ts')).toBe('src/lib/store.svelte.ts');
    expect(resolveRunesModuleSpecifier('./a/../b.svelte.js', 'src/routes/x/+page.ts')).toBe('src/routes/x/b.svelte.js');
    expect(resolveRunesModuleSpecifier('$lib/util.ts', 'src/routes/+page.ts')).toBeUndefined();
    expect(resolveRunesModuleSpecifier('some-pkg', 'src/routes/+page.ts')).toBeUndefined();
  });
});
