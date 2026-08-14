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

function hasAttr(attrs: ElementAttr[], name: string): boolean {
  return attrs.some((a) => a.name === name);
}

function literalOf(attrs: ElementAttr[], name: string): string | undefined {
  return attrs.find((a) => a.name === name)?.literal;
}

/** Whether a literal `role` attribute's first fallback token is one of `INTERACTIVE_ROLES` —
 *  the first token is the one a browser/AT actually applies when the rest are unsupported. */
function hasInteractiveRole(attrs: ElementAttr[]): boolean {
  const role = literalOf(attrs, 'role')?.trim().split(/\s+/)[0];
  return role !== undefined && INTERACTIVE_ROLES.has(role);
}

/**
 * Whether `tag` (with these attributes) is an interactive element per the shared a11y
 * element-set spec: `a` with `href`, `button`/`select`/`textarea`/`summary`/`embed`/`iframe`,
 * `input` unless its literal `type` is `hidden`, `audio`/`video` with `controls`, a literal
 * `tabindex` >= 0, or a literal interactive WAI-ARIA role.
 */
export function isInteractiveElement(tag: string, attrs: ElementAttr[]): boolean {
  if (ALWAYS_INTERACTIVE_TAGS.has(tag)) return true;
  if (tag === 'a' && literalOf(attrs, 'href') !== undefined) return true;
  if (tag === 'input' && literalOf(attrs, 'type')?.toLowerCase() !== 'hidden') return true;
  if ((tag === 'audio' || tag === 'video') && hasAttr(attrs, 'controls')) return true;
  const tabindex = literalOf(attrs, 'tabindex');
  if (tabindex !== undefined) {
    const n = Number(tabindex);
    if (Number.isFinite(n) && n >= 0) return true;
  }
  return hasInteractiveRole(attrs);
}

/**
 * Whether `tag` opens a new "interactive container" for a11y/interactive-nesting's nesting
 * stack — a narrower set than `isInteractiveElement`: only `a`-with-`href`, `button`, and a
 * literal interactive role are containers whose interaction model genuinely breaks when
 * another actionable element sits inside them (an `<input>` or `tabindex` div is itself a
 * valid nesting target, but not a container).
 */
export function isInteractiveContainer(tag: string, attrs: ElementAttr[]): boolean {
  if (tag === 'button') return true;
  if (tag === 'a') return literalOf(attrs, 'href') !== undefined;
  return hasInteractiveRole(attrs);
}
