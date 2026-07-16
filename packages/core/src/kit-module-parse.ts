import {
  parseModuleProgram,
  collectSuppressions,
  unwrapExport,
  addBoundNames,
  scopeIntroducedNames,
  WALK_IGNORED_KEYS
} from './component-parse.js';
import { lineOf } from './svelte-ast.js';
import type { KitModuleFacts } from './kit-module.js';

// Same pragmatic typing stance as component-parse.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/** Exported names whose function bodies run on the server per request (SvelteKit's contract). */
const HANDLER_NAMES = new Set([
  'load',
  'handle',
  'handleFetch',
  'handleError',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'fallback'
]);

/** Unwrap TS wrapper expressions (`x satisfies T`, `x as T`) to the underlying expression. */
function unwrapTs(expr: Node): Node {
  let cur = expr;
  while (cur?.type === 'TSSatisfiesExpression' || cur?.type === 'TSAsExpression') cur = cur.expression;
  return cur;
}

function isFunctionNode(n: Node): boolean {
  return n?.type === 'FunctionDeclaration' || n?.type === 'FunctionExpression' || n?.type === 'ArrowFunctionExpression';
}

/**
 * The function nodes of this file's server-executed entry points: exported
 * `load`/HTTP-method/hooks handlers (function or arrow, `satisfies` unwrapped) and
 * every member of `export const actions = { … }`. A handler assigned a non-function
 * expression (e.g. `export const handle = sequence(...)`) is skipped — conservative.
 */
function collectHandlerFunctions(program: Node): Set<Node> {
  const handlers = new Set<Node>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue;
    const decl = stmt.declaration;
    if (decl.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier' && HANDLER_NAMES.has(decl.id.name)) {
      handlers.add(decl);
      continue;
    }
    if (decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || !d.init) continue;
      const init = unwrapTs(d.init);
      if (HANDLER_NAMES.has(d.id.name) && isFunctionNode(init)) {
        handlers.add(init);
      } else if (d.id.name === 'actions' && init?.type === 'ObjectExpression') {
        for (const p of init.properties ?? []) {
          if (p?.type !== 'Property') continue;
          const v = unwrapTs(p.value);
          if (isFunctionNode(v)) handlers.add(v);
        }
      }
    }
  }
  return handlers;
}

/**
 * Walk the whole program threading (1) shadowed names (like component-parse's
 * `walkScoped`), (2) whether the CURRENT node sits inside any function body, and
 * (3) whether that function chain includes a server handler. Class bodies count as
 * function depth — their methods run when called, not at module evaluation.
 */
function walkKit(
  node: Node,
  handlerFns: Set<Node>,
  visit: (n: Node, shadowed: Set<string>, inFunction: boolean, inHandler: boolean) => void,
  shadowed: Set<string> = new Set(),
  inFunction = false,
  inHandler = false
): void {
  if (Array.isArray(node)) {
    for (const child of node) walkKit(child, handlerFns, visit, shadowed, inFunction, inHandler);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;

  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  const isBoundary = isFunctionNode(node) || node.type === 'ClassDeclaration' || node.type === 'ClassExpression';
  const nextInFunction = inFunction || isBoundary;
  const nextInHandler = inHandler || handlerFns.has(node);

  visit(node, scope, inFunction, inHandler);
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    walkKit(node[key], handlerFns, visit, scope, nextInFunction, nextInHandler);
  }
}

/**
 * Parse one SvelteKit route/hooks file's SSR shared-state facts (SEC003–005). Uses
 * the shared wrap parser (`parseModuleProgram`), so reported lines subtract the
 * 1-line wrap prefix; suppressions are scanned on the unwrapped source.
 */
export function parseKitModuleFacts(source: string, filename: string): Omit<KitModuleFacts, 'file' | 'kind'> {
  const suppressions = collectSuppressions(source);
  const { program, wrapped } = parseModuleProgram(source, filename);
  const moduleStateReassignments: KitModuleFacts['moduleStateReassignments'] = [];
  const importedStateWrites: KitModuleFacts['importedStateWrites'] = [];
  const importedStateWritesOutsideHandlers: KitModuleFacts['importedStateWritesOutsideHandlers'] = [];
  const runesModuleImports: KitModuleFacts['runesModuleImports'] = [];
  if (!program) {
    return {
      moduleStateReassignments,
      importedStateWrites,
      importedStateWritesOutsideHandlers,
      runesModuleImports,
      suppressions
    };
  }
  const line = (start: number) => Math.max(0, lineOf(wrapped, start) - 1);

  // Module-scope let/var bindings (top-level, export-unwrapped) — SEC004's targets.
  const moduleLets = new Set<string>();
  for (const stmt of program.body ?? []) {
    const decl = unwrapExport(stmt);
    if (decl?.type === 'VariableDeclaration' && (decl.kind === 'let' || decl.kind === 'var')) {
      for (const d of decl.declarations ?? []) addBoundNames(d?.id, moduleLets);
    }
  }

  const handlerFns = collectHandlerFunctions(program);
  walkKit(program, handlerFns, (n, shadowed, inFunction, inHandler) => {
    if (!inFunction) return; // top-level reassignment is initialisation, not shared-state mutation
    const flagLet = (name: string | undefined) => {
      if (name && !shadowed.has(name) && moduleLets.has(name)) {
        moduleStateReassignments.push({ name, line: line(n.start), inHandler });
      }
    };
    if (n.type === 'AssignmentExpression') {
      if (n.left?.type === 'Identifier') flagLet(n.left.name);
      else if (n.left?.type === 'ObjectPattern' || n.left?.type === 'ArrayPattern') {
        const bound = new Set<string>();
        addBoundNames(n.left, bound);
        for (const b of bound) flagLet(b);
      }
    } else if (n.type === 'UpdateExpression' && n.argument?.type === 'Identifier') {
      flagLet(n.argument.name);
    }
  });

  return {
    moduleStateReassignments,
    importedStateWrites,
    importedStateWritesOutsideHandlers,
    runesModuleImports,
    suppressions
  };
}
