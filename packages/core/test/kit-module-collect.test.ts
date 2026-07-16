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
