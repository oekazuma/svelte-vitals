import type { Expression, Program, VariableDeclarator } from 'estree';
import type { AST } from 'svelte/compiler';
import { CHILD_NODE_KEYS } from '@svelte-vitals/core/internal';

/** A resolved import binding: which module, and which export ('default' for default imports, '*' for a namespace). */
export interface ImportInfo {
  source: string;
  imported: string;
}

/** local identifier -> import binding. */
export type ImportMap = Map<string, ImportInfo>;

export function addImportsFromProgram(program: Program | null | undefined, map: ImportMap): void {
  for (const node of program?.body ?? []) {
    if (node.type !== 'ImportDeclaration') continue;
    const source = String(node.source.value ?? '');
    for (const spec of node.specifiers) {
      const local = spec.local?.name;
      if (!local) continue;
      if (spec.type === 'ImportDefaultSpecifier') {
        map.set(local, { source, imported: 'default' });
      } else if (spec.type === 'ImportNamespaceSpecifier') {
        map.set(local, { source, imported: '*' });
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

/** The binding a component tag names: a plain import, or a member of a namespace import (`<Page.Title>`). */
export function importOf(imports: ImportMap, name: string): ImportInfo | undefined {
  const direct = imports.get(name);
  if (direct) return direct;
  const dot = name.indexOf('.');
  if (dot < 0) return undefined;
  const ns = imports.get(name.slice(0, dot));
  const member = name.slice(dot + 1);
  return ns?.imported === '*' && !member.includes('.') ? { source: ns.source, imported: member } : undefined;
}

/**
 * The identifiers a component expression can evaluate to (`cond ? A : B`, `a ?? B`), with `''`
 * standing for any other value — nothing rendered, or something not followed.
 */
function candidatesOf(expr: Expression): string[] {
  if (expr.type === 'Identifier') return expr.name === 'undefined' ? [''] : [expr.name];
  if (expr.type === 'ConditionalExpression') return [...candidatesOf(expr.consequent), ...candidatesOf(expr.alternate)];
  if (expr.type === 'LogicalExpression') {
    // `a && B` renders `a`'s falsy value when it does not render B.
    return [...(expr.operator === '&&' ? [''] : candidatesOf(expr.left)), ...candidatesOf(expr.right)];
  }
  return [''];
}

function addBinding(decl: VariableDeclarator, out: Map<string, string[]>): void {
  if (decl.id.type !== 'Identifier' || !decl.init) return;
  const init = decl.init;
  const derived =
    init.type === 'CallExpression' &&
    init.callee.type === 'Identifier' &&
    init.callee.name === '$derived' &&
    init.arguments.length === 1
      ? (init.arguments[0] as Expression)
      : init;
  // `{@const}` is block-scoped, so one name can hold a different component in each arm.
  out.set(decl.id.name, [...new Set([...(out.get(decl.id.name) ?? []), ...candidatesOf(derived)])]);
}

type TemplateNode = { type?: string; declaration?: AST.ConstTag['declaration'] } & Record<string, unknown>;

function addConstTags(node: unknown, out: Map<string, string[]>): void {
  if (Array.isArray(node)) {
    for (const child of node) addConstTags(child, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const n = node as TemplateNode;
  if (n.type === 'ConstTag' && n.declaration) addBinding(n.declaration.declarations[0], out);
  for (const key of CHILD_NODE_KEYS) if (key in n) addConstTags(n[key], out);
}

/**
 * Locals that hold a component chosen at runtime — `const C = $derived(cond ? A : B)`, a plain
 * `const`, or `{@const C = …}` — mapped to the identifiers they can hold (`''`: anything else).
 * Only `const`: a `let` can be reassigned to a component this cannot see.
 */
export function collectComponentBindings(ast: AST.Root): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const program of [ast.instance?.content, ast.module?.content]) {
    for (const node of program?.body ?? []) {
      if (node.type !== 'VariableDeclaration' || node.kind !== 'const') continue;
      for (const decl of node.declarations) addBinding(decl, out);
    }
  }
  addConstTags(ast.fragment, out);
  for (const [name, candidates] of out) if (candidates.every((c) => c === '')) out.delete(name);
  return out;
}
