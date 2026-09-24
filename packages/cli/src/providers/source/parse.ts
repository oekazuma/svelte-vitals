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
  IDREF_ATTRS,
  isSvgSrc
} from '@svelte-vitals/core/internal';
import { collectComponentBindings, collectImports, type ImportMap } from './imports.js';

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

/**
 * Tags from the branches of an if/each/await block: which branch renders, and how often, is
 * runtime state. So each tag is dynamic with no literal claim (text, noindex, JSON-LD, hreflang)
 * — picking one branch's literal would judge a value that may never render — and a tag repeated
 * across exclusive branches counts once.
 */
function conditionalTags(branches: Array<AST.Fragment | null | undefined>, source: string): ParsedTag[] {
  const unique = new Map<string, ParsedTag>();
  for (const fragment of branches) {
    for (const tag of tagsFromNodes(fragment?.nodes ?? [], source)) {
      const { text: _text, noindex: _noindex, jsonld: _jsonld, hreflang: _hreflang, ...shape } = tag;
      const dynamic: ParsedTag = { ...shape, value: 'dynamic' };
      unique.set(JSON.stringify(dynamic), dynamic);
    }
  }
  return [...unique.values()];
}

function tagsFromNodes(children: AST.Fragment['nodes'], source: string): ParsedTag[] {
  const tags: ParsedTag[] = [];
  for (const node of children) {
    if (node.type === 'KeyBlock') {
      tags.push(...tagsFromNodes(node.fragment.nodes, source));
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
      tags.push(...conditionalTags(branches, source));
      continue;
    }
    if (node.type === 'TitleElement') {
      // A <title>'s fragment only ever contains literal text and {expr} tags.
      const titleNodes = node.fragment.nodes as Array<AST.Text | AST.ExpressionTag>;
      const text = textFromNodes(titleNodes);
      tags.push({ kind: 'title', value: valueFromNodes(titleNodes), ...(text !== undefined ? { text } : {}) });
      continue;
    }
    if (node.type === 'HtmlTag') {
      // A JSON-LD <script> built as a string (`{@html jsonLd(data)}`) is invisible as an element, so
      // the expression's own wording is the only signal; other injections (`{@html css}`) stay unmatched.
      if (/json-?ld|ld\+json/i.test(source.slice(node.start, node.end)))
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
    const attributes = node.attributes as AST.Attribute[];

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

function tagsFromHead(head: AST.SvelteHead, source: string): ParsedTag[] {
  return tagsFromNodes(head.fragment.nodes, source);
}

export interface ComponentUse {
  name: string;
  attributes: AST.Component['attributes'];
  hasSpread: boolean;
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

function collectComponents(node: WalkNode | WalkNode[] | null | undefined, acc: ComponentUse[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectComponents(child, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'Component' || node.type === 'SvelteComponent') {
    const attributes = node.attributes;
    acc.push({
      name: componentName(node),
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
  /** The `{#if}`/`{#await}` arms it sits in; absent when unconditional. */
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
  const walk = (node: WalkNode | WalkNode[] | null | undefined): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
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
        walk(snippet.body);
      }
      return;
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
        hasSrcset: hasSpread || Boolean(findAttr(attrs, 'srcset')),
        ...(isSvgImage(attrs, imports) ? { svg: true } : {}),
        line: lineOf(source, node.start)
      });
    }
    for (const key of CHILD_NODE_KEYS) {
      if (key in node) walk(childOf(node, key));
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

/**
 * Collect page-body headings (<h1>–<h6>) anywhere in the template (seo/single-h1), each with
 * the `{#if}`/`{#await}` arms it sits in so exclusive arms are not counted together.
 * `dynamic` records a `<svelte:element>` that may render a heading but whose level is not
 * statically determinable — a route carrying one cannot be reported as having no <h1>.
 */
function collectHeadings(fragment: AST.Fragment, source: string) {
  const headings: ParsedHeading[] = [];
  let dynamic = false;
  let groups = 0;
  const push = (level: number, node: WalkNode & { start: number }, path: BranchStep[]): void => {
    headings.push({ level, line: lineOf(source, node.start), ...(path.length > 0 ? { path } : {}) });
  };
  const walk = (node: WalkNode | WalkNode[] | null | undefined, path: BranchStep[]): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, path);
      return;
    }
    if (!node || typeof node !== 'object') return;
    // Body headings only — a stray <h1> inside <svelte:head> is not a page heading.
    if (node.type === 'SvelteHead') return;
    if (node.type === 'IfBlock' || node.type === 'AwaitBlock') {
      const group = groups++;
      const arms = node.type === 'IfBlock' ? ifArms(node) : [node.pending, node.then, node.catch];
      arms.forEach((arm, branch) => walk(arm, [...path, { group, branch }]));
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
      if (key in node) walk(childOf(node, key), path);
    }
  };
  walk(fragment, []);
  return { headings, dynamic };
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
        slotInLandmark ??= ctx.landmarks.at(-1);
        walk(node.fragment, ctx);
        return;
      case 'RenderTag':
        if (renderCallee(node) === 'children') slotInLandmark ??= ctx.landmarks.at(-1);
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

/** The name a `{@render name(…)}` / `{@render name?.(…)}` calls, when the callee is a plain identifier. */
function renderCallee(node: AST.RenderTag): string | undefined {
  const call = node.expression.type === 'ChainExpression' ? node.expression.expression : node.expression;
  return call.callee.type === 'Identifier' ? call.callee.name : undefined;
}

export interface ParsedFile {
  headTags: ParsedTag[];
  components: ComponentUse[];
  imports: ImportMap;
  /** Locals holding a component chosen at runtime → the identifiers they can hold (`''`: anything else). */
  componentBindings: Map<string, string[]>;
  images: ParsedImage[];
  headings: ParsedHeading[];
  /** This file has a `<svelte:element>` that may render a heading of an undetermined level. */
  dynamicHeading: boolean;
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
  const imports = collectImports(ast);
  const headingAcc = collectHeadings(ast.fragment, source);
  return {
    headTags: heads.flatMap((h) => tagsFromHead(h, source)),
    components,
    imports,
    componentBindings: collectComponentBindings(ast),
    images: collectImages(ast.fragment, source, imports),
    headings: headingAcc.headings,
    dynamicHeading: headingAcc.dynamic,
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
  return heads.flatMap((h) => tagsFromHead(h, source));
}
