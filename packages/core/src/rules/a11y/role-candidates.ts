import { HTML_SPEC } from '../../html-spec/index.js';
import type { AriaElementFact } from '../../component.js';
import type { AriaRoleRow } from '../../html-spec/index.js';
import { resolveRole } from './aria-data.js';

/**
 * Element-level ARIA facts that override the dataset's, with the reason each is data judgment
 * rather than data (design 2026-08-19-aria-role-table-rules, "the spec wins over the dataset").
 * `<hgroup>` is `generic` + naming-prohibited in the dataset; html-aria (TR and editor's draft) and
 * axe give it `role=group` with no prohibition. Replacing the whole fact closes every arm at once.
 * `<address>` is already `group` in the dataset and only its naming flag is wrong.
 */
interface ElementFactOverrideTable {
  /** Keyed by tag name — looked up with the element's arbitrary tag string, so the contract is open. */
  [tag: string]: { implicitRole?: string; namingProhibited?: true };
}
const ELEMENT_FACT_OVERRIDES: ElementFactOverrideTable = {
  hgroup: { implicitRole: 'group' },
  address: { implicitRole: 'group' }
};

export interface RoleCandidates {
  /** `true` when a literal role resolved — the explicit path; the implicit path otherwise. */
  explicit: boolean;
  /**
   * Every role the element may have. On the explicit path, exactly one. On the implicit path, the
   * default and every condition outcome that names a role; `false` marks an outcome of "no
   * corresponding role", under which nothing about ownership is known.
   */
  roles: (string | false)[];
  /** The element's naming prohibition holds under the default and every outcome. */
  namingProhibited: boolean;
}

/**
 * The role(s) an `AriaElementFact` may have. Explicit first: a literal role's first concrete token
 * (`resolveRole`); an expression role, or a spread with no literal role, makes the role unknowable
 * and yields `undefined`. Otherwise the element's implicit role — never one role but the set of
 * candidates the dataset's conditional outcomes leave open, since the selectors that decide between
 * them are not evaluated (design 2026-08-19-aria-role-table-rules, "Which role an element has").
 */
export function roleCandidates(e: AriaElementFact): RoleCandidates | undefined {
  if (e.role?.expression) return undefined;
  if (e.role?.literal !== undefined) {
    const role = resolveRole(e.role.literal.trim().split(/\s+/));
    return role ? { explicit: true, roles: [role], namingProhibited: false } : undefined;
  }
  if (e.hasSpread) return undefined;
  // JSON.parse output and object literals inherit Object.prototype, and e.tag is an author-
  // controlled tag name (e.g. `constructor`) — an unguarded index would return Object's
  // function instead of undefined.
  const el = Object.hasOwn(HTML_SPEC.elements, e.tag) ? HTML_SPEC.elements[e.tag] : undefined;
  if (!el) return undefined;
  // An override replaces the element's ARIA facts wholesale — role, prohibition and conditions.
  const override = Object.hasOwn(ELEMENT_FACT_OVERRIDES, e.tag) ? ELEMENT_FACT_OVERRIDES[e.tag] : undefined;
  const aria: Pick<typeof el.aria, 'implicitRole' | 'namingProhibited' | 'conditions'> = override ?? el.aria;
  const roles: (string | false)[] = [aria.implicitRole ?? false];
  for (const c of Object.values(aria.conditions ?? {})) {
    if ('implicitRole' in c) roles.push(c.implicitRole ?? false);
  }
  // A condition can only add a prohibition (the dataset writes no `namingProhibited: false`), and an
  // outcome without the key inherits the default — so the flag holds under every outcome exactly
  // when the element carries it.
  return { explicit: false, roles: [...new Set(roles)], namingProhibited: aria.namingProhibited === true };
}

/** The role table row, or `undefined` for a role with none (DPUB-ARIA) and for "no corresponding role". */
export function roleRow(role: string | false): AriaRoleRow | undefined {
  return role === false ? undefined : HTML_SPEC.aria.roles[role];
}
