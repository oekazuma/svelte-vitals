import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { parseJsonLd, typeOf } from './jsonld-engine.js';
import { jsonldTags } from './jsonld-engine.js';
import { PENALIZED, PASS } from './detection.js';

// seo/json-ld-validity — validity (parse + @context + @type), custom because it owns parse failures.
export const seoJsonLdValidity: Rule = {
  id: 'seo/json-ld-validity',
  title: 'JSON-LD validity',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale:
    'Invalid JSON-LD — unparseable, or missing @context/@type — is silently ignored by search engines, so the structured data does nothing.',
  fix: {
    description: 'Make the JSON-LD valid: parseable JSON with both @context (schema.org) and @type.',
    snippet:
      '<svelte:head>\n  <script type="application/ld+json">\n    {"@context":"https://schema.org","@type":"WebPage","name":"…"}\n  </script>\n</svelte:head>',
    lang: 'svelte'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const docsUrl = docsUrlFor('seo/json-ld-validity');
    const out: Result[] = [];
    for (const head of ctx.heads) {
      for (const tag of jsonldTags(head)) {
        const parsed = parseJsonLd(tag.jsonld as string);
        let problem: string | undefined;
        if (!parsed.ok) problem = 'JSON-LD is not valid JSON';
        else if (!parsed.nodes.some((n) => '@context' in n)) problem = 'JSON-LD is missing @context';
        else if (!parsed.nodes.some((n) => typeOf(n).length > 0)) problem = 'JSON-LD is missing @type';
        out.push(
          problem
            ? {
                id: 'seo/json-ld-validity',
                category: 'seo',
                severity: 'warning',
                detection: PENALIZED,
                route: head.route,
                location: head.file,
                message: problem,
                recommendation: 'Make the JSON-LD valid JSON with both @context and @type.',
                docsUrl,
                fix: { ...(seoJsonLdValidity.fix as Fix) }
              }
            : {
                id: 'seo/json-ld-validity',
                category: 'seo',
                severity: 'warning',
                detection: PASS,
                route: head.route,
                message: 'JSON-LD validity',
                recommendation: 'Make the JSON-LD valid JSON with both @context and @type.',
                docsUrl
              }
        );
      }
    }
    return out;
  }
};
