// Shared AST-analysis toolkit: the estree/TS helpers, scoped walkers, program-level
// collectors, and directive/suppression scanner used by the component, Kit-module, and
// config parsers. Extracted from component-parse.ts so its siblings depend on the toolkit,
// not on "the component parser", by name.

import { parse } from 'svelte/compiler';
import type { Expression } from 'estree';
import { lineOf } from './svelte-ast.js';
import type { SuppressionDirective } from './component.js';

// The Svelte AST is structurally complex and only partially typed for our needs,
// so traversal uses `any`.
/* oxlint-disable @typescript-eslint/no-explicit-any */
type Node = any;

// TypeScript wrapper expressions the Svelte script parser emits for `x satisfies T` /
// `x as T` / `x!` — not part of estree's own type set, so declared here. `unwrapTs`
// is shared with the Kit-module and Vite-config parsers, hence exported alongside them.
export interface TSSatisfiesExpression {
  type: 'TSSatisfiesExpression';
  start: number;
  end: number;
  expression: TsExpression;
}
export interface TSAsExpression {
  type: 'TSAsExpression';
  start: number;
  end: number;
  expression: TsExpression;
}
export interface TSNonNullExpression {
  type: 'TSNonNullExpression';
  start: number;
  end: number;
  expression: TsExpression;
}
/** An estree `Expression`, optionally wrapped in one or more of the three TS wrappers above. */
export type TsExpression = Expression | TSSatisfiesExpression | TSAsExpression | TSNonNullExpression;

/** Unwrap TS wrapper expressions (`x satisfies T`, `x as T`, `x!`) to the underlying expression. Shared with the Kit-module and Vite-config parsers. */
export function unwrapTs(expr: TsExpression): Expression;
export function unwrapTs(expr: TsExpression | undefined): Expression | undefined;
export function unwrapTs(expr: TsExpression | undefined): Expression | undefined {
  let cur = expr;
  while (
    cur !== undefined &&
    (cur.type === 'TSSatisfiesExpression' || cur.type === 'TSAsExpression' || cur.type === 'TSNonNullExpression')
  )
    cur = cur.expression;
  return cur;
}

/** AST metadata keys every walker skips — never traversed as child nodes. Shared with the Kit-module parser (the security kit-module rules). */
export const WALK_IGNORED_KEYS = new Set(['type', 'start', 'end', 'loc', 'range']);

/** Boundary set for the walkers that enter every node (walkEstree, walkScoped). */
const NO_BOUNDARIES: Set<string> = new Set();

/** Generic ESTree walk over a `<script>` program: visit every node with a `.type`. Shared with the component parser. */
export function walkEstree(node: Node, visit: (n: Node) => void): void {
  walkEvalScope(node, (n) => void visit(n), new Set(), NO_BOUNDARIES);
}

/**
 * Add every name a binding target introduces to `acc`, recursing through all
 * destructuring forms: defaults (`{ a = 1 }`), nested (`{ a: { b } }`), arrays,
 * and rest. Missing a bound prop would drop it from `reactiveNames` and risk a
 * false-positive correctness/effect-as-onmount flag, so this must cover the full pattern grammar.
 * Shared with the Kit-module parser (the security kit-module rules).
 */
export function addBoundNames(id: Node, acc: Set<string>): void {
  if (!id) return;
  switch (id.type) {
    case 'Identifier':
      acc.add(id.name);
      break;
    case 'ObjectPattern':
      for (const p of id.properties ?? []) {
        if (p?.type === 'Property') addBoundNames(p.value, acc);
        else if (p?.type === 'RestElement') addBoundNames(p.argument, acc);
      }
      break;
    case 'ArrayPattern':
      for (const el of id.elements ?? []) addBoundNames(el, acc);
      break;
    case 'AssignmentPattern':
      addBoundNames(id.left, acc);
      break;
    case 'RestElement':
      addBoundNames(id.argument, acc);
      break;
  }
}

/** The base identifier name of a (possibly nested) member expression or identifier, else undefined. Shared with the Kit-module parser (the security kit-module rules). */
export function rootObjectName(node: Node): string | undefined {
  let cur = node;
  while (cur?.type === 'MemberExpression') cur = cur.object;
  return cur?.type === 'Identifier' ? cur.name : undefined;
}

/**
 * Names newly bound AT `node` (not by its children) that shadow an outer binding of the
 * same name for everything nested inside it: function/arrow-function parameters, a
 * `catch` clause's parameter, a block's own variable declarations (`let`/`const`/`var` —
 * a `var` is really function-scoped, so treating it block-scoped leaves a nested block's
 * `var` invisible to sibling blocks; accepted imprecision) plus its own `function`/`class`
 * declaration names, a
 * `for`/`for-of`/`for-in` loop's declared variable, a Svelte `{#each ... as x, i}` block's
 * context AND index binding, a `{#snippet}` block's parameters, an `{#await}` block's
 * `then`/`catch` value/error bindings, and a fragment's own `{@const ...}` /
 * `{let ...}` / `{const ...}` declaration tags (attributed to the enclosing Fragment,
 * shadowing the whole fragment like a block's `let` — a write to one of these
 * template-locals, possible for `{let}`, is still not a write to the outer binding).
 * Used by `walkScoped` so a write/mutation detector
 * doesn't misattribute a write to one of these locals as a write to an outer `$state`/prop
 * of the same name (issue #140 — originally a deliberately partial mitigation that left
 * `{#snippet}`/`{:then}`/`{:catch}` bindings untracked; now covered too. A block's own
 * `let` still shadows the whole block, not just the statements after its declaration —
 * over-conservative, not exhaustive scope resolution). Shared with the Kit-module parser
 * (the security kit-module rules).
 */
export function scopeIntroducedNames(node: Node): Set<string> {
  const introduced = new Set<string>();
  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  ) {
    for (const p of node.params ?? []) addBoundNames(p, introduced);
  } else if (node.type === 'CatchClause') {
    addBoundNames(node.param, introduced);
  } else if (node.type === 'BlockStatement') {
    for (const stmt of node.body ?? []) {
      if (stmt?.type === 'VariableDeclaration') {
        for (const d of stmt.declarations ?? []) addBoundNames(d.id, introduced);
      } else if (
        (stmt?.type === 'FunctionDeclaration' || stmt?.type === 'ClassDeclaration') &&
        typeof stmt.id?.name === 'string'
      ) {
        introduced.add(stmt.id.name);
      }
    }
  } else if (node.type === 'ForStatement' || node.type === 'ForOfStatement' || node.type === 'ForInStatement') {
    const decl = node.type === 'ForStatement' ? node.init : node.left;
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations ?? []) addBoundNames(d.id, introduced);
    }
  } else if (node.type === 'EachBlock' && node.context) {
    addBoundNames(node.context, introduced);
    if (typeof node.index === 'string') introduced.add(node.index);
  } else if (node.type === 'SnippetBlock') {
    for (const p of node.parameters ?? []) addBoundNames(p, introduced);
  } else if (node.type === 'AwaitBlock') {
    if (node.value) addBoundNames(node.value, introduced);
    if (node.error) addBoundNames(node.error, introduced);
  } else if (node.type === 'Fragment') {
    for (const child of node.nodes ?? []) {
      if (child?.type === 'ConstTag' || child?.type === 'DeclarationTag') {
        for (const d of child.declaration?.declarations ?? []) addBoundNames(d.id, introduced);
      }
    }
  }
  return introduced;
}

// Category segment allows digits: `a11y/*` ids exist alongside all-letter categories.
const RULE_ID_RE = '[a-z][a-z0-9]*\\/[a-z][a-z0-9-]*';
const JS_DIRECTIVE = new RegExp(
  `^\\s*//\\s*svelte-vitals-disable-next-line(?:\\s+(${RULE_ID_RE}(?:\\s*,\\s*${RULE_ID_RE})*))?\\s*$`
);
const HTML_DIRECTIVE = new RegExp(
  `^\\s*<!--\\s*svelte-vitals-disable-next-line(?:\\s+(${RULE_ID_RE}(?:\\s*,\\s*${RULE_ID_RE})*))?\\s*-->\\s*$`
);

/**
 * Inline `svelte-vitals-disable-next-line` directives (issue #92). A plain text scan, not an
 * AST walk, so `<script>` (`//`) and template (`<!-- -->`) comments are covered uniformly. The
 * directive must be the entire content of its line; the suppressed line is directive-line + 1.
 * Shared with the Kit-module parser (the security kit-module rules).
 */
export function collectSuppressions(source: string): SuppressionDirective[] {
  const out: SuppressionDirective[] = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    const m = JS_DIRECTIVE.exec(line) ?? HTML_DIRECTIVE.exec(line);
    if (!m) return;
    const ruleIds = m[1]?.split(',').map((s) => s.trim());
    out.push({ line: i + 2, ruleIds });
  });
  return out;
}

/** Nodes whose bodies do NOT run when the surrounding code is evaluated: functions run when called; class member/constructor code runs on construction (correctness/orphan-effect). */
const EVAL_SCOPE_BOUNDARIES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassDeclaration',
  'ClassExpression'
]);

/**
 * Walk only the code that executes when `node` itself is evaluated: every node is
 * visited, but children of eval-scope boundaries (function/class bodies) are not
 * entered. `visit` returning true skips a node's children — used to exempt
 * `$effect.root(...)` callbacks (correctness/orphan-effect). Like `walkScoped`, threads a "shadowed
 * names" set down through scope-introducing constructs (`scopeIntroducedNames`) so
 * `visit` can check whether a candidate identifier is locally shadowed before
 * treating it as a match against an outer (e.g. imported) binding (correctness/orphan-lifecycle).
 * Also the shared skeleton behind `walkEstree` and `walkScoped`, which pass an empty
 * `boundaries` set to enter every node.
 */
export function walkEvalScope(
  node: Node,
  visit: (n: Node, shadowed: Set<string>) => boolean | undefined,
  shadowed: Set<string> = new Set(),
  boundaries: Set<string> = EVAL_SCOPE_BOUNDARIES
): void {
  if (Array.isArray(node)) {
    for (const child of node) walkEvalScope(child, visit, shadowed, boundaries);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  if (visit(node, scope)) return;
  if (boundaries.has(node.type)) return;
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    walkEvalScope(node[key], visit, scope, boundaries);
  }
}

/**
 * Unwrap a top-level statement's `export`/`export default` wrapper to the declaration
 * (or expression) it wraps; a non-export statement is returned as-is. Used so pattern 2
 * (below) treats `export class Store {…}` / `export const s = new Store()` the same as
 * their unexported forms. Shared with the Kit-module parser (the security kit-module rules).
 */
export function unwrapExport(stmt: Node): Node {
  if (stmt.type === 'ExportNamedDeclaration') return stmt.declaration ?? stmt;
  if (stmt.type === 'ExportDefaultDeclaration') return stmt.declaration;
  return stmt;
}

/** Svelte exports that throw `lifecycle_outside_component` when called without an active component context (correctness/orphan-lifecycle). */
const LIFECYCLE_NAMES = new Set([
  'onMount',
  'onDestroy',
  'beforeUpdate',
  'afterUpdate',
  'createEventDispatcher',
  'getContext',
  'setContext',
  'hasContext',
  'getAllContexts'
]);

/**
 * Tracked svelte lifecycle/context bindings in a module program (correctness/orphan-lifecycle): local
 * alias → canonical name for named value imports from 'svelte', plus namespace locals
 * (`import * as s from 'svelte'`). Type-only imports/specifiers excluded; same-named
 * imports from any other module are never tracked. Shared with the Kit-module parser.
 */
export function collectSvelteLifecycleImports(program: Node) {
  const locals = new Map<string, string>();
  const namespaces = new Set<string>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ImportDeclaration' || stmt.importKind === 'type' || stmt.source?.value !== 'svelte') continue;
    for (const s of stmt.specifiers ?? []) {
      if (s?.importKind === 'type' || s?.local?.type !== 'Identifier') continue;
      if (s.type === 'ImportSpecifier' && s.imported?.type === 'Identifier' && LIFECYCLE_NAMES.has(s.imported.name)) {
        locals.set(s.local.name, s.imported.name);
      } else if (s.type === 'ImportNamespaceSpecifier') {
        namespaces.add(s.local.name);
      }
    }
  }
  return { locals, namespaces };
}

/**
 * Whether a CallExpression calls a tracked svelte lifecycle/context binding (correctness/orphan-lifecycle):
 * a direct call to a (possibly aliased) named import, or a non-computed member call on a
 * `svelte` namespace import. Returns the canonical name plus the local root binding (for
 * shadow checks in the Kit parser). Shared with the Kit-module parser.
 */
export function matchLifecycleCall(
  n: Node,
  imports: { locals: Map<string, string>; namespaces: Set<string> }
): { canonical: string; local: string } | undefined {
  const c = n?.callee;
  if (c?.type === 'Identifier') {
    const canonical = imports.locals.get(c.name);
    return canonical ? { canonical, local: c.name } : undefined;
  }
  if (
    c?.type === 'MemberExpression' &&
    !c.computed &&
    c.object?.type === 'Identifier' &&
    imports.namespaces.has(c.object.name) &&
    c.property?.type === 'Identifier' &&
    LIFECYCLE_NAMES.has(c.property.name)
  ) {
    return { canonical: c.property.name, local: c.object.name };
  }
  return undefined;
}

/** Browser-only globals worth flagging in server-executed code (correctness/server-browser-global, correctness/instance-browser-global) — curated high-signal names absent from Node; NOT the full `globals.browser` list, which would false-positive on generic identifiers without scope analysis. */
const BROWSER_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
  'screen',
  'matchMedia',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IntersectionObserver',
  'ResizeObserver',
  'MutationObserver',
  'alert',
  'confirm',
  'prompt'
]);

/**
 * Local names bound to any of `names` VALUE-imported from `moduleSource` (alias-resolved;
 * type-only imports and specifiers skipped). Namespace imports (`import * as x from …`) are
 * deliberately not resolved — the callers that need them handle namespaces themselves.
 * Shared by the browser-guard, `goto`, and `redirect` collectors.
 */
export function collectNamedImportAliases(program: Node, moduleSource: string, names: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ImportDeclaration' || stmt.importKind === 'type' || stmt.source?.value !== moduleSource) {
      continue;
    }
    for (const s of stmt.specifiers ?? []) {
      if (s?.importKind === 'type' || s?.local?.type !== 'Identifier') continue;
      if (s.type === 'ImportSpecifier' && s.imported?.type === 'Identifier' && names.has(s.imported.name)) {
        out.add(s.local.name);
      }
    }
  }
  return out;
}

const BROWSER_GUARD_NAMES = new Set(['browser']);

/**
 * Local names of `browser` value-imported from '$app/environment' (alias-resolved) —
 * the guard binding recognised by the browser-global scanner (correctness/server-browser-global, correctness/instance-browser-global).
 * Shared with the Kit-module parser.
 */
export function collectBrowserGuardImports(program: Node): Set<string> {
  return collectNamedImportAliases(program, '$app/environment', BROWSER_GUARD_NAMES);
}

/**
 * Names bound at the program's top level: every import's local name plus every
 * export-unwrapped declaration name. A tracked global with such a binding is a real
 * binding, not a global read (`const document = …`, `import { window } from …`) —
 * disqualified program-wide by the browser-global scanner (correctness/server-browser-global, correctness/instance-browser-global).
 * Shared with the Kit-module parser.
 */
export function collectProgramBindings(program: Node): Set<string> {
  const bound = new Set<string>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type === 'ImportDeclaration') {
      for (const s of stmt.specifiers ?? []) if (s?.local?.type === 'Identifier') bound.add(s.local.name);
      continue;
    }
    const decl = unwrapExport(stmt);
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations ?? []) addBoundNames(d?.id, bound);
    } else if (
      (decl?.type === 'FunctionDeclaration' || decl?.type === 'ClassDeclaration') &&
      decl.id?.type === 'Identifier'
    ) {
      bound.add(decl.id.name);
    }
  }
  return bound;
}

/** Whether a guard's consequent unconditionally exits (return/throw) — code after it never runs in the guarded environment (correctness/server-browser-global, correctness/instance-browser-global). */
function guardTerminates(consequent: Node): boolean {
  if (!consequent) return false;
  if (consequent.type === 'ReturnStatement' || consequent.type === 'ThrowStatement') return true;
  if (consequent.type === 'BlockStatement') {
    const last = (consequent.body ?? [])[consequent.body.length - 1];
    return last?.type === 'ReturnStatement' || last?.type === 'ThrowStatement';
  }
  return false;
}

/**
 * Whether a guard-clause test establishes a browser environment: it references the
 * `$app/environment` `browser` binding, or contains a
 * `typeof <tracked-global> === | !== 'undefined'` comparison (correctness/server-browser-global, correctness/instance-browser-global).
 * Over-matching here only widens the skip — a conservative miss, never a false positive.
 */
function isBrowserGuardTest(test: Node, guardBindings: Set<string>): boolean {
  let guarded = false;
  walkEstree(test, (n) => {
    if (n.type === 'Identifier' && guardBindings.has(n.name)) guarded = true;
    if (n.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(n.operator)) {
      const sides = [n.left, n.right];
      const hasTypeofGlobal = sides.some(
        (s: Node) =>
          s?.type === 'UnaryExpression' &&
          s.operator === 'typeof' &&
          s.argument?.type === 'Identifier' &&
          BROWSER_GLOBALS.has(s.argument.name)
      );
      const hasUndefinedString = sides.some((s: Node) => s?.type === 'Literal' && s.value === 'undefined');
      if (hasTypeofGlobal && hasUndefinedString) guarded = true;
    }
  });
  return guarded;
}

/**
 * Names of derived guard bindings (one level, no fixpoint chasing): a top-level
 * (export-unwrapped) `const`/`let` declarator whose init passes `isBrowserGuardTest` —
 * `const canUse = browser && !!window.matchMedia;` makes `canUse` itself a guard for a
 * later `if (canUse) { … }`. Over-matching here only widens the skip (conservative
 * miss). The scanner runs this on its own program; the Kit parser and the `.svelte`
 * instance scan also run it on the module program so a module-level derived guard is
 * recognised inside handlers / the instance script (correctness/server-browser-global, correctness/instance-browser-global).
 * Shared with the Kit-module parser.
 */
export function collectDerivedGuardBindings(program: Node, guards: Set<string>): Set<string> {
  const derived = new Set<string>();
  for (const stmt of program.body ?? []) {
    const decl = unwrapExport(stmt);
    if (decl?.type !== 'VariableDeclaration' || (decl.kind !== 'const' && decl.kind !== 'let')) continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type === 'Identifier' && d.init && isBrowserGuardTest(d.init, guards)) {
        derived.add(d.id.name);
      }
    }
  }
  return derived;
}

/**
 * Browser-global reads in code that executes when `program` (or a passed function body)
 * is evaluated (correctness/server-browser-global, correctness/instance-browser-global). Position-aware — only read positions match: never a
 * non-computed member property or object key, a declaration id, an import/export
 * specifier, a label, or a bare `typeof` operand (that idiom never throws). Never
 * descends into TS type-only subtrees (type aliases, interfaces, `TSTypeQuery`'s
 * `typeof window`, generic type arguments, annotations) — a `TSAsExpression` /
 * `TSSatisfiesExpression` / `TSNonNullExpression` / `TSInstantiationExpression`
 * wrapper still has its runtime `.expression` visited. Stops at eval-scope boundaries
 * (function/class bodies), threads the shadow set, disqualifies names bound at the
 * program's top level (`extra.bound` adds more, e.g. the other script's bindings or a
 * handler's parameters), and skips guard clauses ENTIRELY — if/ternary/logical whose
 * test passes `isBrowserGuardTest` — including their else branches (a documented
 * conservative miss). A guard binding derived from another guard, one level deep
 * (`const canUse = browser && !!window.matchMedia;`), is recognised too. Within a
 * `BlockStatement`/`Program`, a terminating early-return guard (`if (!browser) return
 * {};`) stops the scan of the remaining statements in that container — they are
 * server-unreachable in the guarded environment. `extra.guards` adds guard bindings
 * beyond this program's own `$app/environment` import.
 */
export function collectBrowserGlobalRefs(
  program: Node,
  source: string,
  extra?: { guards?: Set<string>; bound?: Set<string> }
): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  const bound = new Set([...collectProgramBindings(program), ...(extra?.bound ?? [])]);
  const guards = new Set([...collectBrowserGuardImports(program), ...(extra?.guards ?? [])]);
  for (const name of collectDerivedGuardBindings(program, guards)) guards.add(name);

  const visit = (n: Node, shadowed: Set<string>): void => {
    if (!n) return;
    if (Array.isArray(n)) {
      for (const c of n) visit(c, shadowed);
      return;
    }
    if (typeof n !== 'object' || typeof n.type !== 'string') return;
    if (EVAL_SCOPE_BOUNDARIES.has(n.type)) return;

    if ((n.type === 'IfStatement' || n.type === 'ConditionalExpression') && isBrowserGuardTest(n.test, guards)) return;
    if (n.type === 'LogicalExpression' && isBrowserGuardTest(n.left, guards)) return;

    const introduced = scopeIntroducedNames(n);
    const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;

    switch (n.type) {
      case 'Identifier':
        if (BROWSER_GLOBALS.has(n.name) && !bound.has(n.name) && !scope.has(n.name)) {
          out.push({ name: n.name, line: lineOf(source, n.start) });
        }
        return;
      case 'UnaryExpression':
        if (n.operator === 'typeof' && n.argument?.type === 'Identifier') return; // guard idiom — never throws
        break;
      case 'MemberExpression':
        visit(n.object, scope);
        if (n.computed) visit(n.property, scope);
        return;
      case 'Property':
        if (n.computed) visit(n.key, scope);
        visit(n.value, scope);
        return;
      case 'VariableDeclarator':
        visit(n.init, scope); // the id is a binding target, not a read
        return;
      case 'LabeledStatement':
        visit(n.body, scope);
        return;
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
        return;
      case 'ExportNamedDeclaration':
        if (!n.declaration) return; // bare specifiers aren't reads
        break;
      case 'BlockStatement':
      case 'Program':
        // Statement-list containers get a manual loop (rather than the generic
        // key-walk) so a terminating early-return guard (`if (!browser) return
        // {};`) can stop scanning the rest of the container — the remaining
        // statements are server-unreachable in the guarded environment
        // (correctness/server-browser-global, correctness/instance-browser-global). The guard statement itself is still skipped by the
        // IfStatement check above; `Program` can't contain a `return`, so its
        // early-break only ever triggers on a `throw`-terminated guard.
        for (const stmt of n.body ?? []) {
          visit(stmt, scope);
          if (
            stmt?.type === 'IfStatement' &&
            isBrowserGuardTest(stmt.test, guards) &&
            guardTerminates(stmt.consequent)
          ) {
            break;
          }
        }
        return;
      default:
        if (n.type.startsWith('TS')) {
          // TS wrapper expressions carry a runtime expression — visit only that.
          // Everything else under a TS* node is erased type-level code (type
          // aliases, interfaces, TSTypeQuery's `typeof window`, generic args,
          // annotations) and can never throw at runtime. Skipping the rare
          // runtime-bearing TS constructs (enum initializers, namespaces) is a
          // conservative miss, aligned with the no-false-positive contract.
          if (
            n.type === 'TSAsExpression' ||
            n.type === 'TSSatisfiesExpression' ||
            n.type === 'TSNonNullExpression' ||
            n.type === 'TSInstantiationExpression'
          ) {
            visit(n.expression, scope);
          }
          return;
        }
    }
    for (const key of Object.keys(n)) {
      if (WALK_IGNORED_KEYS.has(key)) continue;
      visit(n[key], scope);
    }
  };
  visit(program, new Set());
  return out;
}

/**
 * Parse a plain TS/JS module source by wrapping it in a `<script lang="ts">` tag —
 * the Svelte script parser handles TS natively, so no extra parser dependency is
 * needed. Literal "</script" occurrences are neutralised with a same-length
 * placeholder first (string contents don't affect fact extraction; offsets are
 * preserved). Returns the ESTree Program and the wrapped source — wrapped line
 * numbers are +1 relative to the input, so callers subtract 1. Shared by the
 * runes-module facts (correctness/orphan-effect) and the Kit-module facts (the security kit-module rules).
 */
type ParsedModule = { program: Node | undefined; wrapped: string };
export function parseModuleProgram(source: string, filename: string): ParsedModule {
  const neutralized = source.replace(/<\/script/gi, '<_script');
  const wrapped = `<script lang="ts">\n${neutralized}\n</script>`;
  const ast = parse(wrapped, { modern: true, filename }) as Node;
  return { program: ast.instance?.content, wrapped };
}
