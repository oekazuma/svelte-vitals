import { parse } from 'svelte/compiler';
import type {
  ComponentFacts,
  EachBlockFact,
  EffectFact,
  OrphanEffectFact,
  SourceSpan,
  SuppressionDirective
} from './component.js';
import { CHILD_NODE_KEYS, lineOf, findAttr, attrTextOf } from './svelte-ast.js';

// The Svelte AST is structurally complex and only partially typed for our needs,
// so traversal uses `any`. The node-type strings below are verified against
// svelte 5 output (see Slice 0 AST probe): <title> is `TitleElement` (not a
// RegularElement), and `{expr}` is `ExpressionTag`.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/**
 * Whether an `{#each}` iterates a constant inline array literal (`{#each [a, b] as x}`).
 * Such a list has a fixed length and never reorders, so a key can't help — flagging it
 * would be a false positive. A spread element (`[...xs]`) makes it dynamic again, so it
 * is NOT treated as constant.
 */
function isConstantListEach(node: Node): boolean {
  const expr = node?.expression;
  return (
    expr?.type === 'ArrayExpression' &&
    Array.isArray(expr.elements) &&
    !expr.elements.some((el: Node) => el?.type === 'SpreadElement')
  );
}

/** Recursively collect every `{#each}` block in the template (Correctness CORRECT001). */
function collectEachBlocks(node: Node, source: string, acc: EachBlockFact[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectEachBlocks(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  // Itemless each (`{#each { length: 8 }, i}` — the docs' "render N times" pattern,
  // e.g. a chess board) has no item identity to key on; the only possible key is
  // the index itself, which is a no-op. Flagging it would be a false positive.
  if (node.type === 'EachBlock' && node.context != null && !isConstantListEach(node)) {
    acc.push({ hasKey: node.key != null, line: lineOf(source, node.start) });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectEachBlocks(node[key], source, acc);
  }
}

/** Generic ESTree walk over a `<script>` program: visit every node with a `.type`. */
function walkEstree(node: Node, visit: (n: Node) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walkEstree(child, visit);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    walkEstree(node[key], visit);
  }
}

/**
 * Whether a CallExpression *creates an effect*: `$effect(...)` or `$effect.pre(...)`.
 * Excludes the non-effect `$effect.*` readers (`$effect.tracking()`, `$effect.root()`),
 * which would otherwise be recorded as effects and seed spurious CORRECT002 pass units.
 */
function isEffectCall(node: Node): boolean {
  const c = node?.callee;
  if (c?.type === 'Identifier') return c.name === '$effect';
  if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === '$effect') {
    return c.property?.type === 'Identifier' && c.property.name === 'pre';
  }
  return false;
}

/** Whether a CallExpression is `$effect.root(...)` — a legal standalone reactive scope (CORRECT006). */
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
 * `$state.snapshot(...)`, which would otherwise pollute the state-name set (CORRECT002).
 */
function isStateDeclaration(node: Node): boolean {
  const c = node?.callee;
  if (c?.type === 'Identifier') return c.name === '$state';
  if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === '$state') {
    return c.property?.type === 'Identifier' && (c.property.name === 'raw' || c.property.name === 'frozen');
  }
  return false;
}

/** True when a function's body does nothing but assign to `$state` identifiers (CORRECT002). */
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
 * false-positive CORRECT003 flag, so this must cover the full pattern grammar.
 */
function addBoundNames(id: Node, acc: Set<string>): void {
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

/** The base identifier name of a (possibly nested) member expression or identifier, else undefined. */
function rootObjectName(node: Node): string | undefined {
  let cur = node;
  while (cur?.type === 'MemberExpression') cur = cur.object;
  return cur?.type === 'Identifier' ? cur.name : undefined;
}

/**
 * Names newly bound AT `node` (not by its children) that shadow an outer binding of the
 * same name for everything nested inside it: function/arrow-function parameters, a
 * `catch` clause's parameter, a block's own `let`/`const` declarations (not `var`, which
 * is function-scoped and already covered by the enclosing function's params test), a
 * `for`/`for-of`/`for-in` loop's declared variable, and a Svelte `{#each ... as x}`
 * block's context. Used by `walkScoped` so a write/mutation detector doesn't misattribute
 * a write to one of these locals as a write to an outer `$state`/prop of the same name
 * (issue #140 — a deliberately partial mitigation: `{#snippet}`/`{:then}`/`{:catch}`
 * bindings are not tracked, and a block's own `let` shadows the whole block, not just the
 * statements after its declaration — over-conservative, not exhaustive scope resolution).
 */
function scopeIntroducedNames(node: Node): Set<string> {
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
      if (stmt?.type === 'VariableDeclaration' && stmt.kind !== 'var') {
        for (const d of stmt.declarations ?? []) addBoundNames(d.id, introduced);
      }
    }
  } else if (node.type === 'ForStatement' || node.type === 'ForOfStatement' || node.type === 'ForInStatement') {
    const decl = node.type === 'ForStatement' ? node.init : node.left;
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations ?? []) addBoundNames(d.id, introduced);
    }
  } else if (node.type === 'EachBlock' && node.context) {
    addBoundNames(node.context, introduced);
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
  if (Array.isArray(node)) {
    for (const child of node) walkScoped(child, visit, shadowed);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;

  const introduced = scopeIntroducedNames(node);
  const scope = introduced.size > 0 ? new Set([...shadowed, ...introduced]) : shadowed;
  visit(node, scope);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    walkScoped(node[key], visit, scope);
  }
}

/**
 * Add state names that are WRITTEN or ESCAPED (CORRECT004 rules 1–4): reassignment,
 * update, member/element assignment, method call on the state, or the state passed
 * as a call argument. Run over the instance program AND the template fragment
 * (inline handlers mutate state in the template). Scope-aware (issue #140): a local
 * that shadows a state's name (a function param, block-scoped let/const, {#each}
 * context, …) does not mark the outer state as written/escaped.
 */
function collectStateWrites(root: Node, stateNames: Set<string>, acc: Set<string>): void {
  walkScoped(root, (n: Node, scope: Set<string>) => {
    const shadowed = (name: string | undefined): boolean => name === undefined || scope.has(name);
    if (n?.type === 'AssignmentExpression') {
      if (n.left?.type === 'Identifier' && stateNames.has(n.left.name) && !shadowed(n.left.name)) {
        acc.add(n.left.name);
      } else if (n.left?.type === 'MemberExpression') {
        const r = rootObjectName(n.left);
        if (r && stateNames.has(r) && !shadowed(r)) acc.add(r);
      } else if (n.left?.type === 'ObjectPattern' || n.left?.type === 'ArrayPattern') {
        // Destructuring-assignment target, e.g. `({ count } = obj)` or `[count] = arr`.
        const bound = new Set<string>();
        addBoundNames(n.left, bound);
        for (const name of bound) if (stateNames.has(name) && !shadowed(name)) acc.add(name);
      }
    } else if (n?.type === 'UpdateExpression') {
      const r = rootObjectName(n.argument);
      if (r && stateNames.has(r) && !shadowed(r)) acc.add(r); // x++, x.count++, x[i]++
    } else if (n?.type === 'UnaryExpression' && n.operator === 'delete') {
      const r = rootObjectName(n.argument);
      if (r && stateNames.has(r) && !shadowed(r)) acc.add(r);
    } else if (n?.type === 'CallExpression') {
      if (n.callee?.type === 'MemberExpression') {
        const r = rootObjectName(n.callee);
        if (r && stateNames.has(r) && !shadowed(r)) acc.add(r); // x.push(), x.foo()
      }
      for (const a of n.arguments ?? []) {
        // Unwrap a spread argument (`f(...x)`, `f(...x.items)`) to its expression.
        const arg = a?.type === 'SpreadElement' ? a.argument : a;
        const r = rootObjectName(arg);
        if (r && stateNames.has(r) && !shadowed(r)) acc.add(r); // f(x), f(x.a), f(...x)
      }
    }
  });
}

/**
 * Component-like nodes whose attributes are props passed INTO another component
 * (an escape), as opposed to `SvelteElement` (`<svelte:element this={...}>`), whose
 * attributes are DOM-attribute reads on a dynamically-named element — not an escape.
 */
const COMPONENT_LIKE_TYPES = new Set(['Component', 'SvelteComponent', 'SvelteSelf']);

/**
 * Add state names ESCAPED via the template (CORRECT004 rules 5–6): a `bind:` on any
 * element, or passed as a prop to a component (static `<Foo>`, or dynamic
 * `<svelte:component>`/`<svelte:self>`). Slot children / DOM-attribute reads do
 * not escape. `CHILD_NODE_KEYS` omits `attributes`, so inspect them explicitly.
 */
function collectTemplateEscapes(node: Node, stateNames: Set<string>, acc: Set<string>): void {
  if (Array.isArray(node)) {
    for (const c of node) collectTemplateEscapes(c, stateNames, acc);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (Array.isArray(node.attributes)) {
    for (const attr of node.attributes) {
      if (attr?.type === 'BindDirective') {
        const r = rootObjectName(attr.expression);
        if (r && stateNames.has(r)) acc.add(r);
      } else if (COMPONENT_LIKE_TYPES.has(node.type)) {
        walkEstree(attr, (m: Node) => {
          if (m?.type === 'Identifier' && stateNames.has(m.name)) acc.add(m.name);
        });
      }
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectTemplateEscapes(node[key], stateNames, acc);
  }
}

const RUNE_NAMES = new Set(['$state', '$derived', '$effect', '$props', '$bindable', '$inspect', '$host']);

/**
 * Whether an $effect callback body reads a reactive value (CORRECT003, conservative):
 * a reactive name, a `$`-prefixed store subscription, or any bare-identifier call.
 */
function bodyReadsReactive(fn: Node, reactiveNames: Set<string>): boolean {
  let reads = false;
  const IGNORED_KEYS = new Set(['type', 'start', 'end', 'loc', 'range']);
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
      if (!IGNORED_KEYS.has(key)) visit(n[key]);
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

/** Attributes whose value navigates/executes — a literal `javascript:` here is an XSS vector (SEC002). */
const URL_ATTRS = ['href', 'src', 'action', 'formaction'];

/** Recursively collect Security facts: `{@html}` tags and literal `javascript:` URLs (SEC001/SEC002). */
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

/** Whether a CallExpression is a bare `$props()` call. */
function isPropsCall(node: Node): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === '$props';
}

/** Whether a CallExpression is a `$bindable(...)` call (a destructured prop's default value). */
function isBindableCall(node: Node): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === '$bindable';
}

/**
 * Local identifier names bound to a non-`$bindable` prop from `$props()` (CORRECT005):
 * plain and renamed destructured names, and the `...rest` binding (rest props can never
 * be individually declared `$bindable` — that requires a per-prop destructuring default).
 * A prop initialized with `$bindable(...)` is excluded — mutating it is the intended
 * contract. `let props = $props()` (no destructuring) tracks `props` itself, since none
 * of its fields can be `$bindable` either. Returns an empty set when `$props()` appears
 * more than once, or a destructuring shape is ambiguous (nested pattern) — conservative,
 * to avoid false positives rather than chase every shape.
 */
function collectNonBindableProps(program: Node): Set<string> {
  const names = new Set<string>();
  let seen = 0;
  let ambiguous = false;
  walkEstree(program, (n) => {
    if (n.type !== 'VariableDeclarator' || !n.init || !isPropsCall(n.init)) return;
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
          if (!isBindableCall(p.value.right) && p.value.left?.type === 'Identifier') names.add(p.value.left.name);
        } else if (p.value?.type === 'Identifier') {
          names.add(p.value.name);
        }
        // A nested destructuring pattern (`{ a: { b } }`) is skipped conservatively.
      }
    }
  });
  return ambiguous || seen > 1 ? new Set() : names;
}

/** Mutating array/Set/Map methods — a call to one of these on a non-bindable prop mutates it (CORRECT005). */
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
 * Flag mutations of a non-`$bindable` prop (CORRECT005): a member-expression write
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

/** Named props destructured from `$props()`, or 0 when unknowable (ARCH002). */
function countProps(program: Node): number {
  let count = 0;
  let seen = 0;
  // Unknowable when: a non-destructured / `...rest` $props(), or more than one $props()
  // call (a normal component has exactly one) — either way we can't trust a count.
  let uncountable = false;
  walkEstree(program, (n) => {
    if (n.type !== 'VariableDeclarator' || !n.init || !isPropsCall(n.init)) return;
    seen++;
    const props = n.id?.type === 'ObjectPattern' ? n.id.properties : undefined;
    if (!Array.isArray(props) || props.some((p: Node) => p?.type === 'RestElement')) {
      uncountable = true;
      return;
    }
    count = props.filter((p: Node) => p?.type === 'Property').length;
  });
  return uncountable || seen > 1 ? 0 : count;
}

/** Source line count, not over-counting a single trailing newline (ARCH001). */
function countLines(source: string): number {
  if (source.length === 0) return 0;
  return source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
}

/** Module specifiers of every `import`, each with its source line (Bundle PERF009). */
function collectImportSources(program: Node, source: string, acc: { source: string; line: number }[]): void {
  walkEstree(program, (n) => {
    if (n.type === 'ImportDeclaration' && typeof n.source?.value === 'string') {
      acc.push({ source: n.source.value, line: lineOf(source, n.start) });
    }
  });
}

/** A specifier is "bare" (a node_modules package) when it is not relative/absolute/alias-local. */
function isBareSpecifier(s: string): boolean {
  return !/^[./$#]/.test(s);
}

/** Value `import * as X from '<bare pkg>'` namespace imports (type-only excluded) — Bundle PERF010. */
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

const JS_DIRECTIVE = /^\s*\/\/\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*$/;
const HTML_DIRECTIVE =
  /^\s*<!--\s*svelte-vitals-disable-next-line(?:\s+([A-Za-z]+\d+(?:\s*,\s*[A-Za-z]+\d+)*))?\s*-->\s*$/;

/**
 * Inline `svelte-vitals-disable-next-line` directives (issue #92). A plain text scan, not an
 * AST walk, so `<script>` (`//`) and template (`<!-- -->`) comments are covered uniformly. The
 * directive must be the entire content of its line; the suppressed line is directive-line + 1.
 */
function collectSuppressions(source: string): SuppressionDirective[] {
  const out: SuppressionDirective[] = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    const m = JS_DIRECTIVE.exec(line) ?? HTML_DIRECTIVE.exec(line);
    if (!m) return;
    const ruleIds = m[1]?.split(',').map((s) => s.trim().toUpperCase());
    out.push({ line: i + 2, ruleIds });
  });
  return out;
}

/** Nodes whose bodies do NOT run when the surrounding code is evaluated: functions run when called; class member/constructor code runs on construction (CORRECT006). */
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
 * `$effect.root(...)` callbacks (CORRECT006).
 */
function walkEvalScope(node: Node, visit: (n: Node) => boolean | undefined): void {
  if (Array.isArray(node)) {
    for (const child of node) walkEvalScope(child, visit);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (visit(node)) return;
  if (EVAL_SCOPE_BOUNDARIES.has(node.type)) return;
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    walkEvalScope(node[key], visit);
  }
}

/** Lines of `$effect`/`$effect.pre` calls that run when `root` itself is evaluated (CORRECT006). */
function collectEvalScopeEffectLines(root: Node, source: string): number[] {
  const lines: number[] = [];
  walkEvalScope(root, (n) => {
    if (n.type !== 'CallExpression') return undefined;
    if (isEffectRootCall(n)) return true;
    if (isEffectCall(n)) lines.push(lineOf(source, n.start));
    return undefined;
  });
  return lines;
}

/**
 * Unwrap a top-level statement's `export`/`export default` wrapper to the declaration
 * (or expression) it wraps; a non-export statement is returned as-is. Used so pattern 2
 * (below) treats `export class Store {…}` / `export const s = new Store()` the same as
 * their unexported forms.
 */
function unwrapExport(stmt: Node): Node {
  if (stmt.type === 'ExportNamedDeclaration') return stmt.declaration ?? stmt;
  if (stmt.type === 'ExportDefaultDeclaration') return stmt.declaration;
  return stmt;
}

/**
 * Orphan `$effect` facts for a module-context program (CORRECT006): (1) effects that run
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
 * `collectEvalScopeEffectLines` above.
 */
function collectOrphanEffects(program: Node, source: string): OrphanEffectFact[] {
  const out: OrphanEffectFact[] = collectEvalScopeEffectLines(program, source).map((line) => ({
    line,
    kind: 'top-level' as const
  }));

  const body: Node[] = program.body ?? [];

  const effectfulClasses = new Set<string>();
  for (const stmt of body) {
    const decl = unwrapExport(stmt);
    if (decl?.type !== 'ClassDeclaration' || decl.id?.type !== 'Identifier') continue;
    // A TS constructor overload signature is bodiless — require a body so the FIRST
    // matching MethodDefinition is the actual implementation, not a signature.
    const ctor = (decl.body?.body ?? []).find(
      (m: Node) => m?.type === 'MethodDefinition' && m.kind === 'constructor' && m.value?.body
    );
    if (ctor && collectEvalScopeEffectLines(ctor.value.body, source).length > 0) {
      effectfulClasses.add(decl.id.name);
    }
  }

  if (effectfulClasses.size > 0) {
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
        if (n.type === 'NewExpression' && n.callee?.type === 'Identifier' && effectfulClasses.has(n.callee.name)) {
          out.push({ line: lineOf(source, n.start), kind: 'constructor-instantiated', className: n.callee.name });
        }
        return undefined;
      });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/** A Svelte runes module file — the whole file is one module-scope program (CORRECT006). */
const MODULE_FILE_RE = /\.svelte\.(ts|js)$/;

/** What the per-file parsers produce — `ComponentFacts` minus `file`, with `suppressions` always present. */
type ParsedFacts = Omit<ComponentFacts, 'file' | 'suppressions'> & { suppressions: SuppressionDirective[] };

/**
 * Facts for a `.svelte.ts`/`.svelte.js` runes module (CORRECT006). The whole file runs at
 * import time, so only `orphanEffects` and `suppressions` are populated — component-only
 * facts stay empty and `loc` is 0 so ARCH001/PERF009 don't fire on module files. The
 * source is wrapped in a `<script lang="ts">` tag so the Svelte script parser (which
 * handles TS natively) yields the ESTree program; the 1-line wrap prefix is subtracted
 * from every reported line. A source containing a literal `"</script>"` string defeats
 * the wrap and throws here — callers already treat a throw as empty facts.
 */
function parseModuleFacts(source: string, filename: string): ParsedFacts {
  const wrapped = `<script lang="ts">\n${source}\n</script>`;
  const ast = parse(wrapped, { modern: true, filename }) as Node;
  const program = ast.instance?.content;
  const orphanEffects = program
    ? collectOrphanEffects(program, wrapped).map((f) => ({ ...f, line: Math.max(0, f.line - 1) }))
    : [];
  return {
    eachBlocks: [],
    effects: [],
    htmlTags: [],
    javascriptUrls: [],
    loc: 0,
    propCount: 0,
    imports: [],
    importSpans: [],
    namespaceImports: [],
    constableStates: [],
    mutatedProps: [],
    suppressions: collectSuppressions(source),
    orphanEffects
  };
}

/**
 * Parse one source file's facts (CLI/static + vite build mode): a `.svelte` component's
 * reactivity/correctness + security + architecture facts, or a `.svelte.ts`/`.svelte.js`
 * runes module's orphan-$effect facts (CORRECT006).
 */
export function parseComponentFacts(source: string, filename: string): ParsedFacts {
  if (MODULE_FILE_RE.test(filename)) return parseModuleFacts(source, filename);

  const ast = parse(source, { modern: true, filename }) as Node;
  const eachBlocks: EachBlockFact[] = [];
  collectEachBlocks(ast.fragment ?? ast, source, eachBlocks);
  const htmlTags: SourceSpan[] = [];
  const javascriptUrls: SourceSpan[] = [];
  collectSecurityFacts(ast.fragment ?? ast, source, htmlTags, javascriptUrls);
  const loc = countLines(source);
  const suppressions = collectSuppressions(source);

  // Imports live in either the instance (<script>) or module (<script module>) program.
  const importSpans: { source: string; line: number }[] = [];
  const namespaceImports: { source: string; line: number }[] = [];
  if (ast.module?.content) {
    collectImportSources(ast.module.content, source, importSpans);
    collectNamespaceImports(ast.module.content, source, namespaceImports);
  }
  const orphanEffects: OrphanEffectFact[] = ast.module?.content ? collectOrphanEffects(ast.module.content, source) : [];

  const effects: EffectFact[] = [];
  const constableStates: { name: string; line: number }[] = [];
  const mutatedProps: { name: string; line: number }[] = [];
  let propCount = 0;
  const program = ast.instance?.content;
  if (program) {
    collectImportSources(program, source, importSpans);
    collectNamespaceImports(program, source, namespaceImports);
    propCount = countProps(program);
    const nonBindableProps = collectNonBindableProps(program);
    collectPropMutations(program, nonBindableProps, source, mutatedProps);
    if (ast.fragment) collectPropMutations(ast.fragment, nonBindableProps, source, mutatedProps);
    const stateNames = new Set<string>();
    const reactiveNames = new Set<string>();
    const stateDecls: { name: string; line: number }[] = [];
    walkEstree(program, (n) => {
      if (n.type !== 'VariableDeclarator' || !n.init) return;
      if (isStateDeclaration(n.init) && n.id?.type === 'Identifier') {
        stateNames.add(n.id.name);
        stateDecls.push({ name: n.id.name, line: lineOf(source, n.start) });
      }
      if (isStateDeclaration(n.init) || isDerivedDeclaration(n.init) || isPropsCall(n.init))
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
    }
    for (const d of stateDecls) {
      if (!writtenOrEscaped.has(d.name)) constableStates.push(d);
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
    orphanEffects,
    suppressions
  };
}
