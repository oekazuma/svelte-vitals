import { componentRule } from '../component-rule.js';

/**
 * a11y/no-accesskey — unlike most attribute rules, an expression-valued `accesskey` is reported
 * too: the attribute's presence is the problem and its value never matters, so there is nothing
 * unknowable about it. A spread-only carrier stays silent (the attribute never reaches `attrs`).
 * SVG elements are judged along with HTML — `accesskey` is meaningless there, which makes its
 * presence wrong in both namespaces.
 */
export const a11yNoAccesskey = componentRule({
  id: 'a11y/no-accesskey',
  title: 'Accesskey attribute',
  category: 'a11y',
  severity: 'warning',
  label: 'Accesskey attributes',
  recommendation:
    'Remove the accesskey attribute. Provide visible, focusable controls instead; if a real keyboard shortcut is needed, implement it with a key handler and document it in the page.',
  rationale:
    'The accesskey attribute assigns a page-level shortcut key, but the actual key combination varies by browser and OS, is undiscoverable to users, and routinely conflicts with screen reader and browser keyboard bindings. Long-standing accessibility guidance is to not use it.',
  fix: {
    description: 'Remove the accesskey attribute.'
  },
  applies: (c) => (c.elements ?? []).some((e) => e.attrs.some((a) => a.name === 'accesskey')),
  bad: (c) =>
    (c.elements ?? [])
      .filter((e) => e.attrs.some((a) => a.name === 'accesskey'))
      .map((e) => ({
        line: e.line,
        message: `accesskey on <${e.tag}> — the shortcut key varies by browser and OS, is undiscoverable, and conflicts with assistive-technology bindings`
      }))
});
