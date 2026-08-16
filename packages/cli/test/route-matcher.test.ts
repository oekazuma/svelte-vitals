import { describe, it, expect } from 'vitest';
import { routeMatcher } from '../src/index.js';

describe('routeMatcher', () => {
  it('matches everything when no glob', () => {
    const m = routeMatcher(undefined);
    expect(m('/anything/deep')).toBe(true);
  });

  it('trailing /** matches the segment and any depth below it', () => {
    const m = routeMatcher('static/**');
    expect(m('/static')).toBe(true);
    expect(m('/static/a')).toBe(true);
    expect(m('/static/a/b')).toBe(true);
    expect(m('/other')).toBe(false);
  });

  it('leading **/ matches any prefix', () => {
    const m = routeMatcher('**/admin');
    expect(m('/admin')).toBe(true);
    expect(m('/a/admin')).toBe(true);
    expect(m('/a/b/admin')).toBe(true);
    expect(m('/admin/x')).toBe(false);
  });

  it('single * matches one segment only', () => {
    const m = routeMatcher('blog/*');
    expect(m('/blog/post')).toBe(true);
    expect(m('/blog/post/comments')).toBe(false);
  });

  it('exact match', () => {
    const m = routeMatcher('static');
    expect(m('/static')).toBe(true);
    expect(m('/static/a')).toBe(false);
  });

  it('a literal space in the glob matches a literal space, not a wildcard', () => {
    const m = routeMatcher('blog/my post');
    expect(m('/blog/my post')).toBe(true);
    expect(m('/blog/my-post')).toBe(false);
    expect(m('/blog/myXpost')).toBe(false);
  });

  it('accepts a glob written with a leading slash, as every printed route is', () => {
    // The documented example was `--route "/blog/**"`, which matched nothing and exited 0 —
    // a scoped CI run that checked no route at all.
    expect(routeMatcher('/blog/**')('/blog/hello')).toBe(true);
    expect(routeMatcher('/blog/**')('/about')).toBe(false);
    expect(routeMatcher('/')('/')).toBe(true);
    expect(routeMatcher('/**')('/anything/deep')).toBe(true);
  });
});
