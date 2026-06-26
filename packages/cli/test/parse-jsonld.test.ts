import { describe, it, expect } from 'vitest';
import { parseHeadTags } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;
const jsonld = (tags: ReturnType<typeof parseHeadTags>) => tags.find((t) => t.kind === 'jsonld')!;

describe('parse: jsonld raw capture (static)', () => {
  it('captures the literal JSON-LD text', () => {
    const src = head('<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>');
    expect(jsonld(parseHeadTags(src, 'x.svelte')).jsonld).toBe('{"@context":"https://schema.org","@type":"WebPage"}');
  });
  it('captures the literal text even when it is not valid JSON (SEO016 flags it later)', () => {
    const src = head('<script type="application/ld+json">{@html ld}</script>');
    expect(jsonld(parseHeadTags(src, 'x.svelte')).jsonld).toBe('{@html ld}');
  });
});
