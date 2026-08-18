import { componentRule } from '../component-rule.js';
import { isObsoleteElement } from '../../html-spec/index.js';

export const a11yDeprecatedElement = componentRule({
  id: 'a11y/deprecated-element',
  title: 'Obsolete HTML element',
  category: 'a11y',
  // `info`: the element still renders and browsers keep it working; the cost is that assistive
  // technology and future browsers get no guarantee of its semantics. Severity tracks the evidence.
  severity: 'info',
  label: 'Obsolete elements',
  rationale:
    "Elements in the HTML standard's obsolete-features list (`<center>`, `<font>`, `<strike>`, …) are non-conforming: browsers keep rendering them for legacy pages, but their semantics are unspecified for assistive technology and each has a conforming replacement.",
  recommendation:
    'Replace the element with its conforming equivalent — `<s>` for `<strike>`, `<span>` plus CSS for `<font>`/`<center>`, `<b>`/`<strong>` for `<big>` — and move presentation to CSS.',
  // Every HTML element is judged, so a component with none obsolete passes rather than going unrecorded.
  applies: (c) => (c.elements ?? []).some((e) => !e.inSvg),
  bad: (c) =>
    (c.elements ?? [])
      .filter((e) => !e.inSvg && isObsoleteElement(e.tag))
      .map((e) => ({ line: e.line, message: `<${e.tag}> is an obsolete element` }))
});
