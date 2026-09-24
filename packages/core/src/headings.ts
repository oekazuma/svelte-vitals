import type { BranchStep } from './a11y.js';

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
  /**
   * The `{#if}`/`{#await}` arms of its own file it sits in (source mode; absent when unconditional).
   * Group numbers are per file, so only headings of one file can be exclusive.
   */
  path?: BranchStep[];
}

/** Two headings can never render together: different arms of one block in the same file. */
export function exclusiveHeadings(a: HeadingInfo, b: HeadingInfo): boolean {
  if (a.file !== b.file || !a.path || !b.path) return false;
  return a.path.some((s) => b.path!.some((t) => s.group === t.group && s.branch !== t.branch));
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
  /**
   * This route may render a heading whose level is not statically determinable: a
   * `<svelte:element>` (`this={`h${n}`}`, an identifier, …), or a component that cannot be
   * followed but is given a literal `h1` element prop (`<Heading tag="h1">`) — source mode only.
   * Counting stays as-is; only the "no <h1> anywhere" claim becomes unsafe to make.
   */
  dynamicHeading?: boolean;
}
