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

/** Every string value reachable in a node (nested objects + arrays), so placeholder text inside e.g. `publisher.name` is seen. */
export function nodeStringValues(node: JsonLdNode): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === 'object') Object.values(v as JsonLdNode).forEach(walk);
  };
  walk(node);
  return out;
}

/**
 * Absolute = carries a URI scheme (`http:`, `https:`, `data:`, `mailto:`, `urn:`, `tel:`, …) or is
 * protocol-relative (`//host/…`). Only scheme-less path references (`/x`, `x/y`, `./x`, `#frag`) are
 * relative — those are what search engines can't resolve. We deliberately accept non-http schemes and
 * protocol-relative URLs so legitimate values (data-URI logos, `mailto:`/`urn:` identifiers) aren't flagged.
 */
export function isAbsoluteUrl(s: string): boolean {
  const str = s.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(str) || str.startsWith('//');
}

/**
 * ISO-8601 date or date-time at any allowed precision — year (`2026`), year-month (`2026-06`), full
 * date, or date-time. Schema.org `Date`/`DateTime` permit reduced precision, so we accept it. We also
 * reject impossible calendar values (`2026-13`, `2026-02-31`, `…T25:00`) that the shape regex alone allows.
 */
export function isIso8601(s: string): boolean {
  const str = s.trim();
  if (!/^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/.test(str)) return false;
  const y = Number(str.slice(0, 4));
  const hasMonth = str.length >= 7;
  const hasDay = str.length >= 10;
  const m = hasMonth ? Number(str.slice(5, 7)) : 1;
  if (m < 1 || m > 12) return false;
  if (hasDay) {
    const d = Number(str.slice(8, 10));
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
  }
  const tm = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(str);
  if (tm) {
    const [hh, mm, ss] = [Number(tm[1]), Number(tm[2]), tm[3] !== undefined ? Number(tm[3]) : 0];
    if (hh > 23 || mm > 59 || ss > 59) return false;
  }
  return true;
}

const PLACEHOLDER_RES = [
  /lorem ipsum/i,
  /your company/i,
  /your-?domain/i,
  /example company/i,
  /yourcompany/i,
  /your name here/i
];
export const PLACEHOLDERS = PLACEHOLDER_RES.map((r) => r.source);
export function hasPlaceholder(s: string): boolean {
  return PLACEHOLDER_RES.some((re) => re.test(s));
}

// `@id` is intentionally excluded: it is a node *identifier* (IRI), commonly a relative fragment
// like "#organization" that cross-references nodes within the same @graph — valid, not a broken URL.
export const URL_KEYS: ReadonlySet<string> = new Set(['url', 'image', 'logo', 'sameAs', 'contentUrl', 'thumbnailUrl']);
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

/**
 * True when `node[key]` is present AND carries a usable value — not `null`/`undefined`, not an empty
 * or whitespace-only string, not an empty array. A bare `"headline": ""` is exactly the placeholder an
 * author leaves behind, and Google treats it as missing, so presence alone (`key in node`) is too weak.
 */
export function hasNonEmpty(node: JsonLdNode, key: string): boolean {
  if (!(key in node)) return false;
  const v = node[key];
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

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
