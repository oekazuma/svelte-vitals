export const STICKY_COMMENT_MARKER = '<!-- svelte-vitals-report -->';

export interface ExistingComment {
  id: number;
  body: string | null | undefined;
}

export type StickyCommentPlan = { op: 'update'; id: number } | { op: 'create' };

/**
 * Decide whether to update a previous svelte-vitals report comment or create a new
 * one — keyed by a marker so repeated runs update the same comment instead of piling
 * up new ones (ported from the inline `github-script` template it replaces).
 */
export function planStickyComment(existing: ExistingComment[]): StickyCommentPlan {
  const mine = existing.find((c) => c.body?.startsWith(STICKY_COMMENT_MARKER));
  return mine ? { op: 'update', id: mine.id } : { op: 'create' };
}
