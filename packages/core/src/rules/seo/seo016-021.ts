import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import {
  parseJsonLd,
  collectValues,
  nodeStringValues,
  typeOf,
  isAbsoluteUrl,
  isIso8601,
  hasPlaceholder,
  URL_KEYS,
  DATE_KEYS,
  DEPRECATED_TYPES,
  REQUIRED_PROPS,
  type JsonLdNode
} from './jsonld-engine.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

/** Static jsonld tags on a head (those with captured raw content). */
function jsonldTags(head: { tags: HeadTag[] }): HeadTag[] {
  return head.tags.filter((t) => t.kind === 'jsonld' && typeof t.jsonld === 'string');
}

// SEO016 — validity (parse + @context + @type), custom because it owns parse failures.
export const seo016JsonLdValidity: Rule = {
  id: 'SEO016',
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
    const docsUrl = docsUrlFor('SEO016');
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
                id: 'SEO016',
                category: 'seo',
                severity: 'warning',
                detection: PENALIZED,
                route: head.route,
                location: head.file,
                message: problem,
                recommendation: 'Make the JSON-LD valid JSON with both @context and @type.',
                docsUrl,
                fix: { ...(seo016JsonLdValidity.fix as Fix) }
              }
            : {
                id: 'SEO016',
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

interface JsonLdRuleOptions {
  id: string;
  title: string;
  severity: 'warning' | 'info';
  label: string;
  recommendation: string;
  rationale: string;
  fix?: Fix;
  /**
   * Returns a problem message (fail), undefined (pass), or false (no signal — emit nothing).
   * Only called on parseable JSON-LD.
   */
  problem: (nodes: JsonLdNode[]) => string | false | undefined;
}

/** Build a route-scoped JSON-LD rule that runs `problem` over each static, parseable JSON-LD on a route. */
function jsonldRule(opts: JsonLdRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'seo',
    severity: opts.severity,
    scope: 'route',
    rationale: opts.rationale,
    ...(opts.fix ? { fix: opts.fix } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const head of ctx.heads) {
        for (const tag of jsonldTags(head)) {
          const parsed = parseJsonLd(tag.jsonld as string);
          if (!parsed.ok) continue; // SEO016 owns parse failures
          const problem = opts.problem(parsed.nodes);
          if (problem === false) continue; // no signal — rule is not applicable to these nodes
          out.push(
            problem
              ? {
                  id: opts.id,
                  category: 'seo',
                  severity: opts.severity,
                  detection: PENALIZED,
                  route: head.route,
                  location: head.file,
                  message: problem,
                  recommendation: opts.recommendation,
                  docsUrl,
                  ...(opts.fix ? { fix: { ...opts.fix } } : {})
                }
              : {
                  id: opts.id,
                  category: 'seo',
                  severity: opts.severity,
                  detection: PASS,
                  route: head.route,
                  message: opts.label,
                  recommendation: opts.recommendation,
                  docsUrl
                }
          );
        }
      }
      return out;
    }
  };
}

export const seo017DeprecatedType = jsonldRule({
  id: 'SEO017',
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

export const seo018RelativeUrl = jsonldRule({
  id: 'SEO018',
  title: 'JSON-LD relative URL',
  severity: 'warning',
  label: 'JSON-LD URLs',
  recommendation: 'Use absolute https URLs for url/@id/image/logo/sameAs in JSON-LD.',
  rationale: 'Search engines need absolute URLs in structured data; a relative URL cannot be resolved reliably.',
  fix: {
    description: 'Replace relative URLs in JSON-LD with absolute https URLs.',
    snippet: '"image": "https://example.com/logo.png"',
    lang: 'json'
  },
  problem: (nodes) => {
    const bad = collectValues(nodes, URL_KEYS).find((v) => !isAbsoluteUrl(v));
    return bad ? `Relative URL in JSON-LD: "${bad}" — use an absolute https URL` : undefined;
  }
});

export const seo019DateFormat = jsonldRule({
  id: 'SEO019',
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

export const seo020Placeholder = jsonldRule({
  id: 'SEO020',
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

export const seo021RequiredProps = jsonldRule({
  id: 'SEO021',
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
        const missing = required.filter((p) => !(p in node));
        if (missing.length > 0) return `${t} JSON-LD is missing required ${missing.join(', ')}`;
      }
    }
    // No known types found → no signal (rule is not applicable)
    return hasKnownType ? undefined : false;
  }
});
