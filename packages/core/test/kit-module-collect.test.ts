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
  it('falls back to empty facts when a file fails to read', async () => {
    const rt = createMemoryRuntime({ 'src/routes/+page.server.ts': 'let x;' }, new Set(['src/routes/+page.server.ts']));
    expect(await collectKitModuleFacts(rt, '')).toEqual([emptyKitModuleFacts('src/routes/+page.server.ts', 'server')]);
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
