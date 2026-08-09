import { parseInMemoryExports, parseKitModuleFacts } from './kit-module-parse.js';
import type { KitModuleFacts } from './kit-module.js';
import type { Runtime } from './runtime.js';
import type { KitAlias } from './types.js';

/** Fallback facts for a Kit file that fails to read or parse (dev tooling must never throw). */
export function emptyKitModuleFacts(file: string, kind: KitModuleFacts['kind']): KitModuleFacts {
  return {
    file,
    kind,
    moduleStateReassignments: [],
    importedStateWrites: [],
    importedStateWritesOutsideHandlers: [],
    pendingServerStoreWrites: [],
    runesModuleImports: [],
    lifecycleCalls: [],
    browserGlobalRefs: [],
    basePathLinks: [],
    suppressions: []
  };
}

/** 'server' when the file only ever runs on the server; 'universal' for +page.ts/+layout.ts. */
function kindOf(file: string): KitModuleFacts['kind'] {
  const base = file.split('/').pop() ?? file;
  return base.includes('.server.') || base.startsWith('+server.') ? 'server' : 'universal';
}

/**
 * Scan SvelteKit route/hooks files for SSR shared-state facts (the security kit-module rules): route
 * `+page`/`+layout` server and universal modules, `+server` endpoints, and
 * `src/hooks.server`. `src/lib/server/**` is deliberately NOT scanned — legitimate
 * module singletons (DB connections, clients) live there (design). A file that
 * fails to read or parse contributes empty facts instead of aborting the scan.
 *
 * `aliases` is the project's compiled alias list (`Project.kitAliases`); omitted,
 * specifiers resolve through `$lib` → `src/lib` only.
 */
export async function collectKitModuleFacts(
  rt: Runtime,
  cwd: string,
  aliases?: readonly KitAlias[]
): Promise<KitModuleFacts[]> {
  const patterns = [
    'src/routes/**/+{page,layout}.server.{ts,js}',
    'src/routes/**/+{page,layout}.{ts,js}',
    'src/routes/**/+server.{ts,js}',
    'src/hooks.server.{ts,js}'
  ];
  const lists = await Promise.all(patterns.map((p) => rt.glob(p, cwd)));
  const files = [...new Set(lists.flat())];
  const facts = await Promise.all(
    files.sort().map(async (rel): Promise<KitModuleFacts> => {
      const kind = kindOf(rel);
      try {
        const source = await rt.readFile(rt.join(cwd, rel));
        return { file: rel, kind, ...parseKitModuleFacts(source, rel, aliases) };
      } catch {
        return { ...emptyKitModuleFacts(rel, kind), parseFailed: true };
      }
    })
  );
  return arbitrateServerStoreWrites(rt, cwd, facts);
}

/**
 * The files a resolved specifier may name, in resolution order. An extensionless path takes an
 * extension or an index file; a path that already ends in `.js` is checked as written and then
 * remapped to `.ts`, which is how a NodeNext/ESM TypeScript project spells an import of its own
 * `.ts` source (`from '$lib/server/store.js'` -> `src/lib/server/store.ts`).
 */
function moduleCandidates(repoPath: string): string[] {
  if (repoPath.endsWith('.js')) return [repoPath, `${repoPath.slice(0, -3)}.ts`];
  if (repoPath.endsWith('.ts')) return [repoPath];
  return [`${repoPath}.ts`, `${repoPath}.js`, `${repoPath}/index.ts`, `${repoPath}/index.js`];
}

/**
 * Read the module a pending write targets and return the names it exports as an in-memory
 * container. Returns an empty set when the file cannot be found or read: unresolvable means
 * unarbitrated, which leaves the write exempt.
 */
async function inMemoryExportsOf(rt: Runtime, cwd: string, repoPath: string): Promise<ReadonlySet<string>> {
  for (const rel of moduleCandidates(repoPath)) {
    try {
      if (!(await rt.exists(rt.join(cwd, rel)))) continue;
      return parseInMemoryExports(await rt.readFile(rt.join(cwd, rel)), rel);
    } catch {
      return new Set();
    }
  }
  return new Set();
}

/**
 * Decide the `.set()`/`.update()` calls the parse could not: a call on a binding exported from
 * under the `$lib` server root is shared module state when that binding is an in-memory
 * container, and persistence when it is anything else. Only the modules actually targeted are
 * read, so a project whose handlers never write to `$lib/server` pays nothing.
 */
async function arbitrateServerStoreWrites(
  rt: Runtime,
  cwd: string,
  facts: KitModuleFacts[]
): Promise<KitModuleFacts[]> {
  const targets = [...new Set(facts.flatMap((f) => f.pendingServerStoreWrites.map((w) => w.resolved)))];
  if (targets.length === 0) return facts;
  const byPath = new Map(
    await Promise.all(targets.map(async (t) => [t, await inMemoryExportsOf(rt, cwd, t)] as const))
  );
  return facts.map((f) => {
    const promoted = f.pendingServerStoreWrites
      .filter((w) => byPath.get(w.resolved)?.has(w.imported))
      .map((w) => ({ name: w.name, line: w.line, via: 'set-call' as const }));
    if (promoted.length === 0) return f;
    return {
      ...f,
      importedStateWrites: [...f.importedStateWrites, ...promoted].sort((a, b) => a.line - b.line)
    };
  });
}
