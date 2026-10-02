import { describe, it, expect } from 'vitest';
import type { Runtime } from '../src/runtime.js';
import { collectKitModuleFacts, emptyKitModuleFacts } from '../src/kit-module-collect.js';

function createMemoryRuntime(files: Record<string, string>, unreadable: Set<string> = new Set()): Runtime {
  const map = new Map(Object.entries(files));
  return {
    async readFile(path) {
      if (unreadable.has(path)) throw new Error(`EACCES: ${path}`);
      const content = map.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    async exists(path) {
      return map.has(path);
    },
    async glob(pattern) {
      const rx = new RegExp(
        '^' +
          pattern
            .replace(/[.+^$()|[\]\\]/g, '\\$&')
            .replace(/\{([^}]+)\}/g, (_, alts: string) => `(${alts.split(',').join('|')})`)
            .replace(/\*\*\//g, '(.*/)?')
            .replace(/\*/g, '[^/]*') +
          '$'
      );
      return [...map.keys()].filter((k) => rx.test(k));
    },
    join(...parts) {
      return parts.filter((p) => p.length > 0).join('/');
    }
  };
}

describe('collectKitModuleFacts — $lib/server store arbitration', () => {
  const handler = (spec: string, expr: string) =>
    `import { ${expr.split('.')[0]} } from '${spec}';\nexport function load({ locals }) {\n  ${expr};\n}`;
  const writes = async (files: Record<string, string>) => {
    const facts = await collectKitModuleFacts(createMemoryRuntime(files), '');
    return facts.flatMap((f) => f.importedStateWrites);
  };

  it('flags a .set() on a hand-rolled Map exported from $lib/server', async () => {
    // The gap this arbitration exists to close: one shared Map, overwritten per request.
    expect(
      await writes({
        'src/lib/server/store.ts': 'export const db = new Map();',
        'src/routes/+page.server.ts': handler('$lib/server/store', "db.set('user', locals.user)")
      })
    ).toEqual([{ name: 'db', line: 3, via: 'set-call' }]);
  });

  it('leaves an export that is not an in-memory container exempt', async () => {
    expect(
      await writes({
        'src/lib/server/store.ts': "import { drizzle } from 'drizzle-orm';\nexport const db = drizzle(url);",
        'src/routes/+page.server.ts': handler('$lib/server/store', "db.set('user', locals.user)")
      })
    ).toEqual([]);
  });

  it("leaves an object of the module's own functions exempt, but not one that also holds data", async () => {
    const store = (obj: string) =>
      `function get(k) { return read(k); }\nasync function set(k, v) { await write(k, v); }\nexport const data = ${obj};`;
    const page = { 'src/routes/+page.server.ts': handler('$lib/server/data', "data.set('user', locals.user)") };
    expect(await writes({ 'src/lib/server/data.ts': store('{ get, set, remove: () => {} }'), ...page })).toEqual([]);
    expect(await writes({ 'src/lib/server/data.ts': store('{ get, set, items: [] }'), ...page })).toEqual([
      { name: 'data', line: 3, via: 'set-call' }
    ]);
  });

  it('resolves the exported name through an aliased import', async () => {
    const facts = await collectKitModuleFacts(
      createMemoryRuntime({
        'src/lib/server/store.ts': 'export const cache = new Map();',
        'src/routes/+page.server.ts':
          "import { cache as c } from '$lib/server/store';\nexport function load({ locals }) {\n  c.set('u', locals.user);\n}"
      }),
      ''
    );
    expect(facts.flatMap((f) => f.importedStateWrites)).toEqual([{ name: 'c', line: 3, via: 'set-call' }]);
  });

  it('accepts object and array literals, and the index form of the module path', async () => {
    expect(
      await writes({
        'src/lib/server/store/index.ts': 'export const bag = {};',
        'src/routes/+page.server.ts': handler('$lib/server/store', "bag.set('u', 1)")
      })
    ).toHaveLength(1);
  });

  it('leaves an object literal composed from spreads exempt', async () => {
    const facade =
      "import * as stores from './Stores';\nimport prisma from './prisma';\nconst models = { user: prisma.user };\nexport const DatabaseWrites = { ...models, ...{ stores } };";
    expect(
      await writes({
        'src/lib/server/database/index.ts': facade,
        'src/routes/+page.server.ts': handler('$lib/server/database', 'DatabaseWrites.stores.update(1, locals.user)')
      })
    ).toEqual([]);
  });

  it('still flags a spread literal that holds its own container', async () => {
    expect(
      await writes({
        'src/lib/server/store.ts': 'export const state = { ...defaults, hits: new Map() };',
        'src/routes/+page.server.ts': handler('$lib/server/store', "state.hits.set('u', locals.user)")
      })
    ).toEqual([{ name: 'state', line: 3, via: 'set-call' }]);
  });

  it('follows a NodeNext `.js` specifier to the `.ts` source', async () => {
    expect(
      await writes({
        'src/lib/server/store.ts': 'export const db = new Map();',
        'src/routes/+page.server.ts': handler('$lib/server/store.js', "db.set('u', 1)")
      })
    ).toHaveLength(1);
  });

  it('stays exempt when the target module cannot be found or read', async () => {
    // Unresolvable means unarbitrated: silence beats a false positive in a default-on rule.
    expect(await writes({ 'src/routes/+page.server.ts': handler('$lib/server/missing', "db.set('u', 1)") })).toEqual(
      []
    );
  });

  it('reads only the modules a handler actually writes to', async () => {
    const reads: string[] = [];
    const base = createMemoryRuntime({
      'src/lib/server/used.ts': 'export const db = new Map();',
      'src/lib/server/unused.ts': 'export const other = new Map();',
      'src/routes/+page.server.ts': handler('$lib/server/used', "db.set('u', 1)")
    });
    const rt: Runtime = { ...base, readFile: (p) => (reads.push(p), base.readFile(p)) };
    await collectKitModuleFacts(rt, '');
    expect(reads).not.toContain('src/lib/server/unused.ts');
  });
});

describe('collectKitModuleFacts', () => {
  it('collects route server/universal files, +server endpoints, and hooks with kinds', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.server.ts': 'let user;\nexport function load() {\n  user = 1;\n}',
      'src/routes/about/+page.ts': 'export const load = () => ({});',
      'src/routes/api/+server.js': 'export function GET() {}',
      'src/hooks.server.ts': 'export const handle = ({ event, resolve }) => resolve(event);',
      'src/routes/+page.svelte': '<p>not collected</p>',
      'src/lib/server/db.ts': 'let conn;\nexport function get() {\n  conn = 1;\n}'
    });
    const facts = await collectKitModuleFacts(rt, '');
    expect(facts.map((f) => [f.file, f.kind])).toEqual([
      ['src/hooks.server.ts', 'server'],
      ['src/routes/+page.server.ts', 'server'],
      ['src/routes/about/+page.ts', 'universal'],
      ['src/routes/api/+server.js', 'server']
    ]);
    expect(facts[1]!.moduleStateReassignments).toEqual([{ name: 'user', line: 3, inHandler: true }]);
  });
  it('marks a file it could not read as readFailed, not merely parseFailed', async () => {
    const rt = createMemoryRuntime(
      {
        'src/routes/+page.server.ts': 'let x;',
        'src/routes/about/+page.ts': 'export const load = () => ({});'
      },
      new Set(['src/routes/+page.server.ts'])
    );
    const facts = await collectKitModuleFacts(rt, '');
    const byFile = new Map(facts.map((f) => [f.file, f]));
    expect(byFile.get('src/routes/+page.server.ts')).toEqual({
      ...emptyKitModuleFacts('src/routes/+page.server.ts', 'server'),
      parseFailed: true,
      readFailed: true
    });
    expect(byFile.get('src/routes/about/+page.ts')!.parseFailed).toBeUndefined();
  });
});

describe('collectKitModuleFacts — alias list', () => {
  it('passes the alias list through to the parser', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.server.ts': `import { s } from '$a/store.svelte';\n`
    });
    const withList = await collectKitModuleFacts(rt, '', [
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '$a', replacement: 'src/a', match: 'prefix' }
    ]);
    const without = await collectKitModuleFacts(rt, '');
    expect(withList[0]!.runesModuleImports.map((i) => i.resolved)).toEqual(['src/a/store.svelte.ts']);
    expect(without[0]!.runesModuleImports).toEqual([]);
  });
});

describe('collectKitModuleFacts — persistence clients outside $lib/server', () => {
  const writes = async (store: string) => {
    const facts = await collectKitModuleFacts(
      createMemoryRuntime({
        'src/lib/services/kv.ts': store,
        'src/routes/api/+server.ts':
          "import { kv } from '$lib/services/kv';\nexport async function PATCH({ request }) {\n  await kv.set('k', await request.json());\n}"
      }),
      ''
    );
    return facts.flatMap((f) => f.importedStateWrites);
  };

  it('drops a write through a class instance or a package client', async () => {
    expect(await writes('class Kv {}\nexport const kv = new Kv();')).toEqual([]);
    expect(await writes("import { createClient } from 'redis';\nexport const kv = createClient();")).toEqual([]);
  });

  it('keeps a write to a container subclass, a class holding a container, or a factory behind a kit alias', async () => {
    const kept = [{ name: 'kv', line: 3, via: 'set-call' }];
    expect(await writes('class Kv extends Map {}\nexport const kv = new Kv();')).toEqual(kept);
    expect(await writes('class Kv { cache = new Map(); }\nexport const kv = new Kv();')).toEqual(kept);
    expect(await writes('class Kv { constructor() { this.cache = new Set(); } }\nexport const kv = new Kv();')).toEqual(
      kept
    );
    const facts = await collectKitModuleFacts(
      createMemoryRuntime({
        'src/lib/services/kv.ts': "import { make } from '@app/factory';\nexport const kv = make();",
        'src/routes/api/+server.ts':
          "import { kv } from '$lib/services/kv';\nexport async function PATCH() {\n  kv.set('k', 1);\n}"
      }),
      '',
      [
        { find: '$lib', replacement: 'src/lib', match: 'prefix' },
        { find: '@app', replacement: 'src/app', match: 'prefix' }
      ]
    );
    expect(facts.flatMap((f) => f.importedStateWrites)).toEqual(kept);
  });

  it('keeps a write to a store, a container, a local factory or a module it cannot read', async () => {
    const kept = [{ name: 'kv', line: 3, via: 'set-call' }];
    expect(await writes("import { writable } from 'svelte/store';\nexport const kv = writable({});")).toEqual(kept);
    expect(await writes('export const kv = new Map();')).toEqual(kept);
    expect(await writes('function make() { return new Map(); }\nexport const kv = make();')).toEqual(kept);
    const facts = await collectKitModuleFacts(
      createMemoryRuntime({
        'src/routes/api/+server.ts':
          "import { kv } from '$lib/services/kv';\nexport async function PATCH() {\n  kv.set('k', 1);\n}"
      }),
      ''
    );
    expect(facts.flatMap((f) => f.importedStateWrites)).toEqual(kept);
  });
});

describe('collectKitModuleFacts — a load guarded by an imported flag', () => {
  const never = async (config: string, guard = 'if (!FLAG) redirect(302, "/");', imp = 'FLAG') => {
    const facts = await collectKitModuleFacts(
      createMemoryRuntime({
        'src/lib/config.ts': config,
        'src/routes/x/+page.server.ts': `import { redirect } from '@sveltejs/kit';\nimport { ${imp} } from '$lib/config';\nexport async function load() {\n  ${guard}\n  return {};\n}`
      }),
      ''
    );
    return facts.find((f) => f.file === 'src/routes/x/+page.server.ts')?.loadNeverRenders;
  };

  it('never renders when the flag is the literal false, plain or as a member of an object literal', async () => {
    expect(await never('export const FLAG = false;')).toBe(true);
    expect(await never('export const FLAG = false as const;')).toBe(true);
    expect(
      await never(
        'export const FEATURES = { DEBATE: false } as const;',
        'if (!FEATURES.DEBATE) redirect(302, "/");',
        'FEATURES'
      )
    ).toBe(true);
  });

  it('renders when the flag may be true, or the module cannot be read', async () => {
    expect(await never('export const FLAG = true;')).toBeUndefined();
    expect(await never('export let FLAG = false;')).toBeUndefined();
    expect(await never('export const FLAG = import.meta.env.DEV;')).toBeUndefined();
    expect(await never('export const OTHER = false;')).toBeUndefined();
    expect(
      await never(
        'export const FEATURES = { DEBATE: false, ...env };',
        'if (!FEATURES.DEBATE) redirect(302, "/");',
        'FEATURES'
      )
    ).toBeUndefined();
    expect(
      await never(
        'export const FEATURES = { DEBATE: false, DEBATE: true };',
        'if (!FEATURES.DEBATE) redirect(302, "/");',
        'FEATURES'
      )
    ).toBeUndefined();
  });

  it('reads a flag the load shadows as its own binding, not the import', async () => {
    const facts = await collectKitModuleFacts(
      createMemoryRuntime({
        'src/lib/config.ts': 'export const FLAG = false;',
        'src/routes/x/+page.server.ts':
          "import { redirect } from '@sveltejs/kit';\nimport { FLAG } from '$lib/config';\nexport async function load({ url }) {\n  const FLAG = url.searchParams.has('beta');\n  if (!FLAG) redirect(302, '/');\n  return {};\n}"
      }),
      ''
    );
    expect(facts.find((f) => f.file === 'src/routes/x/+page.server.ts')?.loadNeverRenders).toBeUndefined();
  });
});
