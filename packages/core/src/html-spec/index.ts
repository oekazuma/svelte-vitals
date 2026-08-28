import { HTML_SPEC } from './generated.js';
import type { HtmlAttrSpec, HtmlElementSpec } from './types.js';

export type { HtmlAttrSpec, HtmlElementSpec, HtmlSpecData, AriaRoleRow } from './types.js';
export { HTML_SPEC, HTML_SPEC_VERSION } from './generated.js';

/** The HTML element's spec row; `undefined` for SVG (`svg:*`) and unknown names. */
export function htmlElement(tag: string): HtmlElementSpec | undefined {
  const key = tag.toLowerCase();
  // JSON.parse output inherits Object.prototype, and `constructor` is a legal author tag —
  // an unguarded index would return Object's function instead of undefined.
  return Object.hasOwn(HTML_SPEC.elements, key) ? HTML_SPEC.elements[key] : undefined;
}

/**
 * Whether the element is in WHATWG's obsolete-features list — the dataset's `obsolete` flag, which
 * matches that section exactly. No element carries the MDN-tracking `deprecated` flag, so that
 * column is not consulted here. `<marquee>`/`<blink>` are included although the compiler also warns
 * on them: the a11y category's deliberate-overlap decision keeps scored rules that judge the same way
 * the compiler does, and excluding two of the 29 would blind the score to them while it counts
 * `<font>` (design 2026-08-19-aria-role-table-rules, "one reversal").
 */
export function isObsoleteElement(tag: string): boolean {
  return htmlElement(tag)?.obsolete === true;
}

/**
 * The attribute's row from the element's own table. The `#globalAttrs` groups are deliberately not
 * consulted: they carry deprecations like `xlink:href` that would fire on every SVG icon sprite,
 * and the per-element table is where the dataset's per-attribute status lives.
 */
export function elementAttr(tag: string, name: string): HtmlAttrSpec | undefined {
  const attrs = htmlElement(tag)?.attributes;
  if (!attrs) return undefined;
  const key = name.toLowerCase();
  // Same Object.prototype hazard as htmlElement, keyed by an author-controlled attribute name.
  return Object.hasOwn(attrs, key) ? attrs[key] : undefined;
}

/**
 * The dataset's `deprecated` (MDN-tracking) or `obsolete` (WHATWG) flag on this attribute for
 * this element. An attribute both `deprecated` and `nonStandard` (`hr[size]`) counts.
 */
export function isDeprecatedAttr(tag: string, name: string): boolean {
  const a = elementAttr(tag, name);
  return a?.deprecated === true || a?.obsolete === true;
}
