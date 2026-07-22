import type { Detection, Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const present: Detection = { presence: 'own', value: 'static' };
const absent: Detection = { presence: 'none', value: 'absent' };

const FIX: Fix = {
  description: 'Create static/sitemap.xml (or a src/routes/sitemap.xml/+server endpoint).',
  snippet:
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc></url>\n</urlset>',
  lang: 'xml'
};

export const seoSitemapXml: Rule = {
  id: 'seo/sitemap-xml',
  title: 'sitemap.xml',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'A sitemap.xml lists your URLs so search engines can discover and prioritise them, especially pages not well linked internally.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.hasSitemap ? present : absent;
    return [
      {
        id: 'seo/sitemap-xml',
        category: 'seo',
        severity: 'warning',
        detection,
        message: ctx.project.hasSitemap ? 'sitemap.xml' : 'Missing sitemap.xml',
        recommendation: 'Add static/sitemap.xml or a src/routes/sitemap.xml/+server endpoint.',
        docsUrl: docsUrlFor('seo/sitemap-xml'),
        fix: { ...FIX }
      }
    ];
  }
};
