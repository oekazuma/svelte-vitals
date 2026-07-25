import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const links = (src: string) => parseComponentFacts(src, 'A.svelte').basePathLinks;

describe('basePathLinks — <a href>', () => {
  it('records a root-relative href', () => {
    expect(links(`<a href="/about">About</a>`)).toEqual([{ kind: 'href', path: '/about', line: 1 }]);
  });

  it('records a bare root href', () => {
    expect(links(`<a href="/">Home</a>`)).toEqual([{ kind: 'href', path: '/', line: 1 }]);
  });

  it('records each link with its own line', () => {
    const src = [`<a href="/about">A</a>`, `<a href="/blog">B</a>`].join('\n');
    expect(links(src)).toEqual([
      { kind: 'href', path: '/about', line: 1 },
      { kind: 'href', path: '/blog', line: 2 }
    ]);
  });

  it('records a link nested inside blocks', () => {
    const src = [`{#if show}`, `  <a href="/about">A</a>`, `{/if}`].join('\n');
    expect(links(src)).toEqual([{ kind: 'href', path: '/about', line: 2 }]);
  });
});

describe('basePathLinks — <a href> exclusions', () => {
  it('does not record a protocol-relative URL', () => {
    expect(links(`<a href="//cdn.example.com/x">x</a>`)).toEqual([]);
  });

  it('does not record absolute, hash, query, or document-relative links', () => {
    expect(links(`<a href="https://example.com">x</a>`)).toEqual([]);
    expect(links(`<a href="mailto:a@b.dev">x</a>`)).toEqual([]);
    expect(links(`<a href="#top">x</a>`)).toEqual([]);
    expect(links(`<a href="?q=1">x</a>`)).toEqual([]);
    expect(links(`<a href="./rel">x</a>`)).toEqual([]);
    expect(links(`<a href="rel">x</a>`)).toEqual([]);
  });

  it('does not record a dynamic href (base-prefixed or resolve-wrapped)', () => {
    expect(links(`<a href="{base}/about">x</a>`)).toEqual([]);
    expect(links(`<a href={resolve('/about')}>x</a>`)).toEqual([]);
    expect(links(`<a href={url}>x</a>`)).toEqual([]);
  });

  it('does not record an href on a non-anchor element or a dynamic tag', () => {
    expect(links(`<link href="/style.css" />`)).toEqual([]);
    expect(links(`<area href="/about" />`)).toEqual([]);
    expect(links(`<svelte:element this="a" href="/about">x</svelte:element>`)).toEqual([]);
  });

  it('does not record an anchor with no href', () => {
    expect(links(`<a>x</a>`)).toEqual([]);
  });
});
