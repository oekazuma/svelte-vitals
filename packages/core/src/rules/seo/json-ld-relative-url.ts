import { jsonldRule } from './jsonld-engine.js';
import { collectValues, isAbsoluteUrl, URL_KEYS } from './jsonld-engine.js';

export const seo018RelativeUrl = jsonldRule({
  id: 'seo/json-ld-relative-url',
  title: 'JSON-LD relative URL',
  severity: 'warning',
  label: 'JSON-LD URLs',
  recommendation: 'Use absolute URLs (http/https) for url/@id/image/logo/sameAs/contentUrl/thumbnailUrl in JSON-LD.',
  rationale: 'Search engines need absolute URLs in structured data; a relative URL cannot be resolved reliably.',
  fix: {
    description: 'Replace relative URLs in JSON-LD with absolute URLs.',
    snippet: '"image": "https://example.com/logo.png"',
    lang: 'json'
  },
  problem: (nodes) => {
    const bad = collectValues(nodes, URL_KEYS).find((v) => !isAbsoluteUrl(v));
    return bad ? `Relative URL in JSON-LD: "${bad}" — use an absolute URL` : undefined;
  }
});
