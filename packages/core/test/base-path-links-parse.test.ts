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

const script = (body: string, template = '<p>x</p>') => `<script>\n${body}\n</script>\n${template}`;

describe('basePathLinks — goto()', () => {
  const importGoto = `import { goto } from '$app/navigation';`;

  it('records a root-relative goto in a function', () => {
    const src = script([importGoto, `function submit() {`, `  goto('/dashboard');`, `}`].join('\n'));
    expect(links(src)).toEqual([{ kind: 'goto', path: '/dashboard', line: 4 }]);
  });

  it('records a goto in a template inline handler', () => {
    const src = script(importGoto, `<button onclick={() => goto('/dashboard')}>go</button>`);
    expect(links(src)).toEqual([{ kind: 'goto', path: '/dashboard', line: 4 }]);
  });

  it('records an aliased goto import', () => {
    const src = script(
      [`import { goto as navigate } from '$app/navigation';`, `function f() {`, `  navigate('/x');`, `}`].join('\n')
    );
    expect(links(src)).toEqual([{ kind: 'goto', path: '/x', line: 4 }]);
  });

  it('records a goto in a <script module>', () => {
    const src = [`<script module>`, importGoto, `function f() {`, `  goto('/x');`, `}`, `</script>`, `<p>x</p>`].join(
      '\n'
    );
    expect(links(src)).toEqual([{ kind: 'goto', path: '/x', line: 4 }]);
  });

  it('does not record a resolve-wrapped or base-prefixed goto', () => {
    const wrapped = script([importGoto, `function f() {`, `  goto(resolve('/x'));`, `}`].join('\n'));
    expect(links(wrapped)).toEqual([]);
    const prefixed = script([importGoto, `function f() {`, '  goto(`${base}/x`);', `}`].join('\n'));
    expect(links(prefixed)).toEqual([]);
  });

  it('does not record non-root-relative or non-literal goto arguments', () => {
    const external = script([importGoto, `function f() {`, `  goto('https://example.com');`, `}`].join('\n'));
    expect(links(external)).toEqual([]);
    const hash = script([importGoto, `function f() {`, `  goto('#top');`, `}`].join('\n'));
    expect(links(hash)).toEqual([]);
    const variable = script([importGoto, `function f(url) {`, `  goto(url);`, `}`].join('\n'));
    expect(links(variable)).toEqual([]);
  });

  it('does not record a goto imported from somewhere else', () => {
    const src = script([`import { goto } from './my-router.js';`, `function f() {`, `  goto('/x');`, `}`].join('\n'));
    expect(links(src)).toEqual([]);
  });

  it('does not record a namespace-imported goto (documented limitation)', () => {
    const src = script(
      [`import * as nav from '$app/navigation';`, `function f() {`, `  nav.goto('/x');`, `}`].join('\n')
    );
    expect(links(src)).toEqual([]);
  });
});

describe('basePathLinks — runes modules', () => {
  it('records a goto in a .svelte.ts module', () => {
    const src = [`import { goto } from '$app/navigation';`, `export function f() {`, `  goto('/x');`, `}`].join('\n');
    expect(parseComponentFacts(src, 'nav.svelte.ts').basePathLinks).toEqual([{ kind: 'goto', path: '/x', line: 3 }]);
  });
});
