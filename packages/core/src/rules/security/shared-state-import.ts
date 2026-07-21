import { kitModuleRule, type KitModuleIssue } from '../kit-module-rule.js';

/** The `.svelte.ts` ↔ `.svelte.js` sibling of a resolved runes-module path. */
function extSibling(path: string): string {
  return path.endsWith('.svelte.ts')
    ? path.replace(/\.svelte\.ts$/, '.svelte.js')
    : path.replace(/\.svelte\.js$/, '.svelte.ts');
}

export const sec005SharedStateImport = kitModuleRule({
  id: 'security/shared-state-import',
  title: 'Shared runes-state import on the server',
  category: 'security',
  label: 'Server state imports',
  recommendation:
    'Keep module-scope $state out of server-executed code: return data from load and share it via page data or the context API. If the module is genuinely client-only, restructure so server files do not import it, or add an inline suppression.',
  rationale:
    'A .svelte.ts module with module-scope $state is one shared instance on the server: mutated, it leaks data between users; read-only, every request sees the same boot-time value instead of per-user data.',
  applies: (m) => m.runesModuleImports.length > 0,
  bad: (m, ctx) => {
    const stateFiles = new Set((ctx.components ?? []).filter((c) => c.moduleStateDecls.length > 0).map((c) => c.file));
    const writtenOutside = new Set(m.importedStateWritesOutsideHandlers.map((w) => w.name));
    const writtenInHandler = new Set(m.importedStateWrites.map((w) => w.name));
    const out: KitModuleIssue[] = [];
    for (const imp of m.runesModuleImports) {
      if (!stateFiles.has(imp.resolved) && !stateFiles.has(extSibling(imp.resolved))) continue;
      // A binding already reported (critical) by SEC003 is not double-reported here.
      const names = imp.names.filter((n) => !writtenInHandler.has(n));
      if (names.length === 0) continue;
      const mutates = names.some((n) => writtenOutside.has(n));
      out.push({
        line: imp.line,
        message: mutates
          ? `server-executed code mutates shared module state from "${imp.source}" — on the server it is one instance shared by every request`
          : `"${imp.source}" holds module-scope $state — on the server it is shared by every request and keeps its boot-time value (a leak if it ever holds per-user data)`
      });
    }
    return out;
  }
});
