// Pure JSON-LD inspection helpers + curated data. No node:, no deps (JSON.parse only).
export type JsonLdNode = Record<string, unknown>;

/** Parse JSON-LD and flatten to structured-data objects: root, top-level array members, and @graph members. */
export function parseJsonLd(raw: string): { ok: boolean; nodes: JsonLdNode[] } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, nodes: [] };
  }
  const nodes: JsonLdNode[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v && typeof v === 'object') {
      const o = v as JsonLdNode;
      nodes.push(o);
      if (Array.isArray(o['@graph'])) (o['@graph'] as unknown[]).forEach(visit);
    }
  };
  visit(data);
  return { ok: true, nodes };
}

/** `@type` normalized to a string array (it may be a string or an array). */
export function typeOf(node: JsonLdNode): string[] {
  const t = node['@type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
}

/** Deep-walk each node (nested objects + arrays) collecting string values found under any key in `keys`. */
export function collectValues(nodes: JsonLdNode[], keys: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v as JsonLdNode)) {
        if (keys.has(k) && typeof val === 'string') out.push(val);
        else if (keys.has(k) && Array.isArray(val)) for (const e of val) if (typeof e === 'string') out.push(e);
        walk(val);
      }
    }
  };
  nodes.forEach(walk);
  return out;
}

/** A node's own direct string property values (shallow), used by the placeholder scan. */
export function nodeStringValues(node: JsonLdNode): string[] {
  return Object.values(node).filter((v): v is string => typeof v === 'string');
}

export function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/** ISO-8601 date or date-time (date, optional time + Z/offset). Conservative. */
export function isIso8601(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(s.trim());
}

const PLACEHOLDER_RES = [/lorem ipsum/i, /your company/i, /your-?domain/i, /example company/i, /yourcompany/i, /your name here/i];
export const PLACEHOLDERS = PLACEHOLDER_RES.map((r) => r.source);
export function hasPlaceholder(s: string): boolean {
  return PLACEHOLDER_RES.some((re) => re.test(s));
}

export const URL_KEYS: ReadonlySet<string> = new Set(['url', '@id', 'image', 'logo', 'sameAs', 'contentUrl', 'thumbnailUrl']);
export const DATE_KEYS: ReadonlySet<string> = new Set([
  'datePublished',
  'dateModified',
  'dateCreated',
  'startDate',
  'endDate',
  'uploadDate',
  'validFrom',
  'expires'
]);

/** Types whose Google rich results were dropped/restricted (verify before relying on them). */
export const DEPRECATED_TYPES: ReadonlySet<string> = new Set(['HowTo', 'FAQPage', 'ClaimReview']);

/** Curated @type -> required properties for the rich result (Google structured-data docs). */
export const REQUIRED_PROPS: Record<string, string[]> = {
  Article: ['headline'],
  BlogPosting: ['headline'],
  NewsArticle: ['headline'],
  Product: ['name', 'offers'],
  BreadcrumbList: ['itemListElement'],
  Organization: ['name', 'url'],
  WebSite: ['name', 'url'],
  Event: ['name', 'startDate', 'location'],
  Recipe: ['name', 'image', 'recipeIngredient', 'recipeInstructions'],
  Person: ['name'],
  VideoObject: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  LocalBusiness: ['name', 'address']
};
