import { describe, it, expect } from 'vitest';
import { parseFile, attrValueOf } from '../src/providers/source/parse.js';

describe('parseFile', () => {
  it('returns head tags, component usages, and imports', () => {
    const pf = parseFile(
      `<script>import { MetaTags } from 'svelte-meta-tags';</script>` +
        `<svelte:head><title>About</title></svelte:head>` +
        `<MetaTags title={data.title} {...rest} /><div>x</div>`,
      'src/routes/+page.svelte'
    );
    expect(pf.headTags).toEqual([{ kind: 'title', value: 'static' }]);
    expect(pf.imports.get('MetaTags')?.source).toBe('svelte-meta-tags');
    expect(pf.components).toHaveLength(1);
    expect(pf.components[0]!.name).toBe('MetaTags');
    expect(pf.components[0]!.hasSpread).toBe(true);
  });

  it('does not treat regular HTML elements as components', () => {
    const pf = parseFile('<div><p>x</p></div>', 'x.svelte');
    expect(pf.components).toHaveLength(0);
  });

  // Svelte 5 forbids <svelte:head> inside blocks at parse time, so we exercise the
  // same traversal keys (pending/then/catch/fallback) via component detection instead.
  it('finds a component usage inside the {:else} fallback of an {#each} block', () => {
    const pf = parseFile(
      `<script>import { MetaTags } from 'svelte-meta-tags';</script>{#each [] as x}{:else}<MetaTags title="t" />{/each}`,
      'x.svelte'
    );
    expect(pf.components.map((c) => c.name)).toContain('MetaTags');
  });

  it('finds a component usage inside an {#await ... then} branch', () => {
    const pf = parseFile(
      `<script>import { MetaTags } from 'svelte-meta-tags';</script>{#await p then v}<MetaTags title={v} />{/await}`,
      'x.svelte'
    );
    expect(pf.components.map((c) => c.name)).toContain('MetaTags');
  });

  it('finds component usages in both branches of an {#if} block (consequent + alternate)', () => {
    const pf = parseFile(
      `<script>import { A } from 'a'; import { B } from 'b';</script>{#if cond}<A />{:else}<B />{/if}`,
      'x.svelte'
    );
    expect(pf.components.map((c) => c.name).sort()).toEqual(['A', 'B']);
  });
});

describe('parseFile images', () => {
  it('collects <img> attribute presence and line (dynamic counts as present)', () => {
    const src = `<div>\n  <img src="/a.png" width="10" height="10" loading="lazy" />\n  <img src="/b.png" width={w} />\n</div>`;
    const pf = parseFile(src, 'src/routes/+page.svelte');
    expect(pf.images).toHaveLength(2);
    expect(pf.images[0]).toMatchObject({ hasWidth: true, hasHeight: true, hasLoading: true, line: 2 });
    // width={w} (dynamic) still counts as present; height/loading absent.
    expect(pf.images[1]).toMatchObject({ hasWidth: true, hasHeight: false, hasLoading: false, line: 3 });
  });

  it('finds <img> nested inside a block', () => {
    const pf = parseFile(`{#if cond}<img src="/x.png" />{/if}`, 'x.svelte');
    expect(pf.images).toHaveLength(1);
  });
});

describe('attrValueOf', () => {
  it('treats a boolean attribute as absent', () => {
    expect(attrValueOf({ value: true })).toBe('absent');
  });

  it('treats a missing/empty value as absent', () => {
    expect(attrValueOf(undefined)).toBe('absent');
    expect(attrValueOf({ value: [] })).toBe('absent');
    expect(attrValueOf({ value: [{ type: 'Text', data: '   ' }] })).toBe('absent');
  });

  it('treats non-whitespace Text as static', () => {
    expect(attrValueOf({ value: [{ type: 'Text', data: 'hello' }] })).toBe('static');
  });

  it('treats an ExpressionTag value as dynamic (array or single node)', () => {
    expect(attrValueOf({ value: [{ type: 'ExpressionTag' }] })).toBe('dynamic');
    expect(attrValueOf({ value: { type: 'ExpressionTag' } })).toBe('dynamic');
  });
});
