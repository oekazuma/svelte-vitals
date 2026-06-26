import { parse } from 'svelte/compiler';
import type { HeadTag } from '@svelte-vitals/core';
import type { Value } from '@svelte-vitals/core';
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
      tags.push({ kind: 'title', value: valueFromNodes(node.fragment?.nodes ?? []) });
      continue;
    }
    if (node?.type !== 'RegularElement') continue;

    if (node.name === 'meta') {
      const name = attrText(node.attributes, 'name');
      const property = attrText(node.attributes, 'property');
      const content = name === 'robots' ? attrText(node.attributes, 'content') : undefined;
      const noindex = content !== undefined && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
      tags.push({
        kind: 'meta',
        ...(name ? { name } : {}),
        ...(property ? { property } : {}),
        value: attrValue(node.attributes, 'content'),
        ...(noindex ? { noindex: true } : {})
      });
    } else if (node.name === 'link') {
      const rel = attrText(node.attributes, 'rel');
      const hasAs = findAttr(node.attributes, 'as') !== undefined;
      const asLiteral = attrText(node.attributes, 'as'); // literal keyword, or undefined for dynamic/absent
      const hasCrossorigin = findAttr(node.attributes, 'crossorigin') !== undefined;
      tags.push({
        kind: 'link',
        ...(rel ? { rel } : {}),
        value: attrValue(node.attributes, 'href'),
        ...(hasAs ? { hasAs: true } : {}),
        ...(asLiteral ? { as: asLiteral } : {}),
        ...(hasCrossorigin ? { hasCrossorigin: true } : {})
      });
    } else if (node.name === 'script' && attrText(node.attributes, 'type') === 'application/ld+json') {
      const nodes = node.fragment?.nodes ?? [];
      const raw = textFromNodes(nodes);
      tags.push({ kind: 'jsonld', value: valueFromNodes(nodes), ...(raw !== undefined ? { jsonld: raw } : {}) });
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
      line: lineOf(source, node.start)
    });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectImages(node[key], source, acc);
  }
}

export interface ParsedFile {
  headTags: ParsedTag[];
  components: ComponentUse[];
  imports: ImportMap;
  images: ParsedImage[];
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
  return {
    headTags: heads.flatMap(tagsFromHead),
    components,
    imports: collectImports(ast),
    images
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
