import type { ComponentFacts, ElementFact } from '../../component.js';
import { componentRule } from '../component-rule.js';

const NAMING_ATTRS = new Set(['title', 'aria-label', 'aria-labelledby']);

/**
 * The iframe arm reads the generic elements channel rather than the collector's
 * `unnamedInteractive` facts: an iframe has no name-from-content step (its children are fallback
 * content, never rendered), so the subtree scan the other targets need does not apply — and the
 * channel already carries the SVG-namespace flag (SVG has no iframe; the element never renders)
 * and the spread guard. Hidden or presentational iframes are skipped — `aria-hidden="true"`,
 * `hidden`, `role="presentation"`/`"none"` — the tracking/analytics-frame class where a name
 * helps nobody; an expression value in any of the skip attributes (and `hidden` in any form,
 * bare included) resolves unknowable → silence, this rule's convention throughout. The skip set
 * is deliberate to this arm only: a hidden focusable button is a different defect.
 */
function unnamedIframes(c: ComponentFacts): ElementFact[] {
  return (c.elements ?? []).filter((e) => {
    if (e.tag !== 'iframe' || e.inSvg || e.hasSpread) return false;
    if (e.attrs.some((a) => NAMING_ATTRS.has(a.name) && (a.value === undefined || a.value.trim() !== ''))) {
      return false;
    }
    const attr = (name: string) => e.attrs.find((a) => a.name === name);
    const ariaHidden = attr('aria-hidden');
    if (ariaHidden && (ariaHidden.value === undefined || ariaHidden.value.trim().toLowerCase() === 'true')) {
      return false;
    }
    if (attr('hidden')) return false;
    const role = attr('role');
    if (role && (role.value === undefined || ['presentation', 'none'].includes(role.value.trim().toLowerCase()))) {
      return false;
    }
    return true;
  });
}

export const a11yAccessibleName = componentRule({
  id: 'a11y/accessible-name',
  title: 'Interactive element has no accessible name',
  category: 'a11y',
  label: 'Accessible names',
  rationale:
    'A button, link, or image button with no accessible name is announced by assistive technology as its bare role ("button", "link") with nothing to distinguish it from any other control on the page; an iframe without one is announced as an unnamed frame, with no way to tell an embedded video from an ad slot before entering it.',
  recommendation:
    'Give the element visible text or an aria-label/aria-labelledby; a button or link whose only content is an icon image is named by that image\'s alt, an <input type="image"> by its own alt, and an <iframe> by its title.',
  applies: (c) => (c.unnamedInteractive ?? []).length > 0 || unnamedIframes(c).length > 0,
  bad: (c) => [
    ...(c.unnamedInteractive ?? []).map((f) => ({ line: f.line, message: `<${f.tag}> has no accessible name` })),
    ...unnamedIframes(c).map((e) => ({ line: e.line, message: '<iframe> has no accessible name' }))
  ]
});
