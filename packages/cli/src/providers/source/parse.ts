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
  isSvgSrc
} from '@svelte-vitals/core/internal';
import { collectComponentBindings, collectImports, type ComponentCandidate, type ImportMap } from './imports.js';

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

/**
 * Script bindings whose initializer spells out a JSON-LD block (`` const ld = `<script
 * type="application/ld+json">…` ``), so `{@html ld}` is read as one.
 */
function jsonLdBindings(ast: AST.Root, source: string): Set<string> {
  const names = new Set<string>();
  for (const script of [ast.module, ast.instance]) {
    type Declarator = { id?: { type: string; name?: string }; init?: { start: number; end: number } | null };
    for (const stmt of (script?.content.body ?? []) as Array<{ type: string; declarations?: Declarator[] }>) {
      if (stmt.type !== 'VariableDeclaration') continue;
      for (const d of stmt.declarations ?? []) {
        if (
          d.id?.type === 'Identifier' &&
          d.id.name &&
          d.init &&
          /ld\+json/i.test(source.slice(d.init.start, d.init.end))
        )
          names.add(d.id.name);
      }
    }
  }
  return names;
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
      tags.push(...conditionalTags(branches, source, bind, jsonLdNames));
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
      if (named || /json-?ld|ld\+json/i.test(source.slice(node.start, node.end)))
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
  heading: Pick<ReturnType<typeof collectHeadings>, 'componentPaths' | 'holes'>,
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
  return tagsFromNodes(fragment.nodes, source, bindProps(props, args), parsed.template.jsonLdNames);
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
}

/**
 * Whether an <img> src is known to be an SVG. A mixed value's trailing literal carries the
 * extension (`src="{base}/rss.svg"`), `src={'/rss.svg'}` is a literal, and `src={logo}` resolves through a
 * `*.svg` import.
 */
function isSvgImage(attrs: AST.Attribute[], imports: ImportMap): boolean {
  const value = findAttr(attrs, 'src')?.value;
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
function collectImages(fragment: AST.Fragment, source: string, imports: ImportMap): ParsedImage[] {
  const acc: ParsedImage[] = [];
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
    if (node.type === 'RenderTag') {
      const snippet = index.snippets.get(renderCallee(node) ?? '');
      if (snippet && !emitted.has(snippet)) {
        emitted.add(snippet);
        walk(snippet.body, picture);
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
  return acc;
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
function commonPrefix(a: BranchStep[], b: BranchStep[]): BranchStep[] {
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
function collectHeadings(fragment: AST.Fragment, source: string, props: ReadonlyMap<string, string>) {
  const headings: ParsedHeading[] = [];
  const componentPaths = new Map<WalkNode, BranchStep[]>();
  const renderPaths = new Map<string, BranchStep[]>();
  const holes = new Map<WalkNode, Map<string, number>>();
  const index = { snippets: new Map<string, AST.SnippetBlock>(), rendered: new Set<string>() };
  indexSnippets(fragment, index);
  const local = (name: string | undefined): AST.SnippetBlock | undefined =>
    name !== undefined && index.rendered.has(name) ? index.snippets.get(name) : undefined;
  const reached = new Set<AST.SnippetBlock>();
  let dynamic = false;
  let groups = 0;
  let holeIds = 0;
  const push = (level: number, node: WalkNode & { start: number }, path: BranchStep[]): void => {
    headings.push({ level, line: lineOf(source, node.start), ...(path.length > 0 ? { path } : {}) });
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
  const walk = (node: WalkNode | WalkNode[] | null | undefined, path: BranchStep[], open: AST.SnippetBlock[]): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, path, open);
      return;
    }
    if (!node || typeof node !== 'object') return;
    // Body headings only — a stray <h1> inside <svelte:head> is not a page heading.
    if (node.type === 'SvelteHead') return;
    if (node.type === 'SnippetBlock' && local(node.expression.name) === node) return;
    if (node.type === 'IfBlock' || node.type === 'AwaitBlock') {
      const group = groups++;
      const arms = node.type === 'IfBlock' ? ifArms(node) : [node.pending, node.then, node.catch];
      arms.forEach((arm, branch) => walk(arm, [...path, { group, branch }], open));
      return;
    }
    if (node.type === 'SvelteBoundary') {
      const group = groups++;
      for (const child of node.fragment.nodes) {
        const branch = child.type === 'SnippetBlock' ? (BOUNDARY_SNIPPET_ARMS.get(child.expression.name) ?? 0) : 0;
        walk(child, [...path, { group, branch }], open);
      }
      return;
    }
    if (node.type === 'RenderTag') {
      const name = renderCallee(node);
      const snippet = local(name);
      if (snippet && !open.includes(snippet)) {
        reached.add(snippet);
        walk(snippet.body, path, [...open, snippet]);
      } else if (!snippet && name !== undefined) meet(renderPaths, props.get(name) ?? name, path);
      return;
    }
    if (node.type === 'SlotElement' && !node.attributes.some((a) => a.type === 'Attribute' && a.name === 'name')) {
      meet(renderPaths, 'children', path);
    }
    if (node.type === 'Component' || node.type === 'SvelteComponent') {
      meet(componentPaths, node, path);
      for (const child of node.fragment.nodes) {
        const name = child.type === 'SnippetBlock' ? child.expression.name : 'children';
        walk(child, [...path, holeOf(node, name)], open);
      }
      return;
    }
    if (node.type === 'RegularElement' && HEADING_TAG.test(node.name)) {
      push(Number(node.name[1]), node, path);
    } else if (node.type === 'SvelteElement') {
      const tags = svelteElementTags(node.tag);
      const level = tags ? headingLevelOf(tags) : undefined;
      if (level !== undefined) push(level, node, path);
      // An unresolvable tag may be a heading; two different heading levels is a heading whose
      // level is unknown. A resolved non-heading set (`cond ? 'span' : 'em'`) is neither.
      else if (!tags || tags.some((t) => HEADING_TAG.test(t.toLowerCase()))) dynamic = true;
    }
    for (const key of CHILD_NODE_KEYS) {
      if (key in node) walk(childOf(node, key), path, open);
    }
  };
  walk(fragment, [], []);
  // A snippet rendered only from inside itself is still read once.
  for (const snippet of index.snippets.values()) {
    if (local(snippet.expression.name) === snippet && !reached.has(snippet)) walk(snippet.body, [], [snippet]);
  }
  return { headings, dynamic, componentPaths, renderPaths, holes, groups };
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
   * Branch address of this file's <slot>/{@render children()} — the longest prefix all such
   * positions share, so content rendered in two arms is placed above both. Absent: no slot.
   */
  slotPath?: BranchStep[];
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
function collectA11y(fragment: AST.Fragment, source: string): ParsedA11y {
  const nodes: A11yNode[] = [];
  let groups = 0;
  let slotInLandmark: string | undefined;
  let slotInFixedLandmark: string | undefined;
  let slotPath: BranchStep[] | undefined;
  const noteSlot = (ctx: A11yCtx): void => {
    if (slotInLandmark === undefined) {
      slotInLandmark = ctx.landmarks.at(-1);
      slotInFixedLandmark = ctx.fixedLandmark;
    }
    if (!slotPath) slotPath = ctx.path;
    else {
      let n = 0;
      while (n < slotPath.length && n < ctx.path.length && sameStep(slotPath[n]!, ctx.path[n]!)) n++;
      slotPath = slotPath.slice(0, n);
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
        noteSlot(ctx);
        walk(node.fragment, ctx);
        return;
      case 'RenderTag':
        if (renderCallee(node) === 'children') noteSlot(ctx);
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
    ...(slotPath ? { slotPath } : {}),
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

export interface ParsedFile {
  headTags: ParsedTag[];
  components: ComponentUse[];
  imports: ImportMap;
  /** Locals holding a component chosen at runtime → what they can hold (see `ComponentCandidate`). */
  componentBindings: Map<string, ComponentCandidate[]>;
  images: ParsedImage[];
  headings: ParsedHeading[];
  /** How many branch-group numbers this file's heading and component paths use. */
  headingGroups: number;
  /** Where each snippet prop renders (`children` also for `<slot />`), `HOLE` steps included. */
  renderPaths: ReadonlyMap<string, BranchStep[]>;
  /** This file has a `<svelte:element>` that may render a heading of an undetermined level. */
  dynamicHeading: boolean;
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
  const headingAcc = collectHeadings(ast.fragment, source, props);
  const components: ComponentUse[] = [];
  collectComponents(ast.fragment, components, headingAcc);
  const imports = collectImports(ast);
  const jsonLdNames = jsonLdBindings(ast, source);
  return {
    headTags: heads.flatMap((h) => tagsFromHead(h, source, jsonLdNames)),
    components,
    imports,
    componentBindings: collectComponentBindings(ast),
    images: collectImages(ast.fragment, source, imports),
    headings: headingAcc.headings,
    headingGroups: headingAcc.groups,
    renderPaths: headingAcc.renderPaths,
    dynamicHeading: headingAcc.dynamic,
    a11y: collectA11y(ast.fragment, source),
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
  const jsonLdNames = jsonLdBindings(ast, source);
  return heads.flatMap((h) => tagsFromHead(h, source, jsonLdNames));
}
