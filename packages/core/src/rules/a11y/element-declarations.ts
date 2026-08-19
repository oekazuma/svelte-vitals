import type { RuleOptionSpec } from '../../rule-options.js';

/**
 * The declaration grammar the two config-driven element rules share: a bare tag name, lowercased at
 * read. Reserved at config load rather than left open — a `string-list` would otherwise accept
 * `'input[type=file]'` as a name that matches nothing, and giving that string meaning later would
 * reinterpret a value the frozen schema already took (design 2026-08-19-config-driven-element-rules,
 * decision 2). Custom-element names (`my-widget`) are in the grammar; selector characters are not.
 */
export const ELEMENTS_OPTION: RuleOptionSpec = {
  kind: 'string-list',
  default: [],
  pattern: {
    regex: /^[a-z][a-z0-9-]*$/i,
    describe: 'a bare tag name (letters, digits and hyphens; no selector syntax)'
  }
};
