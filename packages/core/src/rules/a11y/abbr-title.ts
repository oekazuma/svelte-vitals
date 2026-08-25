import type { ComponentFacts, ElementFact } from '../../component.js';
import { componentRule } from '../component-rule.js';

/**
 * a11y/abbr-title — a best-practice nudge, not a conformance check: the spec makes `title` on
 * `<abbr>` optional, and an expansion given in the surrounding prose is correct markup this
 * rule cannot see (the known false-positive class; the docs page names the inline-suppression
 * escape hatch for it). A blank literal `title=""` gives no expansion and is reported; an
 * expression value is unknowable and passes, the same predicate as a11y/accessible-name's
 * iframe check. SVG is skipped — `<abbr>` is not an SVG element.
 */
function untitledAbbrs(c: ComponentFacts): ElementFact[] {
  return (c.elements ?? []).filter(
    (e) =>
      e.tag === 'abbr' &&
      !e.inSvg &&
      !e.hasSpread &&
      !e.attrs.some((a) => a.name === 'title' && (a.value === undefined || a.value.trim() !== ''))
  );
}

export const a11yAbbrTitle = componentRule({
  id: 'a11y/abbr-title',
  title: 'Abbreviation without an expansion',
  category: 'a11y',
  severity: 'info',
  label: 'Abbreviation expansions',
  rationale:
    '<abbr> marks an abbreviation, but without a title giving the expansion the element adds no information — visual users get no tooltip and assistive technology has nothing to expand. The spec keeps title optional (an expansion in the surrounding text is also fine), so this is a nudge toward the common case, not a conformance requirement.',
  recommendation:
    'Add title with the expansion, or spell the term out in full at first use instead of using <abbr>. If the expansion is already given in the surrounding text, the markup is fine as written — silence the finding instead.',
  fix: {
    description: 'Add a title attribute with the expansion, or spell the term out at first use.',
    snippet: '<abbr title="HyperText Markup Language">HTML</abbr>',
    lang: 'svelte'
  },
  applies: (c) => untitledAbbrs(c).length > 0,
  bad: (c) =>
    untitledAbbrs(c).map((e) => ({
      line: e.line,
      message: '<abbr> without a title gives readers no expansion of the abbreviation'
    }))
});
