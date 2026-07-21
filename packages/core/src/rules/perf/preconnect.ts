import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const docsUrl = docsUrlFor('performance/preconnect');
const recommendation =
  'Add <link rel="preconnect"> (or dns-prefetch) for the third-party origin so the connection is set up early.';

// Well-known third-party origins worth a preconnect. Allowlist keeps the rule
// precise (no guessing which absolute URLs are first- vs third-party).
const THIRD_PARTY_ORIGINS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

/**
 * Host of an absolute or protocol-relative URL, lowercased; undefined for a
 * relative URL. Regex-based to keep core dependency-free (no `node:url`, and the
 * `URL` global is outside the core lib target).
 */
function hostOf(href: string): string | undefined {
  const m = /^(?:https?:)?\/\/([^/?#]+)/i.exec(href);
  return m ? m[1]!.toLowerCase() : undefined;
}

/**
 * PERF008 — Preconnect for third-party origins. A resource from a well-known
 * third-party origin (e.g. Google Fonts) without a preconnect/dns-prefetch pays a
 * connection-setup round-trip. Opt-in by construction: only origins in the
 * allowlist are checked; routes referencing none emit nothing.
 */
export const perf008Preconnect: Rule = {
  id: 'performance/preconnect',
  title: 'Preconnect third-party origin',
  category: 'performance',
  severity: 'info',
  scope: 'route',
  rationale:
    'Connecting to a third-party origin (DNS + TCP + TLS) is costly; a preconnect/dns-prefetch hint starts it early so the resource arrives sooner.',
  fix: {
    description: 'Add a preconnect hint for the third-party origin.',
    snippet: '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    lang: 'html'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const head of ctx.heads) {
      const referenced = new Map<string, string | undefined>(); // host → referencing file
      const covered = new Set<string>(); // host with preconnect/dns-prefetch
      for (const tag of head.tags) {
        if ((tag.kind !== 'link' && tag.kind !== 'script') || typeof tag.href !== 'string') continue;
        const host = hostOf(tag.href);
        if (!host || !THIRD_PARTY_ORIGINS.has(host)) continue;
        if (tag.kind === 'link' && (tag.rel === 'preconnect' || tag.rel === 'dns-prefetch')) covered.add(host);
        else if (!referenced.has(host)) referenced.set(host, tag.file);
      }
      if (referenced.size === 0) continue; // no third-party origin referenced → not applicable
      const missing = [...referenced].filter(([host]) => !covered.has(host));
      if (missing.length === 0) {
        out.push({
          id: 'performance/preconnect',
          category: 'performance',
          severity: 'info',
          detection: { presence: 'own', value: 'static' },
          route: head.route,
          message: 'Third-party origins are preconnected',
          recommendation,
          docsUrl
        });
        continue;
      }
      for (const [host, file] of missing) {
        out.push({
          id: 'performance/preconnect',
          category: 'performance',
          severity: 'info',
          detection: { presence: 'none', value: 'absent' },
          route: head.route,
          location: file ?? head.file,
          message: `Third-party origin ${host} used without a preconnect`,
          recommendation,
          docsUrl,
          fix: { ...(perf008Preconnect.fix as NonNullable<Rule['fix']>) }
        });
      }
    }
    return out;
  }
};
