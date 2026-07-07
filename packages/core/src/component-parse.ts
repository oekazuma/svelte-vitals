import { parse } from 'svelte/compiler';
import type { EachBlockFact, EffectFact, SourceSpan, SuppressionDirective } from './component.js';
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
 * Add state names that are WRITTEN or ESCAPED (CORRECT004 rules 1–4): reassignment,
 * update, member/element assignment, method call on the state, or the state passed
 * as a call argument. Run over the instance program AND the template fragment
 * (inline handlers mutate state in the template).
 */
function collectStateWrites(root: Node, stateNames: Set<string>, acc: Set<string>): void {
  walkEstree(root, (n: Node) => {
    if (n?.type === 'AssignmentExpression') {
      if (n.left?.type === 'Identifier' && stateNames.has(n.left.name)) acc.add(n.left.name);
      else if (n.left?.type === 'MemberExpression') {
        const r = rootObjectName(n.left);
        if (r && stateNames.has(r)) acc.add(r);
      } else if (n.left?.type === 'ObjectPattern' || n.left?.type === 'ArrayPattern') {
        // Destructuring-assignment target, e.g. `({ count } = obj)` or `[count] = arr`.
        const bound = new Set<string>();
        addBoundNames(n.left, bound);
        for (const name of bound) if (stateNames.has(name)) acc.add(name);
      }
    } else if (n?.type === 'UpdateExpression') {
      const r = rootObjectName(n.argument);
      if (r && stateNames.has(r)) acc.add(r); // x++, x.count++, x[i]++
    } else if (n?.type === 'UnaryExpression' && n.operator === 'delete') {
      const r = rootObjectName(n.argument);
      if (r && stateNames.has(r)) acc.add(r);
    } else if (n?.type === 'CallExpression') {
      if (n.callee?.type === 'MemberExpression') {
        const r = rootObjectName(n.callee);
        if (r && stateNames.has(r)) acc.add(r); // x.push(), x.foo()
      }
      for (const a of n.arguments ?? []) {
        // Unwrap a spread argument (`f(...x)`, `f(...x.items)`) to its expression.
        const arg = a?.type === 'SpreadElement' ? a.argument : a;
        const r = rootObjectName(arg);
        if (r && stateNames.has(r)) acc.add(r); // f(x), f(x.a), f(...x)
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

/** Module specifiers of every `import` in an ESTree program (Bundle PERF009). */
function collectImportSources(program: Node, acc: string[]): void {
  walkEstree(program, (n) => {
    if (n.type === 'ImportDeclaration' && typeof n.source?.value === 'string') acc.push(n.source.value);
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

/** Parse a component's reactivity/correctness + security + architecture facts (CLI/static + vite build mode). */
export function parseComponentFacts(
  source: string,
  filename: string
): {
  eachBlocks: EachBlockFact[];
  effects: EffectFact[];
  htmlTags: SourceSpan[];
  javascriptUrls: SourceSpan[];
  loc: number;
  propCount: number;
  imports: string[];
  namespaceImports: { source: string; line: number }[];
  constableStates: { name: string; line: number }[];
  suppressions: SuppressionDirective[];
} {
  const ast = parse(source, { modern: true, filename }) as Node;
  const eachBlocks: EachBlockFact[] = [];
  collectEachBlocks(ast.fragment ?? ast, source, eachBlocks);
  const htmlTags: SourceSpan[] = [];
  const javascriptUrls: SourceSpan[] = [];
  collectSecurityFacts(ast.fragment ?? ast, source, htmlTags, javascriptUrls);
  const loc = countLines(source);
  const suppressions = collectSuppressions(source);

  // Imports live in either the instance (<script>) or module (<script module>) program.
  const imports: string[] = [];
  const namespaceImports: { source: string; line: number }[] = [];
  if (ast.module?.content) {
    collectImportSources(ast.module.content, imports);
    collectNamespaceImports(ast.module.content, source, namespaceImports);
  }

  const effects: EffectFact[] = [];
  const constableStates: { name: string; line: number }[] = [];
  let propCount = 0;
  const program = ast.instance?.content;
  if (program) {
    collectImportSources(program, imports);
    collectNamespaceImports(program, source, namespaceImports);
    propCount = countProps(program);
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
  return {
    eachBlocks,
    effects,
    htmlTags,
    javascriptUrls,
    loc,
    propCount,
    imports,
    namespaceImports,
    constableStates,
    suppressions
  };
}
