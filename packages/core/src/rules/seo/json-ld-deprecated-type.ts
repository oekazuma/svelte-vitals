import { jsonldRule } from './jsonld-engine.js';
import { typeOf, DEPRECATED_TYPES } from './jsonld-engine.js';

export const seo017DeprecatedType = jsonldRule({
  id: 'seo/json-ld-deprecated-type',
  title: 'Deprecated structured-data type',
  severity: 'info',
  label: 'Structured-data type',
  recommendation:
    'Verify the rich-result status of this @type; Google dropped or restricted some (e.g. HowTo, FAQPage).',
  rationale: 'Some schema types no longer produce rich results, so the markup adds weight without the SERP benefit.',
  problem: (nodes) => {
    const dep = nodes.flatMap(typeOf).find((t) => DEPRECATED_TYPES.has(t));
    return dep ? `@type "${dep}" no longer reliably produces a Google rich result` : undefined;
  }
});
