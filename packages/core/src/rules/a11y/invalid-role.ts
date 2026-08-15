import { componentRule } from '../component-rule.js';
import { isKnownRole, isAbstractRole } from './aria-data.js';
import { splitTokens } from '../../a11y.js';

export const a11yInvalidRole = componentRule({
  id: 'a11y/invalid-role',
  title: 'Invalid ARIA role',
  category: 'a11y',
  label: 'ARIA roles',
  rationale:
    'A role that does not exist in WAI-ARIA (or is abstract, reserved for the spec itself) is ignored or misread by assistive technology, silently breaking the element’s announced semantics.',
  recommendation: 'Use a concrete WAI-ARIA role; abstract roles and typos are ignored by assistive technology.',
  applies: (c) => (c.ariaElements ?? []).some((e) => e.role?.literal !== undefined),
  bad: (c) =>
    (c.ariaElements ?? []).flatMap((e) => {
      const literal = e.role?.literal;
      if (literal === undefined) return [];
      const tokens = splitTokens(literal);
      const badTokens = tokens.filter((t) => !isKnownRole(t) || isAbstractRole(t));
      if (badTokens.length === 0) return [];
      return [
        {
          line: e.line,
          message: `role="${literal}" on <${e.tag}> is ${isAbstractRole(badTokens[0]!) ? 'an abstract role' : 'not a WAI-ARIA role'}`
        }
      ];
    })
});
