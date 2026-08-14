import { describe, it, expect } from 'vitest';
import { parseFile } from '../src/providers/source/parse.js';

describe('parseFile', () => {
  it('returns head tags, component usages, and imports', () => {
    const pf = parseFile(
      `<script>import { MetaTags } from 'svelte-meta-tags';</script>` +
        `<svelte:head><title>About</title></svelte:head>` +
        `<MetaTags title={data.title} {...rest} /><div>x</div>`,
      'src/routes/+page.svelte'
    );
    expect(pf.headTags).toEqual([{ kind: 'title', text: 'About', value: 'static' }]);
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

describe('parseFile — a11y occurrences', () => {
  const parseIt = (src: string) => parseFile(src, 'x.svelte');

  it('assigns branch paths inside {#if}/{:else} and marks {#each} content repeatable', async () => {
    const src = '{#if a}<main />{:else}<main />{/if}{#each xs as x}<div id="dup" />{/each}';
    const parsed = await parseIt(src);
    const mains = parsed.a11y.nodes.filter((n) => n.kind === 'landmark' && n.key === 'main');
    expect(mains.map((n) => n.path)).toEqual([[{ group: 0, branch: 0 }], [{ group: 0, branch: 1 }]]);
    const id = parsed.a11y.nodes.find((n) => n.kind === 'id');
    expect(id).toMatchObject({ key: 'dup', repeatable: true });
  });

  it('collects idrefs, component uses with paths, slot landmark context, and unknowable content', async () => {
    const src = '<main><label for="n" /><slot /></main>{#if b}<Shell />{/if}{@html raw}';
    const parsed = await parseIt(src);
    expect(parsed.a11y.nodes).toContainEqual(
      expect.objectContaining({ kind: 'idref', key: 'n', attr: 'for', inLandmark: 'main' })
    );
    expect(parsed.a11y.nodes).toContainEqual(
      expect.objectContaining({ kind: 'component', key: 'Shell', path: [{ group: 0, branch: 0 }] })
    );
    expect(parsed.a11y.slotInLandmark).toBe('main');
    expect(parsed.a11y.unknowableContent).toBe(true);
  });

  it('numbers {:else if} branches within one group and {#await} states 0/1/2', () => {
    const chain = parseIt('{#if a}<main />{:else if b}<main />{:else}<main />{/if}');
    expect(chain.a11y.nodes.map((n) => n.path)).toEqual([
      [{ group: 0, branch: 0 }],
      [{ group: 0, branch: 1 }],
      [{ group: 0, branch: 2 }]
    ]);
    const awaited = parseIt('{#await p}<main />{:then v}<main />{:catch e}<main />{/await}{#if c}<main />{/if}');
    expect(awaited.a11y.nodes.map((n) => n.path)).toEqual([
      [{ group: 0, branch: 0 }],
      [{ group: 0, branch: 1 }],
      [{ group: 0, branch: 2 }],
      [{ group: 1, branch: 0 }]
    ]);
  });

  it('maps roles and header/footer with nesting flags, literal values only', () => {
    const parsed = parseIt(
      '<header /><section><footer /></section><div role="complementary" /><div role={r} /><main role="presentation" />'
    );
    expect(parsed.a11y.nodes).toEqual([
      expect.objectContaining({ kind: 'landmark', key: 'banner', topLevel: true, inSectioning: false }),
      expect.objectContaining({ kind: 'landmark', key: 'contentinfo', topLevel: false, inSectioning: true }),
      expect.objectContaining({ kind: 'landmark', key: 'complementary' })
    ]);
  });

  it('emits an empty key for expression ids and tokenizes aria idref lists', () => {
    const parsed = parseIt('<div id={x} aria-labelledby="a b" aria-controls="c" /><a href="#top" /><a href="#" />');
    expect(parsed.a11y.nodes.map((n) => ({ kind: n.kind, key: n.key, attr: n.attr }))).toEqual([
      { kind: 'id', key: '', attr: undefined },
      { kind: 'idref', key: 'a', attr: 'aria-labelledby' },
      { kind: 'idref', key: 'b', attr: 'aria-labelledby' },
      { kind: 'idref', key: 'c', attr: 'aria-controls' },
      { kind: 'idref', key: 'top', attr: 'href' }
    ]);
    expect(parsed.a11y.unknowableContent).toBe(false);
  });

  it('collects ids and idrefs from <svelte:element>', () => {
    const parsed = parseIt('<svelte:element this={t} id="x" aria-controls="c" /><svelte:element this={t} id={y} />');
    expect(parsed.a11y.nodes.map((n) => ({ kind: n.kind, key: n.key }))).toEqual([
      { kind: 'id', key: 'x' },
      { kind: 'idref', key: 'c' },
      { kind: 'id', key: '' }
    ]);
  });

  it('marks {#snippet} bodies repeatable and spread attributes unknowable', () => {
    const parsed = parseIt('{#snippet row()}<main />{/snippet}<div {...props} />');
    expect(parsed.a11y.nodes[0]).toMatchObject({ kind: 'landmark', key: 'main', repeatable: true });
    expect(parsed.a11y.unknowableContent).toBe(true);
  });

  it('ignores <svelte:head> content and non-children render tags', () => {
    const parsed = parseIt('<svelte:head><link href="#x" /></svelte:head><main>{@render icon()}</main>');
    expect(parsed.a11y.nodes.filter((n) => n.kind === 'idref')).toHaveLength(0);
    expect(parsed.a11y.slotInLandmark).toBeUndefined();
    expect(parseIt('<main>{@render children()}</main>').a11y.slotInLandmark).toBe('main');
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

  it('treats spread-only <img> as all attributes present (no false positives)', () => {
    const pf = parseFile(`<img {...props} />`, 'x.svelte');
    expect(pf.images).toHaveLength(1);
    expect(pf.images[0]).toMatchObject({ hasWidth: true, hasHeight: true, hasLoading: true });
  });

  it('treats <img> with spread + explicit attr as all attributes present', () => {
    const pf = parseFile(`<img src="/a.png" {...props} />`, 'x.svelte');
    expect(pf.images).toHaveLength(1);
    expect(pf.images[0]).toMatchObject({ hasWidth: true, hasHeight: true, hasLoading: true });
  });

  it('still marks missing attrs as absent when there is no spread', () => {
    const pf = parseFile(`<img src="/a.png" />`, 'x.svelte');
    expect(pf.images).toHaveLength(1);
    expect(pf.images[0]).toMatchObject({ hasWidth: false, hasHeight: false, hasLoading: false });
  });
});
