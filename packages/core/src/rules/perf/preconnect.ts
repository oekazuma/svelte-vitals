import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides } from '../../config-apply.js';
import { listOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';

const docsUrl = docsUrlFor('performance/preconnect');
const recommendation =
  'Add <link rel="preconnect"> (or dns-prefetch) for the third-party origin so the connection is set up early.';

// Well-known third-party origins worth a preconnect. Allowlist keeps the rule
// precise (no guessing which absolute URLs are first- vs third-party).
const THIRD_PARTY_ORIGINS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const OPTIONS: RuleOptionsSpec = { origins: { kind: 'string-list', default: [...THIRD_PARTY_ORIGINS] } };

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
 * performance/preconnect — Preconnect for third-party origins. A resource from a well-known
 * third-party origin (e.g. Google Fonts) without a preconnect/dns-prefetch pays a
 * connection-setup round-trip. Opt-in by construction: only origins in the
 * allowlist are checked; routes referencing none emit nothing.
 */
export const performancePreconnect: Rule = {
  id: 'performance/preconnect',
  title: 'Preconnect third-party origin',
  category: 'performance',
  severity: 'info',
  scope: 'route',
  rationale:
    'Connecting to a third-party origin (DNS + TCP + TLS) is costly; a preconnect/dns-prefetch hint starts it early so the resource arrives sooner.',
  fix: {
    description: 'Add a preconnect hint for the third-party origin.',
    snippet:
      '<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    lang: 'html'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    // Hoisted: compiling every override's globs once, not once per head.
    const compiled = compileOverrides(ctx.config);
    for (const head of ctx.heads) {
      const referenced = new Map<string, string | undefined>(); // host → referencing file
      const covered = new Set<string>(); // host with preconnect/dns-prefetch
      for (const tag of head.tags) {
        if ((tag.kind !== 'link' && tag.kind !== 'script') || typeof tag.href !== 'string') continue;
        const host = hostOf(tag.href);
        if (!host) continue;
        // Coverage is a fact about the document, not a policy decision — recorded BEFORE
        // the `origins` gate. Options are resolved per tag (below), so two tags in one
        // head can resolve different `origins`: a files:-scoped override matching the
        // route file but not the layout file that owns the preconnect would otherwise
        // leave the hint unrecorded and report the origin as un-preconnected, a false
        // positive. Gating only the *reference* side keeps the two sides in agreement
        // whatever each tag resolves.
        if (tag.kind === 'link' && (tag.rel === 'preconnect' || tag.rel === 'dns-prefetch')) {
          covered.add(host);
          continue;
        }
        // Resolved per tag, keyed on the same file expression the resulting finding's
        // `location` uses below — a tag inherited from a layout carries its own `file`,
        // distinct from head.file, and a files:-scoped option override keyed to that
        // layout file must reach it (design 2026-07-26 Finding 1). `origins` is
        // addition-only (never narrowed by an override — design §"Option specs"), so
        // resolving per tag can only ever widen which hosts are in scope.
        const o = resolveRuleOptions(
          'performance/preconnect',
          OPTIONS,
          ctx.config,
          { route: head.route, file: tag.file ?? head.file },
          compiled
        );
        if (!listOption(o, 'origins').includes(host)) continue;
        if (!referenced.has(host)) referenced.set(host, tag.file);
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
          // head.file — the same target used to resolve options above (design
          // 2026-08-08-pass-result-location-design.md) — so a `files:`-scoped override can
          // also match this passing seed via `severity: 'off'`.
          location: head.file,
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
          fix: { ...(performancePreconnect.fix as NonNullable<Rule['fix']>) }
        });
      }
    }
    return out;
  }
};
