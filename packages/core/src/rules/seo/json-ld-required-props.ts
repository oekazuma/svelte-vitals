import { jsonldRule } from './jsonld-engine.js';
import { typeOf, hasNonEmpty, REQUIRED_PROPS } from './jsonld-engine.js';

export const seo021RequiredProps = jsonldRule({
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
        const required = REQUIRED_PROPS[t];
        if (!required) continue; // unknown/custom type → not flagged
        hasKnownType = true;
        const missing = required.filter((p) => !hasNonEmpty(node, p));
        if (missing.length > 0) return `${t} JSON-LD is missing required ${missing.join(', ')}`;
      }
    }
    // No known types found → no signal (rule is not applicable)
    return hasKnownType ? undefined : false;
  }
});
