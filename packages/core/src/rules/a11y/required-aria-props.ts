import { componentRule } from '../component-rule.js';
import { requiredAriaProps, resolveRole } from './aria-data.js';
import type { AriaElementFact } from '../../component.js';
import { splitTokens } from '../../a11y.js';

/** ARIA-in-HTML host elements that supply a required prop's semantics natively, so the
 *  explicit `aria-*` attribute is redundant. Spec-fixed, not derived from aria-query. */
const HOST_SUPPLIED: Record<string, (e: AriaElementFact) => boolean> = {
  'aria-checked': (e) => e.tag === 'input' && (e.inputType === 'checkbox' || e.inputType === 'radio'),
  'aria-selected': (e) => e.tag === 'option',
  'aria-level': (e) => /^h[1-6]$/.test(e.tag),
  'aria-valuenow': (e) => (e.tag === 'input' && e.inputType === 'range') || e.tag === 'progress' || e.tag === 'meter',
  // HTML-AAM: `<select>` and `<input list>` are native comboboxes whose open/closed state and
  // popup relationship the user agent exposes itself, so an explicit `role="combobox"` on them owes
  // neither `aria-expanded` nor `aria-controls`. (The compiler warns on `<input list>` here; staying
  // silent is not the opposite verdict, and HTML-AAM is the source for the host's own semantics.)
  'aria-expanded': (e) => e.tag === 'select' || (e.tag === 'input' && e.hasList === true),
  'aria-controls': (e) => e.tag === 'select' || (e.tag === 'input' && e.hasList === true)
};

export const a11yRequiredAriaProps = componentRule({
  id: 'a11y/required-aria-props',
  title: 'Missing required ARIA props',
  category: 'a11y',
  label: 'Required ARIA props',
  rationale:
    'Some WAI-ARIA roles are unusable to assistive technology without their required state/property attributes — a role="checkbox" with no way to know checked/unchecked announces a control with no discoverable state.',
  recommendation:
    'Add the role’s required `aria-*` attribute(s), or rely on native host semantics that already supply them.',
  applies: (c) =>
    (c.ariaElements ?? []).some(
      (e) => e.role?.literal !== undefined && resolveRole(splitTokens(e.role.literal)) !== undefined
    ),
  bad: (c) =>
    (c.ariaElements ?? []).flatMap((e) => {
      // A spread may supply the required prop; its full attribute set is unknowable, so treat it as satisfied.
      if (e.hasSpread) return [];
      const literal = e.role?.literal;
      if (literal === undefined) return [];
      // The role a user agent applies, which for a fallback list is the first concrete token — the
      // same resolution `a11y/invalid-role` uses, so the two rules cannot read one value differently.
      const role = resolveRole(splitTokens(literal));
      if (role === undefined) return [];
      const required = requiredAriaProps(role);
      if (required.length === 0) return [];
      const present = new Set(e.aria.map((a) => a.name));
      const missing = required.filter((p) => !present.has(p) && !HOST_SUPPLIED[p]?.(e));
      if (missing.length === 0) return [];
      const named = role === literal ? `role="${literal}"` : `role="${literal}" (resolves to ${role})`;
      return [{ line: e.line, message: `${named} on <${e.tag}> is missing required ${missing.join(', ')}` }];
    })
});
