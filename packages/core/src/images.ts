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
  /** True when the <img>, or a `<source>` of its `<picture>`, has a `srcset` attribute (performance/responsive-image). */
  hasSrcset: boolean;
  /** True when the <img>'s src is known to be an SVG (`isSvgSrc`; performance/responsive-image). */
  svg?: boolean;
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /** Source file the <img> came from. */
  file: string;
}

/** A `.svg` path (query and fragment ignored) or an inline `data:image/svg+xml` URI. */
export function isSvgSrc(src: string): boolean {
  return /^data:image\/svg\+xml[;,]/i.test(src) || /\.svg$/i.test(src.split(/[?#]/, 1)[0]!);
}

/** Resolved <img> elements for a single route (page + layout chain). */
export interface ResolvedImages {
  route: string;
  images: ImageInfo[];
}
