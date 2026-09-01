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
  ANCESTRY_DEPENDENT_TAGS,
  NAMING_ATTRS,
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
  const unknowable: ParsedA11y['unknowable'] = [];
  const elementTags = new Set<string>();
  let elementsUnknowable = false;

  const emit = (ctx: A11yCtx, node: Omit<A11yNode, 'repeatable' | 'path' | 'inLandmark'>): void => {
    const inLandmark = ctx.landmarks.at(-1);
    nodes.push({ ...node, repeatable: ctx.repeatable, path: ctx.path, ...(inLandmark ? { inLandmark } : {}) });
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
        // A dynamic tag can render any element; its name is unknown to the presence set either way.
        if (node.type === 'SvelteElement') elementsUnknowable = true;
        else elementTags.add(node.name.toLowerCase());
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
    // The element this node renders as: the tag itself, or a <svelte:element this="…"> literal.
    // Lowercased because HTML tag names are ASCII case-insensitive and Svelte's SSR output
    // normalizes them — the rendered provider sees <heaDer> as a banner, so this walk must too.
    const literalTag =
      node.type === 'SvelteElement'
        ? node.tag.type === 'Literal' && typeof node.tag.value === 'string'
          ? node.tag.value
          : undefined
        : node.name;
    const tag = literalTag?.toLowerCase();
    // A per-file walk cannot see cross-file sectioning ancestry, so insideSectioning stays false;
    // countsAsLandmark (routes.ts) applies the topLevel approximation at composition instead.
    const landmark = resolveLandmark({
      tag,
      roleTokens: roleAttr ? splitTokens(attrTextOf(roleAttr)) : undefined,
      named: tag === 'aside' && hasAccessibleName(attrs),
      insideSectioning: false,
      insideAsideDemoting: ctx.asideDemoting > 0
    });
    if (landmark) {
      // Only ancestry-dependent tags carry the per-file top-level approximation: their landmark-ness
      // depends on sectioning ancestry the composition cannot see. `<main>` and `<aside>` are
      // landmarks wherever they sit, so tagging them would drop every nested one.
      const headerFooter = !roleAttr && tag !== undefined && ANCESTRY_DEPENDENT_TAGS.has(tag);
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
      landmarks: landmark ? [...ctx.landmarks, landmark] : ctx.landmarks
    });
  };

  walk(fragment, { path: [], repeatable: false, landmarks: [], elementDepth: 0, asideDemoting: 0 });
  return {
    nodes,
    ...(slotInLandmark ? { slotInLandmark } : {}),
    unknowable,
    elementTags: [...elementTags],
    elementsUnknowable
  };
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
    a11y: collectA11y(ast.fragment, source),
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
  return heads.flatMap(tagsFromHead);
}
