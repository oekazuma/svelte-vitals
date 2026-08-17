import type { Detection, Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const present: Detection = { presence: 'own', value: 'static' };
const absent: Detection = { presence: 'none', value: 'absent' };

const FIX: Fix = {
  description: 'Add <!doctype html> as the first line of src/app.html.',
  snippet: '<!doctype html>',
  lang: 'html'
};

export const a11yDoctype: Rule = {
  id: 'a11y/doctype',
  title: 'Doctype',
  category: 'a11y',
  // `info`, not `warning`: the accessibility half of this rule's premise has no source — MDN's
  // quirks-mode guide is about layout, and WCAG 4.1.1 Parsing is obsolete and removed. The layout
  // claim stands, so the rule stays; its weight follows the evidence that remains.
  severity: 'info',
  scope: 'project',
  rationale:
    'Without a doctype browsers render in quirks mode, which applies different layout and box-model rules than the standards mode a page is otherwise laid out under.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const { appHtmlDoctype } = ctx.project;
    if (appHtmlDoctype === undefined) return [];
    return [
      {
        id: 'a11y/doctype',
        category: 'a11y',
        severity: 'info',
        detection: appHtmlDoctype ? present : absent,
        location: 'src/app.html',
        message: appHtmlDoctype ? '<!doctype html>' : 'src/app.html is missing <!doctype html>',
        recommendation: 'Add <!doctype html> as the first line of src/app.html.',
        docsUrl: docsUrlFor('a11y/doctype'),
        fix: { ...FIX }
      }
    ];
  }
};
