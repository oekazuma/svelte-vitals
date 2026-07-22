import {
  parseModuleProgram,
  collectSuppressions,
  unwrapExport,
  unwrapTs,
  addBoundNames,
  scopeIntroducedNames,
  rootObjectName,
  WALK_IGNORED_KEYS,
  collectSvelteLifecycleImports,
  matchLifecycleCall,
  collectBrowserGlobalRefs,
  collectBrowserGuardImports,
  collectDerivedGuardBindings,
  collectProgramBindings
} from './component-parse.js';
import { lineOf } from './svelte-ast.js';
import type { KitModuleFacts } from './kit-module.js';

// Same pragmatic typing stance as component-parse.ts.
/* oxlint-disable @typescript-eslint/no-explicit-any */
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

function isFunctionNode(n: Node): boolean {
  return n?.type === 'FunctionDeclaration' || n?.type === 'FunctionExpression' || n?.type === 'ArrowFunctionExpression';
}

/**
 * Top-level local bindings resolvable to a value node: function declarations and
 * `const`/`let` declarators (init unwrapped through `satisfies`/`as`). Used to
 * resolve separate-statement alias exports (`const load = …; export { load };`,
 * `export { handler as GET };`) to the same handler/startup classification as
 * inline `export` declarations. Cross-file re-exports (`export { load } from …`)
 * stay unresolved — conservative, matching the design's direct-analysis scope.
 */
export function collectTopLevelBindings(program: Node): Map<string, Node> {
  const bindings = new Map<string, Node>();
  for (const stmt of program.body ?? []) {
    const decl = unwrapExport(stmt);
    if (decl?.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier') {
      bindings.set(decl.id.name, decl);
    } else if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations ?? []) {
        if (d?.id?.type === 'Identifier' && d.init) bindings.set(d.id.name, unwrapTs(d.init));
      }
    }
  }
  return bindings;
}

/** Add every function-valued member of an `export const actions = { … }` object to `handlers`. */
function addActionsMembers(obj: Node, handlers: Set<Node>): void {
  for (const p of obj.properties ?? []) {
    if (p?.type !== 'Property') continue;
    const v = unwrapTs(p.value);
    if (isFunctionNode(v)) handlers.add(v);
  }
}

/**
 * Iterate the module's named exports, calling `visit(name, value, anchor)` for
 * each: first inline `export` declarations (`export function f` yields the
 * declaration itself; `export const x = …` yields each declarator's TS-unwrapped
 * init), then same-file alias specifiers (`export { local as name }`) resolved
 * through `collectTopLevelBindings` — type-only exports and cross-file re-exports
 * are skipped. `anchor` is the node whose `start` carries the export's source
 * position (the declarator/declaration inline, the resolved node for aliases).
 * A visitor returning `true` stops the walk (first-match finders). Bindings are
 * built lazily, once, and only when an alias specifier actually resolves a pass.
 * Replaces the four hand-rolled copies that classified handlers, the `init`
 * hook, `ssr`/`csr` opt-outs, and the `load` function.
 */
function forEachNamedExport(
  program: Node,
  visit: (name: string, value: Node, anchor: Node) => boolean | undefined
): void {
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue;
    const decl = stmt.declaration;
    if (decl.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier') {
      if (visit(decl.id.name, decl, decl)) return;
      continue;
    }
    if (decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || !d.init) continue;
      if (visit(d.id.name, unwrapTs(d.init), d)) return;
    }
  }
  let bindings: Map<string, Node> | undefined;
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.specifiers || stmt.source || stmt.exportKind === 'type')
      continue;
    for (const s of stmt.specifiers) {
      if (s?.exportKind === 'type' || s?.exported?.type !== 'Identifier' || s?.local?.type !== 'Identifier') continue;
      bindings ??= collectTopLevelBindings(program);
      const resolved = bindings.get(s.local.name);
      if (resolved === undefined) continue;
      if (visit(s.exported.name, resolved, resolved)) return;
    }
  }
}

/**
 * The function nodes of this file's server-executed entry points: exported
 * `load`/HTTP-method/hooks handlers (function or arrow, `satisfies` unwrapped) and
 * every member of `export const actions = { … }`. A handler assigned a non-function
 * expression (e.g. `export const handle = sequence(...)`) is skipped — conservative.
 * Same-file alias exports (`export { load }`, `export { handler as GET }`, an
 * alias-exported `actions`) are resolved too; cross-file re-exports are not.
 */
function collectHandlerFunctions(program: Node): Set<Node> {
  const handlers = new Set<Node>();
  forEachNamedExport(program, (name, value) => {
    if (HANDLER_NAMES.has(name) && isFunctionNode(value)) handlers.add(value);
    else if (name === 'actions' && value?.type === 'ObjectExpression') addActionsMembers(value, handlers);
    return undefined;
  });
  return handlers;
}

/**
 * The function nodes of this file's SvelteKit startup hooks: exported `init`
 * (function or arrow, `satisfies` unwrapped). Kit calls `init` once at server
 * startup — semantically top-level initialisation, not a per-request handler, so
 * security/server-module-state should not flag assignments inside it. A same-file alias export
 * (`export { init }`) is resolved too; a cross-file re-export is not.
 */
function collectStartupFunctions(program: Node): Set<Node> {
  const startup = new Set<Node>();
  forEachNamedExport(program, (name, value) => {
    if (name === 'init' && isFunctionNode(value)) startup.add(value);
    return undefined;
  });
  return startup;
}

/**
 * The `export const ssr = false` / `export const csr = false` opt-out, when
 * present: inline form (`satisfies`/`as` unwrapped) or same-file alias export
 * (`const ssr = false; export { ssr };`). Returns the declaration's line in the
 * WRAPPED source (the caller applies the −1 shift). An `ssr = false` file never
 * runs on the server — correctness/server-browser-global skips its browser-global scan, and seo/ssr-disabled
 * reports the flag itself. A `csr = false` file never ships a client runtime —
 * performance/load-waterfall exempts it (see `csrDisabled` on `KitModuleFacts`).
 */
function findFalseOptOut(program: Node, source: string, name: 'ssr' | 'csr'): { line: number } | undefined {
  let hit: { line: number } | undefined;
  forEachNamedExport(program, (exported, value, anchor) => {
    if (exported !== name || value?.type !== 'Literal' || value.value !== false) return undefined;
    hit = { line: lineOf(source, anchor.start) };
    return true;
  });
  return hit;
}

/**
 * The exported `load` function node (inline `export function load` / `export const
 * load = …`, `satisfies`/`as` unwrapped) or a same-file alias export. Cross-file
 * re-exports stay unresolved, matching the other collectors' scope.
 */
function findLoadFunction(program: Node): Node | undefined {
  let load: Node | undefined;
  forEachNamedExport(program, (name, value) => {
    if (name !== 'load' || !isFunctionNode(value)) return undefined;
    load = value;
    return true;
  });
  return load;
}

/** All AwaitExpression nodes in `node`, not descending into nested functions. */
function collectAwaits(node: Node, out: Node[] = []): Node[] {
  if (Array.isArray(node)) {
    for (const child of node) collectAwaits(child, out);
    return out;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return out;
  if (isFunctionNode(node)) return out;
  if (node.type === 'AwaitExpression') out.push(node);
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    collectAwaits(node[key], out);
  }
  return out;
}

/**
 * Whether `await`'s argument is a `parent()` / `<x>.parent()` call (Kit's parent-load
 * step, exempt from performance/load-waterfall and performance/sequential-awaits). Any `<expr>.parent()` member call matches — over-broad
 * in the false-negative direction only, which is the conservative side.
 */
function isParentCall(arg: Node): boolean {
  const e = unwrapTs(arg);
  if (e?.type !== 'CallExpression') return false;
  const callee = e.callee;
  if (callee?.type === 'Identifier' && callee.name === 'parent') return true;
  return callee?.type === 'MemberExpression' && !callee.computed && callee.property?.name === 'parent';
}

const BODY_METHODS = new Set(['json', 'text', 'blob', 'arrayBuffer', 'formData', 'bytes']);

/**
 * Whether `await`'s argument is a response-body read (`res.json()`, `res.text()`, …):
 * parsing an already-received body costs no extra round trip, so it is not a
 * waterfall hop. Like `parent()`, exempt from classification while its bindings
 * still taint (the parsed data IS derived from the earlier request).
 */
function isBodyParseCall(arg: Node): boolean {
  const e = unwrapTs(arg);
  if (e?.type !== 'CallExpression' || e.arguments?.length) return false;
  const callee = e.callee;
  return callee?.type === 'MemberExpression' && !callee.computed && BODY_METHODS.has(callee.property?.name);
}

/**
 * Whether the expression references any tainted name. Threads nested-function
 * shadowing (`scopeIntroducedNames`) so a callback parameter that shadows a
 * tainted binding does not create a false dependency; non-computed member
 * properties and object keys don't count as references.
 */
function refsTainted(node: Node, tainted: Set<string>): boolean {
  let hit = false;
  const walk = (n: Node, shadowed: Set<string>): void => {
    if (hit) return;
    if (Array.isArray(n)) {
      for (const child of n) walk(child, shadowed);
      return;
    }
    if (!n || typeof n !== 'object' || typeof n.type !== 'string') return;
    const introduced = scopeIntroducedNames(n);
    const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
    if (n.type === 'Identifier' && tainted.has(n.name) && !scope.has(n.name)) {
      hit = true;
      return;
    }
    for (const key of Object.keys(n)) {
      if (WALK_IGNORED_KEYS.has(key)) continue;
      if (n.type === 'MemberExpression' && key === 'property' && !n.computed) continue;
      if (n.type === 'Property' && key === 'key' && !n.computed) continue;
      walk(n[key], scope);
    }
  };
  walk(node, new Set());
  return hit;
}

/**
 * performance/load-waterfall, performance/sequential-awaits — forward-taint analysis of the exported `load`'s straight-line
 * statements (direct `try` blocks inlined; `if`/loops/`switch` are not classified
 * but still propagate taint from their assignments; nested functions are never
 * entered). One await site per statement; a site whose awaits' argument subtrees
 * reference an earlier site's bindings (transitively, through intermediate consts
 * and assignments — member-expression targets taint their root object) is
 * dependent, anchored at the first dependent await; otherwise independent when a
 * prior site exists, unless every await merely resumes an already-created promise
 * (a bare identifier argument starts no request). `await parent()` and
 * response-body reads are never sites, but their bindings taint. Lines are
 * returned in ORIGINAL-source coordinates (the −1 wrap shift is applied here).
 */
function collectLoadWaterfalls(
  program: Node,
  wrapped: string
): { dependentLines: number[]; independentLines: number[] } {
  const dependentLines: number[] = [];
  const independentLines: number[] = [];
  const load = findLoadFunction(program);
  if (!load?.body || load.body.type !== 'BlockStatement') return { dependentLines, independentLines };

  const line = (start: number) => Math.max(0, lineOf(wrapped, start) - 1);
  const tainted = new Set<string>();
  let sawAwaitSite = false;

  const taintAssignTarget = (left: Node): void => {
    if (left?.type === 'MemberExpression') {
      const root = rootObjectName(left);
      if (root) tainted.add(root);
    } else {
      addBoundNames(left, tainted);
    }
  };

  // Taint-only scan for regions we don't classify: assignments/declarations whose
  // RHS contains an await or references taint taint their target. Never enters
  // nested functions; creates no sites.
  const taintOnly = (node: Node): void => {
    if (Array.isArray(node)) {
      for (const child of node) taintOnly(child);
      return;
    }
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    if (isFunctionNode(node)) return;
    if (node.type === 'AssignmentExpression') {
      if (collectAwaits(node.right).length > 0 || refsTainted(node.right, tainted)) taintAssignTarget(node.left);
    } else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations ?? []) {
        if (d?.id && d.init && (collectAwaits(d.init).length > 0 || refsTainted(d.init, tainted))) {
          addBoundNames(d.id, tainted);
        }
      }
    }
    for (const key of Object.keys(node)) {
      if (WALK_IGNORED_KEYS.has(key)) continue;
      taintOnly(node[key]);
    }
  };

  const processStatements = (body: Node[]): void => {
    for (const stmt of body ?? []) {
      if (!stmt) continue;
      if (stmt.type === 'TryStatement') {
        if (stmt.block?.type === 'BlockStatement') processStatements(stmt.block.body);
        if (stmt.handler) taintOnly(stmt.handler);
        if (stmt.finalizer) taintOnly(stmt.finalizer);
        continue;
      }
      if (
        stmt.type === 'VariableDeclaration' ||
        stmt.type === 'ExpressionStatement' ||
        stmt.type === 'ReturnStatement'
      ) {
        const sites = collectAwaits(stmt).filter((a) => !isParentCall(a.argument) && !isBodyParseCall(a.argument));
        if (sites.length > 0) {
          const dependent = sites.filter((a) => refsTainted(a.argument, tainted));
          if (dependent.length > 0) {
            const anchor = dependent.reduce((m, a) => (a.start < m.start ? a : m));
            dependentLines.push(line(anchor.start));
          } else if (sawAwaitSite) {
            // Awaiting an already-created promise (bare identifier) starts no request —
            // only awaits that start work can be needlessly sequential.
            const workSites = sites.filter((a) => unwrapTs(a.argument)?.type !== 'Identifier');
            if (workSites.length > 0) {
              const anchor = workSites.reduce((m, a) => (a.start < m.start ? a : m));
              independentLines.push(line(anchor.start));
            }
          }
          sawAwaitSite = true;
        }
        if (stmt.type === 'VariableDeclaration') {
          for (const d of stmt.declarations ?? []) {
            if (!d?.id || !d.init) continue;
            if (collectAwaits(d.init).length > 0 || refsTainted(d.init, tainted)) addBoundNames(d.id, tainted);
          }
        } else if (stmt.type === 'ExpressionStatement') {
          const expr = unwrapTs(stmt.expression);
          if (expr?.type === 'AssignmentExpression') {
            if (collectAwaits(expr.right).length > 0 || refsTainted(expr.right, tainted)) taintAssignTarget(expr.left);
          }
        }
      } else {
        taintOnly(stmt);
      }
    }
  };

  processStatements(load.body.body);
  return { dependentLines, independentLines };
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

/**
 * Normalize a posix path, resolving `.` and `..` segments — string-only, no I/O.
 * Returns undefined when a `..` segment pops an empty stack, i.e. the path escapes
 * its root (e.g. `../../../../src/lib/server/db` from a shallow route file): the
 * real target lies outside the repo tree we can see, so there is no repo-relative
 * path to return at all.
 */
function normalizePosix(path: string): string | undefined {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length === 0) return undefined;
      out.pop();
    } else out.push(seg);
  }
  return out.join('/');
}

/**
 * Resolve an import specifier to a repo-relative path against the importing file, or
 * undefined when it cannot be a repo-local module: `$lib/` maps to `src/lib/`, `./`/`../`
 * resolve against the importing file's directory; bare packages and other aliases are
 * skipped (they can't be resolved to a repo-local path at all). Also undefined when a
 * relative specifier's `..` segments escape the repo root — see `normalizePosix`.
 */
function resolveRepoLocalPath(spec: string, importerFile: string): string | undefined {
  let path: string;
  if (spec.startsWith('$lib/')) path = `src/lib/${spec.slice('$lib/'.length)}`;
  else if (spec.startsWith('./') || spec.startsWith('../')) {
    const dir = importerFile.split('/').slice(0, -1).join('/');
    path = `${dir}/${spec}`;
  } else return undefined;
  return normalizePosix(path);
}

/**
 * Resolve an import specifier to a repo-relative `.svelte.ts`/`.svelte.js` path, or
 * undefined when it cannot be a runes module: `$lib/` maps to `src/lib/`, `./`/`../`
 * resolve against the importing file's directory; bare packages, other aliases, and
 * a relative specifier whose `..` segments escape the repo root are skipped. An
 * extensionless `…/x.svelte` specifier canonicalises to `….svelte.ts` (security/shared-state-import also
 * tries the `.js` sibling when matching).
 */
export function resolveRunesModuleSpecifier(spec: string, importerFile: string): string | undefined {
  const path = resolveRepoLocalPath(spec, importerFile);
  if (path === undefined) return undefined;
  if (/\.svelte\.(ts|js)$/.test(path)) return path;
  if (path.endsWith('.svelte')) return `${path}.ts`;
  return undefined;
}

/**
 * Whether an import specifier points at repo-local module state that would be
 * SHARED on the server: relative or `$lib/` — but not `src/lib/server` itself or
 * anything under `src/lib/server/**`, where legitimate singletons (DB connections,
 * KV/API clients) live. The check resolves the specifier to its repo-relative path
 * first, so a relative import that lands in `src/lib/server/**` is exempt exactly
 * like the `$lib/server/**` alias form, and the directory-entrypoint import itself
 * (`$lib/server`, or an equivalent `../../lib/server`, resolving to exactly
 * `src/lib/server` — importing the index file rather than a named submodule) is
 * exempt too. A specifier that resolves to undefined — a bare package, an alias
 * that can't map to a repo path, or a relative specifier whose `..` segments escape
 * the repo root (see `normalizePosix`) — is conservatively NOT local state: we
 * can't see that file, so we don't flag writes to it. Installed packages (drizzle,
 * redis, @vercel/kv, …) are excluded: `.set()`/`.update()` on those is persistence,
 * not shared-module-state mutation.
 */
function isLocalStateSpecifier(spec: string, importerFile: string): boolean {
  const path = resolveRepoLocalPath(spec, importerFile);
  if (path === undefined) return false;
  return path !== 'src/lib/server' && !path.startsWith('src/lib/server/');
}

/**
 * Parse one SvelteKit route/hooks file's SSR shared-state facts (the security kit-module rules). Uses
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
  const lifecycleCalls: KitModuleFacts['lifecycleCalls'] = [];
  const browserGlobalRefs: KitModuleFacts['browserGlobalRefs'] = [];
  if (!program) {
    return {
      moduleStateReassignments,
      importedStateWrites,
      importedStateWritesOutsideHandlers,
      runesModuleImports,
      lifecycleCalls,
      browserGlobalRefs,
      suppressions
    };
  }
  const line = (start: number) => Math.max(0, lineOf(wrapped, start) - 1);

  // Imported value bindings (type-only skipped): local name → raw specifier, plus
  // the subset whose specifier resolves to a repo-local runes module (security/shared-state-import).
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

  // Module-scope let/var bindings (top-level, export-unwrapped) — security/server-module-state's targets.
  const moduleLets = new Set<string>();
  for (const stmt of program.body ?? []) {
    const decl = unwrapExport(stmt);
    if (decl?.type === 'VariableDeclaration' && (decl.kind === 'let' || decl.kind === 'var')) {
      for (const d of decl.declarations ?? []) addBoundNames(d?.id, moduleLets);
    }
  }

  const handlerFns = collectHandlerFunctions(program);
  const startupFns = collectStartupFunctions(program);
  const svelteImports = collectSvelteLifecycleImports(program);

  // correctness/server-browser-global — browser-global reads in server-executed positions. The scanner stops
  // at function boundaries, so run it once over the program (top level) and once per
  // handler/init body; closures nested inside handlers are deliberately not entered
  // (they are typically client-side callbacks returned to components).
  const ssrOptOut = findFalseOptOut(program, wrapped, 'ssr');
  const csrOptOut = findFalseOptOut(program, wrapped, 'csr');
  const waterfalls = collectLoadWaterfalls(program, wrapped);
  if (!ssrOptOut) {
    // The scanner returns line numbers computed against `wrapped` — subtract the
    // 1-line wrap prefix (the local `line()` helper takes a byte OFFSET, not a line,
    // so it must not be used here).
    const shiftLine = (l: number) => Math.max(0, l - 1);
    // Union of the raw `$app/environment` browser imports and module-level derived
    // guard bindings, so per-handler scans (whose own pre-pass only sees the handler
    // body) still recognise `const canUse = browser;` declared at module level.
    const browserImports = collectBrowserGuardImports(program);
    const guards = new Set([...browserImports, ...collectDerivedGuardBindings(program, browserImports)]);
    const bound = collectProgramBindings(program);
    for (const r of collectBrowserGlobalRefs(program, wrapped, { guards, bound })) {
      browserGlobalRefs.push({ name: r.name, line: shiftLine(r.line), inHandler: false });
    }
    const scanFn = (fn: Node, inHandler: boolean) => {
      if (!fn?.body) return;
      const params = new Set<string>();
      for (const p of fn.params ?? []) addBoundNames(p, params);
      for (const r of collectBrowserGlobalRefs(fn.body, wrapped, { guards, bound: new Set([...bound, ...params]) })) {
        browserGlobalRefs.push({ name: r.name, line: shiftLine(r.line), inHandler });
      }
    };
    for (const fn of handlerFns) scanFn(fn, true);
    for (const fn of startupFns) {
      // A function aliased to BOTH a handler and `init` was already scanned above —
      // scanning it again would duplicate the facts with a conflicting inHandler
      // flag. Handler classification wins.
      if (handlerFns.has(fn)) continue;
      scanFn(fn, false);
    }
  }

  walkKit(program, handlerFns, startupFns, (n, shadowed, inFunction, inHandler, inStartup) => {
    if (inFunction && !inStartup) {
      // security/server-module-state — module-scope let/var reassigned from inside a function body.
      // Top-level reassignment is initialisation, not shared-state mutation;
      // assignment from inside Kit's `init` startup hook is likewise
      // initialisation, not exempted for security/handler-state-write, security/shared-state-import write detection below.
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

    // security/handler-state-write / security/shared-state-import — a write whose root binding is an import.
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
        if (r && isLocalStateSpecifier(importedSpecifiers.get(r)!, filename)) write = { name: r, via: 'set-call' };
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

    // correctness/orphan-lifecycle — svelte lifecycle/context calls outside component initialisation:
    // top level (crashes at import), handler bodies (crashes per request — getContext
    // in load), and the `init` hook (crashes at boot). Helper functions are exempt:
    // a component may legally call them during its own initialisation.
    if (n.type === 'CallExpression' && (!inFunction || inHandler || inStartup)) {
      const m = matchLifecycleCall(n, svelteImports);
      if (m && !shadowed.has(m.local)) {
        lifecycleCalls.push({ name: m.canonical, line: line(n.start), inHandler });
      }
    }
  });

  const byLine = <T extends { line: number }>(arr: T[]): T[] => arr.sort((a, b) => a.line - b.line);

  return {
    moduleStateReassignments: byLine(moduleStateReassignments),
    importedStateWrites: byLine(importedStateWrites),
    importedStateWritesOutsideHandlers: byLine(importedStateWritesOutsideHandlers),
    runesModuleImports: byLine(runesModuleImports),
    lifecycleCalls: byLine(lifecycleCalls),
    browserGlobalRefs: byLine(browserGlobalRefs),
    ...(ssrOptOut ? { ssrDisabled: { line: Math.max(0, ssrOptOut.line - 1) } } : {}),
    ...(csrOptOut ? { csrDisabled: { line: Math.max(0, csrOptOut.line - 1) } } : {}),
    ...(waterfalls.dependentLines.length > 0 || waterfalls.independentLines.length > 0
      ? { loadWaterfalls: waterfalls }
      : {}),
    suppressions
  };
}
