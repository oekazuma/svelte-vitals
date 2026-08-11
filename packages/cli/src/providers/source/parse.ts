import { parse } from 'svelte/compiler';
import type { AST } from 'svelte/compiler';
import type { HeadTag } from '@svelte-vitals/core';
import {
  CHILD_NODE_KEYS,
  lineOf,
  findAttr,
  valueFromNodes,
  textFromNodes,
  attrText,
  attrValue
} from '@svelte-vitals/core';
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
      const rel = attrText(attributes, 'rel');
      const hasAs = findAttr(attributes, 'as') !== undefined;
      const asLiteral = attrText(attributes, 'as'); // literal keyword, or undefined for dynamic/absent
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

export interface ParsedFile {
  headTags: ParsedTag[];
  components: ComponentUse[];
  imports: ImportMap;
  images: ParsedImage[];
  headings: ParsedHeading[];
}

/** Parse a .svelte source into its layer-1 head tags, component usages, and imports. */
export function parseFile(source: string, filename: string): ParsedFile {
  const ast = parse(source, { modern: true, filename });
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
    headings
  };
}

/**
 * Parse a .svelte source and extract the head tags declared in its
 * <svelte:head> blocks (detection layer 1 — literal svelte:head, design §11).
 */
export function parseHeadTags(source: string, filename: string): ParsedTag[] {
  const ast = parse(source, { modern: true, filename });
  const heads: AST.SvelteHead[] = [];
  collectSvelteHeads(ast.fragment, heads);
  return heads.flatMap(tagsFromHead);
}
