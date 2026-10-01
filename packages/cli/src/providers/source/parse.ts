import type { AST } from 'svelte/compiler';
import type { BranchStep, HeadTag, SuppressionDirective } from '@svelte-vitals/core/internal';
import {
  collectSuppressions,
  stripTextDirective,
  parseSvelte,
  CHILD_NODE_KEYS,
  lineOf,
  findAttr,
  valueFromNodes,
  textFromNodes,
  attrText,
  attrTextOf,
  attrValue,
  attrValueOf,
  decodeFragmentId,
  splitTokens,
  isClassicScriptType,
  resolveLandmark,
  ASIDE_DEMOTING_TAGS,
  SECTIONING_TAGS,
  ANCESTRY_DEPENDENT_TAGS,
  NAMING_ATTRS,
  IDREF_ATTRS,
  isSvgSrc,
  unwrapTs,
  walkEstree
} from '@svelte-vitals/core/internal';
import { collectComponentBindings, collectImports, type ComponentCandidate, type ImportMap } from './imports.js';
import type { UrlCond } from './url-cond.js';

/** A head tag parsed from one file, before layout-chain presence is assigned. */
export type ParsedTag = Omit<HeadTag, 'presence' | 'file'> & {
  /**
   * A `<meta>` with no literal key whose `name`/`property` is an expression (or a spread): it may
   * be any meta of that attribute, so the route composition only rules out "missing" for them.
   */
  dynamicKey?: { name: boolean; property: boolean };
};

/** Any template node reachable while walking a parsed component (a Fragment's node list, plus Fragment itself). */
type WalkNode = AST.Fragment | AST.Text | AST.Tag | AST.ElementLike | AST.Block | AST.Comment;

/**
 * Read a CHILD_NODE_KEYS entry off a heterogeneous template node. Each concrete node type
 * only declares some of these keys (e.g. `IfBlock.consequent`, `EachBlock.body`), so there's
 * no single interface to index into — this cast is the walker's one deliberate escape hatch.
 */
function childOf(node: WalkNode, key: string): WalkNode | WalkNode[] | null | undefined {
  return (node as WalkNode & Record<string, WalkNode | WalkNode[] | null | undefined>)[key];
}

/** Recursively collect every <svelte:head> node anywhere in the template. */
function collectSvelteHeads(node: WalkNode | WalkNode[] | null | undefined, acc: AST.SvelteHead[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectSvelteHeads(child, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'SvelteHead') acc.push(node);
  // Visit the child-bearing properties used by Svelte fragments and blocks.
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectSvelteHeads(childOf(node, key), acc);
  }
}

/**
 * Tags from the branches of an if/each/await block: which branch renders, and how often, is
 * runtime state. So each tag is dynamic with no literal claim (text, noindex, JSON-LD, hreflang)
 * — picking one branch's literal would judge a value that may never render — and a tag repeated
 * across exclusive branches counts once.
 */
function conditionalTags(
  branches: Array<AST.Fragment | null | undefined>,
  source: string,
  bind: Bind,
  jsonLdNames: ReadonlySet<string>
): ParsedTag[] {
  const unique = new Map<string, ParsedTag>();
  for (const fragment of branches) {
    for (const tag of tagsFromNodes(fragment?.nodes ?? [], source, bind, jsonLdNames)) {
      const { text: _text, noindex: _noindex, jsonld: _jsonld, hreflang: _hreflang, ...shape } = tag;
      const dynamic: ParsedTag = { ...shape, value: 'dynamic' };
      unique.set(JSON.stringify(dynamic), dynamic);
    }
  }
  return [...unique.values()];
}

/** Rewrites an element's attributes before they are read (binds prop references to call-site literals). */
type Bind = (attributes: AST.RegularElement['attributes']) => AST.RegularElement['attributes'];

/** Wording that names JSON-LD — "structured data" is the name search engines give it. */
const JSONLD_WORDS = /json-?ld|ld\+json|structured-?data/i;

/**
 * Script bindings whose initializer spells out a JSON-LD block's opening tag (`` const ld = `<script
 * type="application/ld+json">…` ``, or `"<scr" + 'ipt type="application/ld+json">'`), or is built
 * from such a binding (`OPEN + JSON.stringify(data) + CLOSE`), or calls a function named for it
 * (`jsonLd(data)`), so `{@html ld}` is read as one.
 */
function jsonLdBindings(ast: AST.Root): Set<string> {
  type Node = { type: string; [key: string]: unknown };
  // What an initializer reads (identifiers, not a property name or key) and the text of its string parts.
  const scan = (init: unknown) => {
    const refs = new Set<string>();
    const strings: string[] = [];
    const visit = (node: unknown, skip = false): void => {
      if (Array.isArray(node)) return node.forEach((n) => visit(n));
      if (!node || typeof node !== 'object') return;
      const n = node as Node & { name?: string; value?: unknown; computed?: boolean };
      if (n.type === 'Identifier' && !skip && n.name) refs.add(n.name);
      if (n.type === 'Literal' && typeof n.value === 'string') strings.push(n.value);
      if (n.type === 'TemplateElement')
        strings.push(String((n.value as { cooked?: string } | undefined)?.cooked ?? ''));
      for (const [key, value] of Object.entries(n)) {
        if (key === 'parent' || !value || typeof value !== 'object') continue;
        const nonComputed =
          !n.computed &&
          ((n.type === 'MemberExpression' && key === 'property') || (n.type === 'Property' && key === 'key'));
        visit(value, nonComputed);
      }
    };
    visit(init);
    return {
      refs,
      opens: producedByJsonLdCall(init) || strings.some((t) => /\btype\s*=\s*["']?application\/ld\+json/i.test(t))
    };
  };
  // A call whose result is the value — the initializer itself, or through `$derived(…)`, `await`, a
  // conditional's arms, string concatenation or a list's items — never an argument of another call.
  const producedByJsonLdCall = (expr: unknown): boolean => {
    const e = expr as (Node & Record<string, unknown>) | null | undefined;
    switch (e?.type) {
      case 'CallExpression': {
        const callee = e.callee as (Node & { name?: string; property?: { name?: string } }) | undefined;
        const name = callee?.type === 'Identifier' ? callee.name : callee?.property?.name;
        if (name === '$derived') return producedByJsonLdCall((e.arguments as unknown[])[0]);
        return !!name && JSONLD_WORDS.test(name);
      }
      case 'AwaitExpression':
        return producedByJsonLdCall(e.argument);
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
        return producedByJsonLdCall(e.expression);
      case 'ConditionalExpression':
        return producedByJsonLdCall(e.consequent) || producedByJsonLdCall(e.alternate);
      case 'LogicalExpression':
        return producedByJsonLdCall(e.left) || producedByJsonLdCall(e.right);
      case 'BinaryExpression':
        return e.operator === '+' && (producedByJsonLdCall(e.left) || producedByJsonLdCall(e.right));
      case 'TemplateLiteral':
        return (e.expressions as unknown[]).some(producedByJsonLdCall);
      case 'ArrayExpression':
        return (e.elements as unknown[]).some(producedByJsonLdCall);
      default:
        return false;
    }
  };
  const inits = new Map<string, ReturnType<typeof scan>>();
  for (const script of [ast.module, ast.instance]) {
    for (const stmt of script?.content.body ?? []) {
      if (stmt.type !== 'VariableDeclaration') continue;
      for (const d of stmt.declarations) {
        if (d.id.type === 'Identifier' && d.init) inits.set(d.id.name, scan(d.init));
      }
    }
  }
  const names = new Set<string>();
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, { refs, opens }] of inits) {
      if (names.has(name) || !(opens || [...refs].some((r) => names.has(r)))) continue;
      names.add(name);
      grew = true;
    }
  }
  return names;
}

/** `names` plus an `{#each}` item that is JSON-LD: the item of a list named for it (`{#each jsonLdScripts as script}`) or held in a JSON-LD binding. */
function eachItemJsonLd(node: WalkNode, source: string, names: ReadonlySet<string>): ReadonlySet<string> {
  if (node.type !== 'EachBlock' || node.context?.type !== 'Identifier') return names;
  const list = node.expression;
  // Svelte's AST carries offsets on every expression node; estree's types leave them out.
  const { start, end } = list as typeof list & { start: number; end: number };
  const named = JSONLD_WORDS.test(source.slice(start, end)) || (list.type === 'Identifier' && names.has(list.name));
  return named ? new Set([...names, node.context.name]) : names;
}

function tagsFromNodes(
  children: AST.Fragment['nodes'],
  source: string,
  bind: Bind = (a) => a,
  jsonLdNames: ReadonlySet<string> = new Set()
): ParsedTag[] {
  const tags: ParsedTag[] = [];
  for (const node of children) {
    if (node.type === 'KeyBlock') {
      tags.push(...tagsFromNodes(node.fragment.nodes, source, bind, jsonLdNames));
      continue;
    }
    const branches =
      node.type === 'IfBlock'
        ? [node.consequent, node.alternate]
        : node.type === 'EachBlock'
          ? [node.body, node.fallback]
          : node.type === 'AwaitBlock'
            ? [node.pending, node.then, node.catch]
            : undefined;
    if (branches) {
      tags.push(...conditionalTags(branches, source, bind, eachItemJsonLd(node, source, jsonLdNames)));
      continue;
    }
    // Outside `<svelte:head>` Svelte parses `<title>` as a regular element: the top level of a
    // component a parent renders inside `<svelte:head>`.
    if (node.type === 'TitleElement' || (node.type === 'RegularElement' && node.name === 'title')) {
      // A <title>'s fragment only ever contains literal text and {expr} tags.
      const titleNodes = node.fragment.nodes as Array<AST.Text | AST.ExpressionTag>;
      const text = textFromNodes(titleNodes);
      tags.push({ kind: 'title', value: valueFromNodes(titleNodes), ...(text !== undefined ? { text } : {}) });
      continue;
    }
    if (node.type === 'HtmlTag') {
      // A JSON-LD <script> built as a string (`{@html jsonLd(data)}`) is invisible as an element, so
      // the expression's wording, or the initializer of the binding it names, is the only signal;
      // other injections (`{@html css}`) stay unmatched.
      const named = node.expression.type === 'Identifier' && jsonLdNames.has(node.expression.name);
      if (named || JSONLD_WORDS.test(source.slice(node.start, node.end)))
        tags.push({ kind: 'jsonld', value: 'dynamic' });
      continue;
    }
    if (node.type !== 'RegularElement' && node.type !== 'SvelteElement') continue;
    // A `<svelte:element this="script">` with a determinable tag renders exactly that element.
    const resolved = node.type === 'RegularElement' ? [node.name] : svelteElementTags(node.tag);
    if (resolved?.length !== 1) continue;
    const element = resolved[0];
    // The core attr helpers only ever match `Attribute`-typed entries; SpreadAttribute/Directive/AttachTag
    // are filtered out internally, so this widening cast is safe.
    const attributes = bind(node.attributes) as AST.Attribute[];

    if (element === 'meta') {
      const charset = attrValue(attributes, 'charset');
      if (charset !== 'absent') {
        // <meta charset="…"> carries neither name nor property; model it as name:'charset' (seo/charset).
        tags.push({ kind: 'meta', name: 'charset', value: charset });
        continue;
      }
      // Like rel below: rules compare meta names literally, but HTML treats them case-insensitively.
      const name = attrText(attributes, 'name')?.toLowerCase();
      const property = attrText(attributes, 'property');
      if (!name && !property) {
        const spread = node.attributes.some((a) => a.type === 'SpreadAttribute');
        const dynamicKey = {
          name: spread || attrValue(attributes, 'name') === 'dynamic',
          property: spread || attrValue(attributes, 'property') === 'dynamic'
        };
        if (dynamicKey.name || dynamicKey.property) {
          tags.push({ kind: 'meta', value: 'dynamic', dynamicKey });
          continue;
        }
      }
      const content = name === 'robots' ? attrText(attributes, 'content') : undefined;
      const noindex = content !== undefined && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
      const contentValue = attrValue(attributes, 'content');
      const descText =
        name === 'description' && contentValue === 'static' ? attrText(attributes, 'content') : undefined;
      tags.push({
        kind: 'meta',
        ...(name ? { name } : {}),
        ...(property ? { property } : {}),
        value: contentValue,
        ...(noindex ? { noindex: true } : {}),
        ...(descText !== undefined ? { text: descText } : {})
      });
    } else if (element === 'link') {
      // rel/as keywords are ASCII case-insensitive per the HTML spec; rules and the head
      // composition compare them literally, so normalize once here.
      const rel = attrText(attributes, 'rel')?.toLowerCase();
      const hasAs = findAttr(attributes, 'as') !== undefined;
      const asLiteral = attrText(attributes, 'as')?.toLowerCase(); // literal keyword, or undefined for dynamic/absent
      const hasCrossorigin = findAttr(attributes, 'crossorigin') !== undefined;
      const hreflang = attrText(attributes, 'hreflang'); // literal (incl. '') or undefined for dynamic/absent
      const href = attrText(attributes, 'href'); // literal URL (for performance/preconnect origin analysis), or undefined
      tags.push({
        kind: 'link',
        ...(rel ? { rel } : {}),
        value: attrValue(attributes, 'href'),
        ...(hasAs ? { hasAs: true } : {}),
        ...(asLiteral ? { as: asLiteral } : {}),
        ...(hasCrossorigin ? { hasCrossorigin: true } : {}),
        // Keep a literal empty hreflang="" (present-but-invalid) so seo/hreflang can flag it.
        ...(hreflang !== undefined ? { hreflang } : {}),
        ...(href ? { href } : {})
      });
    } else if (element === 'script') {
      const type = attrText(attributes, 'type');
      if (type === 'application/ld+json') {
        // A JSON-LD <script>'s fragment only ever contains literal text and {expr} tags.
        const nodes = node.fragment.nodes as Array<AST.Text | AST.ExpressionTag>;
        const raw = textFromNodes(nodes);
        tags.push({ kind: 'jsonld', value: valueFromNodes(nodes), ...(raw !== undefined ? { jsonld: raw } : {}) });
      } else {
        // External <script src> in <svelte:head> (performance/render-blocking-script, performance/preconnect). Render-blocking
        // only for a classic script (isClassicScriptType) without defer/async; only literal src is modeled.
        const src = attrText(attributes, 'src');
        if (src) {
          const blocking =
            isClassicScriptType(type) &&
            findAttr(attributes, 'defer') === undefined &&
            findAttr(attributes, 'async') === undefined;
          tags.push({ kind: 'script', value: 'static', href: src, ...(blocking ? { blocking: true } : {}) });
        }
      }
    }
  }
  return tags;
}

/**
 * `document.title = …` in the component's script: a title only the browser sets. Assigning it on the
 * server throws, so it runs from `$effect`/`onMount` or behind a guard, and counts like a component
 * mounted with `import()`: on routes that are never server-rendered. A script that also reads
 * `document.title` rewrites a title something else set, and provides none.
 */
function documentTitle(ast: AST.Root): ParsedTag[] {
  let refs = 0;
  let sets = 0;
  for (const script of [ast.module, ast.instance]) {
    if (!script) continue;
    walkEstree(script.content, (n) => {
      if (n.type === 'AssignmentExpression' && n.operator === '=' && isDocumentTitle(unwrapTs(n.left))) sets++;
      else if (isDocumentTitle(n)) refs++;
    });
  }
  return sets > 0 && refs === sets ? [{ kind: 'title', value: 'dynamic', clientOnly: true }] : [];
}

function isDocumentTitle(n: Parameters<Parameters<typeof walkEstree>[1]>[0]): boolean {
  return (
    n?.type === 'MemberExpression' &&
    !n.computed &&
    n.object.type === 'Identifier' &&
    n.object.name === 'document' &&
    n.property.type === 'Identifier' &&
    n.property.name === 'title'
  );
}

/**
 * JSON-LD the markup renders outside `<svelte:head>`: search engines read it in `<body>` too. Only a
 * top-level `{@html}` can sit outside a block or element there (a top-level `<script>` is the component's
 * own), and nothing nested makes a literal claim, like `conditionalTags`.
 */
function bodyJsonLd(fragment: AST.Fragment, source: string, jsonLdNames: ReadonlySet<string>): ParsedTag[] {
  const tags: ParsedTag[] = [];
  // A snippet renders where `{@render}` or the component it is passed to places it, never where it is defined.
  const rendered = new Set<string>();
  const findRenders = (node: WalkNode | WalkNode[] | null | undefined): void => {
    if (Array.isArray(node)) return node.forEach(findRenders);
    if (!node || typeof node !== 'object') return;
    if (node.type === 'RenderTag') {
      const name = renderCallee(node);
      if (name) rendered.add(name);
    }
    for (const key of CHILD_NODE_KEYS) if (key in node) findRenders(childOf(node, key));
  };
  findRenders(fragment);
  const visit = (node: WalkNode | WalkNode[] | null | undefined, nested: boolean, names: ReadonlySet<string>): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child, nested, names);
      return;
    }
    if (!node || typeof node !== 'object' || node.type === 'SvelteHead') return;
    if (node.type === 'SnippetBlock' && !rendered.has(node.expression.name)) return;
    if (node.type === 'Component' || node.type === 'SvelteComponent') {
      // A snippet in a component's tag is a prop the component renders.
      for (const child of node.fragment.nodes) visit(child.type === 'SnippetBlock' ? child.body : child, true, names);
      return;
    }
    if (
      node.type === 'HtmlTag' ||
      node.type === 'SvelteElement' ||
      (node.type === 'RegularElement' && node.name === 'script')
    ) {
      for (const tag of tagsFromNodes([node], source, undefined, names)) {
        if (tag.kind !== 'jsonld') continue;
        tags.push(nested ? { kind: 'jsonld', value: 'dynamic' } : tag);
      }
      if (node.type !== 'SvelteElement') return;
    }
    const inner = node.type === 'EachBlock' ? eachItemJsonLd(node, source, names) : names;
    for (const key of CHILD_NODE_KEYS)
      if (key in node) visit(childOf(node, key), nested || node.type !== 'Fragment', inner);
  };
  visit(fragment.nodes as WalkNode[], false, jsonLdNames);
  return tags;
}

function tagsFromHead(head: AST.SvelteHead, source: string, jsonLdNames: ReadonlySet<string>): ParsedTag[] {
  return tagsFromNodes(head.fragment.nodes, source, undefined, jsonLdNames);
}

export interface ComponentUse {
  name: string;
  attributes: AST.Component['attributes'];
  hasSpread: boolean;
  /** Inside an `{#if}`/`{#each}`/`{#await}` arm: whether it renders at all is runtime state. */
  conditional?: true;
  /** Inside `<svelte:head>`: its markup renders into the head. */
  inHead?: true;
  /** The `{#if}`/`{#await}`/`<svelte:boundary>` arms of its file it sits in, numbered as the file's heading paths. */
  path: BranchStep[];
  /** Snippet prop name (`children` for loose content) → the id of the `HOLE` step content passed in it sits below. */
  holes?: ReadonlyMap<string, number>;
  /** Where it sits in the file's document order: its tag's offset, or the `{@render}` of the snippet holding it. */
  offset: number;
}

/** The name a component tag renders: `<svelte:component this={X}>` renders whatever `X` holds, like `<X>`. */
function componentName(node: AST.Component | AST.SvelteComponent | AST.SvelteSelf): string {
  if (node.type !== 'SvelteComponent') return node.name;
  const e = node.expression;
  if (e.type === 'Identifier') return e.name;
  if (
    e.type === 'MemberExpression' &&
    !e.computed &&
    e.object.type === 'Identifier' &&
    e.property.type === 'Identifier'
  )
    return `${e.object.name}.${e.property.name}`;
  return node.name;
}

function collectComponents(
  node: WalkNode | WalkNode[] | null | undefined,
  acc: ComponentUse[],
  heading: Pick<ReturnType<typeof collectHeadings>, 'componentPaths' | 'componentOffsets' | 'holes'>,
  at: Pick<ComponentUse, 'conditional' | 'inHead'> = {}
): void {
  if (Array.isArray(node)) {
    for (const child of node) collectComponents(child, acc, heading, at);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'Component' || node.type === 'SvelteComponent') {
    const attributes = node.attributes;
    const holes = heading.holes.get(node);
    acc.push({
      name: componentName(node),
      attributes,
      hasSpread: attributes.some((a) => a.type === 'SpreadAttribute'),
      path: heading.componentPaths.get(node) ?? [],
      ...(holes ? { holes } : {}),
      offset: heading.componentOffsets.get(node) ?? node.start,
      ...at
    });
  }
  const inner =
    node.type === 'IfBlock' || node.type === 'EachBlock' || node.type === 'AwaitBlock'
      ? { ...at, conditional: true as const }
      : node.type === 'SvelteHead'
        ? { ...at, inHead: true as const }
        : at;
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectComponents(childOf(node, key), acc, heading, inner);
  }
}

/** A component use's literal props by name. A spread may override any of them, so it leaves none. */
export type PropArgs = ReadonlyMap<string, AST.Text[]>;

function literalArgs(attributes: AST.Component['attributes']): PropArgs {
  const args = new Map<string, AST.Text[]>();
  if (attributes.some((a) => a.type === 'SpreadAttribute')) return args;
  for (const a of attributes) {
    if (a.type === 'Attribute' && Array.isArray(a.value) && a.value.every((n) => n.type === 'Text'))
      args.set(a.name, a.value as AST.Text[]);
  }
  return args;
}

/**
 * An `{#if}` whose test one prop decides (`{#if prop}`, `{#if !prop}`, `{#if prop === 'x'}`): its
 * first arm renders exactly when this holds for the value the component receives.
 */
export interface PropGate {
  prop: string;
  /** `{#if prop}`, `prop === x`, `typeof prop === 't'`, `prop.length > n` (and the negations). */
  kind: 'truthy' | 'equals' | 'typeof' | 'length';
  operand?: string | number | boolean | null;
  op?: string;
  negate: boolean;
}

/** A prop default: its literal value, or `'unknown'` for any other expression. */
type PropDefault = { value: string | number | boolean | null } | 'unknown';

// A `Literal` node's value when it is one a gate can compare (not a regex or bigint).
function literalValue(node: { type: string; value?: unknown; regex?: unknown }): PropDefault {
  const v = node.value;
  return node.type === 'Literal' && !node.regex && (v === null || ['string', 'number', 'boolean'].includes(typeof v))
    ? { value: v as string | number | boolean | null }
    : 'unknown';
}

/** The identifiers a target writes, through destructuring (`({ a, b: [c] } = x)`) too. */
function patternNames(node: unknown, out: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  const n = node as {
    type: string;
    name?: string;
    properties?: unknown[];
    elements?: unknown[];
    left?: unknown;
    argument?: unknown;
    value?: unknown;
  };
  if (n.type === 'Identifier' && n.name) out.add(n.name);
  else if (n.type === 'ObjectPattern') for (const p of n.properties ?? []) patternNames(p, out);
  else if (n.type === 'Property') patternNames(n.value, out);
  else if (n.type === 'ArrayPattern') for (const e of n.elements ?? []) patternNames(e, out);
  else if (n.type === 'AssignmentPattern') patternNames(n.left, out);
  else if (n.type === 'RestElement') patternNames(n.argument, out);
}

/** Every identifier the component assigns, updates or binds: a prop it may change is never decided from outside. */
function reassignedLocals(ast: AST.Root): Set<string> {
  const out = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const n = node as {
      type?: string;
      left?: { type: string; name?: string };
      argument?: { type: string; name?: string };
      expression?: { type: string; name?: string };
    };
    const target =
      n.type === 'AssignmentExpression'
        ? n.left
        : n.type === 'UpdateExpression'
          ? n.argument
          : n.type === 'BindDirective'
            ? n.expression
            : undefined;
    if (target) patternNames(target, out);
    for (const [key, value] of Object.entries(node))
      if (key !== 'parent' && value && typeof value === 'object') visit(value);
  };
  visit(ast.instance?.content);
  visit(ast.fragment);
  return out;
}

/** The gate an `{#if}` test is, when a single prop the component never changes decides it. */
function propGate(
  test: AST.IfBlock['test'],
  props: ReadonlyMap<string, string>,
  reassigned: ReadonlySet<string>
): PropGate | undefined {
  const propOf = (n: { type: string; name?: string }) =>
    n.type === 'Identifier' && n.name && !reassigned.has(n.name) ? props.get(n.name) : undefined;
  if (test.type === 'Identifier') {
    const prop = propOf(test);
    return prop === undefined ? undefined : { prop, kind: 'truthy', negate: false };
  }
  if (test.type === 'UnaryExpression' && test.operator === '!') {
    const prop = propOf(test.argument);
    return prop === undefined ? undefined : { prop, kind: 'truthy', negate: true };
  }
  if (test.type !== 'BinaryExpression' || test.left.type === 'PrivateIdentifier') return undefined;
  const [side, lit] = test.left.type === 'Literal' ? [test.right, test.left] : [test.left, test.right];
  const value = literalValue(lit);
  if (value === 'unknown') return undefined;
  const strict = test.operator === '===' || test.operator === '!==';
  // `typeof prop === 'string'`
  if (strict && side.type === 'UnaryExpression' && side.operator === 'typeof' && typeof value.value === 'string') {
    const prop = propOf(side.argument);
    return prop === undefined
      ? undefined
      : { prop, kind: 'typeof', operand: value.value, negate: test.operator === '!==' };
  }
  // `prop.length > 0`, with the literal on the right.
  if (
    side === test.left &&
    side.type === 'MemberExpression' &&
    !side.computed &&
    side.property.type === 'Identifier' &&
    side.property.name === 'length' &&
    typeof value.value === 'number' &&
    ['>', '>=', '<', '<=', '===', '!=='].includes(test.operator)
  ) {
    const prop = propOf(side.object);
    return prop === undefined
      ? undefined
      : { prop, kind: 'length', op: test.operator, operand: value.value, negate: false };
  }
  if (strict) {
    const prop = propOf(side);
    return prop === undefined
      ? undefined
      : { prop, kind: 'equals', operand: value.value, negate: test.operator === '!==' };
  }
  return undefined;
}

/**
 * For each gated `{#if}` of `parsed` a use decides: `true` when only its first arm renders, `false`
 * when its first arm never does. A prop the use passes literally, a boolean shorthand, or the
 * default (undefined without one) decides it; an expression, a spread or `bind:` does not.
 */
export function decidedArms(parsed: ParsedFile, attributes: AST.Component['attributes']): Map<number, boolean> {
  const out = new Map<number, boolean>();
  if (parsed.headingGates.size === 0 || attributes.some((a) => a.type === 'SpreadAttribute')) return out;
  for (const [group, gate] of parsed.headingGates) {
    const passed = attributes.filter(
      (a) => (a.type === 'Attribute' || a.type === 'BindDirective') && a.name === gate.prop
    );
    if (passed.length > 1 || passed[0]?.type === 'BindDirective') continue;
    const attr = passed[0] as AST.Attribute | undefined;
    // What the prop holds: its literal value, or just its type for an object or template literal.
    let held: { value: unknown } | { type: string } | 'unknown';
    if (!attr) {
      // An absent prop is its default, or `undefined` without one.
      const d = parsed.propDefaults.get(gate.prop);
      held = d === undefined ? { value: undefined } : d;
    } else if (attr.value === true) held = { value: true };
    else if (Array.isArray(attr.value) && attr.value.every((n) => n.type === 'Text'))
      held = { value: attr.value.map((n) => (n as AST.Text).data).join('') };
    else {
      const tag = Array.isArray(attr.value) ? (attr.value.length === 1 ? attr.value[0] : undefined) : attr.value;
      const expr = tag?.type === 'ExpressionTag' ? tag.expression : undefined;
      if (expr?.type === 'ObjectExpression' || expr?.type === 'ArrayExpression') held = { type: 'object' };
      else if (expr?.type === 'TemplateLiteral') held = { type: 'string' };
      else held = expr ? literalValue(expr) : 'unknown';
    }
    if (held === 'unknown') continue;
    const type = 'type' in held ? held.type : held.value === null ? 'object' : typeof held.value;
    let holds: boolean;
    if (gate.kind === 'typeof') holds = type === gate.operand;
    else if (!('value' in held)) {
      // An object is truthy and equals no literal; a template literal may be empty, so only its type is known.
      if (gate.kind === 'length' || type !== 'object') continue;
      holds = gate.kind === 'truthy';
    } else if (gate.kind === 'truthy') holds = Boolean(held.value);
    else if (gate.kind === 'equals') holds = held.value === gate.operand;
    else {
      if (typeof held.value !== 'string') continue;
      const n = held.value.length;
      const m = gate.operand as number;
      holds = { '>': n > m, '>=': n >= m, '<': n < m, '<=': n <= m, '===': n === m, '!==': n !== m }[gate.op!]!;
    }
    out.set(group, holds !== gate.negate);
  }
  return out;
}

/**
 * Local name → prop name for `let { a, b: local = x } = $props()` and legacy `export let a`.
 * Nested patterns and computed keys are skipped: such a local simply stays unbound (dynamic).
 */
function collectProps(ast: AST.Root): Map<string, string> {
  const props = new Map<string, string>();
  for (const stmt of ast.instance?.content.body ?? []) {
    const exported = stmt.type === 'ExportNamedDeclaration';
    const decl = exported ? stmt.declaration : stmt;
    if (decl?.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations) {
      if (exported && decl.kind !== 'const' && d.id.type === 'Identifier') props.set(d.id.name, d.id.name);
      const init = d.init;
      const isProps =
        init?.type === 'CallExpression' && init.callee.type === 'Identifier' && init.callee.name === '$props';
      if (!isProps || d.id.type !== 'ObjectPattern') continue;
      for (const p of d.id.properties) {
        if (p.type !== 'Property' || p.computed) continue;
        const key =
          p.key.type === 'Identifier' ? p.key.name : p.key.type === 'Literal' ? String(p.key.value) : undefined;
        const local = p.value.type === 'AssignmentPattern' ? p.value.left : p.value;
        if (key !== undefined && local.type === 'Identifier') props.set(local.name, key);
      }
    }
  }
  return props;
}

/** Prop name → its default for `let { a = 'x' } = $props()` and `export let a = 'x'`. */
function collectPropDefaults(ast: AST.Root): Map<string, PropDefault> {
  const defaults = new Map<string, PropDefault>();
  for (const stmt of ast.instance?.content.body ?? []) {
    const exported = stmt.type === 'ExportNamedDeclaration';
    const decl = exported ? stmt.declaration : stmt;
    if (decl?.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations) {
      if (exported && decl.kind !== 'const' && d.id.type === 'Identifier' && d.init)
        defaults.set(d.id.name, literalValue(d.init));
      const init = d.init;
      if (init?.type !== 'CallExpression' || init.callee.type !== 'Identifier' || init.callee.name !== '$props')
        continue;
      if (d.id.type !== 'ObjectPattern') continue;
      for (const p of d.id.properties) {
        if (p.type !== 'Property' || p.computed || p.value.type !== 'AssignmentPattern') continue;
        const key =
          p.key.type === 'Identifier' ? p.key.name : p.key.type === 'Literal' ? String(p.key.value) : undefined;
        if (key !== undefined) defaults.set(key, literalValue(p.value.right));
      }
    }
  }
  return defaults;
}

/** `attr={local}`, `attr="{local}"` and `{local}` where `local` is a prop the call site passes literally take that literal. */
function bindProps(props: ReadonlyMap<string, string>, args: PropArgs): Bind {
  return (attributes) =>
    attributes.map((attr) => {
      if (attr.type !== 'Attribute') return attr;
      const v = attr.value;
      const tag = Array.isArray(v) ? (v.length === 1 ? v[0] : undefined) : v === true ? undefined : v;
      if (tag?.type !== 'ExpressionTag' || tag.expression.type !== 'Identifier') return attr;
      const prop = props.get(tag.expression.name);
      const literal = prop === undefined ? undefined : args.get(prop);
      return literal ? { ...attr, value: literal } : attr;
    });
}

// Re-parsed on demand rather than kept on every ParsedFile: the dev dashboard's ParseCache lives
// as long as the server, and few components are ever rendered inside <svelte:head>.
const headRendered = new WeakMap<ParsedFile, AST.Fragment>();

/**
 * The tags `parsed`'s markup yields when a parent renders it inside `<svelte:head>` (its own
 * `<svelte:head>` is already in `headTags`), with its props bound to the call site's `args`.
 */
export function tagsInHead(parsed: ParsedFile, args: PropArgs): ParsedTag[] {
  const { source, filename, props } = parsed.template;
  let fragment = headRendered.get(parsed);
  if (!fragment) {
    fragment = parseSvelte(source, filename).fragment;
    headRendered.set(parsed, fragment);
  }
  // Its JSON-LD is already in `headTags`, which reads JSON-LD wherever the markup renders it.
  return tagsFromNodes(fragment.nodes, source, bindProps(props, args), parsed.template.jsonLdNames).filter(
    (t) => t.kind !== 'jsonld'
  );
}

/** The literal props `use` passes, after `parsed`'s own props are bound to the args it was called with. */
export function argsOf(parsed: ParsedFile, use: ComponentUse, args: PropArgs): PropArgs {
  return literalArgs(bindProps(parsed.template.props, args)(use.attributes));
}

interface ParsedImage {
  hasWidth: boolean;
  hasHeight: boolean;
  hasLoading: boolean;
  hasAlt: boolean;
  lazy: boolean;
  hasSrcset: boolean;
  svg?: boolean;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** A page-body heading (<h1>–<h6>) parsed from one file (seo/single-h1). */
interface ParsedHeading {
  /** Heading level 1–6. */
  level: number;
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /** The `{#if}`/`{#await}` arms it sits in, `HOLE` steps included; absent when unconditional. */
  path?: BranchStep[];
  /** Its place in the file's document order (`HeadingInfo.order`). */
  order: number[];
  /** An ARIA heading (`HeadingInfo.aria`). */
  aria?: true;
}

/**
 * Whether an <img> src is known to be an SVG. A mixed value's trailing literal carries the
 * extension (`src="{base}/rss.svg"`), `src={'/rss.svg'}` is a literal, and `src={logo}` resolves through a
 * `*.svg` import.
 */
function isSvgImage(attrs: AST.Attribute[], imports: ImportMap): boolean {
  const raw = findAttr(attrs, 'src')?.value;
  // A quoted lone expression (`src="{logo}"`) is the same value as `src={logo}`.
  const value = Array.isArray(raw) && raw.length === 1 && raw[0]!.type === 'ExpressionTag' ? raw[0] : raw;
  if (Array.isArray(value)) {
    const last = value.at(-1);
    return last?.type === 'Text' && isSvgSrc(last.data);
  }
  if (value && value !== true && value.expression.type === 'Literal') {
    return typeof value.expression.value === 'string' && isSvgSrc(value.expression.value);
  }
  if (value && value !== true && value.expression.type === 'Identifier') {
    const from = imports.get(value.expression.name)?.source;
    return from !== undefined && isSvgSrc(from);
  }
  return false;
}

/** Each name's first `{#snippet}` definition, and every name some `{@render name(…)}` calls. */
function indexSnippets(
  node: WalkNode | WalkNode[] | null | undefined,
  acc: { snippets: Map<string, AST.SnippetBlock>; rendered: Set<string> }
): void {
  if (Array.isArray(node)) {
    for (const child of node) indexSnippets(child, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'SnippetBlock' && !acc.snippets.has(node.expression.name))
    acc.snippets.set(node.expression.name, node);
  if (node.type === 'RenderTag') {
    const name = renderCallee(node);
    if (name) acc.rendered.add(name);
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) indexSnippets(childOf(node, key), acc);
  }
}

/**
 * `<img>` elements in render order (performance/lcp-image reads the first): a snippet's images
 * sit at its first in-file `{@render}`, not at its definition. A snippet this file never renders
 * (passed to a component) keeps its definition position, since where it renders is unknown.
 */
function collectImages(
  fragment: AST.Fragment,
  source: string,
  imports: ImportMap
): Pick<ParsedFile, 'images' | 'imagesBeforeChildren'> {
  const acc: ParsedImage[] = [];
  // Where each `{@render children()}` (or `<slot />`) sits among the images; a layout that renders its
  // children in more than one place keeps its images first, as no one position holds for every arm.
  const childrenAt: number[] = [];
  const childrenIn = new Map<AST.SnippetBlock, number>();
  const index = { snippets: new Map<string, AST.SnippetBlock>(), rendered: new Set<string>() };
  indexSnippets(fragment, index);
  const emitted = new Set<AST.SnippetBlock>();
  // The nearest open `<picture>`: its `<source>`s precede its `<img>` (HTML content model), so
  // whether one carries a srcset is known by the time the walk reaches the `<img>`.
  type Picture = { srcset: boolean } | undefined;
  const walk = (node: WalkNode | WalkNode[] | null | undefined, picture?: Picture): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, picture);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node.type === 'SnippetBlock') {
      const name = node.expression.name;
      if (index.snippets.get(name) === node && index.rendered.has(name)) return;
      emitted.add(node);
    }
    const slot =
      node.type === 'SlotElement' && !node.attributes.some((a) => a.type === 'Attribute' && a.name === 'name');
    if (slot || (node.type === 'RenderTag' && renderCallee(node) === 'children')) childrenAt.push(acc.length);
    if (node.type === 'RenderTag') {
      const snippet = index.snippets.get(renderCallee(node) ?? '');
      if (snippet && !emitted.has(snippet)) {
        emitted.add(snippet);
        const before = childrenAt.length;
        walk(snippet.body, picture);
        childrenIn.set(snippet, childrenAt.length - before);
      } else if (snippet) {
        // Its images are already placed, but each render places the children it renders again.
        for (let i = childrenIn.get(snippet) ?? 0; i > 0; i--) childrenAt.push(acc.length);
      }
      return;
    }
    if (node.type === 'RegularElement' && node.name === 'picture') picture = { srcset: false };
    if (node.type === 'RegularElement' && node.name === 'source' && picture) {
      picture.srcset ||= node.attributes.some(
        (a) => a.type === 'SpreadAttribute' || (a.type === 'Attribute' && a.name === 'srcset')
      );
    }
    if (node.type === 'RegularElement' && node.name === 'img') {
      // The core attr helpers only ever match `Attribute`-typed entries; SpreadAttribute/Directive/AttachTag
      // are filtered out internally, so this widening cast is safe.
      const attrs = node.attributes as AST.Attribute[];
      const hasSpread = node.attributes.some((a) => a.type === 'SpreadAttribute');
      acc.push({
        hasWidth: hasSpread || Boolean(findAttr(attrs, 'width')),
        hasHeight: hasSpread || Boolean(findAttr(attrs, 'height')),
        hasLoading: hasSpread || Boolean(findAttr(attrs, 'loading')),
        hasAlt: hasSpread || Boolean(findAttr(attrs, 'alt')),
        // A literal loading="lazy" only — a spread or dynamic loading={…} must not be flagged.
        lazy: attrText(attrs, 'loading') === 'lazy',
        hasSrcset: hasSpread || Boolean(findAttr(attrs, 'srcset')) || picture?.srcset === true,
        ...(isSvgImage(attrs, imports) ? { svg: true } : {}),
        line: lineOf(source, node.start)
      });
    }
    for (const key of CHILD_NODE_KEYS) {
      if (key in node) walk(childOf(node, key), picture);
    }
  };
  walk(fragment);
  // A snippet whose only {@render} sits somewhere never walked (inside itself) is still collected.
  for (const snippet of index.snippets.values()) if (!emitted.has(snippet)) walk(snippet.body);
  return { images: acc, ...(childrenAt.length === 1 ? { imagesBeforeChildren: childrenAt[0] } : {}) };
}

/**
 * The tag names a `<svelte:element this={…}>` can render as, or undefined when the expression
 * is not statically determinable. A string literal gives one name; a conditional whose branches
 * are both literals gives both, so the common `this={cond ? 'h1' : 'span'}` reads as the set it
 * really is rather than as an unknown.
 */
function svelteElementTags(tag: AST.SvelteElement['tag']): string[] | undefined {
  if (tag.type === 'Literal') return typeof tag.value === 'string' ? [tag.value] : undefined;
  if (tag.type === 'ConditionalExpression') {
    const branches = [tag.consequent, tag.alternate].map((b) =>
      b.type === 'Literal' && typeof b.value === 'string' ? b.value : undefined
    );
    // Deduped: `cond ? 'main' : 'main'` is one definite tag, and callers that need exactly one
    // (landmark resolution in `walkElement`) would otherwise read it as two possibilities.
    return branches.every((b) => b !== undefined) ? [...new Set(branches as string[])] : undefined;
  }
  return undefined;
}

const HEADING_TAG = /^h[1-6]$/;

/** The one heading level a resolved tag set renders as, or undefined (no heading, or two levels). */
function headingLevelOf(tags: string[]): number | undefined {
  const levels = new Set(
    tags
      .map((t) => t.toLowerCase())
      .filter((t) => HEADING_TAG.test(t))
      .map((t) => Number(t[1]))
  );
  return levels.size === 1 ? [...levels][0] : undefined;
}

/** Longest shared leading run of two branch paths. */
export function commonPrefix(a: BranchStep[], b: BranchStep[]): BranchStep[] {
  let i = 0;
  while (i < a.length && i < b.length && a[i]!.group === b[i]!.group && a[i]!.branch === b[i]!.branch) i++;
  return a.slice(0, i);
}

/** `<svelte:boundary>` arms: its `failed`/`pending` snippets replace the children, never render beside them. */
const BOUNDARY_SNIPPET_ARMS = new Map([
  ['failed', 1],
  ['pending', 2]
]);

/**
 * The `branch` of a placeholder step standing where content passed to a component renders inside
 * it; its `group` is the placeholder's id. `resolveFileTags` replaces it with the component's own
 * path to that `{@render}` once the component is resolved, and drops it otherwise.
 */
export const HOLE = -1;

/**
 * Collect page-body headings (<h1>–<h6>) anywhere in the template (seo/single-h1), each with
 * the `{#if}`/`{#await}`/`<svelte:boundary>` arms it sits in so exclusive arms are not counted
 * together; component tags get the same address (`componentPaths`). A snippet this file renders
 * is read at each `{@render}` of it; content passed to a component (its loose children, or a
 * `{#snippet}` in its tag) sits below a `HOLE` step (`holes`). `renderPaths` is where each
 * snippet prop renders (`children` also for `<slot />`), the common prefix when it renders in
 * several places. `groups` is how many group numbers the file uses.
 * `dynamic` records a `<svelte:element>` that may render a heading but whose level is not
 * statically determinable — a route carrying one cannot be reported as having no <h1>.
 */
/**
 * The request-path test each `{@render children()}` / `<slot />` renders under, keyed by the tag's
 * offset: the conjunction of its `{#if}` arms, read through `$derived` bindings of the instance script.
 * `page.url.pathname` (`$page` too), optionally through a de-localizing call or `|| '/'`, is the path;
 * `startsWith`/`endsWith`/`includes`/`===` against a string literal are the tests it reads.
 */
function childrenUrlConds(ast: AST.Root, source: string): Map<number, UrlCond> {
  const out = new Map<number, UrlCond>();
  if (!source.includes('pathname')) return out;
  type Expr = AST.IfBlock['test'];
  const derived = new Map<string, Expr>();
  for (const stmt of ast.instance?.content.body ?? []) {
    if (stmt.type !== 'VariableDeclaration') continue;
    for (const d of stmt.declarations) {
      const init = d.init;
      if (d.id.type === 'Identifier' && init?.type === 'CallExpression' && init.callee.type === 'Identifier')
        if (init.callee.name === '$derived' && init.arguments.length === 1)
          derived.set(d.id.name, init.arguments[0] as Expr);
    }
  }
  const strip = (n: Expr): Expr => {
    let cur = n as Expr & { expression?: Expr };
    while (cur && (cur.type as string).startsWith('TS') && cur.expression) cur = cur.expression as typeof cur;
    return cur;
  };
  const text = (n: Expr) => {
    const { start, end } = n as Expr & { start: number; end: number };
    return source.slice(start, end).replace(/\s+/g, '');
  };
  const literal = (n: Expr) => (n.type === 'Literal' && typeof n.value === 'string' ? n.value : undefined);
  const isPath = (raw: Expr, depth = 0): boolean => {
    const n = strip(raw);
    if (n.type === 'MemberExpression') return /^\$?page\.url\.pathname$/.test(text(n));
    if (n.type === 'Identifier') return depth < 4 && derived.has(n.name) && isPath(derived.get(n.name)!, depth + 1);
    if (n.type === 'LogicalExpression' && n.operator !== '&&') return isPath(n.left, depth) && literal(n.right) === '/';
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && /locali[sz]e/i.test(n.callee.name))
      return n.arguments.length === 1 && isPath(n.arguments[0] as Expr, depth);
    return false;
  };
  const cond = (raw: Expr, depth = 0): UrlCond => {
    const n = strip(raw);
    if (n.type === 'Identifier' && depth < 4 && derived.has(n.name)) return cond(derived.get(n.name)!, depth + 1);
    if (n.type === 'Literal' && typeof n.value === 'boolean') return { k: n.value };
    if (n.type === 'UnaryExpression' && n.operator === '!') return { not: cond(n.argument, depth) };
    if (n.type === 'LogicalExpression' && n.operator !== '??')
      return n.operator === '&&'
        ? { and: [cond(n.left, depth), cond(n.right, depth)] }
        : { or: [cond(n.left, depth), cond(n.right, depth)] };
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed) {
      const name = n.callee.property.type === 'Identifier' ? n.callee.property.name : '';
      const op = ({ startsWith: 'starts', endsWith: 'ends', includes: 'includes' } as const)[name as 'includes'];
      const v = n.arguments.length === 1 ? literal(n.arguments[0] as Expr) : undefined;
      if (op && v !== undefined && isPath(n.callee.object as Expr, depth)) return { op, v };
    }
    if (n.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(n.operator)) {
      const [side, lit] = literal(n.right as Expr) !== undefined ? [n.left, n.right] : [n.right, n.left];
      const v = literal(lit as Expr);
      if (v !== undefined && isPath(side as Expr, depth)) {
        const eq: UrlCond = { op: 'eq', v };
        return n.operator.startsWith('!') ? { not: eq } : eq;
      }
    }
    return { u: true };
  };
  const walk = (node: WalkNode | WalkNode[] | null | undefined, stack: UrlCond[]): void => {
    if (Array.isArray(node)) return node.forEach((child) => walk(child, stack));
    if (!node) return;
    if (node.type === 'IfBlock') {
      const tests = ifTests(node).map((t) => cond(t));
      ifArms(node).forEach((arm, i) =>
        walk(arm, [...stack, ...tests.slice(0, i).map((t): UrlCond => ({ not: t })), ...(tests[i] ? [tests[i]!] : [])])
      );
      return;
    }
    const isChildren =
      (node.type === 'RenderTag' && renderCallee(node) === 'children') ||
      (node.type === 'SlotElement' && !node.attributes.some((a) => a.type === 'Attribute' && a.name === 'name'));
    if (isChildren && stack.length > 0) out.set(node.start, { and: stack });
    for (const key of CHILD_NODE_KEYS) if (key in node) walk(childOf(node, key), stack);
  };
  walk(ast.fragment, []);
  return out;
}

const isAriaHeading = (node: AST.RegularElement) =>
  attrText(
    node.attributes.filter((a): a is AST.Attribute => a.type === 'Attribute'),
    'role'
  )
    ?.trim()
    .toLowerCase() === 'heading';

function collectHeadings(
  fragment: AST.Fragment,
  source: string,
  props: ReadonlyMap<string, string>,
  reassigned: ReadonlySet<string> = new Set(),
  urls: ReadonlyMap<number, UrlCond> = new Map()
) {
  const headings: ParsedHeading[] = [];
  const gates = new Map<number, PropGate>();
  const componentPaths = new Map<WalkNode, BranchStep[]>();
  const componentOffsets = new Map<WalkNode, number>();
  const renderPaths = new Map<string, BranchStep[]>();
  const renderOffsets = new Map<string, number>();
  const holes = new Map<WalkNode, Map<string, number>>();
  const index = { snippets: new Map<string, AST.SnippetBlock>(), rendered: new Set<string>() };
  indexSnippets(fragment, index);
  const local = (name: string | undefined): AST.SnippetBlock | undefined =>
    name !== undefined && index.rendered.has(name) ? index.snippets.get(name) : undefined;
  const reached = new Set<AST.SnippetBlock>();
  let dynamic = false;
  let groups = 0;
  let holeIds = 0;
  // `{#if}` groups with an `{:else}`: how many arms, for marking those where every arm renders a heading.
  const fullArms = new Map<number, number>();
  // `at` is the `{@render}` a snippet body is read from: its content sits there in document order.
  const push = (
    level: number,
    node: WalkNode & { start: number },
    path: BranchStep[],
    at: number | undefined,
    when: Cond[] | null,
    aria?: true
  ): void => {
    const order = at === undefined ? [node.start] : [at, node.start];
    const heading = {
      level,
      line: lineOf(source, node.start),
      ...(path.length > 0 ? { path } : {}),
      order,
      ...(aria ? { aria } : {})
    };
    headings.push(heading);
    if (when) headingWhen.set(heading, when);
  };
  const first = <K>(map: Map<K, number>, key: K, offset: number): void => {
    if (!map.has(key)) map.set(key, offset);
  };
  // Each distinct place the children render, which `renderPaths` meets into one.
  const childrenSites: ChildrenSite[] = [];
  const site = (path: BranchStep[], offset: number, start: number): void => {
    const url = urls.get(start);
    if (!childrenSites.some(({ path: p }) => p.length === path.length && p.every((s, i) => sameStep(s, path[i]!))))
      childrenSites.push({ path, offset, ...(url ? { url } : {}) });
  };
  const meet = <K>(map: Map<K, BranchStep[]>, key: K, path: BranchStep[]): void => {
    const prev = map.get(key);
    map.set(key, prev ? commonPrefix(prev, path) : path);
  };
  const holeOf = (node: WalkNode, name: string): BranchStep => {
    let named = holes.get(node);
    if (!named) holes.set(node, (named = new Map()));
    let id = named.get(name);
    if (id === undefined) named.set(name, (id = holeIds++));
    return { group: id, branch: HOLE };
  };
  const shared = new Map<WalkNode, BranchStep>();
  // The `{#if}` arm conditions each heading, component and snippet render sits under (`null` inside an
  // `{#each}`, a snippet with parameters or an `{:then}`, where one test is read against several values).
  const headingWhen = new Map<ParsedHeading, Cond[]>();
  // How many arms each block walks: only a place below one-arm blocks alone may join a new block,
  // since moving any other place away from its arms would unfold them.
  const armCount = new Map<number, number>();
  const opaque = { next: 0 };
  const componentWhen = new Map<WalkNode, Cond[] | null>();
  const renderWhen = new Map<string, Cond[] | null>();
  const note = <K>(map: Map<K, Cond[] | null>, key: K, when: Cond[] | null): void => {
    map.set(key, map.has(key) ? null : when);
  };
  const walk = (
    node: WalkNode | WalkNode[] | null | undefined,
    path: BranchStep[],
    open: AST.SnippetBlock[],
    at?: number,
    when: Cond[] | null = []
  ): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, path, open, at, when);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Fragment') {
      const eligible = (b: AST.IfBlock) => !shared.has(b) && !propGate(b.test, props, reassigned);
      for (const set of exclusiveIfs(node as AST.Fragment, source, eligible)) {
        const group = groups++;
        armCount.set(group, set.length);
        set.forEach((block, branch) => shared.set(block, { group, branch }));
      }
    }
    // Body headings only — a stray <h1> inside <svelte:head> is not a page heading.
    if (node.type === 'SvelteHead') return;
    // SVG content is never an HTML heading (an icon's `<svelte:element this={tag}>` draws a shape),
    // unless a <foreignObject> carries HTML back in.
    if (
      node.type === 'RegularElement' &&
      node.name === 'svg' &&
      !source.slice(node.start, node.end).includes('foreignObject')
    )
      return;
    if (node.type === 'SnippetBlock' && local(node.expression.name) === node) return;
    const sibling = node.type === 'IfBlock' ? shared.get(node) : undefined;
    if (sibling && node.type === 'IfBlock') {
      walk(node.consequent, [...path, sibling], open, at, when && [...when, condOf(node.test, source, opaque)]);
      return;
    }
    if (node.type === 'IfBlock' || node.type === 'AwaitBlock') {
      const group = groups++;
      const gate = node.type === 'IfBlock' ? propGate(node.test, props, reassigned) : undefined;
      if (gate) gates.set(group, gate);
      const arms = node.type === 'IfBlock' ? ifArms(node) : [node.pending, node.then, node.catch];
      if (node.type === 'IfBlock' && endsInElse(node)) fullArms.set(group, arms.length);
      armCount.set(group, arms.filter(Boolean).length);
      const tests = node.type === 'IfBlock' ? ifTests(node).map((t) => condOf(t, source, opaque)) : [];
      arms.forEach((arm, branch) => {
        const armWhen =
          node.type === 'AwaitBlock'
            ? branch === 0
              ? when
              : null
            : when && [
                ...when,
                ...tests.slice(0, branch).map((t): Cond => ({ not: t })),
                ...(tests[branch] ? [tests[branch]] : [])
              ];
        walk(arm, [...path, { group, branch }], open, at, armWhen);
      });
      return;
    }
    if (node.type === 'EachBlock') {
      // A list may be empty, so its body renders only sometimes: a block with one arm.
      const group = groups++;
      armCount.set(group, 1);
      walk(node.body, [...path, { group, branch: 0, repeat: true }], open, at, null);
      walk(node.fallback, path, open, at, when);
      return;
    }
    if (node.type === 'SvelteBoundary') {
      const group = groups++;
      armCount.set(group, 2);
      for (const child of node.fragment.nodes) {
        const branch = child.type === 'SnippetBlock' ? (BOUNDARY_SNIPPET_ARMS.get(child.expression.name) ?? 0) : 0;
        walk(child, [...path, { group, branch }], open, at, when);
      }
      return;
    }
    if (node.type === 'RenderTag') {
      const name = renderCallee(node);
      const snippet = local(name);
      if (snippet && !open.includes(snippet)) {
        reached.add(snippet);
        walk(snippet.body, path, [...open, snippet], at ?? node.start, snippet.parameters.length > 0 ? null : when);
      } else if (!snippet && name !== undefined) {
        if ((props.get(name) ?? name) === 'children') site(path, at ?? node.start, node.start);
        meet(renderPaths, props.get(name) ?? name, path);
        note(renderWhen, props.get(name) ?? name, when);
        first(renderOffsets, props.get(name) ?? name, at ?? node.start);
      }
      return;
    }
    if (node.type === 'SlotElement' && !node.attributes.some((a) => a.type === 'Attribute' && a.name === 'name')) {
      site(path, at ?? node.start, node.start);
      meet(renderPaths, 'children', path);
      note(renderWhen, 'children', when);
      first(renderOffsets, 'children', at ?? node.start);
    }
    if (node.type === 'Component' || node.type === 'SvelteComponent') {
      meet(componentPaths, node, path);
      note(componentWhen, node, when);
      first(componentOffsets, node, at ?? node.start);
      for (const child of node.fragment.nodes) {
        const name = child.type === 'SnippetBlock' ? child.expression.name : 'children';
        const scoped = child.type === 'SnippetBlock' && child.parameters.length > 0 ? null : when;
        walk(child, [...path, holeOf(node, name)], open, at, scoped);
      }
      return;
    }
    if (node.type === 'RegularElement' && HEADING_TAG.test(node.name)) {
      push(Number(node.name[1]), node, path, at, when);
    } else if (node.type === 'RegularElement' && isAriaHeading(node)) {
      // ARIA's default level is 2; a level the source does not fix holds its place without one.
      const attrs = node.attributes.filter((a): a is AST.Attribute => a.type === 'Attribute');
      const set = attrs.some((a) => a.name === 'aria-level');
      const level = Number(set ? attrText(attrs, 'aria-level') : 2);
      push(Number.isInteger(level) && level >= 1 && level <= 6 ? level : 0, node, path, at, when, true);
    } else if (node.type === 'SvelteElement') {
      const tags = svelteElementTags(node.tag);
      const level = tags ? headingLevelOf(tags) : undefined;
      if (level !== undefined) push(level, node, path, at, when);
      // An unresolvable tag may be a heading; two different heading levels is a heading whose
      // level is unknown. A resolved non-heading set (`cond ? 'span' : 'em'`) is neither.
      else if (!tags || tags.some((t) => HEADING_TAG.test(t.toLowerCase()))) {
        dynamic = true;
        push(0, node, path, at, when);
      }
    }
    for (const key of CHILD_NODE_KEYS) {
      if (key in node) walk(childOf(node, key), path, open, at, when);
    }
  };
  walk(fragment, [], []);
  // A snippet rendered only from inside itself is still read once.
  for (const snippet of index.snippets.values()) {
    if (local(snippet.expression.name) === snippet && !reached.has(snippet))
      walk(snippet.body, [], [snippet], undefined, null);
  }
  const exclusive = [
    ...headings.flatMap((h) => {
      const when = headingWhen.get(h);
      return when
        ? [{ when, path: h.path ?? [], set: (step: BranchStep) => (h.path = [step, ...(h.path ?? [])]) }]
        : [];
    }),
    ...[...componentWhen].flatMap(([node, when]) =>
      when
        ? [
            {
              when,
              path: componentPaths.get(node)!,
              set: (step: BranchStep) => componentPaths.set(node, [step, ...componentPaths.get(node)!])
            }
          ]
        : []
    ),
    ...[...renderWhen].flatMap(([name, when]) =>
      when
        ? [
            {
              when,
              path: renderPaths.get(name)!,
              set: (step: BranchStep) => renderPaths.set(name, [step, ...renderPaths.get(name)!])
            }
          ]
        : []
    )
  ];
  const oneArm = (p: Placed) => p.path.every((s) => s.branch === HOLE || armCount.get(s.group) === 1);
  for (const clique of contradictingArms(exclusive.filter(oneArm))) {
    const group = groups++;
    clique.forEach((members, branch) => members.forEach((m) => m.set({ group, branch })));
  }
  // A block whose every arm renders a heading directly (not below a further block) always renders one.
  const armsWithHeading = new Map<number, Set<number>>();
  for (const h of headings) {
    const last = h.path?.at(-1);
    if (last && fullArms.has(last.group))
      armsWithHeading.set(last.group, (armsWithHeading.get(last.group) ?? new Set()).add(last.branch));
  }
  const covered = new Set([...armsWithHeading].filter(([g, b]) => b.size === fullArms.get(g)).map(([g]) => g));
  if (covered.size > 0)
    for (const h of headings)
      if (h.path?.some((s) => covered.has(s.group)))
        h.path = h.path.map((s) => (covered.has(s.group) ? { ...s, always: true as const } : s));
  return {
    headings,
    dynamic,
    componentPaths,
    componentOffsets,
    renderPaths,
    childrenSites,
    renderOffsets,
    holes,
    groups,
    gates
  };
}

/** A test's truth as a formula over the file's references (`t`), their equality to a literal (`e`) and opaque parts (`o`). */
type Cond =
  | { t: string }
  | { e: string; v: string }
  | { o: number }
  | { k: boolean }
  | { not: Cond }
  | { and: Cond[] }
  | { or: Cond[] };

function condOf(test: AST.IfBlock['test'], source: string, opaque: { next: number }): Cond {
  type Expr = AST.IfBlock['test'];
  const reference = (n: Expr): boolean =>
    n.type === 'Identifier' || (n.type === 'MemberExpression' && !n.computed && reference(n.object as Expr));
  const text = (n: Expr) => {
    const { start, end } = n as Expr & { start: number; end: number };
    return source.slice(start, end).replace(/\s+/g, '');
  };
  const read = (n: Expr): Cond => {
    if (reference(n)) return { t: text(n) };
    if (n.type === 'Literal' && typeof n.value === 'boolean') return { k: n.value };
    if (n.type === 'UnaryExpression' && n.operator === '!') return { not: read(n.argument) };
    if (n.type === 'LogicalExpression' && n.operator !== '??')
      return n.operator === '&&' ? { and: [read(n.left), read(n.right)] } : { or: [read(n.left), read(n.right)] };
    if (
      n.type === 'BinaryExpression' &&
      ['===', '!==', '==', '!='].includes(n.operator) &&
      n.left.type !== 'PrivateIdentifier'
    ) {
      const [side, lit] = n.left.type === 'Literal' ? [n.right, n.left] : [n.left, n.right];
      const value = literalValue(lit);
      const strict = n.operator.length === 3;
      // As in `exclusiveIfs`: loose equality is exclusive only between numbers.
      if (value !== 'unknown' && reference(side) && (strict || typeof value.value === 'number')) {
        const eq: Cond = { e: `${typeof value.value}:${text(side)}`, v: JSON.stringify(value.value) };
        return n.operator.startsWith('!') ? { not: eq } : eq;
      }
    }
    return { o: opaque.next++ };
  };
  return read(test);
}

/** Whether no assignment makes every condition true: references are free, one reference equals at most one literal. */
function unsatisfiable(conds: Cond[]): boolean {
  const bools = new Set<string>();
  const equals = new Map<string, Set<string>>();
  const gather = (c: Cond): void => {
    if ('t' in c) bools.add(`t:${c.t}`);
    else if ('o' in c) bools.add(`o:${c.o}`);
    else if ('e' in c) equals.set(c.e, (equals.get(c.e) ?? new Set()).add(c.v));
    else if ('not' in c) gather(c.not);
    else if ('and' in c || 'or' in c) ('and' in c ? c.and : c.or).forEach(gather);
  };
  conds.forEach(gather);
  const names = [...bools];
  const subjects = [...equals].map(([key, values]) => [key, [...values, '']] as const);
  let combos = 2 ** names.length;
  for (const [, values] of subjects) combos *= values.length;
  // ponytail: exhaustive truth table; a condition set this large is read as satisfiable.
  if (combos > 4096) return false;
  for (let i = 0; i < combos; i++) {
    let rest = i;
    const bool = new Map(
      names.map((n) => {
        const v = rest % 2 === 1;
        rest = Math.floor(rest / 2);
        return [n, v] as const;
      })
    );
    const equal = new Map(
      subjects.map(([key, values]) => {
        const v = values[rest % values.length]!;
        rest = Math.floor(rest / values.length);
        return [key, v] as const;
      })
    );
    const holds = (c: Cond): boolean =>
      't' in c
        ? bool.get(`t:${c.t}`)!
        : 'o' in c
          ? bool.get(`o:${c.o}`)!
          : 'k' in c
            ? c.k
            : 'e' in c
              ? equal.get(c.e) === c.v
              : 'not' in c
                ? !holds(c.not)
                : 'and' in c
                  ? c.and.every(holds)
                  : c.or.some(holds);
    if (conds.every(holds)) return false;
  }
  return true;
}

type Placed = { when: Cond[]; path: BranchStep[]; set: (step: BranchStep) => void };

/**
 * Sets of places (headings, components, snippet renders) under `{#if}` arms of one file whose
 * conditions cannot all hold at once, though no block they share tells them apart: `{#if open}` and,
 * elsewhere in the file, `{#if !open}`, or `a || b` against `!a` and a nested `!b`. Places with the
 * same conditions sit together; each set gets one new block with an arm per member.
 */
function contradictingArms(places: Placed[]): Placed[][][] {
  const classes = new Map<string, Placed[]>();
  for (const p of places) {
    if (p.when.length === 0) continue;
    const key = JSON.stringify(p.when);
    classes.set(key, [...(classes.get(key) ?? []), p]);
  }
  const list = [...classes.values()];
  // ponytail: pairwise over condition classes; a file with more is left as it is.
  if (list.length < 2 || list.length > 80) return [];
  const apart = (a: Placed[], b: Placed[]) =>
    a[0]!.path.some((s) => b[0]!.path.some((t) => s.group === t.group && s.branch !== t.branch));
  const excludes = (a: Placed[], b: Placed[]) => !apart(a, b) && unsatisfiable([...a[0]!.when, ...b[0]!.when]);
  const taken = new Set<Placed[]>();
  const cliques: Placed[][][] = [];
  for (const a of list) {
    if (taken.has(a)) continue;
    const clique = [a];
    for (const b of list)
      if (!taken.has(b) && !clique.includes(b) && clique.every((c) => excludes(c, b))) clique.push(b);
    if (clique.length < 2) continue;
    clique.forEach((c) => taken.add(c));
    cliques.push(clique);
  }
  return cliques;
}

/**
 * Sets of `{#if}` blocks without an `{:else}` in one arm (reached through elements only, so no
 * block, `{#each}` or component lies between them) whose tests contradict each other on one
 * expression (`{#if pitch}` / `{#if !pitch}`, `{#if step === 0}` / `{#if step === 1}`, also as a
 * conjunct of `&&`). One render evaluates them against the same state, so at most one block of a
 * set renders.
 */
function exclusiveIfs(fragment: AST.Fragment, source: string, eligible: (b: AST.IfBlock) => boolean): AST.IfBlock[][] {
  type Expr = AST.IfBlock['test'];
  const reference = (n: Expr): boolean =>
    n.type === 'Identifier' || (n.type === 'MemberExpression' && !n.computed && reference(n.object as Expr));
  const text = (n: Expr) => {
    const { start, end } = n as Expr & { start: number; end: number };
    return source.slice(start, end).replace(/\s+/g, '');
  };
  // What a test being truthy asserts: `t:` a reference's truthiness, `e:` its strict equality to a literal.
  const facts = (test: Expr, out = new Map<string, string>()): Map<string, string> => {
    if (test.type === 'LogicalExpression' && test.operator === '&&') {
      facts(test.left, out);
      facts(test.right, out);
    } else if (test.type === 'UnaryExpression' && test.operator === '!' && reference(test.argument)) {
      out.set(`t:${text(test.argument)}`, 'false');
    } else if (reference(test)) {
      out.set(`t:${text(test)}`, 'true');
    } else if (
      test.type === 'BinaryExpression' &&
      (test.operator === '===' || test.operator === '==') &&
      test.left.type !== 'PrivateIdentifier'
    ) {
      const [side, lit] = test.left.type === 'Literal' ? [test.right, test.left] : [test.left, test.right];
      const value = literalValue(lit);
      // Loose equality to two different numbers (`step == 0`, `step == 2`) cannot both hold; to strings
      // it can (`x == '0'` and `x == '00'` for `x = 0`), and across types too, so the key carries the type.
      if (value !== 'unknown' && reference(side) && (test.operator === '===' || typeof value.value === 'number'))
        out.set(`e:${typeof value.value}:${text(side)}`, JSON.stringify(value.value));
    }
    return out;
  };
  const blocks: AST.IfBlock[] = [];
  const visit = (nodes: AST.Fragment['nodes']): void => {
    for (const node of nodes) {
      if (node.type === 'IfBlock' && !node.alternate && eligible(node)) blocks.push(node);
      else if (node.type === 'RegularElement' || node.type === 'SvelteElement' || node.type === 'KeyBlock')
        visit(node.fragment.nodes);
    }
  };
  visit(fragment.nodes);
  const byKey = new Map<string, Array<[AST.IfBlock, string]>>();
  for (const block of blocks) {
    for (const [key, value] of facts(block.test)) byKey.set(key, [...(byKey.get(key) ?? []), [block, value]]);
  }
  const taken = new Set<AST.IfBlock>();
  const sets: AST.IfBlock[][] = [];
  for (const entries of byKey.values()) {
    const values = new Set<string>();
    const set = entries.filter(([block, value]) => {
      if (taken.has(block) || values.has(value)) return false;
      values.add(value);
      return true;
    });
    if (set.length < 2) continue;
    for (const [block] of set) taken.add(block);
    sets.push(set.map(([block]) => block));
  }
  return sets;
}

/** Whether an `{#if}` chain ends in a plain `{:else}`, so one of its arms always renders. */
function endsInElse(node: AST.IfBlock): boolean {
  if (!node.alternate) return false;
  const rest = node.alternate.nodes.filter((n) => n.type !== 'Text' || n.data.trim() !== '');
  const chained = rest.length === 1 && rest[0]!.type === 'IfBlock' && rest[0]!.elseif ? rest[0] : undefined;
  return chained ? endsInElse(chained) : true;
}

/** An `{#if}` chain's tests in order, one per arm before a final `{:else}`. */
function ifTests(node: AST.IfBlock): Array<AST.IfBlock['test']> {
  const rest = node.alternate?.nodes.filter((n) => n.type !== 'Text' || n.data.trim() !== '') ?? [];
  const chained = rest.length === 1 && rest[0]!.type === 'IfBlock' && rest[0]!.elseif ? rest[0] : undefined;
  return [node.test, ...(chained ? ifTests(chained) : [])];
}

/** An `{#if}` chain's arms in order: `{:else if}` nests as an IfBlock in `alternate`, flattened here. */
function ifArms(node: AST.IfBlock): Array<AST.Fragment | null> {
  if (!node.alternate) return [node.consequent];
  const rest = node.alternate.nodes.filter((n) => n.type !== 'Text' || n.data.trim() !== '');
  const chained = rest.length === 1 && rest[0]!.type === 'IfBlock' && rest[0]!.elseif ? rest[0] : undefined;
  return [node.consequent, ...(chained ? ifArms(chained) : [node.alternate])];
}

export type { BranchStep };

export interface A11yNode {
  kind: 'landmark' | 'id' | 'idref' | 'component';
  /** landmark → 'main'|'banner'|'contentinfo'|'complementary'; id/idref → the literal id; component → component name */
  key: string;
  line: number;
  /** inside {#each} body or {#snippet} definition at any depth (excluded from duplication counting) */
  repeatable: boolean;
  /** branch address from template root (empty = unconditional) */
  path: BranchStep[];
  /** for kind 'idref': the referencing attribute ('for', 'aria-labelledby', …, 'href') */
  attr?: string;
  /** the landmark ancestor element within this file, if any */
  inLandmark?: string;
  /** the landmark ancestor within this file that is no `<header>`/`<footer>`, whose landmark-ness the layout above can revoke */
  inFixedLandmark?: string;
  /** for kind 'landmark' from <header>/<footer>: at template top level in this file (which also implies "not inside sectioning content" — depth 0 has no ancestors at all) */
  topLevel?: boolean;
}

export interface ParsedA11y {
  nodes: A11yNode[];
  /** landmark ancestor of this file's <slot>/{@render children()} position, if any */
  slotInLandmark?: string;
  /** `slotInLandmark`, skipping `<header>`/`<footer>` (see `A11yNode.inFixedLandmark`) */
  slotInFixedLandmark?: string;
  /**
   * Branch address of each distinct <slot>/{@render children()} position: content rendered in two
   * arms is placed in both, where the arms fold it as one. Absent: no slot.
   */
  slotPaths?: BranchStep[][];
  /** `slotPaths`' request-path tests, by index (`ChildrenSite.url`). */
  slotUrls?: (UrlCond | undefined)[];
  /** {@html} tags and spread attributes, located — each poisons the closed world for no-missing-id-ref */
  unknowable: { kind: 'spread' | 'html'; line: number }[];
  /** Distinct lowercased tag names of the body's `RegularElement`s (a11y/required-element's presence set). */
  elementTags: string[];
  /** file contains `{@html}` or a `<svelte:element>` — either can render an element the walk cannot see */
  elementsUnknowable: boolean;
}

/** An `aria-label`/`aria-labelledby` carrying a name: a non-blank literal, or an expression whose
 *  rendered value is unknowable. An empty or whitespace-only literal names nothing. */
function hasAccessibleName(attrs: AST.Attribute[]): boolean {
  return NAMING_ATTRS.some((name) => {
    const attr = findAttr(attrs, name);
    if (!attr) return false;
    if (attrValueOf(attr) === 'dynamic') return true;
    return (attrTextOf(attr) ?? '').trim().length > 0;
  });
}
const IDREF_ATTR_SET = new Set(IDREF_ATTRS);

/** Context threaded down the a11y walk: where in the template a node sits. */
interface A11yCtx {
  path: BranchStep[];
  repeatable: boolean;
  /** landmark ancestors, outermost first */
  landmarks: string[];
  /** the innermost of `landmarks` that is no `<header>`/`<footer>` */
  fixedLandmark: string | undefined;
  /** open `SECTIONING_TAGS` ancestors — a `<header>`/`<footer>` below one is no landmark */
  sectioning: number;
  elementDepth: number;
  /** open `ASIDE_DEMOTING_TAGS` ancestors — an `<aside>` below one needs a name to be a landmark */
  asideDemoting: number;
}

/**
 * Collect a11y occurrences with the branch/repeat context the route-scoped fold needs.
 * Separate from the flat CHILD_NODE_KEYS walks above because those cannot distinguish
 * `{#if}` branches (which are exclusive, so counting must max) from siblings (which sum).
 */
function collectA11y(
  fragment: AST.Fragment,
  source: string,
  urls: ReadonlyMap<number, UrlCond> = new Map()
): ParsedA11y {
  const nodes: A11yNode[] = [];
  let groups = 0;
  let slotInLandmark: string | undefined;
  let slotInFixedLandmark: string | undefined;
  const slotPaths: BranchStep[][] = [];
  const slotUrls: (UrlCond | undefined)[] = [];
  const noteSlot = (ctx: A11yCtx, start: number): void => {
    if (slotInLandmark === undefined) {
      slotInLandmark = ctx.landmarks.at(-1);
      slotInFixedLandmark = ctx.fixedLandmark;
    }
    const same = (p: BranchStep[]) => p.length === ctx.path.length && p.every((s, i) => sameStep(s, ctx.path[i]!));
    if (!slotPaths.some(same)) {
      slotPaths.push(ctx.path);
      slotUrls.push(urls.get(start));
    }
  };
  const unknowable: ParsedA11y['unknowable'] = [];
  const elementTags = new Set<string>();
  let elementsUnknowable = false;

  const emit = (ctx: A11yCtx, node: Omit<A11yNode, 'repeatable' | 'path' | 'inLandmark'>): void => {
    const inLandmark = ctx.landmarks.at(-1);
    nodes.push({
      ...node,
      repeatable: ctx.repeatable,
      path: ctx.path,
      ...(inLandmark ? { inLandmark } : {}),
      ...(ctx.fixedLandmark ? { inFixedLandmark: ctx.fixedLandmark } : {})
    });
  };

  const noteSpread = (node: WalkNode): void => {
    const attributes = (node as { attributes?: unknown }).attributes;
    if (!Array.isArray(attributes)) return;
    const spread = attributes.find((a) => (a as { type?: string }).type === 'SpreadAttribute');
    if (spread) unknowable.push({ kind: 'spread', line: lineOf(source, (spread as { start: number }).start) });
  };

  const walk = (node: WalkNode | WalkNode[] | null | undefined, ctx: A11yCtx): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, ctx);
      return;
    }
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'SvelteHead':
        return; // head content never renders into the body
      case 'HtmlTag':
        unknowable.push({ kind: 'html', line: lineOf(source, node.start) });
        elementsUnknowable = true;
        return;
      case 'IfBlock': {
        const group = groups++;
        ifArms(node).forEach((arm, branch) => walk(arm, { ...ctx, path: [...ctx.path, { group, branch }] }));
        return;
      }
      case 'AwaitBlock': {
        const group = groups++;
        walk(node.pending, { ...ctx, path: [...ctx.path, { group, branch: 0 }] });
        walk(node.then, { ...ctx, path: [...ctx.path, { group, branch: 1 }] });
        walk(node.catch, { ...ctx, path: [...ctx.path, { group, branch: 2 }] });
        return;
      }
      case 'EachBlock':
        walk(node.body, { ...ctx, repeatable: true });
        walk(node.fallback, ctx);
        return;
      case 'SnippetBlock':
        walk(node.body, { ...ctx, repeatable: true });
        return;
      // <svelte:element>'s tag may be dynamic (then no tag-derived landmark) but its literal
      // id/idref attributes are real — dropping them would make no-missing-id-ref report
      // phantom misses.
      case 'RegularElement':
      case 'SvelteElement': {
        const tags = node.type === 'SvelteElement' ? svelteElementTags(node.tag) : [node.name];
        // A tag the expression does not pin down can render any element, so the presence set is
        // no longer closed. Resolved names join it like a literal element's: branch reachability
        // is already ignored here (an element inside {#if} counts), so a conditional's branches
        // are added for the same reason.
        if (!tags) elementsUnknowable = true;
        else for (const tag of tags) elementTags.add(tag.toLowerCase());
        walkElement(node, ctx);
        return;
      }
      case 'Component':
      case 'SvelteComponent':
      case 'SvelteSelf':
        noteSpread(node);
        emit(ctx, { kind: 'component', key: componentName(node), line: lineOf(source, node.start) });
        walk(node.fragment, { ...ctx, elementDepth: ctx.elementDepth + 1 });
        return;
      case 'SlotElement':
        noteSpread(node);
        noteSlot(ctx, node.start);
        walk(node.fragment, ctx);
        return;
      case 'RenderTag':
        if (renderCallee(node) === 'children') noteSlot(ctx, node.start);
        return;
      default:
        noteSpread(node);
        for (const key of CHILD_NODE_KEYS) {
          if (key in node) walk(childOf(node, key), ctx);
        }
    }
  };

  const walkElement = (node: AST.RegularElement | AST.SvelteElement, ctx: A11yCtx): void => {
    noteSpread(node);
    const line = lineOf(source, node.start);
    // The core attr helpers only ever match `Attribute`-typed entries; SpreadAttribute/Directive/AttachTag
    // are filtered out internally, so this widening cast is safe.
    const attrs = node.attributes as AST.Attribute[];
    const roleAttr = findAttr(attrs, 'role');
    // The element this node renders as: the tag itself, or a <svelte:element this="…"> literal.
    // Lowercased because HTML tag names are ASCII case-insensitive and Svelte's SSR output
    // normalizes them — the rendered provider sees <heaDer> as a banner, so this walk must too.
    // A conditional between two tags yields no single element, so landmark/role resolution
    // — which needs one definite tag — stays out of it.
    const resolved = node.type === 'SvelteElement' ? svelteElementTags(node.tag) : [node.name];
    const literalTag = resolved?.length === 1 ? resolved[0] : undefined;
    const tag = literalTag?.toLowerCase();
    // Only in-file sectioning ancestry is visible here; the layout's main/aside is applied at
    // composition (routes.ts), and countsAsLandmark adds the topLevel approximation on top.
    const landmark = resolveLandmark({
      tag,
      roleTokens: roleAttr ? splitTokens(attrTextOf(roleAttr)) : undefined,
      named: tag === 'aside' && hasAccessibleName(attrs),
      insideSectioning: ctx.sectioning > 0,
      insideAsideDemoting: ctx.asideDemoting > 0
    });
    // Only ancestry-dependent tags carry the per-file top-level approximation: their landmark-ness
    // depends on sectioning ancestry the composition cannot see. `<main>` and `<aside>` are
    // landmarks wherever they sit, so tagging them would drop every nested one.
    const headerFooter = landmark !== undefined && !roleAttr && tag !== undefined && ANCESTRY_DEPENDENT_TAGS.has(tag);
    if (landmark) {
      emit(ctx, {
        kind: 'landmark',
        key: landmark,
        line,
        ...(headerFooter ? { topLevel: ctx.elementDepth === 0 } : {})
      });
    }
    for (const attr of node.attributes) {
      if (attr.type !== 'Attribute') continue;
      if (attr.name === 'id') {
        // Expression id → key '' (the dynamic-id marker that poisons the closed world). An
        // empty/whitespace literal id is fully known but references nothing — emit no node,
        // so one `id=""` in a layout cannot silently disable a11y/no-missing-id-ref.
        const v = attrValueOf(attr);
        if (v === 'dynamic') emit(ctx, { kind: 'id', key: '', line });
        else if (v === 'static') emit(ctx, { kind: 'id', key: attrTextOf(attr)!, line });
      } else if (attr.name === 'href') {
        const href = attrTextOf(attr);
        const fragment = href?.startsWith('#') ? stripTextDirective(href.slice(1)) : '';
        if (fragment) {
          // Navigation percent-decodes the fragment before matching an id (#caf%C3%A9 → café).
          emit(ctx, { kind: 'idref', key: decodeFragmentId(fragment), line, attr: 'href' });
        }
      } else if (IDREF_ATTR_SET.has(attr.name)) {
        for (const token of splitTokens(attrTextOf(attr))) {
          emit(ctx, { kind: 'idref', key: token, line, attr: attr.name });
        }
      }
    }
    // <template> contents are inert (not in the rendered document until instantiated), so ids
    // and landmarks inside never resolve or duplicate. The element's OWN attributes are live.
    // A <svelte:element this="template"> with a literal tag resolves to the same element.
    if (tag === 'template') return;
    walk(node.fragment, {
      ...ctx,
      elementDepth: ctx.elementDepth + 1,
      asideDemoting: ctx.asideDemoting + (tag !== undefined && ASIDE_DEMOTING_TAGS.has(tag) ? 1 : 0),
      sectioning: ctx.sectioning + (tag !== undefined && SECTIONING_TAGS.has(tag) ? 1 : 0),
      landmarks: landmark ? [...ctx.landmarks, landmark] : ctx.landmarks,
      fixedLandmark: landmark && !headerFooter ? landmark : ctx.fixedLandmark
    });
  };

  walk(fragment, {
    path: [],
    repeatable: false,
    landmarks: [],
    fixedLandmark: undefined,
    sectioning: 0,
    elementDepth: 0,
    asideDemoting: 0
  });
  return {
    nodes,
    ...(slotInLandmark ? { slotInLandmark } : {}),
    ...(slotInFixedLandmark ? { slotInFixedLandmark } : {}),
    ...(slotPaths.length > 0 ? { slotPaths } : {}),
    ...(slotUrls.some(Boolean) ? { slotUrls } : {}),
    unknowable,
    elementTags: [...elementTags],
    elementsUnknowable
  };
}

function sameStep(a: BranchStep, b: BranchStep): boolean {
  return a.group === b.group && a.branch === b.branch;
}

/** The name a `{@render name(…)}` / `{@render name?.(…)}` calls, when the callee is a plain identifier. */
function renderCallee(node: AST.RenderTag): string | undefined {
  const call = node.expression.type === 'ChainExpression' ? node.expression.expression : node.expression;
  return call.callee.type === 'Identifier' ? call.callee.name : undefined;
}

/** One place a layout renders `children`: its branch path and its offset in document order. */
export interface ChildrenSite {
  path: BranchStep[];
  offset: number;
  /** The request-path test it renders under, when an `{#if}` around it reads one. */
  url?: UrlCond;
}

export interface ParsedFile {
  headTags: ParsedTag[];
  components: ComponentUse[];
  imports: ImportMap;
  /** Locals holding a component chosen at runtime → what they can hold (see `ComponentCandidate`). */
  componentBindings: Map<string, ComponentCandidate[]>;
  images: ParsedImage[];
  /** How many of `images` render before the one `{@render children()}` (or `<slot />`); unset without exactly one. */
  imagesBeforeChildren?: number;
  headings: ParsedHeading[];
  /** How many branch-group numbers this file's heading and component paths use. */
  headingGroups: number;
  /** Where each snippet prop renders (`children` also for `<slot />`), `HOLE` steps included. */
  renderPaths: ReadonlyMap<string, BranchStep[]>;
  /** Each distinct place `children` renders, when there is more than one. */
  childrenSites?: ChildrenSite[];
  /** Where each snippet prop first renders in the file's document order. */
  renderOffsets: ReadonlyMap<string, number>;
  /** This file has a `<svelte:element>` that may render a heading of an undetermined level. */
  dynamicHeading: boolean;
  /** Heading groups (`{#if}`s) a single prop decides, for `decidedArms`. */
  headingGates: ReadonlyMap<number, PropGate>;
  /** Literal prop defaults, for `decidedArms`. */
  propDefaults: ReadonlyMap<string, PropDefault>;
  a11y: ParsedA11y;
  /** What `tagsInHead` re-reads when a parent renders this file inside `<svelte:head>`. */
  template: { source: string; filename: string; props: ReadonlyMap<string, string>; jsonLdNames: ReadonlySet<string> };
  /** Inline `svelte-vitals-disable-next-line` directives in this file, for the central
   *  suppression pass. Collected here because a route-scoped finding can be located in any file
   *  the composition reads, including ones no component-fact collection visited (`--route`). */
  suppressions: SuppressionDirective[];
}

/** Parse a .svelte source into its layer-1 head tags, component usages, and imports. */
export function parseFile(source: string, filename: string): ParsedFile {
  const ast = parseSvelte(source, filename);
  const heads: AST.SvelteHead[] = [];
  collectSvelteHeads(ast.fragment, heads);
  const props = collectProps(ast);
  const urls = childrenUrlConds(ast, source);
  const headingAcc = collectHeadings(ast.fragment, source, props, reassignedLocals(ast), urls);
  const components: ComponentUse[] = [];
  collectComponents(ast.fragment, components, headingAcc);
  const imports = collectImports(ast);
  const jsonLdNames = jsonLdBindings(ast);
  return {
    headTags: [
      ...heads.flatMap((h) => tagsFromHead(h, source, jsonLdNames)),
      ...bodyJsonLd(ast.fragment, source, jsonLdNames),
      ...documentTitle(ast)
    ],
    components,
    imports,
    componentBindings: collectComponentBindings(ast),
    ...collectImages(ast.fragment, source, imports),
    headings: headingAcc.headings,
    headingGroups: headingAcc.groups,
    renderPaths: headingAcc.renderPaths,
    ...(headingAcc.childrenSites.length > 1 ? { childrenSites: headingAcc.childrenSites } : {}),
    renderOffsets: headingAcc.renderOffsets,
    dynamicHeading: headingAcc.dynamic,
    headingGates: headingAcc.gates,
    propDefaults: collectPropDefaults(ast),
    a11y: collectA11y(ast.fragment, source, urls),
    template: { source, filename, props, jsonLdNames },
    suppressions: collectSuppressions(source)
  };
}

/**
 * Parse a .svelte source and extract the head tags declared in its
 * <svelte:head> blocks (detection layer 1 — literal svelte:head, design §11).
 */
export function parseHeadTags(source: string, filename: string): ParsedTag[] {
  const ast = parseSvelte(source, filename);
  const heads: AST.SvelteHead[] = [];
  collectSvelteHeads(ast.fragment, heads);
  const jsonLdNames = jsonLdBindings(ast);
  return heads.flatMap((h) => tagsFromHead(h, source, jsonLdNames));
}
