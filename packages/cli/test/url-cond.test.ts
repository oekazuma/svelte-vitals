import { describe, expect, it } from 'vitest';
import { urlHolds } from '../src/providers/source/url-cond.js';

describe('urlHolds', () => {
  it('decides a regex test only when the path reads the same with and without a trailing slash', () => {
    expect(urlHolds({ re: '^\\/app\\/(login|invite)', flags: '' }, '/app/manage')).toBe(false);
    expect(urlHolds({ re: '^\\/about\\/$', flags: '' }, '/about')).toBeUndefined();
    expect(urlHolds({ re: '^\\/app', flags: 'g' }, '/app/x')).toBe(true);
  });

  it('decides endsWith by the literal after the last parameter', () => {
    expect(urlHolds({ op: 'ends', v: '/print' }, '/inv/[id]/print')).toBe(true);
    expect(urlHolds({ op: 'ends', v: '/print' }, '/inv/[id]/edit')).toBe(false);
    expect(urlHolds({ op: 'ends', v: '/a/print' }, '/inv/[id]/print')).toBeUndefined();
    expect(urlHolds({ op: 'ends', v: '/x/edit' }, '/inv/[id]/print')).toBe(false);
    expect(urlHolds({ op: 'ends', v: '/print' }, '/docs/[...rest]')).toBeUndefined();
  });

  it('reads a route id list and a template against the route', () => {
    expect(urlHolds({ id: ['/(app)/a'] }, '/a', '/(app)/a')).toBe(true);
    expect(urlHolds({ id: ['/(app)/a'] }, '/b', '/(app)/b')).toBe(false);
    expect(urlHolds({ tpl: ['c', null] }, '/c/[slug]')).toBe(true);
    expect(urlHolds({ tpl: ['c', null] }, '/c/[slug]/admin')).toBe(false);
    expect(urlHolds({ tpl: ['c', null] }, '/c/fixed')).toBeUndefined();
  });
});
