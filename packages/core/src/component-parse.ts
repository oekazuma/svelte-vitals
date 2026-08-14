import { parse } from 'svelte/compiler';
import type { Expression } from 'estree';
import type { AST } from 'svelte/compiler';
import type {
  AriaElementFact,
  BasePathLinkFact,
  BrowserGlobalRefFact,
  CheckableBindValueFact,
  ComponentFacts,
  EachBlockFact,
  EffectFact,
  InteractiveNestingFact,
  OrphanEffectFact,
  OrphanLifecycleCallFact,
  SourceSpan,
  SuppressionDirective,
  UnnamedInteractiveFact
} from './component.js';
import { isRootRelativePath } from './base-path.js';
import { CHILD_NODE_KEYS, lineOf, findAttr, attrTextOf, attrText } from './svelte-ast.js';
import { isInteractiveElement, isInteractiveContainer, type ElementAttr } from './rules/a11y/interactive.js';

// The Svelte AST is structurally complex and only partially typed for our needs,
// so traversal uses `any`. The node-type strings below are verified against
// svelte 5 output (see Slice 0 AST probe): <title> is `TitleElement` (not a
// RegularElement), and `{expr}` is `ExpressionTag`.
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

/** Whether `expr` is a length-only list constructor: `Array(n)` / `new Array(n)` (single argument = length semantics) or `Array.from({ length: n }, …)`. */
function isLengthOnlyArrayCall(expr: TsExpression): boolean {
  const e = unwrapTs(expr);
  if (!e) return false;
  if (
    (e.type === 'CallExpression' || e.type === 'NewExpression') &&
    e.callee?.type === 'Identifier' &&
    e.callee.name === 'Array'
  ) {
    return (e.arguments?.length ?? 0) === 1;
  }
  if (
    e.type === 'CallExpression' &&
    e.callee?.type === 'MemberExpression' &&
    !e.callee.computed &&
    e.callee.object?.type === 'Identifier' &&
    e.callee.object.name === 'Array' &&
    e.callee.property.type === 'Identifier' &&
    e.callee.property.name === 'from' &&
    e.arguments?.[0]?.type === 'ObjectExpression'
  ) {
    return (e.arguments[0].properties ?? []).some(
      (p: Node) => p?.type === 'Property' && !p.computed && (p.key?.name === 'length' || p.key?.value === 'length')
    );
  }
  return false;
}

/**
 * Whether the each expression yields no item identity to key on: a constant
 * inline array literal (fixed length, never reorders), a length-only list
 * (`Array(n)`, `new Array(n)`, `[...Array(n)]`, `Array.from({ length: n })` —
 * placeholder/skeleton lists), or a spread array whose every element spreads a
 * length-only list. Such blocks are skipped entirely — neither each-key nor
 * each-index-key can give useful advice on them.
 */
function isIdentityFreeEach(node: AST.EachBlock): boolean {
  const expr = unwrapTs(node.expression);
  if (expr.type === 'ArrayExpression' && Array.isArray(expr.elements)) {
    return expr.elements.every((el) => el?.type !== 'SpreadElement' || isLengthOnlyArrayCall(el.argument));
  }
  return isLengthOnlyArrayCall(expr);
}

/**
 * Whether `expr` is the index binding itself or a trivial coercion of it —
 * `i`, `String(i)`, `Number(i)`, `` `${i}` ``, `i.toString()`, `i + ''` — all
 * position-based identity. A template or concatenation with any literal text
 * (`` `row-${i}` ``, `i + '-row'`) or extra expressions is treated as composite
 * and NOT matched: composite keys may be a deliberate uniqueness workaround for
 * duplicate items.
 */
function isIndexExpression(expr: TsExpression, index: string): boolean {
  const e = unwrapTs(expr);
  if (e.type === 'Identifier') return e.name === index;
  if (e.type === 'CallExpression') {
    const callee = e.callee;
    if (
      callee.type === 'Identifier' &&
      (callee.name === 'String' || callee.name === 'Number') &&
      e.arguments.length === 1
    ) {
      return isIndexExpression(e.arguments[0] as Expression, index);
    }
    if (
      callee.type === 'MemberExpression' &&
      !callee.computed &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 'toString' &&
      e.arguments.length === 0
    ) {
      return isIndexExpression(callee.object as Expression, index);
    }
    return false;
  }
  if (e.type === 'TemplateLiteral') {
    const exprs = e.expressions;
    if (exprs.length !== 1) return false;
    const hasText = e.quasis.some((q) => (q.value.cooked ?? q.value.raw) !== '');
    if (hasText) return false;
    return isIndexExpression(exprs[0]!, index);
  }
  if (e.type === 'BinaryExpression' && e.operator === '+') {
    const emptyString = (n: Expression): boolean => n.type === 'Literal' && n.value === '';
    if (emptyString(e.left as Expression)) return isIndexExpression(e.right, index);
    if (emptyString(e.right)) return isIndexExpression(e.left as Expression, index);
  }
  return false;
}

/**
 * Whether the block's key expression is its index binding or a trivial
 * stringification of it (`{#each items as item, i (i)}`, `(String(i))`,
 * `` (`${i}`) ``, `(i.toString())`) — position-based identity, the anti-pattern
 * Svelte's docs call out ("do not use the index as a key"). Composite keys that
 * merely CONTAIN the index add uniqueness and are never matched
 * (correctness/each-index-key).
 */
function isIndexKey(each: AST.EachBlock): boolean {
  if (typeof each.index !== 'string' || each.key == null) return false;
  return isIndexExpression(each.key, each.index);
}

/** Recursively collect every `{#each}` block in the template (correctness/each-key). */
function collectEachBlocks(node: Node, source: string, acc: EachBlockFact[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectEachBlocks(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  // Itemless each (`{#each { length: 8 }, i}` — the docs' "render N times" pattern,
  // e.g. a chess board) has no item identity to key on; the only possible key is
  // the index itself, which is a no-op. Flagging it would be a false positive.
  if (node.type === 'EachBlock' && node.context != null && !isIdentityFreeEach(node)) {
    acc.push({
      hasKey: node.key != null,
      line: lineOf(source, node.start),
      ...(isIndexKey(node) ? { indexKey: true } : {})
    });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectEachBlocks(node[key], source, acc);
  }
}

/** AST metadata keys every walker skips — never traversed as child nodes. Shared with the Kit-module parser (the security kit-module rules). */
export const WALK_IGNORED_KEYS = new Set(['type', 'start', 'end', 'loc', 'range']);

/** Boundary set for the walkers that enter every node (walkEstree, walkScoped). */
const NO_BOUNDARIES: Set<string> = new Set();

/** Generic ESTree walk over a `<script>` program: visit every node with a `.type`. */
function walkEstree(node: Node, visit: (n: Node) => void): void {
  walkEvalScope(node, (n) => void visit(n), new Set(), NO_BOUNDARIES);
}

/**
 * Whether a CallExpression *creates an effect*: `$effect(...)` or `$effect.pre(...)`.
 * Excludes the non-effect `$effect.*` readers (`$effect.tracking()`, `$effect.root()`),
 * which would otherwise be recorded as effects and seed spurious correctness/effect-as-derived pass units.
 */
function isEffectCall(node: Node): boolean {
  const c = node?.callee;
  if (c?.type === 'Identifier') return c.name === '$effect';
  if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === '$effect') {
    return c.property?.type === 'Identifier' && c.property.name === 'pre';
  }
  return false;
}

/** Whether a CallExpression is `$effect.root(...)` — a legal standalone reactive scope (correctness/orphan-effect). */
function isEffectRootCall(node: Node): boolean {
  const c = node?.callee;
  return (
    c?.type === 'MemberExpression' &&
    c.object?.type === 'Identifier' &&
    c.object.name === '$effect' &&
    c.property?.type === 'Identifier' &&
    c.property.name === 'root'
  );
}

/**
 * Whether a CallExpression is a `$state` *declaration* form: `$state(...)`,
 * `$state.raw(...)`, or `$state.frozen(...)` — but NOT readers like
 * `$state.snapshot(...)`, which would otherwise pollute the state-name set (correctness/effect-as-derived).
 */
function isStateDeclaration(node: Node): boolean {
  const c = node?.callee;
  if (c?.type === 'Identifier') return c.name === '$state';
  if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === '$state') {
    return c.property?.type === 'Identifier' && (c.property.name === 'raw' || c.property.name === 'frozen');
  }
  return false;
}

/** True when a function's body does nothing but assign to `$state` identifiers (correctness/effect-as-derived). */
function bodyOnlyAssignsState(fn: Node, stateNames: Set<string>): boolean {
  // Only a plain `=` is a derive candidate. Compound assignments (`+=`, `*=`, `??=`, …)
  // read the previous value, so they accumulate rather than derive and can't become a
  // self-referential `$derived` — flagging them would be a false positive.
  const isStateAssign = (expr: Node): boolean =>
    expr?.type === 'AssignmentExpression' &&
    expr.operator === '=' &&
    expr.left?.type === 'Identifier' &&
    stateNames.has(expr.left.name);
  const body = fn?.body;
  if (!body) return false;
  if (body.type !== 'BlockStatement') return isStateAssign(body); // arrow with expression body
  if (body.body.length === 0) return false;
  return body.body.every((s: Node) => s?.type === 'ExpressionStatement' && isStateAssign(s.expression));
}

/** `$derived(...)` or `$derived.by(...)` declaration form. */
function isDerivedDeclaration(node: Node): boolean {
  const c = node?.callee;
  if (c?.type === 'Identifier') return c.name === '$derived';
  if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === '$derived') {
    return c.property?.type === 'Identifier' && c.property.name === 'by';
  }
  return false;
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

/**
 * Like `walkEstree`, but threads a "shadowed names" set down through scope-introducing
 * constructs (`scopeIntroducedNames`) so `visit` can check whether a candidate identifier
 * is locally shadowed before treating it as a match against an outer binding.
 */
function walkScoped(
  node: Node,
  visit: (n: Node, shadowed: Set<string>) => void,
  shadowed: Set<string> = new Set()
): void {
  walkEvalScope(node, (n, scope) => void visit(n, scope), shadowed, NO_BOUNDARIES);
}

/**
 * Add state names that are WRITTEN or ESCAPED (correctness/unmutated-state rules 1–4): reassignment,
 * update, member/element assignment, method call on the state, or the state passed
 * as a call argument. Run over the instance program AND the template fragment
 * (inline handlers mutate state in the template). Scope-aware (issue #140): a local
 * that shadows a state's name (a function param, block-scoped let/const, {#each}
 * context, …) does not mark the outer state as written/escaped. The optional
 * `kinds` map additionally classifies each hit — 'reassign' (whole-binding
 * writes), 'mutate' (member/element writes, delete, member updates, method
 * calls), 'escape' (call arguments) — for consumers that need the distinction
 * (performance/state-raw); the `acc` union contract is unchanged.
 */
type WriteKind = 'reassign' | 'mutate' | 'escape';

function collectStateWrites(
  root: Node,
  stateNames: Set<string>,
  acc: Set<string>,
  kinds?: Map<string, Set<WriteKind>>
): void {
  const record = (name: string, kind: WriteKind): void => {
    acc.add(name);
    if (kinds) {
      let set = kinds.get(name);
      if (!set) kinds.set(name, (set = new Set()));
      set.add(kind);
    }
  };
  walkScoped(root, (n: Node, scope: Set<string>) => {
    const shadowed = (name: string | undefined): boolean => name === undefined || scope.has(name);
    if (n?.type === 'AssignmentExpression') {
      if (n.left?.type === 'Identifier' && stateNames.has(n.left.name) && !shadowed(n.left.name)) {
        record(n.left.name, 'reassign');
      } else if (n.left?.type === 'MemberExpression') {
        const r = rootObjectName(n.left);
        if (r && stateNames.has(r) && !shadowed(r)) record(r, 'mutate');
      } else if (n.left?.type === 'ObjectPattern' || n.left?.type === 'ArrayPattern') {
        // Destructuring-assignment target, e.g. `({ count } = obj)` or `[count] = arr`.
        const bound = new Set<string>();
        addBoundNames(n.left, bound);
        for (const name of bound) if (stateNames.has(name) && !shadowed(name)) record(name, 'reassign');
      }
    } else if (n?.type === 'UpdateExpression') {
      // A bare `x++` rewrites the whole binding (reassign); `x.count++` mutates within it.
      if (n.argument?.type === 'Identifier') {
        if (stateNames.has(n.argument.name) && !shadowed(n.argument.name)) record(n.argument.name, 'reassign');
      } else {
        const r = rootObjectName(n.argument);
        if (r && stateNames.has(r) && !shadowed(r)) record(r, 'mutate'); // x.count++, x[i]++
      }
    } else if (n?.type === 'UnaryExpression' && n.operator === 'delete') {
      const r = rootObjectName(n.argument);
      if (r && stateNames.has(r) && !shadowed(r)) record(r, 'mutate');
    } else if (n?.type === 'CallExpression') {
      if (n.callee?.type === 'MemberExpression') {
        const r = rootObjectName(n.callee);
        if (r && stateNames.has(r) && !shadowed(r)) record(r, 'mutate'); // x.push(), x.foo()
      }
      for (const a of n.arguments ?? []) {
        // Unwrap a spread argument (`f(...x)`, `f(...x.items)`) to its expression.
        const arg = a?.type === 'SpreadElement' ? a.argument : a;
        const r = rootObjectName(arg);
        if (r && stateNames.has(r) && !shadowed(r)) record(r, 'escape'); // f(x), f(x.a), f(...x)
      }
    }
  });
}

/** Function-shaped nodes whose bodies defer evaluation — prop reads inside them stay reactive (compiled to call-time reads). */
function isDeferredBody(n: Node): boolean {
  return n?.type === 'FunctionDeclaration' || n?.type === 'FunctionExpression' || n?.type === 'ArrowFunctionExpression';
}

/** A plain `$state(...)` call — bare-Identifier callee, never `$state.raw`/`$state.frozen` (performance/state-raw candidates only; `isStateDeclaration` stays raw-inclusive for `stateNames`). */
function isPlainStateCall(node: Node): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === '$state';
}

/** Built-in classes with reactive drop-ins in svelte/reactivity — plain instances in $state are NOT deep-proxied, so their mutations are untracked (correctness/nonreactive-builtin-state). */
const BUILTIN_STATE_TYPES = new Set(['Map', 'Set', 'Date', 'URL', 'URLSearchParams']);

/** Type-specific mutating methods. URL mutates via property writes and deep searchParams calls only. */
const BUILTIN_MUTATIONS: Record<string, Set<string>> = {
  Map: new Set(['set', 'delete', 'clear']),
  Set: new Set(['add', 'delete', 'clear']),
  Date: new Set([
    'setTime',
    'setFullYear',
    'setMonth',
    'setDate',
    'setHours',
    'setMinutes',
    'setSeconds',
    'setMilliseconds',
    'setYear',
    'setUTCFullYear',
    'setUTCMonth',
    'setUTCDate',
    'setUTCHours',
    'setUTCMinutes',
    'setUTCSeconds',
    'setUTCMilliseconds'
  ]),
  URL: new Set<string>(),
  URLSearchParams: new Set(['append', 'set', 'delete', 'sort'])
};

/**
 * Signals for correctness/nonreactive-builtin-state, per candidate binding
 * (name → constructor type): `mutated` collects type-specific mutations that
 * happen INSIDE a function body (a top-level init mutation runs before first
 * render and can never leave the UI stale); `reassigned` collects whole-binding
 * reassignments ANYWHERE (a fresh reassignment after mutation makes the code
 * work) — except the bare self-assignment `b = b`, a no-op under $state's
 * referential equality in Svelte 5, which must not exempt. Member writes
 * (assignment / update / `delete`) and deep member calls count as mutation
 * only for URL bindings (URL mutates via properties: `u.href = …`,
 * `u.searchParams.set(...)` — final method in the URLSearchParams set); the
 * other types count only direct calls from their own method table, so an
 * expando-property write on a Map never flags (SvelteMap would not track it
 * either). Deep reads (`get`, `has`, …) never count. Shadow-aware; class
 * bodies count as function depth.
 */
function collectBuiltinStateSignals(
  node: Node,
  candidates: Map<string, string>,
  mutated: Set<string>,
  reassigned: Set<string>,
  shadowed: Set<string> = new Set(),
  inFunction = false
): void {
  if (Array.isArray(node)) {
    for (const child of node) collectBuiltinStateSignals(child, candidates, mutated, reassigned, shadowed, inFunction);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  const boundary = isDeferredBody(node) || node.type === 'ClassDeclaration' || node.type === 'ClassExpression';
  const nextInFunction = inFunction || boundary;
  const hit = (name: unknown): string | undefined =>
    typeof name === 'string' && candidates.has(name) && !scope.has(name) ? name : undefined;

  if (node.type === 'AssignmentExpression') {
    if (node.left?.type === 'Identifier') {
      const n = hit(node.left.name);
      const isBareSelfAssign = node.right?.type === 'Identifier' && node.right.name === n;
      if (n && !isBareSelfAssign) reassigned.add(n);
    } else if (node.left?.type === 'ObjectPattern' || node.left?.type === 'ArrayPattern') {
      const bound = new Set<string>();
      addBoundNames(node.left, bound);
      for (const name of bound) {
        const n = hit(name);
        if (n) reassigned.add(n);
      }
    } else if (node.left?.type === 'MemberExpression' && inFunction) {
      const n = hit(rootObjectName(node.left));
      if (n && candidates.get(n) === 'URL') mutated.add(n);
    }
  } else if (node.type === 'UpdateExpression' && node.argument?.type === 'MemberExpression' && inFunction) {
    const n = hit(rootObjectName(node.argument));
    if (n && candidates.get(n) === 'URL') mutated.add(n);
  } else if (node.type === 'UnaryExpression' && node.operator === 'delete' && inFunction) {
    const n = hit(rootObjectName(node.argument));
    if (n && candidates.get(n) === 'URL') mutated.add(n);
  } else if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    inFunction
  ) {
    const method = node.callee.property?.name;
    if (typeof method === 'string') {
      if (node.callee.object?.type === 'Identifier') {
        const n = hit(node.callee.object.name);
        if (n && BUILTIN_MUTATIONS[candidates.get(n)!]?.has(method)) mutated.add(n);
      } else if (node.callee.object?.type === 'MemberExpression') {
        const n = hit(rootObjectName(node.callee));
        if (n && candidates.get(n) === 'URL' && BUILTIN_MUTATIONS.URLSearchParams!.has(method)) mutated.add(n);
      }
    }
  }

  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    collectBuiltinStateSignals(node[key], candidates, mutated, reassigned, scope, nextInFunction);
  }
}

/**
 * Scan a binding pattern (a `VariableDeclarator.id`, or nested inside one) for
 * real references hiding inside it, while skipping the bound identifiers
 * themselves — a binding site is never a read. `const { a } = x` binds `a`,
 * no reference to anything; `const { a = obj } = x` reads `obj` (an
 * `AssignmentPattern`'s default-value RHS is a real expression position);
 * `const { [obj]: a } = x` reads `obj` as a computed key. Both cases hand off
 * to `collectAliasRefs` (normal expression-walk semantics) for the referenced
 * subtree; only the pattern shape itself (`ObjectPattern`/`ArrayPattern`/
 * `RestElement`/`AssignmentPattern` bound side) is walked specially here.
 */
function collectPatternAliasRefs(
  node: Node,
  names: Set<string>,
  acc: Set<string>,
  scope: Set<string>,
  ownRhs: string | null
): void {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (node.type === 'Identifier') return; // bound name, not a reference
  if (node.type === 'ObjectPattern') {
    for (const prop of node.properties ?? []) {
      if (prop?.type === 'RestElement') {
        collectPatternAliasRefs(prop.argument, names, acc, scope, ownRhs);
      } else if (prop?.type === 'Property') {
        if (prop.computed) collectAliasRefs(prop.key, names, acc, scope, ownRhs);
        collectPatternAliasRefs(prop.value, names, acc, scope, ownRhs);
      }
    }
    return;
  }
  if (node.type === 'ArrayPattern') {
    for (const el of node.elements ?? []) collectPatternAliasRefs(el, names, acc, scope, ownRhs);
    return;
  }
  if (node.type === 'AssignmentPattern') {
    collectPatternAliasRefs(node.left, names, acc, scope, ownRhs);
    collectAliasRefs(node.right, names, acc, scope, ownRhs);
    return;
  }
  if (node.type === 'RestElement') {
    collectPatternAliasRefs(node.argument, names, acc, scope, ownRhs);
  }
}

/**
 * Bare references to candidate names outside their own reassignments — aliasing
 * escapes (performance/state-raw condition 4). Nearest-enclosing-assignment
 * semantics: a reference is exempt only while the CLOSEST surrounding
 * AssignmentExpression assigns to that same candidate (`list = [...list, x]`
 * qualifies; `obj = (cache = obj)` does not). Skips the assignment LHS itself
 * and non-computed member properties/keys; shadow-aware. A `VariableDeclarator`
 * routes its `id` through `collectPatternAliasRefs` — bound names in the
 * pattern are never references, but destructuring defaults and computed keys
 * are — so the candidate's own `$state(literal)` declarator contains no
 * self-reference; `let b = $state([...list])` referencing ANOTHER candidate
 * still correctly counts as an alias escape of `list` via `init`. Walks
 * whatever subtree it is given — callers choose the roots.
 */
function collectAliasRefs(
  node: Node,
  names: Set<string>,
  acc: Set<string>,
  shadowed: Set<string> = new Set(),
  ownRhs: string | null = null
): void {
  if (Array.isArray(node)) {
    for (const child of node) collectAliasRefs(child, names, acc, shadowed, ownRhs);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  if (node.type === 'AssignmentExpression') {
    const lhsIsCandidate = node.left?.type === 'Identifier' && names.has(node.left.name) && !scope.has(node.left.name);
    if (!lhsIsCandidate) collectAliasRefs(node.left, names, acc, scope, null);
    collectAliasRefs(node.right, names, acc, scope, lhsIsCandidate ? node.left.name : null);
    return;
  }
  if (node.type === 'VariableDeclarator') {
    collectPatternAliasRefs(node.id, names, acc, scope, ownRhs);
    if (node.init) collectAliasRefs(node.init, names, acc, scope, ownRhs);
    return;
  }
  if (node.type === 'Identifier' && names.has(node.name) && !scope.has(node.name) && node.name !== ownRhs) {
    acc.add(node.name);
    return;
  }
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    if (node.type === 'MemberExpression' && key === 'property' && !node.computed) continue;
    if (node.type === 'Property' && key === 'key' && !node.computed) continue;
    collectAliasRefs(node[key], names, acc, scope, ownRhs);
  }
}

/**
 * Alias scan over the fragment: template READ positions are exempt, but function
 * bodies inside the template (inline handlers) are not — `onclick={() => (cache = obj)}`
 * escapes. Threads template shadowing (each contexts etc.) into the handler scan.
 */
function collectFragmentAliasRefs(
  node: Node,
  names: Set<string>,
  acc: Set<string>,
  shadowed: Set<string> = new Set()
): void {
  if (Array.isArray(node)) {
    for (const child of node) collectFragmentAliasRefs(child, names, acc, shadowed);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (isDeferredBody(node)) {
    const introduced = scopeIntroducedNames(node);
    const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
    collectAliasRefs(node.body, names, acc, scope, null);
    return;
  }
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  if (Array.isArray(node.attributes)) collectFragmentAliasRefs(node.attributes, names, acc, scope);
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key) || key === 'attributes') continue;
    collectFragmentAliasRefs(node[key], names, acc, scope);
  }
}

/**
 * Each-context taint (performance/state-raw condition 5): for `{#each candidate as item}`
 * or `{#each candidate.path as item}`, any mutate/escape of the context binding (or index)
 * inside the block — member writes, method calls, call arguments, `bind:`, component props —
 * disqualifies the candidate over the candidate or a member path of it
 * (`{#each obj.items as item}`): item-level edits stop being reactive under $state.raw.
 * Pure reassignments of the context name are ignored (they don't touch the list's contents).
 */
function collectEachContextTaint(
  node: Node,
  names: Set<string>,
  acc: Set<string>,
  shadowed: Set<string> = new Set()
): void {
  if (Array.isArray(node)) {
    for (const child of node) collectEachContextTaint(child, names, acc, shadowed);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  if (node.type === 'EachBlock') {
    const expr = unwrapTs(node.expression);
    const target =
      expr?.type === 'Identifier' ? expr.name : expr?.type === 'MemberExpression' ? rootObjectName(expr) : undefined;
    if (target !== undefined && names.has(target) && !shadowed.has(target)) {
      const ctxNames = new Set<string>();
      addBoundNames(node.context, ctxNames);
      if (typeof node.index === 'string') ctxNames.add(node.index);
      if (ctxNames.size > 0) {
        const union = new Set<string>();
        const kinds = new Map<string, Set<WriteKind>>();
        collectStateWrites(node.body, ctxNames, union, kinds);
        collectTemplateEscapes(node.body, ctxNames, union, kinds);
        const dirty = [...union].some((n) => {
          const k = kinds.get(n);
          return !k || [...k].some((kind) => kind !== 'reassign');
        });
        if (dirty) acc.add(target);
      }
    }
  }
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    collectEachContextTaint(node[key], names, acc, scope);
  }
}

/**
 * Whether `node` references any of `names` in an EAGER position: nested
 * function/arrow bodies (incl. object getters/methods, whose values are
 * FunctionExpressions) are skipped — the compiler defers those reads to call
 * time, so they stay reactive. Non-computed member properties and object keys
 * are not references. Shadow-aware via `scopeIntroducedNames`.
 */
function refsNamesEagerly(node: Node, names: Set<string>, shadowed: Set<string> = new Set()): boolean {
  if (Array.isArray(node)) return node.some((c) => refsNamesEagerly(c, names, shadowed));
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return false;
  if (isDeferredBody(node)) return false;
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  if (node.type === 'Identifier' && names.has(node.name) && !scope.has(node.name)) return true;
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    if (node.type === 'MemberExpression' && key === 'property' && !node.computed) continue;
    if (node.type === 'Property' && key === 'key' && !node.computed) continue;
    if (refsNamesEagerly(node[key], names, scope)) return true;
  }
  return false;
}

/** Whether the subtree contains any call, construction, or await — used to keep stale-prop candidates to plain expressions (rune wrappers and helper/service calls are all excluded structurally). */
function containsCallLike(node: Node): boolean {
  let found = false;
  walkEstree(node, (n: Node) => {
    if (n?.type === 'CallExpression' || n?.type === 'NewExpression' || n?.type === 'AwaitExpression') found = true;
  });
  return found;
}

/**
 * Names from `names` referenced in the template fragment in an eager position:
 * expression tags, attribute/directive expressions, and block expressions count;
 * inline-handler function bodies do NOT (deferred reads never render), while
 * `{#snippet}` bodies DO (render content). Shadow-aware for template scopes
 * (each contexts + index, snippet parameters, await value/error).
 */
function collectFragmentRefs(
  node: Node,
  names: Set<string>,
  acc: Set<string>,
  shadowed: Set<string> = new Set()
): void {
  if (Array.isArray(node)) {
    for (const c of node) collectFragmentRefs(c, names, acc, shadowed);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (isDeferredBody(node)) return;
  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  if (node.type === 'Identifier' && names.has(node.name) && !scope.has(node.name)) acc.add(node.name);
  if (node.type === 'EachBlock' || node.type === 'AwaitBlock') {
    // The header expression evaluates in the OUTER scope — the block's own
    // bindings (each context/index, await value/error) exist only in its body
    // and key, not in the expression that feeds the block.
    collectFragmentRefs(node.expression, names, acc, shadowed);
    for (const key of Object.keys(node)) {
      if (WALK_IGNORED_KEYS.has(key) || key === 'expression') continue;
      collectFragmentRefs(node[key], names, acc, scope);
    }
    return;
  }
  if (Array.isArray(node.attributes)) collectFragmentRefs(node.attributes, names, acc, scope);
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key) || key === 'attributes') continue;
    if (node.type === 'MemberExpression' && key === 'property' && !node.computed) continue;
    if (node.type === 'Property' && key === 'key' && !node.computed) continue;
    collectFragmentRefs(node[key], names, acc, scope);
  }
}

/**
 * Stale prop derivations (correctness/stale-prop-derivation): top-level
 * const/let/var Identifier declarators whose CALL-FREE initializer references a
 * prop eagerly. Reassignment/escape and template-reference filtering happen at
 * the call site, where the fragment is available.
 */
function collectStalePropCandidates(
  program: Node,
  propNames: Set<string>,
  source: string
): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'VariableDeclaration') continue;
    for (const d of stmt.declarations ?? []) {
      if (d?.id?.type !== 'Identifier' || !d.init) continue;
      if (containsCallLike(d.init)) continue;
      if (!refsNamesEagerly(d.init, propNames)) continue;
      out.push({ name: d.id.name, line: lineOf(source, d.start) });
    }
  }
  return out;
}

/**
 * Component-like nodes whose attributes are props passed INTO another component
 * (an escape), as opposed to `SvelteElement` (`<svelte:element this={...}>`), whose
 * attributes are DOM-attribute reads on a dynamically-named element — not an escape.
 */
const COMPONENT_LIKE_TYPES = new Set(['Component', 'SvelteComponent', 'SvelteSelf']);

/**
 * Add state names ESCAPED via the template (correctness/unmutated-state rules 5–6): a `bind:` on any
 * element, or passed as a prop to a component (static `<Foo>`, or dynamic
 * `<svelte:component>`/`<svelte:self>`). Slot children / DOM-attribute reads do
 * not escape. `CHILD_NODE_KEYS` omits `attributes`, so inspect them explicitly.
 * The optional `kinds` map records every hit as 'escape' for consumers that need
 * the classification (performance/state-raw); the `acc` union contract is unchanged.
 */
function collectTemplateEscapes(
  node: Node,
  stateNames: Set<string>,
  acc: Set<string>,
  kinds?: Map<string, Set<WriteKind>>
): void {
  const record = (name: string): void => {
    acc.add(name);
    if (kinds) {
      let set = kinds.get(name);
      if (!set) kinds.set(name, (set = new Set()));
      set.add('escape');
    }
  };
  if (Array.isArray(node)) {
    for (const c of node) collectTemplateEscapes(c, stateNames, acc, kinds);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (Array.isArray(node.attributes)) {
    for (const attr of node.attributes) {
      if (attr?.type === 'BindDirective') {
        const r = rootObjectName(attr.expression);
        if (r && stateNames.has(r)) record(r);
      } else if (COMPONENT_LIKE_TYPES.has(node.type)) {
        walkEstree(attr, (m: Node) => {
          if (m?.type === 'Identifier' && stateNames.has(m.name)) record(m.name);
        });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectTemplateEscapes(node[key], stateNames, acc, kinds);
  }
}

/** Directive types verified against svelte 5 modern-AST output: `use:x={obj}` → `UseDirective`, `transition:x={obj}` → `TransitionDirective`, `animate:x={obj}` → `AnimateDirective`. */
const DIRECTIVE_ESCAPE_TYPES = new Set(['UseDirective', 'TransitionDirective', 'AnimateDirective']);

/**
 * Directive expressions that hand a value to arbitrary code — `use:action={obj}`,
 * `transition:fn={obj}`, `animate:fn={obj}` — are reference handoffs, the same class
 * as a call argument. Serves `performance/state-raw` and `correctness/unmutated-state`
 * (the receiving code may mutate the proxy invisibly, so such state is neither
 * raw-able nor "unused"). The shared template-escape collector deliberately still
 * excludes directives so `correctness/stale-prop-derivation`'s disqualification set
 * is unchanged — a stale prop-derived value handed to an action is still worth flagging.
 */
function collectDirectiveEscapes(node: Node, names: Set<string>, acc: Set<string>): void {
  if (Array.isArray(node)) {
    for (const c of node) collectDirectiveEscapes(c, names, acc);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (Array.isArray(node.attributes)) {
    for (const attr of node.attributes) {
      if (DIRECTIVE_ESCAPE_TYPES.has(attr?.type) && attr.expression) {
        walkEstree(attr.expression, (m: Node) => {
          if (m?.type === 'Identifier' && names.has(m.name)) acc.add(m.name);
        });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectDirectiveEscapes(node[key], names, acc);
  }
}

const RUNE_NAMES = new Set(['$state', '$derived', '$effect', '$props', '$bindable', '$inspect', '$host']);

/**
 * Local names bound by any non-type-only import specifier (default, named, or namespace),
 * anywhere in a program (correctness/effect-as-onmount). An imported binding is opaque to this
 * analysis — it may be a runes-module state object, a `svelte/reactivity`/`svelte/reactivity/window`
 * constructor or live binding, or anything else carrying hidden reactivity — so member reads on
 * it are folded into `reactiveNames` rather than risk telling someone to replace a live effect
 * with `onMount`.
 */
function collectImportedLocalNames(program: Node, acc: Set<string>): void {
  for (const stmt of program?.body ?? []) {
    if (stmt?.type !== 'ImportDeclaration' || stmt.importKind === 'type') continue;
    for (const s of stmt.specifiers ?? []) {
      if (s?.importKind === 'type' || s?.local?.type !== 'Identifier') continue;
      acc.add(s.local.name);
    }
  }
}

/**
 * Local names declared with a `new …()` initializer (`const x = new Foo()`), anywhere in a
 * program (correctness/effect-as-onmount). A class instance is opaque the same way an import is —
 * it may carry `$state` fields — so it's folded into `reactiveNames` alongside imports.
 * Declarator-init only: `let x; x = new Foo();` is not seen (`VariableDeclarator.init` is unset,
 * and the later `AssignmentExpression` isn't a declarator at all) — a rarer style, left
 * undetected rather than adding an assignment-tracking pass for it.
 */
function collectNewExprLocalNames(program: Node, acc: Set<string>): void {
  walkEstree(program, (n) => {
    if (n.type !== 'VariableDeclarator' || n.id?.type !== 'Identifier' || !n.init) return;
    if (unwrapTs(n.init).type === 'NewExpression') acc.add(n.id.name);
  });
}

/**
 * Whether an $effect callback body reads a reactive value (correctness/effect-as-onmount, conservative):
 * a reactive name (rune declarator, imported binding, or a local declared with a `new …()`
 * initializer — see `collectImportedLocalNames`/`collectNewExprLocalNames`), a `$`-prefixed
 * store subscription, or any bare-identifier call. Still blind to a reactive value reached only
 * through a plain function call's return value (`const c = createCounter()`) or a
 * prop-drilled/destructured member of one of the above — narrower than "any" reactive read,
 * deliberately: those shapes have no syntactic marker to key off, so treating them as reactive by
 * default would give up detection entirely rather than narrow it.
 */
function bodyReadsReactive(fn: Node, reactiveNames: Set<string>): boolean {
  let reads = false;
  // Dedicated walk (not the generic walkEstree) so a non-computed property NAME
  // (`obj.count`, `{ count: 5 }`) that happens to match a reactive binding isn't
  // misread as a reactive read — only value/computed positions count.
  const visit = (n: Node): void => {
    if (reads || !n) return;
    if (Array.isArray(n)) {
      for (const c of n) visit(c);
      return;
    }
    if (typeof n !== 'object' || typeof n.type !== 'string') return;
    if (n.type === 'Identifier') {
      if (reactiveNames.has(n.name) || (n.name.startsWith('$') && !RUNE_NAMES.has(n.name))) reads = true;
      return;
    }
    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier') {
      reads = true; // bare-identifier call may read reactive state internally
      return;
    }
    if (n.type === 'MemberExpression') {
      visit(n.object);
      if (n.computed) visit(n.property); // `obj[count]` reads count; `obj.count` does not
      return;
    }
    if (n.type === 'Property') {
      if (n.computed) visit(n.key);
      visit(n.value);
      return;
    }
    for (const key of Object.keys(n)) {
      if (!WALK_IGNORED_KEYS.has(key)) visit(n[key]);
    }
  };
  visit(fn.body);
  return reads;
}

/** Empty effect callback body (`() => {}` or no body). */
function bodyIsEmpty(fn: Node): boolean {
  const body = fn?.body;
  if (!body) return true;
  if (body.type === 'BlockStatement') return (body.body ?? []).length === 0;
  return false;
}

/** Attributes whose value navigates/executes — a literal `javascript:` here is an XSS vector (security/javascript-url). */
const URL_ATTRS = ['href', 'src', 'action', 'formaction'];

/** Native checkable input types where bind:value binds the wrong DOM property (correctness/checkable-bind-value). */
const CHECKABLE_INPUT_TYPES = new Set(['checkbox', 'radio']);

/** Recursively collect Security facts: `{@html}` tags and literal `javascript:` URLs (security/raw-html, security/javascript-url). */
function collectSecurityFacts(node: Node, source: string, htmlTags: SourceSpan[], jsUrls: SourceSpan[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectSecurityFacts(child, source, htmlTags, jsUrls);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'HtmlTag') htmlTags.push({ line: lineOf(source, node.start) });
  // RegularElement = static <a>/<iframe>/…; SvelteElement = <svelte:element this="a" …>.
  if ((node.type === 'RegularElement' || node.type === 'SvelteElement') && Array.isArray(node.attributes)) {
    for (const name of URL_ATTRS) {
      const attr = findAttr(node.attributes, name);
      if (!attr) continue;
      // Fully-literal value only. A dynamic `href={url}` OR a mixed `href="{base}javascript:.."`
      // yields undefined — we can't know the rendered URL statically, so we don't flag it.
      const value = attrTextOf(attr);
      if (value !== undefined && /^\s*javascript:/i.test(value)) {
        jsUrls.push({ line: lineOf(source, attr.start ?? node.start) });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectSecurityFacts(node[key], source, htmlTags, jsUrls);
  }
}

/**
 * `<input type="checkbox">` / `<input type="radio">` elements carrying a `bind:value`
 * directive (correctness/checkable-bind-value) — bind:value binds the DOM value property,
 * which checkbox/radio interaction never changes, so the bound state silently never updates.
 * Only `RegularElement` (a static `<input>`) is checked, so a dynamic tag via
 * `<svelte:element this="input" …>` is naturally skipped (it is a different node type). A
 * dynamic `type={expr}` makes `attrTextOf` return `undefined`, which is also skipped.
 */
function collectCheckableBindValues(node: Node, source: string, acc: CheckableBindValueFact[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectCheckableBindValues(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && node.name === 'input' && Array.isArray(node.attributes)) {
    const typeAttr = findAttr(node.attributes, 'type');
    const typeValue = typeAttr ? attrTextOf(typeAttr) : undefined;
    if (typeValue && CHECKABLE_INPUT_TYPES.has(typeValue)) {
      const bindValue = node.attributes.find((a: Node) => a?.type === 'BindDirective' && a.name === 'value');
      if (bindValue) {
        acc.push({
          kind: typeValue as 'checkbox' | 'radio',
          line: lineOf(source, bindValue.start ?? node.start)
        });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectCheckableBindValues(node[key], source, acc);
  }
}

/** Classify a single Attribute's raw `value`: bare (`true`) is a literal `''`, a single Text
 *  node is its literal text, anything else (an ExpressionTag or a multi-part template) is dynamic. */
function classifyAttrValue(value: unknown): { literal?: string } | { expression: true } {
  if (value === true) return { literal: '' };
  if (Array.isArray(value) && value.length === 1 && value[0]?.type === 'Text') {
    return { literal: String(value[0].data ?? '') };
  }
  return { expression: true };
}

/**
 * Elements carrying a `role` and/or `aria-*` attribute(s) (a11y ARIA rules). Only
 * `RegularElement` is checked, so `<svelte:element this="div" role="…">` is out of static reach —
 * same convention as `collectCheckableBindValues`/`collectHrefLinks`.
 */
function collectAriaElements(node: Node, source: string, acc: AriaElementFact[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectAriaElements(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && Array.isArray(node.attributes)) {
    const roleAttr = findAttr(node.attributes, 'role');
    const ariaAttrs = node.attributes.filter(
      (a: Node) => a?.type === 'Attribute' && typeof a.name === 'string' && a.name.startsWith('aria-')
    );
    if (roleAttr || ariaAttrs.length > 0) {
      const inputType = node.name === 'input' ? attrText(node.attributes, 'type') : undefined;
      acc.push({
        tag: node.name,
        line: lineOf(source, node.start),
        ...(roleAttr ? { role: classifyAttrValue(roleAttr.value) } : {}),
        ...(inputType !== undefined ? { inputType: inputType.toLowerCase() } : {}),
        aria: ariaAttrs.map((a: Node) => ({
          name: a.name,
          line: lineOf(source, a.start ?? node.start),
          ...classifyAttrValue(a.value)
        }))
      });
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectAriaElements(node[key], source, acc);
  }
}

/** This element's `Attribute` nodes (directives/spreads excluded) as `isInteractiveElement`'s
 *  input shape. */
function elementAttrs(attributes: Node[]): ElementAttr[] {
  return attributes
    .filter((a: Node) => a?.type === 'Attribute' && typeof a.name === 'string')
    .map((a: Node) => ({ name: a.name, ...classifyAttrValue(a.value) }));
}

/**
 * Interactive elements nested inside another interactive container (a11y/interactive-nesting).
 * Only `RegularElement` is checked, so `<svelte:element this="button">` is out of static reach
 * — same convention as `collectAriaElements`. `stack` tracks the tags of enclosing containers
 * (`isInteractiveContainer`); any interactive element entering while it is non-empty records
 * one fact at the descendant's line, keyed to the nearest enclosing container.
 */
function collectInteractiveNestings(node: Node, source: string, acc: InteractiveNestingFact[], stack: string[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectInteractiveNestings(child, source, acc, stack);
    return;
  }
  if (!node || typeof node !== 'object') return;
  let opened = false;
  if (node.type === 'RegularElement' && Array.isArray(node.attributes)) {
    const attrs = elementAttrs(node.attributes);
    if (stack.length > 0 && isInteractiveElement(node.name, attrs)) {
      acc.push({
        containerTag: stack[stack.length - 1]!,
        descendantTag: node.name,
        line: lineOf(source, node.start)
      });
    }
    if (isInteractiveContainer(node.name, attrs)) {
      stack.push(node.name);
      opened = true;
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectInteractiveNestings(node[key], source, acc, stack);
  }
  if (opened) stack.pop();
}

/** `aria-label`/`aria-labelledby`/`title` present on this element: a literal non-empty value,
 *  or any expression (its rendered value is unknowable, but its *presence* is enough to name
 *  the element — a11y/accessible-name treats an expression name source as present). */
function hasNamingAttr(attributes: Node[]): boolean {
  return ['aria-label', 'aria-labelledby', 'title'].some((name) => {
    const attr = findAttr(attributes, name);
    if (!attr) return false;
    const v = classifyAttrValue(attr.value);
    return 'expression' in v || (v.literal !== undefined && v.literal.trim().length > 0);
  });
}

/** Named/unknowable verdict for a candidate interactive element's descendant subtree
 *  (a11y/accessible-name). `named`: a non-whitespace text descendant, or a descendant `img`
 *  with a non-empty literal `alt`. `unknowable`: an expression-tag, `Component`, `{@render}`,
 *  or `{@html}` anywhere below — content the rule cannot statically resolve, so the element is
 *  skipped rather than risk a false positive. */
function scanAccessibleNameSubtree(node: Node): { named: boolean; unknowable: boolean } {
  if (Array.isArray(node)) {
    const acc = { named: false, unknowable: false };
    for (const child of node) {
      const r = scanAccessibleNameSubtree(child);
      acc.named ||= r.named;
      acc.unknowable ||= r.unknowable;
    }
    return acc;
  }
  if (!node || typeof node !== 'object') return { named: false, unknowable: false };
  if (node.type === 'Text') return { named: String(node.data ?? '').trim().length > 0, unknowable: false };
  if (
    node.type === 'ExpressionTag' ||
    node.type === 'RenderTag' ||
    node.type === 'HtmlTag' ||
    COMPONENT_LIKE_TYPES.has(node.type)
  ) {
    return { named: false, unknowable: true };
  }
  if (node.type === 'RegularElement' && node.name === 'img' && Array.isArray(node.attributes)) {
    const alt = attrText(node.attributes, 'alt');
    if (alt !== undefined && alt.trim().length > 0) return { named: true, unknowable: false };
  }
  const acc = { named: false, unknowable: false };
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) {
      const r = scanAccessibleNameSubtree(node[key]);
      acc.named ||= r.named;
      acc.unknowable ||= r.unknowable;
    }
  }
  return acc;
}

/** Which accessible-name target `node` is, or undefined if it isn't one (a11y/accessible-name).
 *  `a` needs a literal `href` (an expression href is unknowable whether the anchor even renders
 *  as a link, matching the `isInteractiveContainer` convention above); `input` needs a literal
 *  `type="image"`. */
function accessibleNameTarget(node: Node): 'button' | 'a' | 'input' | undefined {
  if (node.name === 'button') return 'button';
  if (node.name === 'a') return attrText(node.attributes, 'href') !== undefined ? 'a' : undefined;
  if (node.name === 'input') {
    const type = attrText(node.attributes, 'type');
    return type?.toLowerCase() === 'image' ? 'input' : undefined;
  }
  return undefined;
}

/**
 * `button`/`a href`/`input type="image"` elements with no computable accessible name
 * (a11y/accessible-name). A spread attribute on the element itself makes its rendered
 * attributes unknowable, so the element is skipped entirely rather than risk a false positive.
 */
function collectUnnamedInteractive(node: Node, source: string, acc: UnnamedInteractiveFact[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectUnnamedInteractive(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && Array.isArray(node.attributes)) {
    const target = accessibleNameTarget(node);
    const hasSpread = node.attributes.some((a: Node) => a?.type === 'SpreadAttribute');
    if (target && !hasSpread) {
      if (target === 'input') {
        const alt = attrText(node.attributes, 'alt');
        if (!hasNamingAttr(node.attributes) && !(alt !== undefined && alt.trim().length > 0)) {
          acc.push({ tag: node.name, line: lineOf(source, node.start) });
        }
      } else {
        const scan = scanAccessibleNameSubtree(node);
        if (!hasNamingAttr(node.attributes) && !scan.named && !scan.unknowable) {
          acc.push({ tag: node.name, line: lineOf(source, node.start) });
        }
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectUnnamedInteractive(node[key], source, acc);
  }
}

/** Whether `node` is a labelable element that associates a `<label>` by wrapping it
 *  (a11y/label-has-control): `input` (unless its literal `type` is `hidden`), `select`,
 *  `textarea`, `button`, `meter`, `output`, `progress`. */
const LABELABLE_TAGS = new Set(['input', 'select', 'textarea', 'button', 'meter', 'output', 'progress']);
function isLabelableDescendant(node: Node): boolean {
  if (node.type !== 'RegularElement' || !LABELABLE_TAGS.has(node.name)) return false;
  if (node.name !== 'input') return true;
  return attrText(node.attributes ?? [], 'type')?.toLowerCase() !== 'hidden';
}

/** Wrapped-control/unknowable verdict for a `<label>`'s subtree (a11y/label-has-control).
 *  `hasControl`: a descendant labelable element. `unknowable`: an expression-tag, `Component`,
 *  `{@render}`, or `{@html}` anywhere below — content the rule cannot statically resolve, so
 *  the label is skipped rather than risk a false positive. */
function scanLabelSubtree(node: Node): { hasControl: boolean; unknowable: boolean } {
  if (Array.isArray(node)) {
    const acc = { hasControl: false, unknowable: false };
    for (const child of node) {
      const r = scanLabelSubtree(child);
      acc.hasControl ||= r.hasControl;
      acc.unknowable ||= r.unknowable;
    }
    return acc;
  }
  if (!node || typeof node !== 'object') return { hasControl: false, unknowable: false };
  if (
    node.type === 'ExpressionTag' ||
    node.type === 'RenderTag' ||
    node.type === 'HtmlTag' ||
    COMPONENT_LIKE_TYPES.has(node.type)
  ) {
    return { hasControl: false, unknowable: true };
  }
  if (isLabelableDescendant(node)) return { hasControl: true, unknowable: false };
  const acc = { hasControl: false, unknowable: false };
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) {
      const r = scanLabelSubtree(node[key]);
      acc.hasControl ||= r.hasControl;
      acc.unknowable ||= r.unknowable;
    }
  }
  return acc;
}

/**
 * `<label>` elements with neither a `for` attribute (literal or expression — its presence is
 * enough) nor a wrapped labelable descendant (a11y/label-has-control).
 */
function collectUnassociatedLabels(node: Node, source: string, acc: { line: number }[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectUnassociatedLabels(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && node.name === 'label' && Array.isArray(node.attributes)) {
    const hasFor = findAttr(node.attributes, 'for') !== undefined;
    if (!hasFor) {
      const scan = scanLabelSubtree(node);
      if (!scan.hasControl && !scan.unknowable) {
        acc.push({ line: lineOf(source, node.start) });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectUnassociatedLabels(node[key], source, acc);
  }
}

/** Requires trailing whitespace after the bullet char to avoid flagging `-webkit` prose or a
 *  signed number like `-1` (a11y/use-list). */
const BULLET_TEXT_RE = /^[•・·\-*]\s/;

/**
 * Text nodes whose trimmed content opens with a bullet character followed by whitespace,
 * outside any `li` ancestor — a plain-text bullet where a `<ul>`/`<ol>` would give assistive
 * technology a real list structure (a11y/use-list).
 */
function collectBulletTexts(
  node: Node,
  source: string,
  acc: { line: number; char: string }[],
  insideLi: boolean
): void {
  if (Array.isArray(node)) {
    for (const child of node) collectBulletTexts(child, source, acc, insideLi);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'Text') {
    const trimmed = String(node.data ?? '').trim();
    if (!insideLi && BULLET_TEXT_RE.test(trimmed)) {
      acc.push({ line: lineOf(source, node.start), char: trimmed[0]! });
    }
    return;
  }
  const nowInsideLi = insideLi || (node.type === 'RegularElement' && node.name === 'li');
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectBulletTexts(node[key], source, acc, nowInsideLi);
  }
}

/**
 * Root-relative `<a href="/…">` literals (correctness/base-path-navigation). Only
 * `RegularElement` anchors with a fully static href are considered, which is what makes the
 * correct forms self-excluding: `href="{base}/x"` and `href={resolve('/x')}` contain an
 * `ExpressionTag`, so `attrTextOf` returns undefined. `<svelte:element this="a">` is a
 * different node type and is out of static reach.
 */
function collectHrefLinks(node: Node, source: string, acc: BasePathLinkFact[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectHrefLinks(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && node.name === 'a' && Array.isArray(node.attributes)) {
    const attr = findAttr(node.attributes, 'href');
    const value = attr ? attrTextOf(attr) : undefined;
    if (value !== undefined && isRootRelativePath(value)) {
      acc.push({ kind: 'href', path: value, line: lineOf(source, attr?.start ?? node.start) });
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectHrefLinks(node[key], source, acc);
  }
}

const GOTO_NAMES = new Set(['goto']);

/**
 * Root-relative `goto('/…')` calls (correctness/base-path-navigation). Only a plain string
 * literal argument counts, which self-excludes the correct forms — `goto(resolve('/x'))` is a
 * CallExpression and ``goto(`${base}/x`)`` is a TemplateLiteral. `roots` are the nodes to walk
 * (the instance program plus the template fragment, so inline handlers are covered); `locals`
 * comes from the same program's imports.
 */
function collectGotoLinks(locals: Set<string>, roots: Node[], source: string, acc: BasePathLinkFact[]): void {
  if (locals.size === 0) return;
  for (const root of roots) {
    if (!root) continue;
    walkEstree(root, (n: Node) => {
      if (n.type !== 'CallExpression' || n.callee?.type !== 'Identifier' || !locals.has(n.callee.name)) return;
      const arg = n.arguments?.[0];
      if (arg?.type !== 'Literal' || typeof arg.value !== 'string' || !isRootRelativePath(arg.value)) return;
      acc.push({ kind: 'goto', path: arg.value, line: lineOf(source, n.start) });
    });
  }
}

/** Whether a CallExpression is a bare `$props()` call. */
function isPropsCall(node: Node): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === '$props';
}

/** Whether a CallExpression is a `$bindable(...)` call (a destructured prop's default value). */
function isBindableCall(node: Node): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === '$bindable';
}

/**
 * Local identifier names bound to a prop from `$props()`: plain and renamed destructured
 * names, and the `...rest` binding. `includeBindable` controls whether a prop initialized
 * with `$bindable(...)` is included — `false` excludes it (correctness/prop-mutation: mutating
 * a `$bindable` prop is the intended contract), `true` includes it (correctness/stale-prop-derivation:
 * a `$bindable` prop can still be derived-from-at-init just like any other prop). `let props
 * = $props()` (no destructuring) tracks `props` itself, since none of its fields can be
 * `$bindable` either. Returns an empty set when `$props()` appears more than once, or a
 * destructuring shape is ambiguous (nested pattern) — conservative, to avoid false positives
 * rather than chase every shape.
 */
function collectPropNames(program: Node, includeBindable: boolean): Set<string> {
  const names = new Set<string>();
  let seen = 0;
  let ambiguous = false;
  walkEstree(program, (n) => {
    if (n.type !== 'VariableDeclarator' || !n.init || !isPropsCall(unwrapTs(n.init))) return;
    seen++;
    if (n.id?.type === 'Identifier') {
      names.add(n.id.name);
      return;
    }
    if (n.id?.type !== 'ObjectPattern' || !Array.isArray(n.id.properties)) {
      ambiguous = true;
      return;
    }
    for (const p of n.id.properties) {
      if (p?.type === 'RestElement') {
        addBoundNames(p.argument, names);
      } else if (p?.type === 'Property') {
        if (p.value?.type === 'AssignmentPattern') {
          if ((includeBindable || !isBindableCall(p.value.right)) && p.value.left?.type === 'Identifier')
            names.add(p.value.left.name);
        } else if (p.value?.type === 'Identifier') {
          names.add(p.value.name);
        }
        // A nested destructuring pattern (`{ a: { b } }`) is skipped conservatively.
      }
    }
  });
  return ambiguous || seen > 1 ? new Set() : names;
}

/**
 * Local identifier names bound to a prop via legacy `export let foo` / `export let foo = default`
 * (correctness/stale-prop-derivation, correctness/prop-mutation: the same two bugs exist under
 * legacy reactivity, just with a different fix). Top-level only, plain identifiers only — a
 * component can't mix legacy `export let` props with runes-mode `$props()` in the same file
 * (a Svelte compile error), so this and `collectPropNames`'s result are never both non-empty
 * for the same component.
 */
function collectLegacyPropNames(program: Node): Set<string> {
  const names = new Set<string>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || stmt.declaration?.type !== 'VariableDeclaration') continue;
    for (const d of stmt.declaration.declarations ?? []) {
      if (d?.id?.type === 'Identifier') names.add(d.id.name);
    }
  }
  return names;
}

/** Mutating array/Set/Map methods — a call to one of these on a non-bindable prop mutates it (correctness/prop-mutation). */
const MUTATING_METHODS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'copyWithin',
  'fill',
  'set',
  'add',
  'delete',
  'clear'
]);

/**
 * Flag mutations of a non-`$bindable` prop (correctness/prop-mutation): a member-expression write
 * (`prop.x = …`, `prop.x += …`, `prop.x++`), `delete prop.x`, or a call to a mutating
 * method on the prop (`prop.push(...)`). Plain reassignment of the prop identifier
 * itself (`prop = 5`) is NOT flagged — Svelte's docs explicitly sanction temporary
 * reassignment for ephemeral state; only mutation is prohibited. Run over the instance
 * program AND the template fragment (inline handlers can mutate props in the template).
 * Scope-aware (issue #140): a local that shadows the prop's name is not flagged.
 */
function collectPropMutations(
  root: Node,
  propNames: Set<string>,
  source: string,
  acc: { name: string; line: number }[]
): void {
  if (propNames.size === 0) return;
  walkScoped(root, (n: Node, scope: Set<string>) => {
    const flag = (r: string | undefined) => {
      if (r && propNames.has(r) && !scope.has(r)) acc.push({ name: r, line: lineOf(source, n.start) });
    };
    if (n.type === 'AssignmentExpression' && n.left?.type === 'MemberExpression') {
      flag(rootObjectName(n.left));
    } else if (n.type === 'UpdateExpression' && n.argument?.type === 'MemberExpression') {
      flag(rootObjectName(n.argument));
    } else if (n.type === 'UnaryExpression' && n.operator === 'delete') {
      flag(rootObjectName(n.argument));
    } else if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression') {
      const method = n.callee.property?.type === 'Identifier' ? n.callee.property.name : undefined;
      if (method && MUTATING_METHODS.has(method)) flag(rootObjectName(n.callee.object));
    }
  });
}

/** Named props destructured from `$props()`, or 0 when unknowable (architecture/prop-count). */
function countProps(program: Node): number {
  let count = 0;
  let seen = 0;
  // Unknowable when: a non-destructured $props(), or more than one $props() call (a normal
  // component has exactly one) — either way we can't trust a count. A `...rest` element beside
  // named props is fine: counting only the `Property` entries yields a lower bound, and the
  // rule's predicate is `propCount > max`, so a lower bound can never produce a false positive.
  let uncountable = false;
  walkEstree(program, (n) => {
    if (n.type !== 'VariableDeclarator' || !n.init || !isPropsCall(unwrapTs(n.init))) return;
    seen++;
    const props = n.id?.type === 'ObjectPattern' ? n.id.properties : undefined;
    if (!Array.isArray(props)) {
      uncountable = true;
      return;
    }
    count = props.filter((p: Node) => p?.type === 'Property').length;
  });
  return uncountable || seen > 1 ? 0 : count;
}

/** Source line count, not over-counting a single trailing newline (architecture/component-size). */
function countLines(source: string): number {
  if (source.length === 0) return 0;
  return source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
}

/** Whether an import declaration contributes no runtime value binding — see `ComponentFacts.importSpans`. */
function isTypeOnlyImport(n: Node): boolean {
  if (n.importKind === 'type') return true;
  const specs = n.specifiers;
  // A declaration with no specifiers is a side-effect import: the module is still loaded.
  return Array.isArray(specs) && specs.length > 0 && specs.every((s: Node) => s?.importKind === 'type');
}

/** Module specifiers of every `import`, each with its source line (see `ComponentFacts.importSpans`). */
function collectImportSources(
  program: Node,
  source: string,
  acc: { source: string; line: number; type?: true }[]
): void {
  walkEstree(program, (n) => {
    if (n.type === 'ImportDeclaration' && typeof n.source?.value === 'string') {
      acc.push({
        source: n.source.value,
        line: lineOf(source, n.start),
        ...(isTypeOnlyImport(n) ? { type: true as const } : {})
      });
    }
  });
}

/** A specifier is "bare" (a node_modules package) when it is not relative/absolute/alias-local. */
function isBareSpecifier(s: string): boolean {
  return !/^[./$#]/.test(s);
}

/** Value `import * as X from '<bare pkg>'` namespace imports (type-only excluded) — performance/namespace-import. */
function collectNamespaceImports(program: Node, source: string, acc: { source: string; line: number }[]): void {
  walkEstree(program, (n) => {
    if (n.type !== 'ImportDeclaration' || n.importKind === 'type') return;
    const spec = n.source?.value;
    if (typeof spec !== 'string' || !isBareSpecifier(spec)) return;
    if (Array.isArray(n.specifiers) && n.specifiers.some((s: Node) => s?.type === 'ImportNamespaceSpecifier')) {
      acc.push({ source: spec, line: lineOf(source, n.start) });
    }
  });
}

const RULE_ID_RE = '[a-z]+\\/[a-z][a-z0-9-]*';
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

const MD_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
const SCRIPT_OPEN = /<script(?:\s[^>]*)?>/;
const SCRIPT_CLOSE = /<\/script\s*>/;
const STYLE_OPEN = /<style(?:\s[^>]*)?>/;
const STYLE_CLOSE = /<\/style\s*>/;

/**
 * Markdown links inside comments. A plain text scan, like `collectSuppressions` — a link in a comment is
 * not an AST node. `//` counts as a comment opener only at the start of a line, which is what keeps the
 * scan off the `//` in `https://`; a trailing `// [x](y)` is therefore missed, and measurement found no
 * such link, so the cost is a case that does not occur rather than one this rule needs.
 *
 * `<script>`/`<style>` blocks are tracked separately (open on the tag, close on the closing tag) because
 * neither comment form applies uniformly inside them: `<!--`/`-->` are markup syntax, not script/style
 * syntax, so a `<!--` inside a script string literal (e.g. a URL comparison) must not open a markup
 * comment; and a line-leading `//` is only a comment in a script, never in markup or style, where it is
 * either content or a syntax error. The tags themselves are read from the markup *outside* any comment, so
 * a commented-out block does not open one. `wholeFileIsScript` covers `.svelte.ts`/`.svelte.js` runes
 * modules, which have no `<script>` tag at all — the entire file is script.
 */
function collectCommentLinks(
  source: string,
  { wholeFileIsScript = false }: { wholeFileIsScript?: boolean } = {}
): { url: string; line: number }[] {
  const out: { url: string; line: number }[] = [];
  let htmlOpen = false; // inside a multi-line markup <!-- … -->
  let block: 'script' | 'style' | undefined = wholeFileIsScript ? 'script' : undefined;
  source.split('\n').forEach((line, i) => {
    let text = '';
    if (block !== undefined) {
      if (block === 'script' && /^\s*\/\//.test(line)) text = line.replace(/^\s*\/\//, '');
      if (!wholeFileIsScript && (block === 'script' ? SCRIPT_CLOSE : STYLE_CLOSE).test(line)) block = undefined;
    } else {
      // The line is split into comment text and the markup around it before either is examined, so a
      // `<script>` written inside a comment cannot open a block. Opening one there would leave it open
      // for want of a matching `</script>`, silently skipping every comment in the rest of the file.
      let plain = '';
      let rest = line;
      while (rest.length > 0) {
        if (htmlOpen) {
          const end = rest.indexOf('-->');
          if (end === -1) {
            text += rest;
            break;
          }
          text += rest.slice(0, end);
          htmlOpen = false;
          rest = rest.slice(end + 3);
          continue;
        }
        const start = rest.indexOf('<!--');
        if (start === -1) {
          plain += rest;
          break;
        }
        plain += rest.slice(0, start);
        htmlOpen = true;
        rest = rest.slice(start + 4);
      }
      const opened = SCRIPT_OPEN.test(plain) ? 'script' : STYLE_OPEN.test(plain) ? 'style' : undefined;
      if (opened !== undefined && !(opened === 'script' ? SCRIPT_CLOSE : STYLE_CLOSE).test(plain)) block = opened;
    }
    for (const m of text.matchAll(MD_LINK)) {
      if (m[1] !== undefined) out.push({ url: m[1], line: i + 1 });
    }
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
function walkEvalScope(
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
 * Calls matching `matcher` that run when `root` itself is evaluated (correctness/orphan-effect, correctness/orphan-lifecycle).
 * `skipSubtree` exempts a call's children — correctness/orphan-effect uses it for `$effect.root(...)`
 * callbacks, which are a legal standalone reactive scope. `initialShadowed` seeds the
 * shadow set threaded through `walkEvalScope` (correctness/orphan-lifecycle uses it to seed a
 * constructor's own parameters before scanning its body).
 */
function collectEvalScopeCalls(
  root: Node,
  source: string,
  matcher: (n: Node, shadowed: Set<string>) => string | undefined,
  skipSubtree?: (n: Node) => boolean,
  initialShadowed?: Set<string>
): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  walkEvalScope(
    root,
    (n, shadowed) => {
      if (n.type !== 'CallExpression') return undefined;
      if (skipSubtree?.(n)) return true;
      const name = matcher(n, shadowed);
      if (name) out.push({ name, line: lineOf(source, n.start) });
      return undefined;
    },
    initialShadowed
  );
  return out;
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

/**
 * Matcher-parameterised orphan-call collector (correctness/orphan-effect, correctness/orphan-lifecycle): (1) matching calls that
 * run at module evaluation time, (2) a module-scope `new` (direct top-level statements
 * only, export-unwrapped) of a same-file top-level class whose constructor directly
 * makes a matching call. See `collectOrphanEffects`'s doc comment for why pattern 2 is
 * restricted to top-level `ClassDeclaration`s and top-level `new` statements.
 */
function collectOrphanCalls(
  program: Node,
  source: string,
  matcher: (n: Node, shadowed: Set<string>) => string | undefined,
  skipSubtree?: (n: Node) => boolean
): { name: string; line: number; kind: 'top-level' | 'constructor-instantiated'; className?: string }[] {
  const out: { name: string; line: number; kind: 'top-level' | 'constructor-instantiated'; className?: string }[] =
    collectEvalScopeCalls(program, source, matcher, skipSubtree).map((c) => ({ ...c, kind: 'top-level' as const }));

  const body: Node[] = program.body ?? [];

  const matchingClasses = new Map<string, string>(); // class name → canonical callee name
  for (const stmt of body) {
    const decl = unwrapExport(stmt);
    if (decl?.type !== 'ClassDeclaration' || decl.id?.type !== 'Identifier') continue;
    // A TS constructor overload signature is bodiless — require a body so the FIRST
    // matching MethodDefinition is the actual implementation, not a signature.
    const ctor = (decl.body?.body ?? []).find(
      (m: Node) => m?.type === 'MethodDefinition' && m.kind === 'constructor' && m.value?.body
    );
    if (!ctor) continue;
    // Seed the shadow set with the constructor's own parameters — a parameter that
    // shadows an imported lifecycle name makes a same-named call inside the body a
    // legal local call, not the tracked import (correctness/orphan-lifecycle false positive).
    const ctorShadow = new Set<string>();
    for (const p of ctor.value.params ?? []) addBoundNames(p, ctorShadow);
    const calls = collectEvalScopeCalls(ctor.value.body, source, matcher, skipSubtree, ctorShadow);
    // calls are in walk (source) order — a constructor mixing callees reports the first one.
    if (calls.length > 0) matchingClasses.set(decl.id.name, calls[0]!.name);
  }

  if (matchingClasses.size > 0) {
    for (const stmt of body) {
      const decl = unwrapExport(stmt);
      // A direct top-level `VariableDeclaration`/`ExpressionStatement`, or an
      // `export default <expression>` (whose "declaration" IS the expression itself,
      // not wrapped in a statement node) — anything else (if/for/block/try, …) is a
      // conservative miss by design.
      const isCandidate =
        decl?.type === 'VariableDeclaration' ||
        decl?.type === 'ExpressionStatement' ||
        (stmt.type === 'ExportDefaultDeclaration' &&
          decl?.type !== 'FunctionDeclaration' &&
          decl?.type !== 'ClassDeclaration');
      if (!isCandidate) continue;
      walkEvalScope(decl, (n) => {
        if (n.type === 'NewExpression' && n.callee?.type === 'Identifier' && matchingClasses.has(n.callee.name)) {
          out.push({
            name: matchingClasses.get(n.callee.name)!,
            line: lineOf(source, n.start),
            kind: 'constructor-instantiated',
            className: n.callee.name
          });
        }
        return undefined;
      });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/**
 * Orphan `$effect` facts for a module-context program (correctness/orphan-effect): (1) effects that run
 * at module evaluation time, (2) a module-scope `new` of a same-file class whose
 * constructor creates a bare effect. Conservative by construction — never crosses a
 * function boundary, so factory functions, IIFEs, and cross-file classes are not flagged.
 *
 * Pattern 2 (the class/`new` half) operates on DIRECT top-level statements only — it
 * never descends into blocks/if/for/try. A top-level `ClassDeclaration` name is a real
 * module-scope binding that an import can't legally share, so restricting collection to
 * `program.body` (unwrapping only `export`/`export default`) rules out two false-positive
 * vectors: a block-scoped class shadowing an imported name of the same name, and a class
 * expression's own name (`const A = class Store {…}`), which is only visible inside the
 * expression, never as a module-scope binding. This matches the design spec's own wording
 * for pattern 2: "flag top-level `new ClassName(...)` statements". Pattern 1 (top-level
 * `$effect`, including inside top-level blocks/if) is unaffected — see
 * `collectEvalScopeCalls` above. Generalised as `collectOrphanCalls` — correctness/orphan-lifecycle reuses
 * the same walk with a lifecycle-import matcher.
 */
function collectOrphanEffects(program: Node, source: string): OrphanEffectFact[] {
  return collectOrphanCalls(program, source, (n) => (isEffectCall(n) ? '$effect' : undefined), isEffectRootCall).map(
    ({ line, kind, className }) => ({ line, kind, ...(className !== undefined ? { className } : {}) })
  );
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
export function collectSvelteLifecycleImports(program: Node): { locals: Map<string, string>; namespaces: Set<string> } {
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

/** Orphan lifecycle-call facts for a module-context program (correctness/orphan-lifecycle). */
function collectOrphanLifecycleCalls(program: Node, source: string): OrphanLifecycleCallFact[] {
  const imports = collectSvelteLifecycleImports(program);
  if (imports.locals.size === 0 && imports.namespaces.size === 0) return [];
  return collectOrphanCalls(program, source, (n, shadowed) => {
    const m = matchLifecycleCall(n, imports);
    return m && !shadowed.has(m.local) ? m.canonical : undefined;
  });
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

/** A Svelte runes module file — the whole file is one module-scope program (correctness/orphan-effect). */
const MODULE_FILE_RE = /\.svelte\.(ts|js)$/;

/** What the per-file parsers produce — `ComponentFacts` minus `file`, with `suppressions` always present. */
type ParsedFacts = Omit<ComponentFacts, 'file' | 'suppressions'> & { suppressions: SuppressionDirective[] };

/**
 * Parse a plain TS/JS module source by wrapping it in a `<script lang="ts">` tag —
 * the Svelte script parser handles TS natively, so no extra parser dependency is
 * needed. Literal "</script" occurrences are neutralised with a same-length
 * placeholder first (string contents don't affect fact extraction; offsets are
 * preserved). Returns the ESTree Program and the wrapped source — wrapped line
 * numbers are +1 relative to the input, so callers subtract 1. Shared by the
 * runes-module facts (correctness/orphan-effect) and the Kit-module facts (the security kit-module rules).
 */
export function parseModuleProgram(source: string, filename: string): { program: Node | undefined; wrapped: string } {
  const neutralized = source.replace(/<\/script/gi, '<_script');
  const wrapped = `<script lang="ts">\n${neutralized}\n</script>`;
  const ast = parse(wrapped, { modern: true, filename }) as Node;
  return { program: ast.instance?.content, wrapped };
}

/**
 * Module-scope reactive-state declarations in a runes module (security/shared-state-import): a top-level
 * `let|const x = $state(...)` / `$state.raw(...)` declaration, and a module-scope
 * `new` (in a top-level variable declaration) of a same-file top-level class with a
 * `$state` field initializer — recorded under the instance binding's name at the
 * declaration line. Direct top-level statements only (export-unwrapped), mirroring
 * correctness/orphan-effect's pattern-2 conservatism.
 */
function collectModuleStateDecls(program: Node, source: string): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  const body: Node[] = program.body ?? [];
  const statefulClasses = new Set<string>();
  for (const stmt of body) {
    const decl = unwrapExport(stmt);
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations ?? []) {
        if (d?.id?.type === 'Identifier' && d.init && isStateDeclaration(unwrapTs(d.init))) {
          out.push({ name: d.id.name, line: lineOf(source, d.start) });
        }
      }
    } else if (decl?.type === 'ClassDeclaration' && decl.id?.type === 'Identifier') {
      const hasStateField = (decl.body?.body ?? []).some(
        (m: Node) => m?.type === 'PropertyDefinition' && m.value && isStateDeclaration(unwrapTs(m.value))
      );
      if (hasStateField) statefulClasses.add(decl.id.name);
    }
  }
  if (statefulClasses.size > 0) {
    for (const stmt of body) {
      const decl = unwrapExport(stmt);
      if (decl?.type !== 'VariableDeclaration') continue;
      for (const d of decl.declarations ?? []) {
        if (
          d?.init?.type === 'NewExpression' &&
          d.init.callee?.type === 'Identifier' &&
          statefulClasses.has(d.init.callee.name)
        ) {
          out.push({
            name: d.id?.type === 'Identifier' ? d.id.name : d.init.callee.name,
            line: lineOf(source, d.start)
          });
        }
      }
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/**
 * Facts for a `.svelte.ts`/`.svelte.js` runes module (correctness/orphan-effect, correctness/orphan-lifecycle, correctness/server-browser-global,
 * performance/heavy-import, performance/namespace-import, architecture/private-scope-import, architecture/route-component-import).
 * The whole file runs at import time, so only `orphanEffects`, `orphanLifecycleCalls`, `browserGlobalRefs`,
 * `moduleStateDecls`, `imports`/`importSpans`/`namespaceImports`, and `suppressions` are populated —
 * `loc` stays 0 so architecture/component-size skips module files (there is no component to size), and
 * the rest of the component-only facts stay empty. Uses `parseModuleProgram` to get the ESTree program
 * from the wrapped source; the 1-line wrap prefix is subtracted from every reported line.
 */
function parseModuleFacts(source: string, filename: string): ParsedFacts {
  const { program, wrapped } = parseModuleProgram(source, filename);
  const shift = (line: number) => Math.max(0, line - 1);
  const orphanEffects = program
    ? collectOrphanEffects(program, wrapped).map((f) => ({ ...f, line: shift(f.line) }))
    : [];
  const orphanLifecycleCalls = program
    ? collectOrphanLifecycleCalls(program, wrapped).map((f) => ({ ...f, line: shift(f.line) }))
    : [];
  const browserGlobalRefs: BrowserGlobalRefFact[] = program
    ? collectBrowserGlobalRefs(program, wrapped).map((r) => ({ ...r, line: shift(r.line), context: 'module' as const }))
    : [];
  const moduleStateDecls = program
    ? collectModuleStateDecls(program, wrapped).map((d) => ({ ...d, line: shift(d.line) }))
    : [];
  const basePathLinks: BasePathLinkFact[] = [];
  if (program) {
    const locals = collectNamedImportAliases(program, '$app/navigation', GOTO_NAMES);
    const raw: BasePathLinkFact[] = [];
    collectGotoLinks(locals, [program], wrapped, raw);
    for (const l of raw) basePathLinks.push({ ...l, line: shift(l.line) });
    basePathLinks.sort((a, b) => a.line - b.line);
  }
  const importSpans: { source: string; line: number; type?: true }[] = [];
  const namespaceImports: { source: string; line: number }[] = [];
  if (program) {
    const rawImportSpans: { source: string; line: number; type?: true }[] = [];
    collectImportSources(program, wrapped, rawImportSpans);
    for (const s of rawImportSpans) importSpans.push({ ...s, line: shift(s.line) });
    const rawNamespaceImports: { source: string; line: number }[] = [];
    collectNamespaceImports(program, wrapped, rawNamespaceImports);
    for (const n of rawNamespaceImports) namespaceImports.push({ ...n, line: shift(n.line) });
  }
  const imports = importSpans.map((s) => s.source);
  return {
    eachBlocks: [],
    effects: [],
    htmlTags: [],
    javascriptUrls: [],
    loc: 0,
    propCount: 0,
    imports,
    importSpans,
    namespaceImports,
    constableStates: [],
    mutatedProps: [],
    stalePropDerivations: [],
    rawableStates: [],
    nonreactiveBuiltinStates: [],
    checkableBindValues: [],
    basePathLinks,
    suppressions: collectSuppressions(source),
    commentLinks: collectCommentLinks(source, { wholeFileIsScript: true }),
    orphanEffects,
    orphanLifecycleCalls,
    browserGlobalRefs,
    moduleStateDecls
  };
}

/**
 * Parse one source file's facts (CLI/static + vite build mode): a `.svelte` component's
 * reactivity/correctness + security + architecture facts, or a `.svelte.ts`/`.svelte.js`
 * runes module's orphan-$effect facts (correctness/orphan-effect).
 */
export function parseComponentFacts(source: string, filename: string): ParsedFacts {
  if (MODULE_FILE_RE.test(filename)) return parseModuleFacts(source, filename);

  const ast = parse(source, { modern: true, filename }) as Node;
  const eachBlocks: EachBlockFact[] = [];
  collectEachBlocks(ast.fragment ?? ast, source, eachBlocks);
  const htmlTags: SourceSpan[] = [];
  const javascriptUrls: SourceSpan[] = [];
  collectSecurityFacts(ast.fragment ?? ast, source, htmlTags, javascriptUrls);
  const checkableBindValues: CheckableBindValueFact[] = [];
  collectCheckableBindValues(ast.fragment ?? ast, source, checkableBindValues);
  const ariaElements: AriaElementFact[] = [];
  collectAriaElements(ast.fragment ?? ast, source, ariaElements);
  const interactiveNestings: InteractiveNestingFact[] = [];
  collectInteractiveNestings(ast.fragment ?? ast, source, interactiveNestings, []);
  const unnamedInteractive: UnnamedInteractiveFact[] = [];
  collectUnnamedInteractive(ast.fragment ?? ast, source, unnamedInteractive);
  const unassociatedLabels: { line: number }[] = [];
  collectUnassociatedLabels(ast.fragment ?? ast, source, unassociatedLabels);
  const bulletTexts: { line: number; char: string }[] = [];
  collectBulletTexts(ast.fragment ?? ast, source, bulletTexts, false);
  const basePathLinks: BasePathLinkFact[] = [];
  collectHrefLinks(ast.fragment ?? ast, source, basePathLinks);
  const gotoPrograms = [ast.module?.content, ast.instance?.content].filter(Boolean) as Node[];
  const gotoLocals = new Set<string>();
  for (const p of gotoPrograms)
    for (const n of collectNamedImportAliases(p, '$app/navigation', GOTO_NAMES)) {
      gotoLocals.add(n);
    }
  collectGotoLinks(gotoLocals, [...gotoPrograms, ast.fragment], source, basePathLinks);
  basePathLinks.sort((a, b) => a.line - b.line);
  const loc = countLines(source);
  const suppressions = collectSuppressions(source);

  // Imports live in either the instance (<script>) or module (<script module>) program.
  const moduleProgram = ast.module?.content;
  const importSpans: { source: string; line: number; type?: true }[] = [];
  const namespaceImports: { source: string; line: number }[] = [];
  if (moduleProgram) {
    collectImportSources(moduleProgram, source, importSpans);
    collectNamespaceImports(moduleProgram, source, namespaceImports);
  }
  const orphanEffects: OrphanEffectFact[] = moduleProgram ? collectOrphanEffects(moduleProgram, source) : [];
  const orphanLifecycleCalls: OrphanLifecycleCallFact[] = moduleProgram
    ? collectOrphanLifecycleCalls(moduleProgram, source)
    : [];
  const browserGlobalRefs: BrowserGlobalRefFact[] = [];
  if (moduleProgram) {
    for (const r of collectBrowserGlobalRefs(moduleProgram, source)) {
      browserGlobalRefs.push({ ...r, context: 'module' });
    }
  }

  const effects: EffectFact[] = [];
  const constableStates: { name: string; line: number }[] = [];
  const mutatedProps: { name: string; line: number; legacy?: boolean }[] = [];
  const stalePropDerivations: { name: string; line: number; legacy?: boolean }[] = [];
  const rawableStates: { name: string; line: number }[] = [];
  const nonreactiveBuiltinStates: { name: string; type: string; line: number }[] = [];
  let propCount = 0;
  const program = ast.instance?.content;
  if (program) {
    collectImportSources(program, source, importSpans);
    collectNamespaceImports(program, source, namespaceImports);
    propCount = countProps(program);
    // A component is either runes-mode ($props()) or legacy-mode (export let), never both —
    // Svelte rejects mixing them — so at most one of these two sets is ever non-empty.
    const legacyPropNames = collectLegacyPropNames(program);
    const nonBindableProps = new Set([...collectPropNames(program, false), ...legacyPropNames]);
    const rawMutations: { name: string; line: number }[] = [];
    collectPropMutations(program, nonBindableProps, source, rawMutations);
    if (ast.fragment) collectPropMutations(ast.fragment, nonBindableProps, source, rawMutations);
    for (const m of rawMutations) mutatedProps.push(legacyPropNames.has(m.name) ? { ...m, legacy: true } : m);
    const allPropNames = new Set([...collectPropNames(program, true), ...legacyPropNames]);
    if (allPropNames.size > 0) {
      const candidates = collectStalePropCandidates(program, allPropNames, source);
      if (candidates.length > 0) {
        const candidateNames = new Set(candidates.map((c) => c.name));
        const disqualified = new Set<string>();
        collectStateWrites(program, candidateNames, disqualified);
        if (ast.fragment) {
          collectStateWrites(ast.fragment, candidateNames, disqualified);
          collectTemplateEscapes(ast.fragment, candidateNames, disqualified);
        }
        const referenced = new Set<string>();
        if (ast.fragment) collectFragmentRefs(ast.fragment, candidateNames, referenced);
        // `c.name` is the derived LOCAL variable (e.g. `color`), never the prop itself (e.g.
        // `type`) — legacy-ness is a per-component property (export let vs $props(), never
        // mixed), not per-candidate, so every candidate here shares the same flag.
        const isLegacy = legacyPropNames.size > 0;
        for (const c of candidates) {
          if (!disqualified.has(c.name) && referenced.has(c.name)) {
            stalePropDerivations.push(isLegacy ? { ...c, legacy: true } : c);
          }
        }
      }
    }
    const stateNames = new Set<string>();
    const reactiveNames = new Set<string>();
    collectImportedLocalNames(program, reactiveNames);
    collectNewExprLocalNames(program, reactiveNames);
    if (moduleProgram) {
      collectImportedLocalNames(moduleProgram, reactiveNames);
      collectNewExprLocalNames(moduleProgram, reactiveNames);
    }
    const stateDecls: { name: string; line: number }[] = [];
    walkEstree(program, (n) => {
      if (n.type !== 'VariableDeclarator' || !n.init) return;
      const init = unwrapTs(n.init);
      if (isStateDeclaration(init) && n.id?.type === 'Identifier') {
        stateNames.add(n.id.name);
        stateDecls.push({ name: n.id.name, line: lineOf(source, n.start) });
      }
      if (isStateDeclaration(init) || isDerivedDeclaration(init) || isPropsCall(init))
        addBoundNames(n.id, reactiveNames);
    });
    walkEstree(program, (n) => {
      if (n.type !== 'CallExpression' || !isEffectCall(n)) return;
      const fn = n.arguments?.[0];
      const isFn = fn?.type === 'ArrowFunctionExpression' || fn?.type === 'FunctionExpression';
      effects.push({
        line: lineOf(source, n.start),
        assignsOnlyState: isFn ? bodyOnlyAssignsState(fn, stateNames) : false,
        mountOnly: isFn ? !bodyIsEmpty(fn) && !bodyReadsReactive(fn, reactiveNames) : false
      });
    });
    const writtenOrEscaped = new Set<string>();
    collectStateWrites(program, stateNames, writtenOrEscaped);
    if (ast.fragment) {
      collectStateWrites(ast.fragment, stateNames, writtenOrEscaped);
      collectTemplateEscapes(ast.fragment, stateNames, writtenOrEscaped);
      collectDirectiveEscapes(ast.fragment, stateNames, writtenOrEscaped);
    }
    for (const d of stateDecls) {
      if (!writtenOrEscaped.has(d.name)) constableStates.push(d);
    }
    const rawableCandidates: { name: string; line: number }[] = [];
    for (const stmt of program.body ?? []) {
      if (stmt?.type !== 'VariableDeclaration') continue;
      for (const d of stmt.declarations ?? []) {
        if (d?.id?.type !== 'Identifier' || !d.init) continue;
        const init: Node = unwrapTs(d.init);
        if (!isPlainStateCall(init)) continue;
        const arg = unwrapTs(init.arguments?.[0]);
        if (arg?.type === 'ObjectExpression' || arg?.type === 'ArrayExpression') {
          rawableCandidates.push({ name: d.id.name, line: lineOf(source, d.start) });
        }
      }
    }
    if (rawableCandidates.length > 0) {
      const candNames = new Set(rawableCandidates.map((c) => c.name));
      const union = new Set<string>();
      const kinds = new Map<string, Set<WriteKind>>();
      collectStateWrites(program, candNames, union, kinds);
      if (ast.fragment) {
        collectStateWrites(ast.fragment, candNames, union, kinds);
        collectTemplateEscapes(ast.fragment, candNames, union, kinds);
      }
      const aliasEscapes = new Set<string>();
      collectAliasRefs(program, candNames, aliasEscapes);
      const eachTaint = new Set<string>();
      if (ast.fragment) {
        collectFragmentAliasRefs(ast.fragment, candNames, aliasEscapes);
        collectDirectiveEscapes(ast.fragment, candNames, aliasEscapes);
        collectEachContextTaint(ast.fragment, candNames, eachTaint);
      }
      for (const c of rawableCandidates) {
        const k = kinds.get(c.name);
        const reassigned = k?.has('reassign') ?? false;
        const dirty =
          (k !== undefined && [...k].some((kind) => kind !== 'reassign')) ||
          aliasEscapes.has(c.name) ||
          eachTaint.has(c.name);
        if (reassigned && !dirty) rawableStates.push(c);
      }
    }
    const builtinCandidates = new Map<string, { type: string; line: number }>();
    for (const stmt of program.body ?? []) {
      if (stmt?.type !== 'VariableDeclaration') continue;
      for (const d of stmt.declarations ?? []) {
        if (d?.id?.type !== 'Identifier' || !d.init) continue;
        const init: Node = unwrapTs(d.init);
        if (!isPlainStateCall(init)) continue;
        const arg = unwrapTs(init.arguments?.[0]);
        if (
          arg?.type === 'NewExpression' &&
          arg.callee?.type === 'Identifier' &&
          BUILTIN_STATE_TYPES.has(arg.callee.name)
        ) {
          builtinCandidates.set(d.id.name, { type: arg.callee.name, line: lineOf(source, d.start) });
        }
      }
    }
    if (builtinCandidates.size > 0) {
      const types = new Map([...builtinCandidates].map(([n, meta]) => [n, meta.type]));
      const mutatedBuiltins = new Set<string>();
      const reassignedBuiltins = new Set<string>();
      collectBuiltinStateSignals(program, types, mutatedBuiltins, reassignedBuiltins);
      if (ast.fragment) collectBuiltinStateSignals(ast.fragment, types, mutatedBuiltins, reassignedBuiltins);
      for (const [name, meta] of builtinCandidates) {
        if (mutatedBuiltins.has(name) && !reassignedBuiltins.has(name)) {
          nonreactiveBuiltinStates.push({ name, type: meta.type, line: meta.line });
        }
      }
    }
    // Instance top level runs on the server during SSR (correctness/instance-browser-global). The module
    // script's guard bindings (raw browser imports + module-level derived guards)
    // and top-level bindings are visible here — pass them in.
    let moduleExtra: { guards: Set<string>; bound: Set<string> } | undefined;
    if (moduleProgram) {
      const moduleBrowserImports = collectBrowserGuardImports(moduleProgram);
      moduleExtra = {
        guards: new Set([...moduleBrowserImports, ...collectDerivedGuardBindings(moduleProgram, moduleBrowserImports)]),
        bound: collectProgramBindings(moduleProgram)
      };
    }
    for (const r of collectBrowserGlobalRefs(program, source, moduleExtra)) {
      browserGlobalRefs.push({ ...r, context: 'instance' });
    }
  }
  const imports = importSpans.map((s) => s.source);
  return {
    eachBlocks,
    effects,
    htmlTags,
    javascriptUrls,
    loc,
    propCount,
    imports,
    importSpans,
    namespaceImports,
    constableStates,
    mutatedProps,
    stalePropDerivations,
    rawableStates,
    nonreactiveBuiltinStates,
    checkableBindValues,
    basePathLinks,
    orphanEffects,
    orphanLifecycleCalls,
    browserGlobalRefs,
    moduleStateDecls: [],
    suppressions,
    commentLinks: collectCommentLinks(source),
    ariaElements,
    interactiveNestings,
    unnamedInteractive,
    unassociatedLabels,
    bulletTexts
  };
}
