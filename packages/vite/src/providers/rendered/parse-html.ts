import { parse, type HTMLElement } from 'node-html-parser';
import type { Value } from '@svelte-vitals/core';
import type { A11yOccurrenceInfo, HeadTag, ImageInfo } from '@svelte-vitals/core/internal';
import {
  decodeFragmentId,
  splitTokens,
  isTopFragment,
  stripTextDirective,
  isClassicScriptType,
  resolveLandmark,
  SECTIONING_TAGS,
  ASIDE_DEMOTING_TAGS,
  NAMING_ATTRS,
  IDREF_ATTRS
} from '@svelte-vitals/core/internal';

function attrValue(v: string | undefined): Value {
  return v !== undefined && v.trim().length > 0 ? 'static' : 'absent';
}

export interface ParsedHtmlHead {
  tags: HeadTag[];
  htmlLang: { presence: 'own' | 'none'; value: Value };
  /** Page-body heading levels (the `n` in <hn>) found in the document (seo/single-h1). */
  headings: number[];
  /** Page <img> elements (the caller fills `file`); enables the image rules in rendered mode. */
  images: Omit<ImageInfo, 'file'>[];
  /** One entry per landmark occurrence in document order ('main'|'banner'|'contentinfo'|'complementary'); enables a11y/duplicate-landmark, a11y/top-level-landmark. */
  landmarks: string[];
  /** A landmark nested inside another landmark, with the ancestor's kind; enables a11y/top-level-landmark. */
  nestedLandmarks: { kind: string; within: string }[];
  /** One entry per literal id="…" occurrence anywhere in the document, in document order; enables a11y/id-duplication and, deduplicated, a11y/no-missing-id-ref's candidate set. */
  ids: string[];
  /** One entry per for/aria-…/href="#…" id reference; enables a11y/no-missing-id-ref. */
  idRefs: { id: string; attr: string }[];
  /** Distinct tag names under `<body>`; enables a11y/required-element. */
  elementTags: string[];
}

interface A11yWalkCtx {
  sectioning: number;
  asideDemoting: number;
  /** ancestor landmark kinds seen so far, outermost first */
  landmarks: string[];
  /** under `<body>` — the presence set is body-scoped, the rest of the walk is whole-document */
  inBody: boolean;
}

interface CollectedA11y {
  landmarks: string[];
  nestedLandmarks: { kind: string; within: string }[];
  ids: string[];
  idRefs: { id: string; attr: string }[];
  /** Distinct lowercased tag names under `<body>` — a11y/required-element's presence set, body-scoped like the source provider's. */
  elementTags: string[];
}

/** Whole-document scan (not body-scoped: app.html shell ids/refs are real occurrences too). */
function collectA11y(root: HTMLElement): CollectedA11y {
  const landmarks: string[] = [];
  const nestedLandmarks: { kind: string; within: string }[] = [];
  const ids: string[] = [];
  const idRefs: { id: string; attr: string }[] = [];
  const elementTags = new Set<string>();

  const walk = (el: HTMLElement, ctx: A11yWalkCtx): void => {
    const tag = el.rawTagName?.toLowerCase();
    if (tag && ctx.inBody) elementTags.add(tag);
    const roleAttr = el.getAttribute('role');
    // The rendered DOM's real nesting decides sectioning ancestry directly, unlike source
    // mode's per-file topLevel approximation (routes.ts countsAsLandmark).
    const landmark = resolveLandmark({
      tag,
      roleTokens: roleAttr !== undefined ? splitTokens(roleAttr) : undefined,
      named: tag === 'aside' && NAMING_ATTRS.some((a) => (el.getAttribute(a) ?? '').trim().length > 0),
      insideSectioning: ctx.sectioning > 0,
      insideAsideDemoting: ctx.asideDemoting > 0
    });

    if (landmark) {
      landmarks.push(landmark);
      const within = ctx.landmarks.at(-1);
      if (within) nestedLandmarks.push({ kind: landmark, within });
    }

    const id = el.getAttribute('id');
    // A whitespace-only id is invalid HTML and unmatchable — same skip as source mode.
    if (id && id.trim()) ids.push(id);

    const href = el.getAttribute('href');
    const target = href?.startsWith('#') ? stripTextDirective(href.slice(1)) : '';
    if (target) {
      // Navigation percent-decodes the fragment before matching an id (#caf%C3%A9 → café), and
      // the "top of the document" check compares the decoded form too (#%74op === #top).
      const fragment = decodeFragmentId(target);
      if (!isTopFragment(fragment)) idRefs.push({ id: fragment, attr: 'href' });
    }
    for (const attr of IDREF_ATTRS) {
      for (const token of splitTokens(el.getAttribute(attr) ?? undefined)) idRefs.push({ id: token, attr });
    }

    // <template> contents are inert (not part of the live document), so ids and landmarks
    // inside never resolve or duplicate. The element's OWN attributes above are live.
    if (tag === 'template') return;
    const nextCtx: A11yWalkCtx = {
      sectioning: ctx.sectioning + (SECTIONING_TAGS.has(tag) ? 1 : 0),
      asideDemoting: ctx.asideDemoting + (ASIDE_DEMOTING_TAGS.has(tag) ? 1 : 0),
      landmarks: landmark ? [...ctx.landmarks, landmark] : ctx.landmarks,
      inBody: ctx.inBody || tag === 'body'
    };
    for (const child of el.children) walk(child, nextCtx);
  };

  for (const child of root.children) walk(child, { sectioning: 0, asideDemoting: 0, landmarks: [], inBody: false });
  return { landmarks, nestedLandmarks, ids, idRefs, elementTags: [...elementTags] };
}

/** Parse a fully-rendered HTML document's <head> into normalized head tags. */
export function parseHtmlHead(html: string): ParsedHtmlHead {
  const root = parse(html);
  const head = root.querySelector('head') ?? root;
  const tags: HeadTag[] = [];

  const title = head.querySelector('title');
  if (title) {
    const text = title.text;
    tags.push({
      kind: 'title',
      presence: 'own',
      value: attrValue(text),
      ...(text && text.trim().length > 0 ? { text } : {})
    });
  }

  for (const meta of head.querySelectorAll('meta')) {
    const name = meta.getAttribute('name');
    const property = meta.getAttribute('property');
    const charset = meta.getAttribute('charset');
    if (charset != null) {
      // <meta charset="…"> carries neither name nor property; model it as name:'charset' (seo/charset).
      tags.push({ kind: 'meta', name: 'charset', presence: 'own', value: attrValue(charset) });
      continue;
    }
    if (!name && !property) continue;
    const content = name === 'robots' ? meta.getAttribute('content') : null;
    const noindex = content != null && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
    const descText = name === 'description' ? meta.getAttribute('content') : null;
    tags.push({
      kind: 'meta',
      ...(name ? { name } : {}),
      ...(property ? { property } : {}),
      presence: 'own',
      value: attrValue(meta.getAttribute('content')),
      ...(noindex ? { noindex: true } : {}),
      ...(descText && descText.trim().length > 0 ? { text: descText } : {})
    });
  }

  for (const link of head.querySelectorAll('link')) {
    // rel/as keywords are ASCII case-insensitive per the HTML spec; the rules compare
    // them literally, so normalize here (mirrors the source parser in packages/cli).
    const rel = link.getAttribute('rel')?.toLowerCase();
    if (!rel) continue;
    const asAttr = link.getAttribute('as')?.toLowerCase(); // rendered HTML: literal string or undefined
    const hasCrossorigin = link.hasAttribute('crossorigin');
    const hreflang = link.getAttribute('hreflang');
    const href = link.getAttribute('href');
    tags.push({
      kind: 'link',
      rel,
      presence: 'own',
      value: attrValue(href),
      ...(asAttr != null ? { hasAs: true, as: asAttr } : {}),
      ...(hasCrossorigin ? { hasCrossorigin: true } : {}),
      // Keep a literal empty hreflang="" (present-but-invalid) so seo/hreflang can flag it.
      ...(hreflang != null ? { hreflang } : {}),
      ...(href ? { href } : {})
    });
  }

  for (const script of head.querySelectorAll('script')) {
    const type = script.getAttribute('type');
    if (type === 'application/ld+json') {
      // `<script>` is a raw-text element — browsers and search engines read its body verbatim and do
      // NOT decode HTML entities. `.text` decodes (e.g. `&quot;` -> `"`), which would corrupt the JSON
      // before seo/json-ld-validity parses it; `.rawText` preserves exactly what the crawler sees.
      const raw = script.rawText;
      tags.push({
        kind: 'jsonld',
        presence: 'own',
        value: attrValue(raw),
        ...(raw && raw.trim().length > 0 ? { jsonld: raw } : {})
      });
      continue;
    }
    // External <script src> in <head> (performance/render-blocking-script, performance/preconnect). Render-blocking only
    // for a classic script (isClassicScriptType) without defer/async; the src URL feeds third-party origin analysis.
    const src = script.getAttribute('src');
    if (src) {
      const blocking = isClassicScriptType(type) && !script.hasAttribute('defer') && !script.hasAttribute('async');
      tags.push({
        kind: 'script',
        presence: 'own',
        value: 'static',
        href: src,
        ...(blocking ? { blocking: true } : {})
      });
    }
  }

  const htmlEl = root.querySelector('html');
  const lang = htmlEl?.getAttribute('lang');
  const htmlLang =
    lang === undefined || lang === null
      ? { presence: 'none' as const, value: 'absent' as const }
      : { presence: 'own' as const, value: attrValue(lang) };

  // Page-body headings (seo/single-h1), in document order so the levels match the
  // static provider (which collects in AST order) — grouping by level would diverge
  // for inputs like <h2>…<h1>. Scope to <body> so a stray heading in <head> is not
  // counted (fallback to root for fragment HTML).
  const headings = (root.querySelector('body') ?? root)
    .querySelectorAll('h1,h2,h3,h4,h5,h6')
    .map((el) => Number(el.rawTagName[1]));

  // Page <img> elements (performance/image-dimensions, performance/image-loading-hint, performance/lcp-image,
  // performance/responsive-image, seo/image-alt). Scope to <body> (like the
  // heading scan) so a stray <head><img> isn't reported. Document order so performance/lcp-image's
  // "first image ≈ LCP" heuristic matches the static provider. line 0 = unknown.
  const images = (root.querySelector('body') ?? root).querySelectorAll('img').map((img) => ({
    hasWidth: img.hasAttribute('width'),
    hasHeight: img.hasAttribute('height'),
    hasLoading: img.hasAttribute('loading'),
    hasAlt: img.hasAttribute('alt'),
    lazy: img.getAttribute('loading') === 'lazy',
    hasSrcset: img.hasAttribute('srcset'),
    line: 0
  }));

  const a11y = collectA11y(root);

  return { tags, htmlLang, headings, images, ...a11y };
}

/** Group raw occurrence keys (one entry per hit, in document order) by key, `file` attached, `line: 0` (rendered mode does not track source lines). */
export function toOccurrenceMap(keys: string[], file: string): Record<string, A11yOccurrenceInfo[]> {
  // Null prototype: keys are author-controlled (`id="__proto__"` is legal page content) and a
  // plain {} would resolve such keys on Object.prototype, crashing the `??=`/push below.
  const out: Record<string, A11yOccurrenceInfo[]> = Object.create(null);
  for (const key of keys) (out[key] ??= []).push({ file, line: 0 });
  return out;
}
