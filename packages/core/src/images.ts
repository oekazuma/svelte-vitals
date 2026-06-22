/**
 * A normalized <img> occurrence — the mode-independent boundary for Performance
 * rules (mirrors head.ts). Attribute presence only: a dynamically-bound attribute
 * (width={w}) still counts as present, so dynamic values are never flagged.
 */
export interface ImageInfo {
  hasWidth: boolean;
  hasHeight: boolean;
  hasLoading: boolean;
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /** Source file the <img> came from. */
  file: string;
}

/** Resolved <img> elements for a single route (page + layout chain). */
export interface ResolvedImages {
  route: string;
  images: ImageInfo[];
}
