import type { AST } from 'svelte/compiler';
import type { BranchStep, HeadTag } from '@svelte-vitals/core/internal';
import {
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
  LANDMARK_ROLES,
  IDREF_ATTRS
} from '@svelte-vitals/core/internal';
import { collectImports, type ImportMap } from './imports.js';

/** A head tag parsed from one file, before layout-chain presence is assigned. */
export type ParsedTag = Omit<HeadTag, 'presence' | 'file'>;

/** Any template node reachable while walking a parsed component (a Fragment's node list, plus Fragment itself). */
type WalkNode = AST.Fragment | AST.Text | AST.Tag | AST.ElementLike | AST.Block | AST.Comment;

/**
 * Read a CHILD_NODE_KEYS entry off a heterogeneous template node. Each concrete node type
 * only declares some of these keys (e.g. `IfBlock.consequent`, `EachBlock.body`), so there's
 * no single interface to index into — this cast is the walker's one deliberate escape hatch.
 */
function childOf(node: WalkNode, key: string): WalkNode | WalkNode[] | null | undefined {
  return (node as unknown as Record<string, WalkNode | WalkNode[] | null | undefined>)[key];
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

// HTML spec: a <script> executes as a "classic script" only when its `type` is absent, empty,
// or a JavaScript MIME type (mimesniff's JAVASCRIPT_MIME_TYPES). Anything else — module,
// importmap, speculationrules, a third-party runtime like text/partytown, … — never runs as a
// blocking classic script (performance/render-blocking-script).
const JS_MIME_TYPES = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript'
]);

function isClassicScriptType(type: string | undefined): boolean {
  if (type === undefined) return true;
  const normalized = type.trim().toLowerCase();
  return normalized === '' || JS_MIME_TYPES.has(normalized);
}

function tagsFromHead(head: AST.SvelteHead): ParsedTag[] {
  const tags: ParsedTag[] = [];
  const children = head.fragment.nodes;
  for (const node of children) {
    if (node.type === 'TitleElement') {
      // A <title>'s fragment only ever contains literal text and {expr} tags.
      const titleNodes = node.fragment.nodes as Array<AST.Text | AST.ExpressionTag>;
      const text = textFromNodes(titleNodes);
      tags.push({ kind: 'title', value: valueFromNodes(titleNodes), ...(text !== undefined ? { text } : {}) });
      continue;
    }
    if (node.type !== 'RegularElement') continue;
    // The core attr helpers only ever match `Attribute`-typed entries; SpreadAttribute/Directive/AttachTag
    // are filtered out internally, so this widening cast is safe.
    const attributes = node.attributes as AST.Attribute[];

    if (node.name === 'meta') {
      const charset = attrValue(attributes, 'charset');
      if (charset !== 'absent') {
        // <meta charset="…"> carries neither name nor property; model it as name:'charset' (seo/charset).
        tags.push({ kind: 'meta', name: 'charset', value: charset });
        continue;
      }
      const name = attrText(attributes, 'name');
      const property = attrText(attributes, 'property');
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
    } else if (node.name === 'link') {
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
    } else if (node.name === 'script') {
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

export interface ComponentUse {
  name: string;
  attributes: AST.Component['attributes'];
  hasSpread: boolean;
}

function collectComponents(node: WalkNode | WalkNode[] | null | undefined, acc: ComponentUse[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectComponents(child, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'Component') {
    const attributes = node.attributes;
    acc.push({
      name: node.name,
      attributes,
      hasSpread: attributes.some((a) => a.type === 'SpreadAttribute')
    });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectComponents(childOf(node, key), acc);
  }
}

interface ParsedImage {
  hasWidth: boolean;
  hasHeight: boolean;
  hasLoading: boolean;
  hasAlt: boolean;
  lazy: boolean;
  hasSrcset: boolean;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** A page-body heading (<h1>–<h6>) parsed from one file (seo/single-h1). */
interface ParsedHeading {
  /** Heading level 1–6. */
  level: number;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

function collectImages(node: WalkNode | WalkNode[] | null | undefined, source: string, acc: ParsedImage[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectImages(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
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
      hasSrcset: hasSpread || Boolean(findAttr(attrs, 'srcset')),
      line: lineOf(source, node.start)
    });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectImages(childOf(node, key), source, acc);
  }
}

/** Recursively collect page-body headings (<h1>–<h6>) anywhere in the template (seo/single-h1). */
function collectHeadings(node: WalkNode | WalkNode[] | null | undefined, source: string, acc: ParsedHeading[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectHeadings(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  // Body headings only — a stray <h1> inside <svelte:head> is not a page heading.
  if (node.type === 'SvelteHead') return;
  if (node.type === 'RegularElement' && /^h[1-6]$/.test(node.name)) {
    acc.push({ level: Number(node.name[1]), line: lineOf(source, node.start) });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectHeadings(childOf(node, key), source, acc);
  }
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
  /** for kind 'landmark' from <header>/<footer>: at template top level in this file (which also implies "not inside sectioning content" — depth 0 has no ancestors at all) */
  topLevel?: boolean;
}

export interface ParsedA11y {
  nodes: A11yNode[];
  /** landmark ancestor of this file's <slot>/{@render children()} position, if any */
  slotInLandmark?: string;
  /** file contains {@html} or a spread attribute — poisons the closed world for no-missing-id-ref */
  unknowableContent: boolean;
}

const LANDMARK_TAGS: Record<string, string | undefined> = { main: 'main', header: 'banner', footer: 'contentinfo' };
const IDREF_ATTR_SET = new Set(IDREF_ATTRS);

/** Context threaded down the a11y walk: where in the template a node sits. */
interface A11yCtx {
  path: BranchStep[];
  repeatable: boolean;
  /** landmark ancestors, outermost first */
  landmarks: string[];
  elementDepth: number;
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
  let unknowableContent = false;

  const emit = (ctx: A11yCtx, node: Omit<A11yNode, 'repeatable' | 'path' | 'inLandmark'>): void => {
    const inLandmark = ctx.landmarks.at(-1);
    nodes.push({ ...node, repeatable: ctx.repeatable, path: ctx.path, ...(inLandmark ? { inLandmark } : {}) });
  };

  const noteSpread = (node: WalkNode): void => {
    const attributes = (node as { attributes?: unknown }).attributes;
    if (Array.isArray(attributes) && attributes.some((a) => (a as { type?: string }).type === 'SpreadAttribute')) {
      unknowableContent = true;
    }
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
        unknowableContent = true;
        return;
      case 'IfBlock':
        walkIfChain(node, ctx, groups++, 0);
        return;
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
      // <svelte:element> has a dynamic tag (so no tag-derived landmark) but its literal id/idref
      // attributes are real — dropping them would make no-missing-id-ref report phantom misses.
      case 'RegularElement':
      case 'SvelteElement':
        walkElement(node, ctx);
        return;
      case 'Component':
      case 'SvelteComponent':
      case 'SvelteSelf':
        noteSpread(node);
        emit(ctx, { kind: 'component', key: node.name, line: lineOf(source, node.start) });
        walk(node.fragment, { ...ctx, elementDepth: ctx.elementDepth + 1 });
        return;
      case 'SlotElement':
        noteSpread(node);
        slotInLandmark ??= ctx.landmarks.at(-1);
        walk(node.fragment, ctx);
        return;
      case 'RenderTag':
        if (isChildrenRender(node)) slotInLandmark ??= ctx.landmarks.at(-1);
        return;
      default:
        noteSpread(node);
        for (const key of CHILD_NODE_KEYS) {
          if (key in node) walk(childOf(node, key), ctx);
        }
    }
  };

  /** `{:else if}` nests as an IfBlock in `alternate`; flatten the chain into branches of one group. */
  const walkIfChain = (node: AST.IfBlock, ctx: A11yCtx, group: number, branch: number): void => {
    walk(node.consequent, { ...ctx, path: [...ctx.path, { group, branch }] });
    if (!node.alternate) return;
    const rest = node.alternate.nodes.filter((n) => n.type !== 'Text' || n.data.trim() !== '');
    const chained = rest.length === 1 && rest[0]!.type === 'IfBlock' && rest[0]!.elseif ? rest[0] : undefined;
    if (chained) walkIfChain(chained, ctx, group, branch + 1);
    else walk(node.alternate, { ...ctx, path: [...ctx.path, { group, branch: branch + 1 }] });
  };

  const walkElement = (node: AST.RegularElement | AST.SvelteElement, ctx: A11yCtx): void => {
    noteSpread(node);
    const line = lineOf(source, node.start);
    // The core attr helpers only ever match `Attribute`-typed entries; SpreadAttribute/Directive/AttachTag
    // are filtered out internally, so this widening cast is safe.
    const attrs = node.attributes as AST.Attribute[];
    const roleAttr = findAttr(attrs, 'role');
    // ARIA fallback role lists (role="switch checkbox") resolve to the first supported token; a
    // non-literal or non-landmark role suppresses the tag mapping rather than falling through to it.
    const role = roleAttr ? splitTokens(attrTextOf(roleAttr))[0] : undefined;
    const landmark = roleAttr ? (role && LANDMARK_ROLES.has(role) ? role : undefined) : LANDMARK_TAGS[node.name];
    if (landmark) {
      const headerFooter = !roleAttr && node.name !== 'main';
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
        if (href?.startsWith('#') && href.length > 1) {
          // Navigation percent-decodes the fragment before matching an id (#caf%C3%A9 → café).
          emit(ctx, { kind: 'idref', key: decodeFragmentId(href.slice(1)), line, attr: 'href' });
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
    const literalTag =
      node.type === 'SvelteElement'
        ? node.tag.type === 'Literal' && typeof node.tag.value === 'string'
          ? node.tag.value
          : undefined
        : node.name;
    if (literalTag === 'template') return;
    walk(node.fragment, {
      ...ctx,
      elementDepth: ctx.elementDepth + 1,
      landmarks: landmark ? [...ctx.landmarks, landmark] : ctx.landmarks
    });
  };

  walk(fragment, { path: [], repeatable: false, landmarks: [], elementDepth: 0 });
  return { nodes, ...(slotInLandmark ? { slotInLandmark } : {}), unknowableContent };
}

function isChildrenRender(node: AST.RenderTag): boolean {
  const call = node.expression.type === 'ChainExpression' ? node.expression.expression : node.expression;
  return call.callee.type === 'Identifier' && call.callee.name === 'children';
}

export interface ParsedFile {
  headTags: ParsedTag[];
  components: ComponentUse[];
  imports: ImportMap;
  images: ParsedImage[];
  headings: ParsedHeading[];
  a11y: ParsedA11y;
}

/** Parse a .svelte source into its layer-1 head tags, component usages, and imports. */
export function parseFile(source: string, filename: string): ParsedFile {
  const ast = parseSvelte(source, filename);
  const heads: AST.SvelteHead[] = [];
  collectSvelteHeads(ast.fragment, heads);
  const components: ComponentUse[] = [];
  collectComponents(ast.fragment, components);
  const images: ParsedImage[] = [];
  collectImages(ast.fragment, source, images);
  const headings: ParsedHeading[] = [];
  collectHeadings(ast.fragment, source, headings);
  return {
    headTags: heads.flatMap(tagsFromHead),
    components,
    imports: collectImports(ast),
    images,
    headings,
    a11y: collectA11y(ast.fragment, source)
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
  return heads.flatMap(tagsFromHead);
}
