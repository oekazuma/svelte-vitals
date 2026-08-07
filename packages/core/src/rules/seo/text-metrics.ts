// Pure text measurement for SEO length rules. No node:, no deps.

// Reuse a single grapheme segmenter (constructing one per call is costly).
const segmenter = new Intl.Segmenter();

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
 * matching what a user sees.
 */
export function visibleLength(s: string): number {
  return [...segmenter.segment(collapseWhitespace(s))].length;
}
