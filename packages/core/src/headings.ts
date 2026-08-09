/**
 * A normalized page-body heading occurrence — the mode-independent boundary for
 * the heading-hierarchy rule (mirrors images.ts). Both providers collect these
 * so seo/single-h1 never needs to know which mode produced them.
 */
export interface HeadingInfo {
  /** Heading level 1–6 (the `n` in <hn>). */
  level: number;
  /** 1-based source line, or 0 if unknown (rendered mode does not track lines). */
  line: number;
  /** Source file the heading came from. */
  file: string;
}

/** Resolved page-body headings for a single route (page + layout chain). */
export interface ResolvedHeadings {
  route: string;
  headings: HeadingInfo[];
  /**
   * Headings found in child components rendered (transitively) by this route's
   * chain files — source mode only; absent in rendered mode. Kept separate from
   * `headings` because their position in document order is unknown: safe for
   * counting (seo/single-h1), unusable for outline order (seo/heading-level-skip).
   */
  componentHeadings?: HeadingInfo[];
}
