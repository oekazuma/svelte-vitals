import { componentRule } from '../component-rule.js';
import { requiredAriaProps } from './aria-data.js';
import type { AriaElementFact } from '../../component.js';

/** ARIA-in-HTML host elements that supply a required prop's semantics natively, so the
 *  explicit `aria-*` attribute is redundant. Spec-fixed, not derived from aria-query. */
const HOST_SUPPLIED: Record<string, (e: AriaElementFact) => boolean> = {
  'aria-checked': (e) => e.tag === 'input' && (e.inputType === 'checkbox' || e.inputType === 'radio'),
  'aria-selected': (e) => e.tag === 'option',
  'aria-level': (e) => /^h[1-6]$/.test(e.tag),
  'aria-valuenow': (e) => (e.tag === 'input' && e.inputType === 'range') || e.tag === 'progress' || e.tag === 'meter'
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
  applies: (c) => (c.ariaElements ?? []).some((e) => e.role?.literal !== undefined && !e.role.literal.includes(' ')),
  bad: (c) =>
    (c.ariaElements ?? []).flatMap((e) => {
      const literal = e.role?.literal;
      if (literal === undefined || literal.includes(' ')) return [];
      const required = requiredAriaProps(literal);
      if (required.length === 0) return [];
      const present = new Set(e.aria.map((a) => a.name));
      const missing = required.filter((p) => !present.has(p) && !HOST_SUPPLIED[p]?.(e));
      if (missing.length === 0) return [];
      return [{ line: e.line, message: `role="${literal}" on <${e.tag}> is missing required ${missing.join(', ')}` }];
    })
});
