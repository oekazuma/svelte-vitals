import { describe, it, expect } from 'vitest';
import { planStickyComment, STICKY_COMMENT_MARKER } from '../src/sticky-comment.js';

describe('planStickyComment', () => {
  it('creates when there is no existing marked comment', () => {
    expect(planStickyComment([{ id: 1, body: 'unrelated comment' }])).toEqual({ op: 'create' });
  });

  it('creates when the comment list is empty', () => {
    expect(planStickyComment([])).toEqual({ op: 'create' });
  });

  it('updates the existing marked comment, ignoring others', () => {
    const out = planStickyComment([
      { id: 1, body: 'unrelated comment' },
      { id: 2, body: `${STICKY_COMMENT_MARKER}\nold report` },
      { id: 3, body: 'another unrelated comment' }
    ]);
    expect(out).toEqual({ op: 'update', id: 2 });
  });

  it('treats a null body as no match (never throws)', () => {
    expect(planStickyComment([{ id: 1, body: null }])).toEqual({ op: 'create' });
  });
});
