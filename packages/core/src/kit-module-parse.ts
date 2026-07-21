import {
  parseModuleProgram,
  collectSuppressions,
  unwrapExport,
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
export function unwrapTs(expr: Node): Node {
  let cur = expr;
  while (cur?.type === 'TSSatisfiesExpression' || cur?.type === 'TSAsExpression') cur = cur.expression;
  return cur;
}

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
 * Same-file alias exports (`export { load }`, `export { handler as GET }`, an
 * alias-exported `actions` object) resolved against `bindings` and folded into
 * `handlers` — mirrors the classification inline `export` declarations get.
 */
function resolveAliasHandlerExports(program: Node, bindings: Map<string, Node>, handlers: Set<Node>): void {
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.specifiers || stmt.source || stmt.exportKind === 'type')
      continue;
    for (const s of stmt.specifiers) {
      if (s?.exportKind === 'type' || s?.exported?.type !== 'Identifier' || s?.local?.type !== 'Identifier') continue;
      const exportedName = s.exported.name;
      const resolved = bindings.get(s.local.name);
      if (HANDLER_NAMES.has(exportedName) && isFunctionNode(resolved)) {
        handlers.add(resolved);
      } else if (exportedName === 'actions' && resolved?.type === 'ObjectExpression') {
        addActionsMembers(resolved, handlers);
      }
    }
  }
}

/**
 * Same-file alias exports of the `init` startup hook (`export { init }`) resolved
 * against `bindings` and folded into `startup` — mirrors the classification an
 * inline `export async function init() {}` gets.
 */
function resolveAliasStartupExports(program: Node, bindings: Map<string, Node>, startup: Set<Node>): void {
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.specifiers || stmt.source || stmt.exportKind === 'type')
      continue;
    for (const s of stmt.specifiers) {
      if (s?.exportKind === 'type' || s?.exported?.type !== 'Identifier' || s?.local?.type !== 'Identifier') continue;
      if (s.exported.name !== 'init') continue;
      const resolved = bindings.get(s.local.name);
      if (isFunctionNode(resolved)) startup.add(resolved);
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
        addActionsMembers(init, handlers);
      }
    }
  }
  resolveAliasHandlerExports(program, collectTopLevelBindings(program), handlers);
  return handlers;
}

/**
 * The function nodes of this file's SvelteKit startup hooks: exported `init`
 * (function or arrow, `satisfies` unwrapped). Kit calls `init` once at server
 * startup — semantically top-level initialisation, not a per-request handler, so
 * SEC004 should not flag assignments inside it. A same-file alias export
 * (`export { init }`) is resolved too; a cross-file re-export is not.
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
  resolveAliasStartupExports(program, collectTopLevelBindings(program), startup);
  return startup;
}

/**
 * The `export const ssr = false` opt-out, when present: inline form
 * (`satisfies`/`as` unwrapped) or same-file alias export (`const ssr = false;
 * export { ssr };`). Returns the declaration's line in the WRAPPED source (the
 * caller applies the −1 shift). Such a file never runs on the server — CORRECT008
 * skips its browser-global scan, and SEO031 reports the flag itself.
 */
function findSsrFalseOptOut(program: Node, source: string): { line: number } | undefined {
  const isFalse = (init: Node): boolean => {
    const v = unwrapTs(init);
    return v?.type === 'Literal' && v.value === false;
  };
  for (const stmt of program.body ?? []) {
    const decl = unwrapExport(stmt);
    if (decl?.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type === 'Identifier' && d.id.name === 'ssr' && d.init && isFalse(d.init)) {
        if (stmt.type === 'ExportNamedDeclaration') return { line: lineOf(source, d.start) };
      }
    }
  }
  // Alias export: `const ssr = false; export { ssr };`
  const bindings = collectTopLevelBindings(program);
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.specifiers || stmt.source || stmt.exportKind === 'type')
      continue;
    for (const s of stmt.specifiers) {
      if (s?.exportKind === 'type' || s?.exported?.type !== 'Identifier' || s?.local?.type !== 'Identifier') continue;
      if (s.exported.name !== 'ssr') continue;
      const resolved = bindings.get(s.local.name);
      if (resolved?.type === 'Literal' && resolved.value === false) return { line: lineOf(source, resolved.start) };
    }
  }
  return undefined;
}

/**
 * The exported `load` function node (inline `export function load` / `export const
 * load = …`, `satisfies`/`as` unwrapped) or a same-file alias export. Cross-file
 * re-exports stay unresolved, matching the other collectors' scope.
 */
function findLoadFunction(program: Node): Node | undefined {
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue;
    const decl = stmt.declaration;
    if (decl.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier' && decl.id.name === 'load') return decl;
    if (decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || d.id.name !== 'load' || !d.init) continue;
      const init = unwrapTs(d.init);
      if (isFunctionNode(init)) return init;
    }
  }
  const bindings = collectTopLevelBindings(program);
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.specifiers || stmt.source || stmt.exportKind === 'type')
      continue;
    for (const s of stmt.specifiers) {
      if (s?.exportKind === 'type' || s?.exported?.type !== 'Identifier' || s?.local?.type !== 'Identifier') continue;
      if (s.exported.name !== 'load') continue;
      const resolved = bindings.get(s.local.name);
      if (resolved && isFunctionNode(resolved)) return resolved;
    }
  }
  return undefined;
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

/** Whether `await`'s argument is a `parent()` / `<x>.parent()` call (Kit's parent-load step, PERF011/013-exempt). */
function isParentCall(arg: Node): boolean {
  const e = unwrapTs(arg);
  if (e?.type !== 'CallExpression') return false;
  const callee = e.callee;
  if (callee?.type === 'Identifier' && callee.name === 'parent') return true;
  return callee?.type === 'MemberExpression' && !callee.computed && callee.property?.name === 'parent';
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
 * PERF011/PERF013 — forward-taint analysis of the exported `load`'s straight-line
 * statements (direct `try` blocks inlined; `if`/loops/`switch`/`catch`/nested
 * functions are not entered). One await site per statement; a site whose awaits'
 * argument subtrees reference an earlier site's bindings (transitively, through
 * intermediate consts) is dependent, otherwise independent when a prior site
 * exists. `await parent()` is never a site, but its bindings taint. Lines are
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

  const statements: Node[] = [];
  const pushStmts = (body: Node[]): void => {
    for (const stmt of body ?? []) {
      if (stmt?.type === 'TryStatement' && stmt.block?.type === 'BlockStatement') pushStmts(stmt.block.body);
      else if (stmt) statements.push(stmt);
    }
  };
  pushStmts(load.body.body);

  const line = (start: number) => Math.max(0, lineOf(wrapped, start) - 1);
  const tainted = new Set<string>();
  let sawAwaitSite = false;

  for (const stmt of statements) {
    if (stmt.type === 'VariableDeclaration' || stmt.type === 'ExpressionStatement' || stmt.type === 'ReturnStatement') {
      const sites = collectAwaits(stmt).filter((a) => !isParentCall(a.argument));
      if (sites.length > 0) {
        const first = sites.reduce((m, a) => (a.start < m.start ? a : m));
        if (sites.some((a) => refsTainted(a.argument, tainted))) dependentLines.push(line(first.start));
        else if (sawAwaitSite) independentLines.push(line(first.start));
        sawAwaitSite = true;
      }
      if (stmt.type === 'VariableDeclaration') {
        for (const d of stmt.declarations ?? []) {
          if (!d?.id || !d.init) continue;
          if (collectAwaits(d.init).length > 0 || refsTainted(d.init, tainted)) addBoundNames(d.id, tainted);
        }
      }
    }
  }
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
 * extensionless `…/x.svelte` specifier canonicalises to `….svelte.ts` (SEC005 also
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
  const svelteImports = collectSvelteLifecycleImports(program);

  // CORRECT008 — browser-global reads in server-executed positions. The scanner stops
  // at function boundaries, so run it once over the program (top level) and once per
  // handler/init body; closures nested inside handlers are deliberately not entered
  // (they are typically client-side callbacks returned to components).
  const ssrOptOut = findSsrFalseOptOut(program, wrapped);
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

    // CORRECT007 — svelte lifecycle/context calls outside component initialisation:
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
    ...(waterfalls.dependentLines.length > 0 || waterfalls.independentLines.length > 0
      ? { loadWaterfalls: waterfalls }
      : {}),
    suppressions
  };
}
