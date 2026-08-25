import type { ComponentFacts, ElementFact } from '../../component.js';
import { componentRule } from '../component-rule.js';

/**
 * `<dialog>` and popover containers run their focusing steps on show, not on page load, and both
 * honour an `autofocus` descendant — so autofocus there is the correct tool, not focus theft.
 * The popover check accepts the attribute in any form (bare, literal, expression): an expression
 * could resolve to a real popover value, and a generous carve-out trades a false negative for
 * never flagging the documented pattern (same trade as correctness/autoplay-muted's `muted`).
 * Neither container form counts in the SVG namespace — the focusing steps are defined for the
 * HTML `dialog` element and HTML elements with a `popover` attribute only; a `<dialog>` inside
 * `<foreignObject>` is back in HTML and still counts.
 */
function inShowTimeContainer(elements: ElementFact[], start: ElementFact): boolean {
  let e: ElementFact | undefined = start;
  while (e !== undefined) {
    if (!e.inSvg && (e.tag === 'dialog' || e.attrs.some((a) => a.name === 'popover'))) return true;
    e = e.parent === undefined ? undefined : elements[e.parent];
  }
  return false;
}

/**
 * a11y/no-autofocus — only a literal `autofocus` counts (a bare boolean attribute parses to
 * `value: ''`); an expression value could be `false` and passes as unknowable. The ancestor walk
 * uses `ElementFact.parent`, which looks through logic blocks but breaks at every non-lexical
 * construct (a component, `{#snippet}` body, `<svelte:element>`, custom element, `{@html}`,
 * `{@render}`, `<slot>`) — past a break the dialog cannot be proven, so the element is reported;
 * the docs page's Limitations section names these classes and the inline-suppression escape
 * hatch. SVG elements are judged along with HTML: SVG2 honours `autofocus` with the same
 * page-load focus semantics.
 */
export const a11yNoAutofocus = componentRule({
  id: 'a11y/no-autofocus',
  title: 'Autofocus outside a dialog',
  category: 'a11y',
  severity: 'warning',
  label: 'Autofocus placement',
  recommendation:
    'Remove the autofocus attribute and let focus start at the top of the page, or move the control into the <dialog> or popover it belongs to; focus moved in response to a user action belongs in an event handler.',
  rationale:
    'autofocus moves focus on page load without the user asking, skipping everything before the target — screen reader users lose the page context they were building, and keyboard users are dropped mid-page. Inside a <dialog> or a popover it is the correct tool (their focusing steps run on show, not on load); anywhere else it is almost always a usability bug.',
  fix: {
    description:
      'Remove the autofocus attribute, or move the element inside the <dialog>/popover container it is meant to focus.'
  },
  applies: (c) => literalAutofocusElements(c).length > 0,
  bad: (c) => {
    const elements = c.elements ?? [];
    return literalAutofocusElements(c)
      .filter((e) => !inShowTimeContainer(elements, e))
      .map((e) => ({
        line: e.line,
        message: `autofocus on <${e.tag}> steals focus when the page loads — keyboard and screen reader users lose their place`
      }));
  }
});

function literalAutofocusElements(c: ComponentFacts): ElementFact[] {
  return (c.elements ?? []).filter((e) => e.attrs.some((a) => a.name === 'autofocus' && a.value !== undefined));
}
