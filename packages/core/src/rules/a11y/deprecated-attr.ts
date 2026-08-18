import { componentRule } from '../component-rule.js';
import { htmlElement, isDeprecatedAttr } from '../../html-spec/index.js';

export const a11yDeprecatedAttr = componentRule({
  id: 'a11y/deprecated-attr',
  title: 'Deprecated HTML attribute',
  category: 'a11y',
  // `info`, as for deprecated-element: the attribute may still work today; the finding is that the
  // spec no longer defines what it means, and a CSS or modern-attribute replacement exists.
  severity: 'info',
  label: 'Deprecated attributes',
  rationale:
    "An attribute the HTML spec data marks deprecated (`iframe[frameborder]`, `td[width]`, `body[bgcolor]`, …) has its behavior defined by legacy browser compatibility rather than by the standard, and each has a CSS or modern-attribute replacement. Coverage is what the dataset records as deprecated, which tracks MDN's status; WHATWG-obsolete attributes MDN never documented (`p[align]`) are not reported.",
  recommendation: 'Move the presentation to CSS, or use the modern attribute the deprecated one was superseded by.',
  // Every attributed HTML element is judged, so a clean component passes rather than going unrecorded.
  applies: (c) => (c.elements ?? []).some((e) => !e.inSvg && e.attrs.length > 0),
  bad: (c) =>
    (c.elements ?? [])
      // Attributes on an obsolete element are that element's finding (a11y/deprecated-element),
      // and stay that way even when that rule is off or suppressed — this is a data-level skip,
      // not a view of the other rule's result.
      .filter((e) => !e.inSvg && !htmlElement(e.tag)?.obsolete)
      .flatMap((e) => {
        const names = e.attrs.filter((a) => isDeprecatedAttr(e.tag, a.name)).map((a) => a.name);
        if (names.length === 0) return [];
        // One finding per element, anchored at the element's line: a `disable-next-line` directive
        // can only sit above the start tag, so an attribute-line anchor on a multi-line element
        // would leave a documented lever with no position that works.
        const list = names.map((n) => `\`${n}\``).join(', ');
        return [
          {
            line: e.line,
            message: `${list} on <${e.tag}> ${names.length === 1 ? 'is a deprecated attribute' : 'are deprecated attributes'}`
          }
        ];
      })
});
