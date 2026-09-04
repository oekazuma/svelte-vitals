import { jsonldRule } from './jsonld-engine.js';
import { typeOf, missingRequiredProps, REQUIRED_PROPS } from './jsonld-engine.js';

export const seoJsonLdRequiredProps = jsonldRule({
  id: 'seo/json-ld-required-props',
  title: 'JSON-LD required properties',
  severity: 'warning',
  label: 'JSON-LD required properties',
  recommendation: "Add the properties Google requires for this @type's rich result.",
  rationale: 'A recognized @type missing its required properties is ineligible for the corresponding rich result.',
  problem: (nodes) => {
    let hasKnownType = false;
    for (const node of nodes) {
      for (const t of typeOf(node)) {
        // `t` is the page's own @type string; an unguarded index would return Object.prototype members
        // for names like `constructor` and crash the whole rule (a crashed rule drops out of scoring).
        const required = Object.hasOwn(REQUIRED_PROPS, t) ? REQUIRED_PROPS[t] : undefined;
        if (!required) continue; // unknown/custom type, or a type Google requires nothing from → not flagged
        hasKnownType = true;
        const missing = missingRequiredProps(node, required);
        if (missing.length > 0) return `${t} JSON-LD is missing required ${missing.join(', ')}`;
      }
    }
    // No known types found → no signal (rule is not applicable)
    return hasKnownType ? undefined : false;
  }
});
