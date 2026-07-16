import {
  parseModuleProgram,
  collectSuppressions,
  unwrapExport,
  addBoundNames,
  scopeIntroducedNames,
  rootObjectName,
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
 * The function nodes of this file's SvelteKit startup hooks: exported `init`
 * (function or arrow, `satisfies` unwrapped). Kit calls `init` once at server
 * startup — semantically top-level initialisation, not a per-request handler, so
 * SEC004 should not flag assignments inside it.
 */
function collectStartupFunctions(program: Node): Set<Node> {
  const startup = new Set<Node>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue;
    const decl = stmt.declaration;
    if (decl.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier' && decl.id.name === 'init') {
      startup.add(decl);
      continue;
    }
    if (decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || !d.init) continue;
      const init = unwrapTs(d.init);
      if (d.id.name === 'init' && isFunctionNode(init)) startup.add(init);
    }
  }
  return startup;
}

/**
 * Walk the whole program threading (1) shadowed names (like component-parse's
 * `walkScoped`), (2) whether the CURRENT node sits inside any function body, (3)
 * whether that function chain includes a server handler, and (4) whether it
 * includes the `init` startup hook. Class bodies count as function depth — their
 * methods run when called, not at module evaluation.
 */
function walkKit(
  node: Node,
  handlerFns: Set<Node>,
  startupFns: Set<Node>,
  visit: (n: Node, shadowed: Set<string>, inFunction: boolean, inHandler: boolean, inStartup: boolean) => void,
  shadowed: Set<string> = new Set(),
  inFunction = false,
  inHandler = false,
  inStartup = false
): void {
  if (Array.isArray(node)) {
    for (const child of node) walkKit(child, handlerFns, startupFns, visit, shadowed, inFunction, inHandler, inStartup);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;

  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  const isBoundary = isFunctionNode(node) || node.type === 'ClassDeclaration' || node.type === 'ClassExpression';
  const nextInFunction = inFunction || isBoundary;
  const nextInHandler = inHandler || handlerFns.has(node);
  const nextInStartup = inStartup || startupFns.has(node);

  visit(node, scope, inFunction, inHandler, inStartup);
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    walkKit(node[key], handlerFns, startupFns, visit, scope, nextInFunction, nextInHandler, nextInStartup);
  }
}

/** Normalize a posix path, resolving `.` and `..` segments — string-only, no I/O. */
function normalizePosix(path: string): string {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

/**
 * Resolve an import specifier to a repo-relative `.svelte.ts`/`.svelte.js` path, or
 * undefined when it cannot be a runes module: `$lib/` maps to `src/lib/`, `./`/`../`
 * resolve against the importing file's directory; bare packages and other aliases are
 * skipped. An extensionless `…/x.svelte` specifier canonicalises to `….svelte.ts`
 * (SEC005 also tries the `.js` sibling when matching).
 */
export function resolveRunesModuleSpecifier(spec: string, importerFile: string): string | undefined {
  let path: string;
  if (spec.startsWith('$lib/')) path = `src/lib/${spec.slice('$lib/'.length)}`;
  else if (spec.startsWith('./') || spec.startsWith('../')) {
    const dir = importerFile.split('/').slice(0, -1).join('/');
    path = `${dir}/${spec}`;
  } else return undefined;
  path = normalizePosix(path);
  if (/\.svelte\.(ts|js)$/.test(path)) return path;
  if (path.endsWith('.svelte')) return `${path}.ts`;
  return undefined;
}

/**
 * Whether an import specifier points at repo-local module state that would be
 * SHARED on the server: relative or `$lib/` — but not `$lib/server/**`, where
 * legitimate singletons (DB connections, KV/API clients) live. Installed packages
 * (drizzle, redis, @vercel/kv, …) are excluded: `.set()`/`.update()` on those is
 * persistence, not shared-module-state mutation.
 */
function isLocalStateSpecifier(spec: string): boolean {
  if (spec.startsWith('./') || spec.startsWith('../')) return true;
  return spec.startsWith('$lib/') && !spec.startsWith('$lib/server/');
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

  // Imported value bindings (type-only skipped): local name → raw specifier, plus
  // the subset whose specifier resolves to a repo-local runes module (SEC005).
  const importedSpecifiers = new Map<string, string>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ImportDeclaration' || stmt.importKind === 'type') continue;
    const spec = typeof stmt.source?.value === 'string' ? stmt.source.value : '';
    const names: string[] = [];
    for (const s of stmt.specifiers ?? []) {
      if (s?.importKind === 'type' || s?.local?.type !== 'Identifier') continue;
      names.push(s.local.name);
      importedSpecifiers.set(s.local.name, spec);
    }
    if (names.length === 0) continue;
    const resolved = resolveRunesModuleSpecifier(spec, filename);
    if (resolved) runesModuleImports.push({ source: spec, resolved, names, line: line(stmt.start) });
  }

  // Module-scope let/var bindings (top-level, export-unwrapped) — SEC004's targets.
  const moduleLets = new Set<string>();
  for (const stmt of program.body ?? []) {
    const decl = unwrapExport(stmt);
    if (decl?.type === 'VariableDeclaration' && (decl.kind === 'let' || decl.kind === 'var')) {
      for (const d of decl.declarations ?? []) addBoundNames(d?.id, moduleLets);
    }
  }

  const handlerFns = collectHandlerFunctions(program);
  const startupFns = collectStartupFunctions(program);
  walkKit(program, handlerFns, startupFns, (n, shadowed, inFunction, inHandler, inStartup) => {
    if (inFunction && !inStartup) {
      // SEC004 — module-scope let/var reassigned from inside a function body.
      // Top-level reassignment is initialisation, not shared-state mutation;
      // assignment from inside Kit's `init` startup hook is likewise
      // initialisation, not exempted for SEC003/SEC005 write detection below.
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
    }

    // SEC003 / SEC005 — a write whose root binding is an import.
    let write: { name: string; via: 'assignment' | 'set-call' } | undefined;
    const importedRoot = (expr: Node): string | undefined => {
      const r = rootObjectName(expr);
      return r && !shadowed.has(r) && importedSpecifiers.has(r) ? r : undefined;
    };
    if (n.type === 'AssignmentExpression' && n.left?.type === 'MemberExpression') {
      const r = importedRoot(n.left);
      if (r) write = { name: r, via: 'assignment' };
    } else if (n.type === 'UpdateExpression' && n.argument?.type === 'MemberExpression') {
      const r = importedRoot(n.argument);
      if (r) write = { name: r, via: 'assignment' };
    } else if (n.type === 'UnaryExpression' && n.operator === 'delete') {
      const r = importedRoot(n.argument);
      if (r) write = { name: r, via: 'assignment' };
    } else if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression') {
      const method = n.callee.property?.type === 'Identifier' ? n.callee.property.name : undefined;
      if (method === 'set' || method === 'update') {
        const r = importedRoot(n.callee.object);
        if (r && isLocalStateSpecifier(importedSpecifiers.get(r)!)) write = { name: r, via: 'set-call' };
      }
    } else if (
      n.type === 'AssignmentExpression' &&
      (n.left?.type === 'ObjectPattern' || n.left?.type === 'ArrayPattern')
    ) {
      // Destructuring-assignment targets: `[state.x] = arr`, `({ a: state.y } = obj)`.
      // Only TARGET positions count — a computed key (`[state.key]:`) and a default
      // value (`= state.fallback`) are reads, not writes.
      const scanPatternTargets = (pat: Node): void => {
        if (!pat || write) return;
        if (pat.type === 'MemberExpression') {
          const r = importedRoot(pat);
          if (r) write = { name: r, via: 'assignment' };
        } else if (pat.type === 'ObjectPattern') {
          for (const p of pat.properties ?? []) {
            if (p?.type === 'Property') scanPatternTargets(p.value);
            else if (p?.type === 'RestElement') scanPatternTargets(p.argument);
          }
        } else if (pat.type === 'ArrayPattern') {
          for (const el of pat.elements ?? []) scanPatternTargets(el);
        } else if (pat.type === 'AssignmentPattern') {
          scanPatternTargets(pat.left);
        } else if (pat.type === 'RestElement') {
          scanPatternTargets(pat.argument);
        }
      };
      scanPatternTargets(n.left);
    }
    if (write) {
      if (inHandler) importedStateWrites.push({ ...write, line: line(n.start) });
      else importedStateWritesOutsideHandlers.push({ name: write.name, line: line(n.start) });
    }
  });

  const byLine = <T extends { line: number }>(arr: T[]): T[] => arr.sort((a, b) => a.line - b.line);

  return {
    moduleStateReassignments: byLine(moduleStateReassignments),
    importedStateWrites: byLine(importedStateWrites),
    importedStateWritesOutsideHandlers: byLine(importedStateWritesOutsideHandlers),
    runesModuleImports: byLine(runesModuleImports),
    suppressions
  };
}
