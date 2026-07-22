import type { Program } from 'estree';
import type { AST } from 'svelte/compiler';

/** A resolved import binding: which module, and which export ('default' for default imports). */
export interface ImportInfo {
  source: string;
  imported: string;
}

/** local identifier -> import binding. */
export type ImportMap = Map<string, ImportInfo>;

function addImportsFromProgram(program: Program | null | undefined, map: ImportMap): void {
  for (const node of program?.body ?? []) {
    if (node.type !== 'ImportDeclaration') continue;
    const source = String(node.source.value ?? '');
    for (const spec of node.specifiers) {
      const local = spec.local?.name;
      if (!local) continue;
      if (spec.type === 'ImportDefaultSpecifier') {
        map.set(local, { source, imported: 'default' });
      } else if (spec.type === 'ImportSpecifier') {
        // `imported` is an Identifier (`.name`) for normal specifiers, or a string
        // Literal (`.value`) for string-literal specifiers (`import { 'a-b' as c }`).
        // Falling back to `local` would mislabel the latter (`c` instead of `a-b`).
        const imported = spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
        map.set(local, { source, imported: typeof imported === 'string' ? imported : local });
      }
    }
  }
}

/** Collect import bindings from both the instance and module `<script>` blocks. */
export function collectImports(ast: AST.Root): ImportMap {
  const map: ImportMap = new Map();
  addImportsFromProgram(ast.instance?.content, map);
  addImportsFromProgram(ast.module?.content, map);
  return map;
}
