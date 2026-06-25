import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { headTagRule } from './head-tag-rule.js';

// SEO010 — flag-on-presence: a route whose robots meta is noindex. info advisory.
export const seo010Indexability: Rule = {
  id: 'SEO010',
  title: 'Indexability',
  category: 'seo',
  severity: 'info',
  scope: 'route',
  rationale:
    'A noindex directive removes the page from search results; an accidental noindex on a public route silently deindexes it.',
  fix: {
    description: 'If this route should be indexed, drop noindex from its <meta name="robots">.',
    snippet: '<svelte:head>\n  <meta name="robots" content="index, follow" />\n</svelte:head>',
    lang: 'svelte'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const docsUrl = docsUrlFor('SEO010');
    const out: Result[] = [];
    for (const head of ctx.heads) {
      const noindexed = head.tags.some((t) => t.kind === 'meta' && t.name === 'robots' && t.noindex === true);
      if (!noindexed) continue;
      out.push({
        id: 'SEO010',
        category: 'seo',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' }, // surfaced as an issue (isPenalized)
        route: head.route,
        location: head.file,
        message: 'Route is noindex — verify this is intentional',
        recommendation: 'If this route should be indexed, remove noindex from its <meta name="robots">.',
        docsUrl,
        fix: {
          description: 'If this route should be indexed, drop noindex from its <meta name="robots">.',
          snippet: '<svelte:head>\n  <meta name="robots" content="index, follow" />\n</svelte:head>',
          lang: 'svelte'
        }
      });
    }
    return out;
  }
};

export const seo011TwitterCard = headTagRule({
  id: 'SEO011',
  title: 'Twitter Card',
  severity: 'info',
  match: (t) => t.kind === 'meta' && t.name === 'twitter:card',
  label: '<meta name="twitter:card">',
  recommendation: 'Add <meta name="twitter:card" content="summary_large_image"> so X/Twitter renders a rich card.',
  rationale:
    'twitter:card selects how the page renders when shared on X/Twitter; without it the platform falls back to a basic link (Open Graph tags are used as fallbacks for the rest).',
  fix: {
    description: 'Add a twitter:card meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta name="twitter:card" content="summary_large_image" />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo012OgDescription = headTagRule({
  id: 'SEO012',
  title: 'Open Graph description',
  severity: 'warning',
  match: (t) => t.kind === 'meta' && t.property === 'og:description',
  label: '<meta property="og:description">',
  recommendation: 'Add <meta property="og:description">, or set openGraph.description on your meta component.',
  rationale:
    'og:description is the summary shown under the title in social previews; without it platforms guess or show nothing, lowering click-through.',
  fix: {
    description: 'Add an og:description meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta property="og:description" content="A concise page summary." />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo013OgUrl = headTagRule({
  id: 'SEO013',
  title: 'Open Graph URL',
  severity: 'info',
  match: (t) => t.kind === 'meta' && t.property === 'og:url',
  label: '<meta property="og:url">',
  recommendation: 'Add <meta property="og:url"> with the canonical URL, or set openGraph.url on your meta component.',
  rationale:
    'og:url tells social platforms the canonical address to attribute shares and likes to, consolidating engagement on one URL.',
  fix: {
    description: 'Add an og:url meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta property="og:url" content="https://example.com/this-page" />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo014Viewport = headTagRule({
  id: 'SEO014',
  title: 'Viewport',
  severity: 'warning',
  match: (t) => t.kind === 'meta' && t.name === 'viewport',
  label: '<meta name="viewport">',
  recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> (usually in app.html).',
  rationale:
    'Without a viewport meta tag the page is not mobile-responsive, which Google penalizes under mobile-first indexing.',
  fix: {
    description: 'Add the viewport meta tag (typically in src/app.html <head>).',
    snippet: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    lang: 'html'
  }
});

// SEO015 — project rule: robots.txt should point crawlers at the sitemap.
export const seo015SitemapInRobots: Rule = {
  id: 'SEO015',
  title: 'Sitemap referenced in robots.txt',
  category: 'seo',
  severity: 'info',
  scope: 'project',
  rationale:
    'A Sitemap: line in robots.txt helps crawlers discover your sitemap; without it discovery relies on manual submission.',
  fix: {
    description: 'Add a Sitemap: line to static/robots.txt.',
    snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
    lang: 'text'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const { hasRobotsTxt, hasSitemap, robotsReferencesSitemap } = ctx.project;
    // Only meaningful when both exist AND we could read the static robots.txt and found no reference.
    if (!(hasRobotsTxt && hasSitemap && robotsReferencesSitemap === false)) return [];
    return [
      {
        id: 'SEO015',
        category: 'seo',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message: 'robots.txt does not reference your sitemap',
        recommendation: 'Add a Sitemap: line to static/robots.txt pointing at your sitemap.xml.',
        docsUrl: docsUrlFor('SEO015'),
        fix: {
          description: 'Add a Sitemap: line to static/robots.txt.',
          snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
          lang: 'text'
        }
      }
    ];
  }
};
