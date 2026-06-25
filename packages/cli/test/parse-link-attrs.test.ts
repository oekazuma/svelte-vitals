import { describe, it, expect } from 'vitest';
import { parseHeadTags } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;

describe('parse: link as/crossorigin (static)', () => {
  it('captures a literal as keyword + crossorigin presence', () => {
    const tags = parseHeadTags(head('<link rel="preload" href="/i.woff2" as="font" crossorigin />'), 'x.svelte');
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.as).toBe('font');
    expect(link.hasAs).toBe(true);
    expect(link.hasCrossorigin).toBe(true);
  });
  it('treats a dynamic as={x} as present but with no literal keyword', () => {
    const tags = parseHeadTags(head('<link rel="preload" href="/a.js" as={kind} />'), 'x.svelte');
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.hasAs).toBe(true); // present → PERF003 won't fire
    expect(link.as).toBeUndefined(); // not a literal → PERF004 won't fire
  });
  it('leaves fields unset when the attributes are absent', () => {
    const tags = parseHeadTags(head('<link rel="preload" href="/a.js" />'), 'x.svelte');
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.hasAs).toBeUndefined();
    expect(link.as).toBeUndefined();
    expect(link.hasCrossorigin).toBeUndefined();
  });
});
