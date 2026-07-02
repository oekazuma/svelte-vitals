import { parse } from 'svelte/compiler';
import type { HeadTag } from '@svelte-vitals/core';
import type { Value, EachBlockFact, EffectFact, SourceSpan } from '@svelte-vitals/core';
import { collectImports, type ImportMap } from './imports.js';

/** A head tag parsed from one file, before layout-chain presence is assigned. */
export type ParsedTag = Omit<HeadTag, 'presence' | 'file'>;

// The Svelte AST is structurally complex and only partially typed for our needs,
// so traversal uses `any`. The node-type strings below are verified against
// svelte 5 output (see Slice 0 AST probe): <title> is `TitleElement` (not a
// RegularElement), and `{expr}` is `ExpressionTag`.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/**
 * All keys that can bear child nodes in a Svelte AST node.
 * Covers if/each/await blocks (pending/then/catch/fallback) as well as
 * the standard fragment, nodes, consequent, alternate, and body keys.
 */
const CHILD_NODE_KEYS = [
  'fragment',
  'nodes',
  'consequent',
  'alternate',
  'body',
  'pending',
  'then',
  'catch',
  'fallback'
];

/**
 * Determine a value's kind from a list of child/text nodes (design §4, §11):
 *   - any ExpressionTag present  → 'dynamic' (e.g. {data.title}); we do NOT
 *     follow the expression — that would turn this into runtime analysis.
 *   - non-whitespace Text only   → 'static'
 *   - empty / whitespace only    → 'absent'
 */
function valueFromNodes(nodes: Node[]): Value {
  if (!Array.isArray(nodes)) return 'absent';
  if (nodes.some((n) => n?.type === 'ExpressionTag')) return 'dynamic';
  const text = nodes
    .filter((n) => n?.type === 'Text')
    .map((n) => String(n.data ?? ''))
    .join('');
  return text.trim().length > 0 ? 'static' : 'absent';
}

/** The literal text of a node list when fully static (no ExpressionTag), else undefined. */
function textFromNodes(nodes: Node[]): string | undefined {
  if (!Array.isArray(nodes) || nodes.some((n) => n?.type === 'ExpressionTag')) return undefined;
  const text = nodes
    .filter((n) => n?.type === 'Text')
    .map((n) => String(n.data ?? ''))
    .join('');
  return text.trim().length > 0 ? text : undefined;
}

/** Static string of an attribute (e.g. name="description"), or undefined if dynamic/absent. */
function attrText(attributes: Node[], name: string): string | undefined {
  const attr = findAttr(attributes, name);
  if (!attr) return undefined;
  const v = attr.value;
  if (v === true) return '';
  if (Array.isArray(v)) {
    return v
      .filter((n: Node) => n?.type === 'Text')
      .map((n: Node) => String(n.data ?? ''))
      .join('');
  }
  return undefined; // single ExpressionTag → not a literal
}

/** Value kind of an attribute's content (e.g. the `content` of a <meta>). */
export function attrValue(attributes: Node[], name: string): Value {
  const attr = findAttr(attributes, name);
  if (!attr) return 'absent';
  const v = attr.value;
  if (v === true) return 'absent'; // boolean attribute, no content
  if (Array.isArray(v)) return valueFromNodes(v);
  if (v && v.type === 'ExpressionTag') return 'dynamic'; // content={expr}
  return 'absent';
}

function lineOf(source: string, offset: unknown): number {
  if (typeof offset !== 'number' || offset < 0) return 0;
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) if (source[i] === '\n') line++;
  return line;
}

function findAttr(attributes: Node[], name: string): Node | undefined {
  if (!Array.isArray(attributes)) return undefined;
  return attributes.find((a) => a?.type === 'Attribute' && a.name === name);
}

/** Recursively collect every <svelte:head> node anywhere in the template. */
function collectSvelteHeads(node: Node, acc: Node[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectSvelteHeads(child, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'SvelteHead') acc.push(node);
  // Visit the child-bearing properties used by Svelte fragments and blocks.
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectSvelteHeads(node[key], acc);
  }
}

function tagsFromHead(head: Node): ParsedTag[] {
  const tags: ParsedTag[] = [];
  const children: Node[] = head?.fragment?.nodes ?? [];
  for (const node of children) {
    if (node?.type === 'TitleElement') {
      const titleNodes = node.fragment?.nodes ?? [];
      const text = textFromNodes(titleNodes);
      tags.push({ kind: 'title', value: valueFromNodes(titleNodes), ...(text !== undefined ? { text } : {}) });
      continue;
    }
    if (node?.type !== 'RegularElement') continue;

    if (node.name === 'meta') {
      const charset = attrValue(node.attributes, 'charset');
      if (charset !== 'absent') {
        // <meta charset="…"> carries neither name nor property; model it as name:'charset' (SEO024).
        tags.push({ kind: 'meta', name: 'charset', value: charset });
        continue;
      }
      const name = attrText(node.attributes, 'name');
      const property = attrText(node.attributes, 'property');
      const content = name === 'robots' ? attrText(node.attributes, 'content') : undefined;
      const noindex = content !== undefined && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
      const contentValue = attrValue(node.attributes, 'content');
      const descText =
        name === 'description' && contentValue === 'static' ? attrText(node.attributes, 'content') : undefined;
      tags.push({
        kind: 'meta',
        ...(name ? { name } : {}),
        ...(property ? { property } : {}),
        value: contentValue,
        ...(noindex ? { noindex: true } : {}),
        ...(descText !== undefined ? { text: descText } : {})
      });
    } else if (node.name === 'link') {
      const rel = attrText(node.attributes, 'rel');
      const hasAs = findAttr(node.attributes, 'as') !== undefined;
      const asLiteral = attrText(node.attributes, 'as'); // literal keyword, or undefined for dynamic/absent
      const hasCrossorigin = findAttr(node.attributes, 'crossorigin') !== undefined;
      const hreflang = attrText(node.attributes, 'hreflang'); // literal (incl. '') or undefined for dynamic/absent
      const href = attrText(node.attributes, 'href'); // literal URL (for PERF008 origin analysis), or undefined
      tags.push({
        kind: 'link',
        ...(rel ? { rel } : {}),
        value: attrValue(node.attributes, 'href'),
        ...(hasAs ? { hasAs: true } : {}),
        ...(asLiteral ? { as: asLiteral } : {}),
        ...(hasCrossorigin ? { hasCrossorigin: true } : {}),
        // Keep a literal empty hreflang="" (present-but-invalid) so SEO026 can flag it.
        ...(hreflang !== undefined ? { hreflang } : {}),
        ...(href ? { href } : {})
      });
    } else if (node.name === 'script') {
      const type = attrText(node.attributes, 'type');
      if (type === 'application/ld+json') {
        const nodes = node.fragment?.nodes ?? [];
        const raw = textFromNodes(nodes);
        tags.push({ kind: 'jsonld', value: valueFromNodes(nodes), ...(raw !== undefined ? { jsonld: raw } : {}) });
      } else {
        // External <script src> in <svelte:head> (PERF007/PERF008). Render-blocking
        // unless defer/async/type=module; only literal src is modeled.
        const src = attrText(node.attributes, 'src');
        if (src) {
          const blocking =
            findAttr(node.attributes, 'defer') === undefined &&
            findAttr(node.attributes, 'async') === undefined &&
            type !== 'module';
          tags.push({ kind: 'script', value: 'static', href: src, ...(blocking ? { blocking: true } : {}) });
        }
      }
    }
  }
  return tags;
}

/** Value kind of a single attribute (e.g. a component prop). */
export function attrValueOf(attr: Node): Value {
  const v = attr?.value;
  if (v === true) return 'absent';
  if (Array.isArray(v)) return valueFromNodes(v);
  if (v && v.type === 'ExpressionTag') return 'dynamic';
  return 'absent';
}

/** Literal static text of a single attribute node (e.g. a component prop), or undefined if dynamic/absent. */
export function attrTextOf(attr: Node): string | undefined {
  const v = attr?.value;
  if (!Array.isArray(v) || v.some((n: Node) => n?.type === 'ExpressionTag')) return undefined;
  const text = v
    .filter((n: Node) => n?.type === 'Text')
    .map((n: Node) => String(n.data ?? ''))
    .join('');
  return text.trim().length > 0 ? text : undefined;
}

export interface ComponentUse {
  name: string;
  attributes: Node[];
  hasSpread: boolean;
}

function collectComponents(node: Node, acc: ComponentUse[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectComponents(child, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'Component' && typeof node.name === 'string') {
    const attributes: Node[] = node.attributes ?? [];
    acc.push({
      name: node.name,
      attributes,
      hasSpread: attributes.some((a) => a?.type === 'SpreadAttribute')
    });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectComponents(node[key], acc);
  }
}

export interface ParsedImage {
  hasWidth: boolean;
  hasHeight: boolean;
  hasLoading: boolean;
  hasAlt: boolean;
  lazy: boolean;
  hasSrcset: boolean;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** A page-body heading (<h1>–<h6>) parsed from one file (SEO027). */
export interface ParsedHeading {
  /** Heading level 1–6. */
  level: number;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

function collectImages(node: Node, source: string, acc: ParsedImage[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectImages(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && node.name === 'img') {
    const attrs: Node[] = node.attributes ?? [];
    const hasSpread = attrs.some((a: Node) => a?.type === 'SpreadAttribute');
    acc.push({
      hasWidth: hasSpread || Boolean(findAttr(attrs, 'width')),
      hasHeight: hasSpread || Boolean(findAttr(attrs, 'height')),
      hasLoading: hasSpread || Boolean(findAttr(attrs, 'loading')),
      hasAlt: hasSpread || Boolean(findAttr(attrs, 'alt')),
      // A literal loading="lazy" only — a spread or dynamic loading={…} must not be flagged.
      lazy: attrText(attrs, 'loading') === 'lazy',
      hasSrcset: hasSpread || Boolean(findAttr(attrs, 'srcset')),
      line: lineOf(source, node.start)
    });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectImages(node[key], source, acc);
  }
}

/** Recursively collect page-body headings (<h1>–<h6>) anywhere in the template (SEO027). */
function collectHeadings(node: Node, source: string, acc: ParsedHeading[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectHeadings(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  // Body headings only — a stray <h1> inside <svelte:head> is not a page heading.
  if (node.type === 'SvelteHead') return;
  if (node.type === 'RegularElement' && typeof node.name === 'string' && /^h[1-6]$/.test(node.name)) {
    acc.push({ level: Number(node.name[1]), line: lineOf(source, node.start) });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectHeadings(node[key], source, acc);
  }
}

export interface ParsedFile {
  headTags: ParsedTag[];
  components: ComponentUse[];
  imports: ImportMap;
  images: ParsedImage[];
  headings: ParsedHeading[];
}

/** Parse a .svelte source into its layer-1 head tags, component usages, and imports. */
export function parseFile(source: string, filename: string): ParsedFile {
  const ast = parse(source, { modern: true, filename }) as Node;
  const heads: Node[] = [];
  collectSvelteHeads(ast.fragment ?? ast, heads);
  const components: ComponentUse[] = [];
  collectComponents(ast.fragment ?? ast, components);
  const images: ParsedImage[] = [];
  collectImages(ast.fragment ?? ast, source, images);
  const headings: ParsedHeading[] = [];
  collectHeadings(ast.fragment ?? ast, source, headings);
  return {
    headTags: heads.flatMap(tagsFromHead),
    components,
    imports: collectImports(ast),
    images,
    headings
  };
}

/**
 * Parse a .svelte source and extract the head tags declared in its
 * <svelte:head> blocks (detection layer 1 — literal svelte:head, design §11).
 */
export function parseHeadTags(source: string, filename: string): ParsedTag[] {
  const ast = parse(source, { modern: true, filename }) as Node;
  const heads: Node[] = [];
  collectSvelteHeads(ast.fragment ?? ast, heads);
  return heads.flatMap(tagsFromHead);
}

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
  if (node.type === 'EachBlock' && !isConstantListEach(node)) {
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
      }
    } else if (n?.type === 'UpdateExpression' && n.argument?.type === 'Identifier' && stateNames.has(n.argument.name)) {
      acc.add(n.argument.name);
    } else if (n?.type === 'CallExpression') {
      if (n.callee?.type === 'MemberExpression') {
        const r = rootObjectName(n.callee);
        if (r && stateNames.has(r)) acc.add(r); // x.push(), x.foo()
      }
      for (const a of n.arguments ?? []) {
        if (a?.type === 'Identifier' && stateNames.has(a.name)) acc.add(a.name); // f(x)
      }
    }
  });
}

/**
 * Add state names ESCAPED via the template (CORRECT004 rules 5–6): a `bind:` on any
 * element, or passed as a `Component` prop. Slot children / DOM-attribute reads do
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
      } else if (node.type === 'Component') {
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

/** Parse a component's reactivity/correctness + security + architecture facts (CLI/static only). */
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
} {
  const ast = parse(source, { modern: true, filename }) as Node;
  const eachBlocks: EachBlockFact[] = [];
  collectEachBlocks(ast.fragment ?? ast, source, eachBlocks);
  const htmlTags: SourceSpan[] = [];
  const javascriptUrls: SourceSpan[] = [];
  collectSecurityFacts(ast.fragment ?? ast, source, htmlTags, javascriptUrls);
  const loc = countLines(source);

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
  return { eachBlocks, effects, htmlTags, javascriptUrls, loc, propCount, imports, namespaceImports, constableStates };
}
