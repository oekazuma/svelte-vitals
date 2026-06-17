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
});
