/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/** A resolved import binding: which module, and which export ('default' for default imports). */
export interface ImportInfo {
  source: string;
  imported: string;
}

/** local identifier -> import binding. */
export type ImportMap = Map<string, ImportInfo>;

function addImportsFromProgram(program: Node, map: ImportMap): void {
  for (const node of program?.body ?? []) {
    if (node?.type !== 'ImportDeclaration') continue;
    const source = String(node.source?.value ?? '');
    for (const spec of node.specifiers ?? []) {
      const local = spec?.local?.name;
      if (!local) continue;
      if (spec.type === 'ImportDefaultSpecifier') {
        map.set(local, { source, imported: 'default' });
      } else if (spec.type === 'ImportSpecifier') {
        map.set(local, { source, imported: spec.imported?.name ?? local });
      }
    }
  }
}

/** Collect import bindings from both the instance and module `<script>` blocks. */
export function collectImports(ast: unknown): ImportMap {
  const root = ast as Node;
  const map: ImportMap = new Map();
  addImportsFromProgram(root?.instance?.content, map);
  addImportsFromProgram(root?.module?.content, map);
  return map;
}
