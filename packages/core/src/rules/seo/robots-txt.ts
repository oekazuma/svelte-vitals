import type { Detection, Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const present: Detection = { presence: 'own', value: 'static' };
const absent: Detection = { presence: 'none', value: 'absent' };

const FIX: Fix = {
  description: 'Create static/robots.txt (or a src/routes/robots.txt/+server endpoint).',
  snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
  lang: 'text'
};

export const seoRobotsTxt: Rule = {
  id: 'seo/robots-txt',
  title: 'robots.txt',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'robots.txt tells crawlers which paths they may fetch and points them to your sitemap; missing it leaves crawl behaviour to defaults.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.hasRobotsTxt ? present : absent;
    return [
      {
        id: 'seo/robots-txt',
        category: 'seo',
        severity: 'warning',
        detection,
        message: ctx.project.hasRobotsTxt ? 'robots.txt' : 'Missing robots.txt',
        recommendation: 'Add static/robots.txt or a src/routes/robots.txt/+server endpoint.',
        docsUrl: docsUrlFor('seo/robots-txt'),
        fix: { ...FIX }
      }
    ];
  }
};
