import { roles, aria } from 'aria-query';

/**
 * ARIA names `aria-query@5.3.2` does not carry. It is not the clean ARIA 1.2 snapshot it looks
 * like — it holds 1.2's 48 attributes plus three 1.3 additions — so the gap is patched by name
 * rather than by version. Every entry here is defined in the ARIA 1.3 editor's draft, which is
 * what makes reporting it as an unknown name wrong — how far implementations have got is a
 * separate question this rule does not ask. Re-check this list whenever the aria-query dependency
 * moves.
 */
const ARIA_1_3_ROLES = new Set(['comment', 'image', 'sectionheader', 'sectionfooter', 'suggestion']);
const ARIA_1_3_ATTRIBUTES = new Set(['aria-colindextext', 'aria-rowindextext']);

/**
 * Roles whose `requiredProps` row in aria-query is stale. Neither ARIA 1.2 nor the 1.3 editor's
 * draft lists required states or properties for these — the 1.3 draft re-lists inherited
 * requirements where they apply (`menuitemradio` → `aria-checked`), so the absence is deliberate
 * rather than an inheritance the table left implicit. Without this, idiomatic APG listbox and
 * tree markup is flagged.
 */
const NO_REQUIRED_PROPS = new Set(['option', 'treeitem']);

export function isKnownRole(role: string): boolean {
  return ARIA_1_3_ROLES.has(role) || roles.has(role as Parameters<typeof roles.has>[0]);
}

export function isAbstractRole(role: string): boolean {
  return roles.get(role as Parameters<typeof roles.get>[0])?.abstract === true;
}

/** A concrete (non-abstract) role is the one a user agent resolves a role token list to. */
export function isConcreteRole(role: string): boolean {
  return isKnownRole(role) && !isAbstractRole(role);
}

/**
 * The role a user agent applies: the first token naming a concrete role, or undefined when none
 * does. Shared so the role rules cannot disagree about what a fallback list means.
 */
export function resolveRole(tokens: readonly string[]): string | undefined {
  return tokens.find(isConcreteRole);
}

export function isKnownAriaAttribute(name: string): boolean {
  return ARIA_1_3_ATTRIBUTES.has(name) || aria.has(name as Parameters<typeof aria.has>[0]);
}

export function requiredAriaProps(role: string): string[] {
  if (NO_REQUIRED_PROPS.has(role)) return [];
  const def = roles.get(role as Parameters<typeof roles.get>[0]);
  return def ? Object.keys(def.requiredProps) : [];
}

export function ariaValueKind(name: string): { type: string; values?: string[] } | undefined {
  const def = aria.get(name as Parameters<typeof aria.get>[0]);
  if (!def) return undefined;
  return { type: def.type, ...(def.values ? { values: def.values.map(String) } : {}) };
}
