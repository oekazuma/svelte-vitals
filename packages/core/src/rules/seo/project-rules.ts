import type { Detection, Result } from '../../types.js';
import type { Rule, RuleContext } from '../../rule.js';

const present: Detection = { presence: 'own', value: 'static' };
const absent: Detection = { presence: 'none', value: 'absent' };

export const seo006Robots: Rule = {
  id: 'SEO006',
  title: 'robots.txt',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.hasRobotsTxt ? present : absent;
    return [
      {
        id: 'SEO006',
        severity: 'warning',
        detection,
        message: ctx.project.hasRobotsTxt ? 'robots.txt' : 'Missing robots.txt',
        recommendation: 'Add static/robots.txt or a src/routes/robots.txt/+server endpoint.',
        docsUrl: 'https://svelte-vitals.dev/rules/SEO006',
        fix: {
          description: 'Create static/robots.txt (or a src/routes/robots.txt/+server endpoint).',
          snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
          lang: 'text'
        }
      }
    ];
  }
};

export const seo007Sitemap: Rule = {
  id: 'SEO007',
  title: 'sitemap.xml',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.hasSitemap ? present : absent;
    return [
      {
        id: 'SEO007',
        severity: 'warning',
        detection,
        message: ctx.project.hasSitemap ? 'sitemap.xml' : 'Missing sitemap.xml',
        recommendation: 'Add static/sitemap.xml or a src/routes/sitemap.xml/+server endpoint.',
        docsUrl: 'https://svelte-vitals.dev/rules/SEO007',
        fix: {
          description: 'Create static/sitemap.xml (or a src/routes/sitemap.xml/+server endpoint).',
          snippet:
            '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc></url>\n</urlset>',
          lang: 'xml'
        }
      }
    ];
  }
};

export const seo009HtmlLang: Rule = {
  id: 'SEO009',
  title: '<html lang>',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.htmlLang;
    const message =
      detection.presence === 'none'
        ? 'Missing <html lang>'
        : detection.value === 'absent'
          ? 'Empty <html lang>'
          : '<html lang>';
    return [
      {
        id: 'SEO009',
        severity: 'warning',
        detection,
        message,
        recommendation: 'Set <html lang="..."> in src/app.html.',
        docsUrl: 'https://svelte-vitals.dev/rules/SEO009',
        fix: {
          description: 'Set the lang attribute on <html> in src/app.html.',
          snippet: '<html lang="en">',
          lang: 'html'
        }
      }
    ];
  }
};
