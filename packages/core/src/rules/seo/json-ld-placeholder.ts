import { jsonldRule } from './jsonld-engine.js';
import { nodeStringValues, hasPlaceholder } from './jsonld-engine.js';

export const seo020Placeholder = jsonldRule({
  id: 'seo/json-ld-placeholder',
  title: 'JSON-LD placeholder text',
  severity: 'info',
  label: 'JSON-LD content',
  recommendation: 'Replace placeholder/boilerplate text in JSON-LD with real values.',
  rationale: 'Leftover placeholder text (e.g. "Your Company Name", "lorem ipsum") ships misleading structured data.',
  problem: (nodes) => {
    const bad = nodes.flatMap(nodeStringValues).find(hasPlaceholder);
    return bad ? `Placeholder text in JSON-LD: "${bad}"` : undefined;
  }
});
