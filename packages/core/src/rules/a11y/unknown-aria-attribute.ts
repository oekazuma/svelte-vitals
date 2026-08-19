import { componentRule } from '../component-rule.js';
import { isKnownAriaAttribute } from './aria-data.js';

export const a11yUnknownAriaAttribute = componentRule({
  id: 'a11y/unknown-aria-attribute',
  title: 'Unknown ARIA attribute',
  category: 'a11y',
  label: 'Known ARIA attributes',
  rationale:
    'An `aria-*` name that does not exist in WAI-ARIA is not recognized by assistive technology, so the attribute is silently ignored instead of doing what the author intended.',
  recommendation: 'Use a spec-defined `aria-*` attribute; unknown names are ignored by assistive technology.',
  applies: (c) => (c.ariaElements ?? []).some((e) => e.aria.length > 0),
  // Anchored at the element's start tag, not the attribute's line: a `disable-next-line` directive
  // can only sit above the tag, so an attribute-line anchor on a multi-line element would leave the
  // documented lever with no position that works.
  bad: (c) =>
    (c.ariaElements ?? []).flatMap((e) =>
      e.aria
        .filter((a) => !isKnownAriaAttribute(a.name))
        .map((a) => ({ line: e.line, message: `\`${a.name}\` is not a WAI-ARIA attribute` }))
    )
});
