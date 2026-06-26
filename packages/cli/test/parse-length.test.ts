import { describe, it, expect } from 'vitest';
import { parseHeadTags } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;
const find = (src: string, kind: 'title' | 'meta') => parseHeadTags(src, 'x.svelte').find((t) => t.kind === kind)!;

describe('parse: title/description text capture (static)', () => {
  it('captures static title text', () => {
    expect(find(head('<title>About Us</title>'), 'title').text).toBe('About Us');
  });
  it('leaves title text undefined when dynamic', () => {
    expect(find(head('<title>{data.title}</title>'), 'title').text).toBeUndefined();
  });
  it('captures static description content', () => {
    const t = find(head('<meta name="description" content="A concise summary." />'), 'meta');
    expect(t.text).toBe('A concise summary.');
  });
  it('leaves description text undefined when content is dynamic', () => {
    const t = find(head('<meta name="description" content={desc} />'), 'meta');
    expect(t.text).toBeUndefined();
  });
  it('leaves description text undefined when content is a quoted interpolation', () => {
    const t = find(head('<meta name="description" content="{desc}" />'), 'meta');
    expect(t.text).toBeUndefined();
  });
});
