import { describe, it, expect } from 'vitest';
import { parseHeadTags } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;
const robots = (tags: ReturnType<typeof parseHeadTags>) => tags.find((t) => t.kind === 'meta' && t.name === 'robots')!;

describe('parse: robots noindex (static)', () => {
  it('flags a literal noindex', () => {
    expect(robots(parseHeadTags(head('<meta name="robots" content="noindex, follow" />'), 'x.svelte')).noindex).toBe(true);
  });
  it('flags content="none" (== noindex,nofollow)', () => {
    expect(robots(parseHeadTags(head('<meta name="robots" content="none" />'), 'x.svelte')).noindex).toBe(true);
  });
  it('does not flag index,follow', () => {
    expect(robots(parseHeadTags(head('<meta name="robots" content="index, follow" />'), 'x.svelte')).noindex).toBeUndefined();
  });
  it('does not flag a dynamic content', () => {
    expect(robots(parseHeadTags(head('<meta name="robots" content={r} />'), 'x.svelte')).noindex).toBeUndefined();
  });
});
