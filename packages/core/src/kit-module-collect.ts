import { parseKitModuleFacts } from './kit-module-parse.js';
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
  return Promise.all(
    files.sort().map(async (rel): Promise<KitModuleFacts> => {
      const kind = kindOf(rel);
      try {
        const source = await rt.readFile(rt.join(cwd, rel));
        return { file: rel, kind, ...parseKitModuleFacts(source, rel, aliases) };
      } catch {
        return emptyKitModuleFacts(rel, kind);
      }
    })
  );
}
