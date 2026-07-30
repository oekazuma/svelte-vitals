import { describe, it, expect } from 'vitest';
import { parseKitModuleFacts, resolveRunesModuleSpecifier, resolveRepoLocalPath } from '../src/kit-module-parse.js';
import type { KitAlias } from '../src/types.js';

const facts = (src: string, file = 'src/routes/+page.server.ts') => parseKitModuleFacts(src, file);

describe('parseKitModuleFacts — module-scope reassignments (security/server-module-state)', () => {
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
    const src =
      'let user;\nexport function load() {\n  // svelte-vitals-disable-next-line security/server-module-state\n  user = 1;\n}';
    const f = facts(src);
    expect(f.moduleStateReassignments).toEqual([{ name: 'user', line: 4, inHandler: true }]);
    expect(f.suppressions).toEqual([{ line: 4, ruleIds: ['security/server-module-state'] }]);
  });
  it("does not flag assignments inside SvelteKit's init startup hook", () => {
    const src =
      'let db;\nexport async function init() {\n  db = await connect();\n}\nexport const handle = async ({ event, resolve }) => resolve(event);';
    expect(facts(src, 'src/hooks.server.ts').moduleStateReassignments).toEqual([]);
  });
  it('resolves separate-statement alias exports to handlers', () => {
    const src = 'let user;\nconst load = async () => {\n  user = 1;\n};\nexport { load };';
    expect(facts(src).moduleStateReassignments).toEqual([{ name: 'user', line: 3, inHandler: true }]);
  });
  it('resolves an alias-exported actions object', () => {
    const src = 'let user;\nconst actions = {\n  default: async () => {\n    user = 1;\n  }\n};\nexport { actions };';
    expect(facts(src).moduleStateReassignments).toEqual([{ name: 'user', line: 4, inHandler: true }]);
  });
  it('applies the init exemption to an alias-exported init hook', () => {
    const src = 'let db;\nasync function init() {\n  db = 1;\n}\nexport { init };';
    expect(facts(src, 'src/hooks.server.ts').moduleStateReassignments).toEqual([]);
  });
  it('leaves cross-file re-exports unresolved (conservative)', () => {
    const src = "let n;\nexport { load } from './shared.js';\nfunction helper() {\n  n = 1;\n}";
    expect(facts(src).moduleStateReassignments).toEqual([{ name: 'n', line: 4, inHandler: false }]);
  });
  it('ignores type-only alias exports', () => {
    const src =
      'let user;\ntype load = () => void;\nconst load = async () => {\n  user = 1;\n};\nexport type { load };';
    expect(facts(src).moduleStateReassignments).toEqual([{ name: 'user', line: 4, inHandler: false }]);
  });
});

describe('parseKitModuleFacts — imported-state writes (security/handler-state-write/security/shared-state-import)', () => {
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
  it('does not flag .set/.update on package or $lib/server imports (DB/KV clients)', () => {
    const src = [
      "import { db } from '$lib/server/db';",
      "import { kv } from '@vercel/kv';",
      'export const actions = {',
      '  default: async () => {',
      '    await db.update(users).set({ name: "x" });',
      '    await kv.set("k", 1);',
      '  }',
      '};'
    ].join('\n');
    const f = facts(src);
    expect(f.importedStateWrites).toEqual([]);
    expect(f.importedStateWritesOutsideHandlers).toEqual([]);
  });
  it('still flags .set on a repo-local $lib store (the docs NEVER example)', () => {
    const src = "import { user } from '$lib/user';\nexport function load() {\n  user.set({});\n}";
    expect(facts(src).importedStateWrites).toEqual([{ name: 'user', line: 3, via: 'set-call' }]);
  });
  it('resolves renamed alias exports (export { handler as GET })', () => {
    const src =
      "import { state } from './shared.js';\nfunction handler() {\n  state.user = 1;\n}\nexport { handler as GET };";
    expect(facts(src, 'src/routes/api/+server.ts').importedStateWrites).toEqual([
      { name: 'state', line: 3, via: 'assignment' }
    ]);
  });
  it('does not flag .set/.update on a relative-path import into lib/server', () => {
    const src = [
      "import { db } from '../../lib/server/db';",
      'export const actions = {',
      '  default: async () => {',
      '    await db.update(users).set({ name: "x" });',
      '  }',
      '};'
    ].join('\n');
    const f = facts(src, 'src/routes/a/+page.server.ts');
    expect(f.importedStateWrites).toEqual([]);
    expect(f.importedStateWritesOutsideHandlers).toEqual([]);
  });
  it('still flags .set on a relative-path store import outside lib/server', () => {
    const src = "import { user } from '../user-store.js';\nexport function load() {\n  user.set({});\n}";
    expect(facts(src, 'src/routes/a/+page.server.ts').importedStateWrites).toEqual([
      { name: 'user', line: 3, via: 'set-call' }
    ]);
  });
  it('does not flag .set on a $lib/server directory-entrypoint import', () => {
    const src = [
      "import { db } from '$lib/server';",
      'export const actions = {',
      '  default: async () => {',
      '    await db.set("k", 1);',
      '  }',
      '};'
    ].join('\n');
    expect(facts(src).importedStateWrites).toEqual([]);
  });
  it('follows a moved $lib when exempting the lib server directory (files.lib: "src/library")', () => {
    // Reproduces the final-review false positive: a project that moves `kit.files.lib` still
    // gets its `$lib/server/**` DB/KV singletons exempted, because the exemption is derived
    // from the resolved `$lib` entry rather than a hard-coded `src/lib/server`. Before the
    // fix, `$lib/server/db` resolves to `src/library/server/db`, which the literal
    // `src/lib/server` check misses, and this write is (wrongly) recorded.
    const aliases: KitAlias[] = [{ find: '$lib', replacement: 'src/library', match: 'prefix' }];
    const src = [
      "import { db } from '$lib/server/db';",
      'export async function load() {',
      '  db.set("k", 1);',
      '  return {};',
      '}'
    ].join('\n');
    expect(parseKitModuleFacts(src, 'src/routes/+page.server.ts', aliases).importedStateWrites).toEqual([]);
  });
  it('stays silent on a relative-path .set() outside src/lib/server when $lib is opaque', () => {
    // An unreadable kit.files.lib compiles to an opaque $lib entry (replacement: null). A
    // $lib/… specifier already resolves to undefined in that case (covered separately below), so
    // it can't distinguish the fix from a no-op. This test picks a RELATIVE specifier that
    // resolves OUTSIDE the default 'src/lib/server' — the one path shape where the two
    // behaviours diverge: pre-fix, libServerRoot ignores the opaque entry and falls back to the
    // 'src/lib' default, so this path (not under it) is (correctly, but for the wrong reason)
    // NOT exempt and the write IS flagged (see the unaliased sibling test above). Post-fix, the
    // true lib root is unknown, so isLocalStateSpecifier returns false unconditionally and the
    // write is not reported at all — a missed finding, not a false positive.
    const aliases: KitAlias[] = [{ find: '$lib', replacement: null, match: 'prefix' }];
    const src = "import { user } from '../user-store.js';\nexport function load() {\n  user.set({});\n}";
    expect(parseKitModuleFacts(src, 'src/routes/a/+page.server.ts', aliases).importedStateWrites).toEqual([]);
  });
  it('treats a ..-escaping specifier conservatively (not local, not a runes module)', () => {
    const src = "import { store } from '../../../../src/lib/user.js';\nexport function load() {\n  store.set(1);\n}";
    expect(facts(src, 'src/routes/a/+page.server.ts').importedStateWrites).toEqual([]);
    expect(
      resolveRunesModuleSpecifier('../../../../src/lib/quiz.svelte.ts', 'src/routes/a/+page.server.ts')
    ).toBeUndefined();
  });
});

describe('parseKitModuleFacts — runes-module imports (security/shared-state-import)', () => {
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

describe('parseKitModuleFacts — lifecycle calls (correctness/orphan-lifecycle)', () => {
  it('flags getContext inside load (the classic trap)', () => {
    const src =
      "import { getContext } from 'svelte';\nexport function load() {\n  const user = getContext('user');\n  return { user };\n}";
    expect(facts(src).lifecycleCalls).toEqual([{ name: 'getContext', line: 3, inHandler: true }]);
  });
  it('flags top-level and init-hook calls with inHandler false', () => {
    const src =
      "import { onMount, setContext } from 'svelte';\nonMount(() => {});\nexport async function init() {\n  setContext('k', 1);\n}";
    expect(facts(src, 'src/hooks.server.ts').lifecycleCalls).toEqual([
      { name: 'onMount', line: 2, inHandler: false },
      { name: 'setContext', line: 4, inHandler: false }
    ]);
  });
  it('does not flag calls inside non-handler helper functions', () => {
    const src = "import { getContext } from 'svelte';\nexport function useUser() {\n  return getContext('user');\n}";
    expect(facts(src, 'src/routes/+page.ts').lifecycleCalls).toEqual([]);
  });
  it('resolves aliases and ignores same-named imports from other modules', () => {
    const src =
      "import { getContext as ctx } from 'svelte';\nimport { setContext } from './di.js';\nexport const load = () => {\n  ctx('a');\n  setContext('b', 1);\n};";
    expect(facts(src).lifecycleCalls).toEqual([{ name: 'getContext', line: 4, inHandler: true }]);
  });
  it('flags calls in functions nested inside a handler (deliberate: usually invoked within the handler)', () => {
    const src =
      "import { getContext } from 'svelte';\nexport function load() {\n  return { getUser: () => getContext('user') };\n}";
    expect(facts(src).lifecycleCalls).toEqual([{ name: 'getContext', line: 3, inHandler: true }]);
  });
});

describe('parseKitModuleFacts — browser-global refs (correctness/server-browser-global)', () => {
  it('flags reads at top level and inside load with the right inHandler flags', () => {
    const src = "const w = window.innerWidth;\nexport function load() {\n  return { s: localStorage.getItem('k') };\n}";
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([
      { name: 'window', line: 1, inHandler: false },
      { name: 'localStorage', line: 3, inHandler: true }
    ]);
  });
  it('flags init-hook reads with inHandler false and exempts helper functions', () => {
    const src = [
      'export async function init() {',
      '  document.title;',
      '}',
      'export function helper() {',
      '  return window.innerWidth;',
      '}'
    ].join('\n');
    expect(facts(src, 'src/hooks.server.ts').browserGlobalRefs).toEqual([
      { name: 'document', line: 2, inHandler: false }
    ]);
  });
  it('does not descend into closures nested inside a handler', () => {
    const src = 'export function load() {\n  return { getWidth: () => window.innerWidth };\n}';
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
  });
  it('respects browser/typeof guards and handler-parameter shadowing inside handlers', () => {
    const src = [
      "import { browser } from '$app/environment';",
      'export function load({ window }) {',
      '  if (browser) {',
      '    document.title;',
      '  }',
      '  window.close();',
      "  return typeof localStorage !== 'undefined' ? localStorage.getItem('k') : null;",
      '}'
    ].join('\n');
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
  });
  it('empties the facts when the file itself exports ssr = false, but not for csr = false', () => {
    const ssrOff =
      'export const ssr = false;\nconst w = window.innerWidth;\nexport function load() {\n  return { t: document.title };\n}';
    expect(facts(ssrOff, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
    const csrOff = 'export const csr = false;\nconst w = window.innerWidth;';
    expect(facts(csrOff, 'src/routes/+page.ts').browserGlobalRefs).toEqual([
      { name: 'window', line: 2, inHandler: false }
    ]);
  });
  it('scans a function aliased to both a handler and init exactly once (handler wins)', () => {
    const src = 'function foo() {\n  document.title;\n}\nexport { foo as load, foo as init };';
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([
      { name: 'document', line: 2, inHandler: true }
    ]);
  });
  it('honours the alias-exported ssr = false form', () => {
    const src = 'const ssr = false;\nexport { ssr };\nconst w = window.innerWidth;';
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
  });
  it('stops scanning a handler after an early-return browser guard', () => {
    const src = [
      "import { browser } from '$app/environment';",
      'export function load() {',
      '  if (!browser) return {};',
      '  return { w: window.innerWidth };',
      '}'
    ].join('\n');
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
  });
  it('recognises a module-level derived guard used inside a handler', () => {
    const src = [
      "import { browser } from '$app/environment';",
      'const canUse = browser;',
      'export function load() {',
      '  if (canUse) {',
      '    return { w: window.innerWidth };',
      '  }',
      '  return {};',
      '}'
    ].join('\n');
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([]);
  });
  it('stops after a typeof early-return guard but still flags before it', () => {
    const src = [
      'export function load() {',
      '  const before = navigator.language;',
      "  if (typeof window === 'undefined') return {};",
      '  return { w: window.innerWidth };',
      '}'
    ].join('\n');
    expect(facts(src, 'src/routes/+page.ts').browserGlobalRefs).toEqual([
      { name: 'navigator', line: 2, inHandler: true }
    ]);
  });
});

describe('parseKitModuleFacts — ssrDisabled (seo/ssr-disabled)', () => {
  it('records the declaration line for an inline export const ssr = false', () => {
    const src = 'export const prerender = true;\nexport const ssr = false;';
    expect(facts(src, 'src/routes/+page.ts').ssrDisabled).toEqual({ line: 2 });
  });
  it('handles satisfies and the alias-export form', () => {
    expect(facts('export const ssr = false satisfies boolean;', 'src/routes/+page.ts').ssrDisabled).toEqual({
      line: 1
    });
    expect(facts('const ssr = false;\nexport { ssr };', 'src/routes/+page.ts').ssrDisabled).toEqual({ line: 1 });
  });
  it('is absent for csr = false, ssr = true, non-literal, and non-exported forms', () => {
    expect(facts('export const csr = false;', 'src/routes/+page.ts').ssrDisabled).toBeUndefined();
    expect(facts('export const ssr = true;', 'src/routes/+page.ts').ssrDisabled).toBeUndefined();
    expect(
      facts("import { dev } from '$app/environment';\nexport const ssr = dev;", 'src/routes/+page.ts').ssrDisabled
    ).toBeUndefined();
    expect(facts('const ssr = false;', 'src/routes/+page.ts').ssrDisabled).toBeUndefined();
  });
});

const prefix = (find: string, replacement: string | null): KitAlias => ({ find, replacement, match: 'prefix' });
const contents = (find: string, replacement: string | null): KitAlias => ({ find, replacement, match: 'contents' });
const exact = (find: string, replacement: string | null): KitAlias => ({ find, replacement, match: 'exact' });
const LIB = prefix('$lib', 'src/lib');
const IMPORTER = 'src/routes/a/+page.server.ts';
const resolve = (spec: string, aliases?: KitAlias[]) => resolveRepoLocalPath(spec, IMPORTER, aliases);

describe('resolveRepoLocalPath — alias entries', () => {
  it('resolves a prefix entry for the bare key and for a nested specifier', () => {
    const aliases = [LIB, prefix('$a', 'src/a')];
    expect(resolve('$a', aliases)).toBe('src/a');
    expect(resolve('$a/x/y.svelte.ts', aliases)).toBe('src/a/x/y.svelte.ts');
  });

  it('a contents entry matches a nested specifier but not the bare key', () => {
    const aliases = [LIB, contents('$a', 'src/a')];
    expect(resolve('$a/x', aliases)).toBe('src/a/x');
    expect(resolve('$a', aliases)).toBeUndefined();
  });

  it('an exact entry matches the bare key but not a nested specifier', () => {
    const aliases = [LIB, exact('$a', 'src/a')];
    expect(resolve('$a', aliases)).toBe('src/a');
    expect(resolve('$a/x', aliases)).toBeUndefined();
  });

  it('takes the FIRST matching entry, not the one with the longest key', () => {
    // Kit pushes entries in declaration order and Vite's alias plugin uses entries.find(),
    // so `$a` answers `$a/b/c` and the `$a/b` entry is unreachable. A longest-key rule would
    // answer src/y/c — a different, possibly existing file.
    const aliases = [LIB, prefix('$a', 'src/x'), prefix('$a/b', 'src/y')];
    expect(resolve('$a/b/c', aliases)).toBe('src/x/b/c');
  });

  it('resolves the same pair differently when the declaration order is reversed', () => {
    const aliases = [LIB, prefix('$a/b', 'src/y'), prefix('$a', 'src/x')];
    expect(resolve('$a/b/c', aliases)).toBe('src/y/c');
  });

  it('an opaque entry blocks rather than falling through to a later entry', () => {
    // undefined is also what today's code answers for this specifier, so this pins the
    // "no worse than today" claim as well as the blocking behaviour.
    const aliases = [LIB, prefix('$a', null), prefix('$a/b', 'src/y')];
    expect(resolve('$a/b/c', aliases)).toBeUndefined();
  });

  it('does not match across a segment boundary', () => {
    expect(resolve('$libFoo/x', [LIB])).toBeUndefined();
  });

  it('returns undefined when the target escapes the project root', () => {
    expect(resolve('$out/x', [LIB, prefix('$out', '../sibling/src')])).toBeUndefined();
  });

  it('returns undefined for a literal absolute alias value, rather than a bogus project-relative path', () => {
    // Unchecked, normalizePosix drops the leading empty segment of `/opt/shared/src/x` and
    // answers `opt/shared/src/x` — a project-relative path that names a different, possibly
    // existing file. An absolute target is outside the analyzed project by definition.
    expect(resolve('$shared/x', [LIB, prefix('$shared', '/opt/shared/src')])).toBeUndefined();
  });

  it('returns undefined for a Windows drive-letter absolute alias value', () => {
    // Values are posixified first, so a config's `'C:\\shared\\src'` becomes `C:/shared/src` —
    // it doesn't start with `/`, so the plain absolute-path guard misses it and it would
    // otherwise pass through as a bogus project-relative path.
    expect(resolve('$shared/x', [LIB, prefix('$shared', 'C:/shared/src')])).toBeUndefined();
  });

  it('resolves a nested specifier under a value that names a file, without special-casing it', () => {
    // Kit never branches on whether the value is a file, so neither does this: the nonsense
    // path simply matches no real file downstream.
    expect(resolve('$f/x', [LIB, prefix('$f', 'src/f.js')])).toBe('src/f.js/x');
  });

  it('defaults to $lib -> src/lib when no list is passed', () => {
    expect(resolveRepoLocalPath('$lib/q.svelte.ts', IMPORTER)).toBe('src/lib/q.svelte.ts');
  });

  it('resolves a bare $lib under the default list', () => {
    // A deliberate widening: today this returns undefined. Kit's prefix mode resolves it.
    expect(resolveRepoLocalPath('$lib', IMPORTER)).toBe('src/lib');
  });

  it('resolves a $lib specifier to undefined when the $lib entry is opaque', () => {
    // An unreadable kit.files.lib compiles to { find: '$lib', replacement: null, match: 'prefix' }.
    // The opaque-entry-blocks behaviour already covers this generically; this pins it for $lib
    // specifically, since $lib's own exemption logic (libServerRoot) depends on this staying true.
    expect(resolve('$lib/x.svelte.ts', [prefix('$lib', null)])).toBeUndefined();
  });

  it('resolves a relative specifier whatever the list says', () => {
    expect(resolve('../../lib/q.svelte.ts', [LIB, prefix('.', 'src/nonsense')])).toBe('src/lib/q.svelte.ts');
  });

  it('returns undefined for a bare package', () => {
    expect(resolve('drizzle-orm', [LIB, prefix('$a', 'src/a')])).toBeUndefined();
  });
});

describe('parseKitModuleFacts — alias-resolved specifiers', () => {
  const src = `import { s } from '$a/store.svelte';\ns.set(1);\n`;
  const aliases: KitAlias[] = [
    { find: '$lib', replacement: 'src/lib', match: 'prefix' },
    { find: '$a', replacement: 'src/a', match: 'prefix' }
  ];

  it('records no runes-module import for an unknown alias', () => {
    expect(parseKitModuleFacts(src, 'src/routes/+page.server.ts').runesModuleImports).toEqual([]);
  });

  it('records the import once the alias list explains the specifier', () => {
    expect(parseKitModuleFacts(src, 'src/routes/+page.server.ts', aliases).runesModuleImports).toEqual([
      { source: '$a/store.svelte', resolved: 'src/a/store.svelte.ts', names: ['s'], line: 1 }
    ]);
  });

  it('records the set-call write once the alias list explains the specifier', () => {
    const wrapped = `import { s } from '$a/store.svelte';\nexport function load() {\n  s.set(1);\n}\n`;
    expect(parseKitModuleFacts(wrapped, 'src/routes/+page.server.ts').importedStateWrites).toEqual([]);
    expect(parseKitModuleFacts(wrapped, 'src/routes/+page.server.ts', aliases).importedStateWrites).toEqual([
      { name: 's', line: 3, via: 'set-call' }
    ]);
  });
});
