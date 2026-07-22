// Pure text measurement for SEO length rules. No node:, no deps.

// Reuse a single grapheme segmenter (constructing one per call is costly).
const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : undefined;

/**
 * Trim and collapse internal whitespace runs to a single space — the canonical
 * normalization for visible text. Shared so length (visibleLength) and uniqueness
 * (seo/duplicate-title, seo/duplicate-description) measure identical text the same way and never drift.
 */
export function collapseWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * Visible character count as a SERP would show it: trimmed, internal whitespace runs
 * collapsed, counted by grapheme cluster — so a ZWJ/flag/skin-tone emoji counts once,
 * matching what a user sees. Falls back to code-point counting where Intl.Segmenter is
 * unavailable (still collapses astral pairs into single code points).
 */
export function visibleLength(s: string): number {
  const collapsed = collapseWhitespace(s);
  if (!segmenter) return [...collapsed].length;
  return [...segmenter.segment(collapsed)].length;
}
