import { componentRule } from '../component-rule.js';
import { ariaValueKind } from './aria-data.js';

function isValid(type: string, values: string[] | undefined, literal: string): boolean {
  switch (type) {
    case 'boolean':
      return literal === 'true' || literal === 'false';
    case 'tristate':
      return literal === 'true' || literal === 'false' || literal === 'mixed';
    case 'token':
      return (values ?? []).includes(literal);
    case 'tokenlist':
      return literal
        .split(/\s+/)
        .filter(Boolean)
        .every((t) => (values ?? []).includes(t));
    case 'integer':
      return /^-?\d+$/.test(literal);
    case 'number':
      return Number.isFinite(Number(literal));
    default:
      // 'string' / 'id' / 'idlist', and any future aria-query type: no static check possible.
      return true;
  }
}

export const a11yInvalidAriaValue = componentRule({
  id: 'a11y/invalid-aria-value',
  title: 'Invalid ARIA attribute value',
  category: 'a11y',
  label: 'ARIA attribute values',
  rationale:
    'An `aria-*` attribute whose value does not match its spec-defined type (e.g. a boolean given a non-`true`/`false` literal) is misread or ignored by assistive technology.',
  recommendation: 'Use a value matching the attribute’s WAI-ARIA type — see the spec for allowed values.',
  applies: (c) => (c.ariaElements ?? []).some((e) => e.aria.some((a) => a.literal !== undefined)),
  bad: (c) =>
    (c.ariaElements ?? []).flatMap((e) =>
      e.aria.flatMap((a) => {
        if (a.literal === undefined) return [];
        const kind = ariaValueKind(a.name);
        if (kind === undefined) return [];
        if (isValid(kind.type, kind.values, a.literal)) return [];
        return [{ line: a.line, message: `\`${a.name}="${a.literal}"\` is not a valid ${kind.type} value` }];
      })
    )
});
