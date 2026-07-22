import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const FIX: Fix = {
  description: 'Set the lang attribute on <html> in src/app.html.',
  snippet: '<html lang="en">',
  lang: 'html'
};

export const seoHtmlLang: Rule = {
  id: 'seo/html-lang',
  title: '<html lang>',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'The <html lang> attribute declares the page language for search engines, screen readers, and translation tools.',
  fix: FIX,
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
        id: 'seo/html-lang',
        category: 'seo',
        severity: 'warning',
        detection,
        message,
        recommendation: 'Set <html lang="..."> in src/app.html.',
        docsUrl: docsUrlFor('seo/html-lang'),
        fix: { ...FIX }
      }
    ];
  }
};
