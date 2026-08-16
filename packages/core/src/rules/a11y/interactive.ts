import { splitTokens } from '../../a11y.js';
import { resolveRole } from './aria-data.js';

/** One element attribute as seen by the a11y element-set checks below — the same
 *  literal/expression classification `component-parse.ts` uses elsewhere. */
export interface ElementAttr {
  name: string;
  literal?: string;
  expression?: boolean;
}

/** Tags that are always interactive, regardless of attributes. */
const ALWAYS_INTERACTIVE_TAGS = new Set(['button', 'select', 'textarea', 'summary', 'embed', 'iframe']);

/** WAI-ARIA roles with a native interaction model — a literal `role` matching one of these
 *  makes the element interactive even without an interactive host tag. */
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'slider',
  'spinbutton',
  'textbox',
  'combobox',
  'searchbox',
  'scrollbar',
  'gridcell'
]);

/**
 * Roles that genuinely break when another actionable element sits inside them: ARIA's
 * children-presentational set (a user agent does not expose their descendants at all), plus
 * `link`, which carries the same content-model restriction as `<a href>`.
 *
 * Deliberately NOT every interactive role. `gridcell` containing a button or a link is the
 * documented grid pattern, and the ARIA 1.1 combobox is a wrapper around its own input — both
 * were reported as nesting defects while being the recommended markup.
 */
const CONTAINER_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'slider',
  'scrollbar'
]);

function literalOf(attrs: ElementAttr[], name: string): string | undefined {
  return attrs.find((a) => a.name === name)?.literal;
}

/** Whether the role a user agent applies — the first token naming a concrete role, not merely the
 *  first token — is in `set`. `role="future-role button"` is a button. */
function hasRoleIn(attrs: ElementAttr[], set: ReadonlySet<string>): boolean {
  const role = resolveRole(splitTokens(literalOf(attrs, 'role')));
  return role !== undefined && set.has(role);
}

/**
 * Whether `tag` (with these attributes) is an interactive element per the shared a11y
 * element-set spec: `a` with `href`, `button`/`select`/`textarea`/`summary`/`embed`/`iframe`,
 * `input` with no `type` attribute or a literal `type` other than `hidden` (an expression
 * `type` is unknowable — could resolve to `hidden` — so it does not count), `audio`/`video`
 * with `controls`, a literal `tabindex` >= 0, or a literal interactive WAI-ARIA role.
 */
export function isInteractiveElement(tag: string, attrs: ElementAttr[]): boolean {
  if (ALWAYS_INTERACTIVE_TAGS.has(tag)) return true;
  if (tag === 'a' && literalOf(attrs, 'href') !== undefined) return true;
  if (tag === 'input') {
    const typeAttr = attrs.find((a) => a.name === 'type');
    // No type => the default type is 'text' => interactive. An expression type's rendered
    // value is unknowable (could be 'hidden'), so it is skipped rather than risk a false positive.
    if (!typeAttr) return true;
    if (typeAttr.literal !== undefined) return typeAttr.literal.toLowerCase() !== 'hidden';
    return false;
  }
  if ((tag === 'audio' || tag === 'video') && attrs.some((a) => a.name === 'controls')) return true;
  const tabindex = literalOf(attrs, 'tabindex')?.trim();
  // A blank tabindex is invalid HTML and ignored by browsers (Number('') would coerce to 0).
  if (tabindex) {
    const n = Number(tabindex);
    if (Number.isFinite(n) && n >= 0) return true;
  }
  return hasRoleIn(attrs, INTERACTIVE_ROLES);
}

/**
 * Whether `tag` opens a new "interactive container" for a11y/interactive-nesting's nesting
 * stack — a narrower set than `isInteractiveElement`: only `a`-with-`href`, `button`, and a
 * literal `CONTAINER_ROLES` role (an `<input>` or `tabindex` div is itself a valid nesting
 * target, but not a container).
 */
export function isInteractiveContainer(tag: string, attrs: ElementAttr[]): boolean {
  if (tag === 'button') return true;
  if (tag === 'a') return literalOf(attrs, 'href') !== undefined;
  return hasRoleIn(attrs, CONTAINER_ROLES);
}
