import type { Expression, Node, Pattern, Program, VariableDeclarator } from 'estree';
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
 * What a component local may hold: an identifier (`''`: anything else), or a module a function
 * body loads with `import()` — mounted only in the browser, after that function runs.
 */
export type ComponentCandidate = string | ImportInfo;

/** The literal specifier of `import('<literal>')`, awaited or not. */
function importSpec(expr: Node | null | undefined): string | undefined {
  const e = expr?.type === 'AwaitExpression' ? expr.argument : expr;
  return e?.type === 'ImportExpression' && e.source.type === 'Literal' && typeof e.source.value === 'string'
    ? e.source.value
    : undefined;
}

/** `import()` results held in locals: whole modules (`const m = await import(…)`, `Promise.all`) and destructured exports. */
interface DynamicLocals {
  modules: Map<string, string>;
  exports: Map<string, ImportInfo>;
}

function addDynamicLocals(id: Pattern, init: Expression | null | undefined, out: DynamicLocals): void {
  const spec = importSpec(init);
  if (id.type === 'Identifier' && spec) out.modules.set(id.name, spec);
  else if (id.type === 'ObjectPattern' && spec) {
    for (const p of id.properties) {
      if (p.type !== 'Property' || p.computed || p.value.type !== 'Identifier') continue;
      const key = p.key.type === 'Identifier' ? p.key.name : p.key.type === 'Literal' ? String(p.key.value) : undefined;
      if (key) out.exports.set(p.value.name, { source: spec, imported: key });
    }
  } else if (id.type === 'ArrayPattern' && init?.type === 'AwaitExpression') {
    const call = init.argument;
    const isAll =
      call.type === 'CallExpression' &&
      call.callee.type === 'MemberExpression' &&
      call.callee.object.type === 'Identifier' &&
      call.callee.object.name === 'Promise' &&
      call.callee.property.type === 'Identifier' &&
      call.callee.property.name === 'all' &&
      call.arguments[0]?.type === 'ArrayExpression';
    if (!isAll) return;
    const elements = (call.arguments[0] as { elements: (Node | null)[] }).elements;
    id.elements.forEach((el, i) => {
      const s = importSpec(elements[i]);
      if (el?.type === 'Identifier' && s) out.modules.set(el.name, s);
    });
  }
}

/** The export an assigned value names: `(await import(…)).X`, `m.X` for an `import()` module local, or a destructured export. */
function dynamicExport(expr: Expression, locals: DynamicLocals): ImportInfo | undefined {
  if (expr.type === 'Identifier') return locals.exports.get(expr.name);
  if (expr.type !== 'MemberExpression' || expr.computed || expr.property.type !== 'Identifier') return undefined;
  const spec = expr.object.type === 'Identifier' ? locals.modules.get(expr.object.name) : importSpec(expr.object);
  return spec ? { source: spec, imported: expr.property.name } : undefined;
}

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** Every node under `node` (scripts and template alike), with whether it sits inside a function body. */
function walkAll(node: unknown, visit: (n: Node, inFunction: boolean) => void, inFunction = false): void {
  if (Array.isArray(node)) {
    for (const child of node) walkAll(child, visit, inFunction);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const n = node as Node & Record<string, unknown>;
  if (typeof n.type === 'string') visit(n, inFunction);
  const inner = inFunction || FUNCTION_TYPES.has(n.type);
  for (const key of Object.keys(n)) {
    if (key !== 'metadata' && key !== 'parent' && key !== 'loc') walkAll(n[key], visit, inner);
  }
}

/**
 * Top-level `let`s (`$state`) a function assigns a component loaded with `import()` —
 * `onMount(async () => { C = (await import('./C.svelte')).default })`. Every other value they may
 * hold counts as `''`, since a `let` is runtime state.
 */
function addDynamicBindings(ast: AST.Root, out: Map<string, ComponentCandidate[]>): void {
  const lets = new Set<string>();
  for (const node of ast.instance?.content.body ?? []) {
    if (node.type !== 'VariableDeclaration' || node.kind !== 'let') continue;
    for (const decl of node.declarations) if (decl.id.type === 'Identifier') lets.add(decl.id.name);
  }
  if (lets.size === 0) return;
  const roots = [ast.instance?.content, ast.fragment];
  const locals: DynamicLocals = { modules: new Map(), exports: new Map() };
  walkAll(roots, (n) => {
    if (n.type === 'VariableDeclarator') addDynamicLocals(n.id, n.init, locals);
  });
  const found = new Map<string, ComponentCandidate[]>();
  walkAll(roots, (n, inFunction) => {
    if (n.type !== 'AssignmentExpression' || n.operator !== '=' || n.left.type !== 'Identifier') return;
    if (!lets.has(n.left.name)) return;
    const loaded = inFunction ? dynamicExport(n.right, locals) : undefined;
    const list = found.get(n.left.name) ?? [''];
    found.set(n.left.name, [...list, ...(loaded ? [loaded] : candidatesOf(n.right))]);
  });
  for (const [name, candidates] of found) {
    if (candidates.some((c) => typeof c !== 'string')) out.set(name, candidates);
  }
}

/**
 * Locals that hold a component chosen at runtime — `const C = $derived(cond ? A : B)`, a plain
 * `const`, `{@const C = …}`, or a `let` a function fills from `import()` — mapped to what they
 * can hold. Any other `let` is not followed: it can be reassigned to a component this cannot see.
 */
export function collectComponentBindings(ast: AST.Root): Map<string, ComponentCandidate[]> {
  const out = new Map<string, string[]>();
  for (const program of [ast.instance?.content, ast.module?.content]) {
    for (const node of program?.body ?? []) {
      if (node.type !== 'VariableDeclaration' || node.kind !== 'const') continue;
      for (const decl of node.declarations) addBinding(decl, out);
    }
  }
  addConstTags(ast.fragment, out);
  for (const [name, candidates] of out) if (candidates.every((c) => c === '')) out.delete(name);
  const bindings = new Map<string, ComponentCandidate[]>(out);
  addDynamicBindings(ast, bindings);
  return bindings;
}
