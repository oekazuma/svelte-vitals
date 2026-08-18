import { HTML_SPEC } from './generated.js';
import type { HtmlAttrSpec, HtmlElementSpec } from './types.js';

export type { HtmlAttrSpec, HtmlElementSpec, HtmlSpecData, AriaRoleRow } from './types.js';
export { HTML_SPEC, HTML_SPEC_VERSION } from './generated.js';

/**
 * The compiler already reports these two (`a11y_distracting_elements`), and the a11y review settled
 * that where compiler and rule overlap the compiler wins — reporting them again under a second id
 * is the contradiction class that decision exists to prevent.
 */
const COMPILER_REPORTED = new Set(['marquee', 'blink']);

/** The HTML element's spec row; `undefined` for SVG (`svg:*`) and unknown names. */
export function htmlElement(tag: string): HtmlElementSpec | undefined {
  return HTML_SPEC.elements[tag.toLowerCase()];
}

/**
 * Whether the element is in WHATWG's obsolete-features list — the dataset's `obsolete` flag, which
 * matches that section exactly (29 elements). No element carries the MDN-tracking `deprecated`
 * flag, so that column is not consulted here.
 */
export function isObsoleteElement(tag: string): boolean {
  const el = htmlElement(tag);
  return el?.obsolete === true && !COMPILER_REPORTED.has(tag.toLowerCase());
}

/**
 * The attribute's row from the element's own table. The `#globalAttrs` groups are deliberately not
 * consulted: they carry deprecations like `xlink:href` that would fire on every SVG icon sprite,
 * and the per-element table is where the dataset's per-attribute status lives.
 */
export function elementAttr(tag: string, name: string): HtmlAttrSpec | undefined {
  return htmlElement(tag)?.attributes[name.toLowerCase()];
}

/**
 * The dataset's `deprecated` (MDN-tracking) or `obsolete` (WHATWG) flag on this attribute for
 * this element. An attribute both `deprecated` and `nonStandard` (`hr[size]`) counts.
 */
export function isDeprecatedAttr(tag: string, name: string): boolean {
  const a = elementAttr(tag, name);
  return a?.deprecated === true || a?.obsolete === true;
}
