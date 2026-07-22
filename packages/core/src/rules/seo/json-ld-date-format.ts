import { jsonldRule } from './jsonld-engine.js';
import { collectValues, isIso8601, DATE_KEYS } from './jsonld-engine.js';

export const seoJsonLdDateFormat = jsonldRule({
  id: 'seo/json-ld-date-format',
  title: 'JSON-LD date format',
  severity: 'info',
  label: 'JSON-LD dates',
  recommendation: 'Use ISO-8601 dates (e.g. 2026-06-26 or 2026-06-26T10:00:00Z) in JSON-LD.',
  rationale: 'Schema.org date properties expect ISO-8601; other formats may be ignored or misparsed.',
  fix: {
    description: 'Format JSON-LD date properties as ISO-8601.',
    snippet: '"datePublished": "2026-06-26"',
    lang: 'json'
  },
  problem: (nodes) => {
    const bad = collectValues(nodes, DATE_KEYS).find((v) => !isIso8601(v));
    return bad ? `Non-ISO-8601 date in JSON-LD: "${bad}"` : undefined;
  }
});
