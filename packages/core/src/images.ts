/**
 * A normalized <img> occurrence — the mode-independent boundary for Performance
 * rules (mirrors head.ts). Attribute presence only: a dynamically-bound attribute
 * (width={w}) still counts as present, so dynamic values are never flagged.
 */
export interface ImageInfo {
  hasWidth: boolean;
  hasHeight: boolean;
  hasLoading: boolean;
  /** True when the <img> has an `alt` attribute at all (incl. empty `alt=""` decorative; seo/image-alt). */
  hasAlt: boolean;
  /** True when the <img> has a literal `loading="lazy"` (performance/lcp-image). Dynamic/spread → false. */
  lazy: boolean;
  /** True when the <img> has a `srcset` attribute (performance/responsive-image). */
  hasSrcset: boolean;
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
