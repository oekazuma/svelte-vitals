import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const FIX: Fix = {
  description: 'Add a Sitemap: line to static/robots.txt.',
  snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
  lang: 'text'
};

// seo/sitemap-in-robots — project rule: robots.txt should point crawlers at the sitemap.
export const seo015SitemapInRobots: Rule = {
  id: 'seo/sitemap-in-robots',
  title: 'Sitemap referenced in robots.txt',
  category: 'seo',
  severity: 'info',
  scope: 'project',
  rationale:
    'A Sitemap: line in robots.txt helps crawlers discover your sitemap; without it discovery relies on manual submission.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const { hasRobotsTxt, hasSitemap, robotsReferencesSitemap } = ctx.project;
    // Only meaningful when both exist AND we could read the static robots.txt and found no reference.
    if (!(hasRobotsTxt && hasSitemap && robotsReferencesSitemap === false)) return [];
    return [
      {
        id: 'seo/sitemap-in-robots',
        category: 'seo',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message: 'robots.txt does not reference your sitemap',
        recommendation: 'Add a Sitemap: line to static/robots.txt pointing at your sitemap.xml.',
        docsUrl: docsUrlFor('seo/sitemap-in-robots'),
        fix: { ...FIX }
      }
    ];
  }
};
