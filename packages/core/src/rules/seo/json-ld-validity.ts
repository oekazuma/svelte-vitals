import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { collectValues, contextValues, jsonldTags, parseJsonLd, typeOf, type JsonLdNode } from './jsonld-engine.js';
import { PENALIZED, PASS } from './detection.js';
import { SCHEMA_ORG_TYPES } from './schema-vocabulary.generated.js';

const SCHEMA_ORG_CONTEXT_RE = /^https?:\/\/schema\.org\/?$/;

/** Lowercase name -> canonical catalog name, for the case-insensitive "did you mean" hint. */
const LOWERCASE_TO_CANONICAL: ReadonlyMap<string, string> = new Map(
  [...SCHEMA_ORG_TYPES].map((name) => [name.toLowerCase(), name])
);
/** Sorted once so `closestType`'s tie-break (first in sorted order) is deterministic and cheap to repeat. */
const SORTED_TYPES: readonly string[] = [...SCHEMA_ORG_TYPES].sort();

// Matches the CLI's own did-you-mean UX (packages/cli/src/gunshi/guard.ts: @gunshi/plugin-suggestion,
// maxDistance 2, maxSuggestions 1) for consistency between the two surfaces.
const MAX_SUGGEST_DISTANCE = 2;

/**
 * Levenshtein distance, capped: once a row's minimum exceeds `maxDistance` no cell can still land
 * <= it (each further row can only add cost), so returning early there is a bound, not a heuristic.
 * Hand-rolled rather than imported: the CLI already has this via `@gunshi/plugin-suggestion`, but
 * that's a CLI argument-parsing framework's plugin — pulling it into `@svelte-vitals/core` would
 * break core's runtime-agnostic-with-zero-deps contract (AGENTS.md "Core purity"), which is a
 * harder rule than the CLI's own "reuse gunshi's matcher" preference, itself scoped to the CLI.
 */
function levenshteinWithin(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    prev = curr;
  }
  return prev[b.length]!;
}

/**
 * Closest catalog name within edit distance `MAX_SUGGEST_DISTANCE` of `name`, or undefined —
 * the phase-2 typo hint (design doc's "Distance-1 typo suggestions" refinement, generalized to
 * distance <= 2 to match the CLI's UX). Distance is computed case-insensitively (a typo and a
 * casing slip are the same kind of user error), but the returned name keeps catalog casing. Ties
 * broken by sorted catalog order — arbitrary but stable, so the same typo always suggests the same
 * name. Only ever called after the free case-insensitive-exact-match check misses, and only on the
 * rare unknown-@type path, so scanning the ~1,000-name catalog here is negligible.
 */
function closestType(name: string, catalog: readonly string[]): string | undefined {
  const lower = name.toLowerCase();
  let best: string | undefined;
  let bestDistance = MAX_SUGGEST_DISTANCE + 1;
  for (const candidate of catalog) {
    if (Math.abs(candidate.length - name.length) > MAX_SUGGEST_DISTANCE) continue;
    const d = levenshteinWithin(lower, candidate.toLowerCase(), MAX_SUGGEST_DISTANCE);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  return bestDistance <= MAX_SUGGEST_DISTANCE ? best : undefined;
}

function isSchemaOrgContextValue(v: unknown): boolean {
  if (typeof v === 'string') return SCHEMA_ORG_CONTEXT_RE.test(v);
  if (Array.isArray(v)) return v.every((m) => typeof m === 'string' && SCHEMA_ORG_CONTEXT_RE.test(m));
  return false; // object (term remapping) or anything else — we can't know what it legitimizes
}

/**
 * The vocabulary arm only runs when every `@context` occurrence in the document (root, array
 * members, `@graph` members, and nested entities alike) is schema.org — an array or object context
 * can remap terms to a vocabulary we don't know, so anything non-schema.org exempts the whole
 * document rather than risking a false positive.
 */
function isSchemaOrgOnly(nodes: JsonLdNode[]): boolean {
  const contexts = contextValues(nodes);
  return contexts.length > 0 && contexts.every(isSchemaOrgContextValue);
}

/** IRI (`https://schema.org/Article`) and prefixed (`schema:Article`) forms are valid JSON-LD, not bare vocabulary names. */
function isBareTypeName(name: string): boolean {
  return !name.includes(':') && !name.includes('/');
}

/** Unique, unknown bare `@type` names anywhere in the document (root, nested entities, `@graph` members). */
function unknownTypeNames(nodes: JsonLdNode[]): string[] {
  const seen = new Set<string>();
  for (const name of collectValues(nodes, new Set(['@type']))) {
    if (isBareTypeName(name) && !SCHEMA_ORG_TYPES.has(name)) seen.add(name);
  }
  return [...seen];
}

function unknownTypeMessage(name: string): string {
  const canonical = LOWERCASE_TO_CANONICAL.get(name.toLowerCase()) ?? closestType(name, SORTED_TYPES);
  return canonical
    ? `Unknown @type '${name}' — not a schema.org type. Did you mean '${canonical}'?`
    : `Unknown @type '${name}' — not a schema.org type.`;
}

// seo/json-ld-validity — validity (parse + @context + @type + schema.org vocabulary), custom because it owns parse failures.
export const seoJsonLdValidity: Rule = {
  id: 'seo/json-ld-validity',
  title: 'JSON-LD validity',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale:
    'Invalid JSON-LD — unparseable, missing @context/@type, or declaring a @type that is not a real schema.org type — is silently ignored by search engines, so the structured data does nothing.',
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

        if (!problem && isSchemaOrgOnly(parsed.nodes)) {
          const unknown = unknownTypeNames(parsed.nodes);
          if (unknown.length > 0) {
            for (const name of unknown) {
              out.push({
                id: 'seo/json-ld-validity',
                category: 'seo',
                severity: 'warning',
                detection: PENALIZED,
                route: head.route,
                location: tag.file ?? head.file,
                message: unknownTypeMessage(name),
                recommendation: "Use the exact schema.org type name (case-sensitive), e.g. 'Article', 'Product'.",
                docsUrl
              });
            }
            continue; // unknown types found — no PASS result for this tag
          }
        }

        out.push(
          problem
            ? {
                id: 'seo/json-ld-validity',
                category: 'seo',
                severity: 'warning',
                detection: PENALIZED,
                route: head.route,
                location: tag.file ?? head.file,
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
                // Same `location` the penalized branch above uses (design
                // 2026-08-08-pass-result-location-design.md).
                location: tag.file ?? head.file,
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
