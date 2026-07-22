import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const FIX: Fix = {
  description: 'If this route should be indexed, drop noindex from its <meta name="robots">.',
  snippet: '<svelte:head>\n  <meta name="robots" content="index, follow" />\n</svelte:head>',
  lang: 'svelte'
};

// seo/indexability — flag-on-presence: a route whose robots meta is noindex. info advisory.
export const seoIndexability: Rule = {
  id: 'seo/indexability',
  title: 'Indexability',
  category: 'seo',
  severity: 'info',
  scope: 'route',
  rationale:
    'A noindex directive removes the page from search results; an accidental noindex on a public route silently deindexes it.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const docsUrl = docsUrlFor('seo/indexability');
    const out: Result[] = [];
    for (const head of ctx.heads) {
      const noindexed = head.tags.some((t) => t.kind === 'meta' && t.name === 'robots' && t.noindex === true);
      if (!noindexed) continue;
      out.push({
        id: 'seo/indexability',
        category: 'seo',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' }, // surfaced as an issue (isPenalized)
        route: head.route,
        location: head.file,
        message: 'Route is noindex — verify this is intentional',
        recommendation: 'If this route should be indexed, remove noindex from its <meta name="robots">.',
        docsUrl,
        fix: { ...FIX }
      });
    }
    return out;
  }
};
