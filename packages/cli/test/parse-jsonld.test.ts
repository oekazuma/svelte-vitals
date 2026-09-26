import { describe, it, expect } from 'vitest';
import { parseFile, parseHeadTags } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;
const jsonld = (tags: ReturnType<typeof parseHeadTags>) => tags.find((t) => t.kind === 'jsonld')!;

describe('parse: jsonld raw capture (static)', () => {
  it('captures the literal JSON-LD text', () => {
    const src = head('<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>');
    expect(jsonld(parseHeadTags(src, 'x.svelte')).jsonld).toBe('{"@context":"https://schema.org","@type":"WebPage"}');
  });
  it('captures the literal text even when it is not valid JSON (seo/json-ld-validity flags it later)', () => {
    const src = head('<script type="application/ld+json">{@html ld}</script>');
    expect(jsonld(parseHeadTags(src, 'x.svelte')).jsonld).toBe('{@html ld}');
  });
});

describe('parse: {@html} JSON-LD in <svelte:head>', () => {
  const jsonldTags = (inner: string) => parseHeadTags(head(inner), 'x.svelte').filter((t) => t.kind === 'jsonld');

  it('treats an {@html} whose expression names JSON-LD as a dynamic JSON-LD tag', () => {
    expect(jsonldTags('{@html schemaToJsonLd(data.breadcrumbJsonLd)}')).toEqual([{ kind: 'jsonld', value: 'dynamic' }]);
    expect(jsonldTags('{@html `<script type="application/ld+json">${JSON.stringify(ld)}</script>`}')).toEqual([
      { kind: 'jsonld', value: 'dynamic' }
    ]);
    expect(jsonldTags('{#if ld}{@html jsonLdScript}{/if}')).toEqual([{ kind: 'jsonld', value: 'dynamic' }]);
  });

  it('treats {@html NAME} as JSON-LD when the script binding NAME builds a JSON-LD block', () => {
    const src = (init: string) =>
      `<script>let { data } = $props(); const LT = '<'; let html = ${init};</script>${head('{@html html}')}`;
    const tags = (init: string) => parseHeadTags(src(init), 'x.svelte').filter((t) => t.kind === 'jsonld');
    expect(tags('$derived(`${LT}script type="application/ld+json">${JSON.stringify(data)}${LT}/script>`)')).toEqual([
      { kind: 'jsonld', value: 'dynamic' }
    ]);
    expect(tags('$derived(`${LT}style>${data.css}${LT}/style>`)')).toEqual([]);
    expect(tags('`${LT}meta name="description" content="Served as application/ld+json">`')).toEqual([]);
  });

  it('reads a binding built from another that holds the opening tag in fragments', () => {
    const src = `<script>let { data } = $props(); const OPEN = "<scr" + 'ipt type="application/ld+json">'; const CLOSE = "</scr" + "ipt>"; const html = $derived(OPEN + JSON.stringify(data) + CLOSE);</script>${head('{@html html}')}`;
    expect(parseHeadTags(src, 'x.svelte').filter((t) => t.kind === 'jsonld')).toEqual([
      { kind: 'jsonld', value: 'dynamic' }
    ]);
  });

  it('leaves an unrelated {@html} injection unmatched', () => {
    expect(jsonldTags("{@html '<style>body{margin:0}</style>'}")).toEqual([]);
    expect(jsonldTags('{@html themeCss}')).toEqual([]);
  });
});

describe('parse: <svelte:element this="script"> JSON-LD in <svelte:head>', () => {
  const jsonldTags = (inner: string) => parseHeadTags(head(inner), 'x.svelte').filter((t) => t.kind === 'jsonld');

  it('reads a literal-tag svelte:element as the <script> it renders', () => {
    expect(
      jsonldTags('<svelte:element this={"script"} type="application/ld+json">{JSON.stringify(ld)}</svelte:element>')
    ).toEqual([{ kind: 'jsonld', value: 'dynamic' }]);
    expect(jsonldTags('<svelte:element this="script" type="application/ld+json">{ld}</svelte:element>')).toEqual([
      { kind: 'jsonld', value: 'dynamic' }
    ]);
  });

  it('leaves a svelte:element whose tag is not determinable unmatched', () => {
    expect(jsonldTags('<svelte:element this={tag} type="application/ld+json">{ld}</svelte:element>')).toEqual([]);
  });
});

describe('parse: JSON-LD outside <svelte:head>', () => {
  const jsonld = (src: string) => parseFile(src, 'x.svelte').headTags.filter((t) => t.kind === 'jsonld');

  it('reads JSON-LD the body renders, as present without a literal claim', () => {
    expect(
      jsonld('<main><script type="application/ld+json">{"@type":"Organization"}</script><h1>Hi</h1></main>')
    ).toEqual([{ kind: 'jsonld', value: 'dynamic' }]);
    expect(jsonld('{#if ok}<script type="application/ld+json">{"@type":"Organization"}</script>{/if}')).toEqual([
      { kind: 'jsonld', value: 'dynamic' }
    ]);
    const built = `<script>let { data } = $props(); const OPEN = "<scr" + 'ipt type="application/ld+json">'; const html = $derived(OPEN + JSON.stringify(data));</script>{@html html}`;
    expect(jsonld(built)).toEqual([{ kind: 'jsonld', value: 'dynamic' }]);
    expect(jsonld('<script>let { css } = $props();</script>{@html css}')).toEqual([]);
  });
});
