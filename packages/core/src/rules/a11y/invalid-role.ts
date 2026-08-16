import { componentRule } from '../component-rule.js';
import { isAbstractRole, isConcreteRole } from './aria-data.js';
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
      // A user agent resolves the role attribute to the first token naming a concrete role, so a
      // list whose later tokens are unknown is the spec's own progressive-enhancement form, not a
      // defect. Only a list that resolves to nothing leaves the element without the semantics its
      // author asked for.
      if (tokens.length === 0 || tokens.some(isConcreteRole)) return [];
      const message =
        tokens.length === 1
          ? `role="${literal}" on <${e.tag}> is ${isAbstractRole(tokens[0]!) ? 'an abstract role' : 'not a WAI-ARIA role'}`
          : `no token in role="${literal}" on <${e.tag}> names a concrete WAI-ARIA role`;
      return [{ line: e.line, message }];
    })
});
