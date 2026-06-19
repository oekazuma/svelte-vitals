import type { Result, Detection } from '../../types.js';
import type { HeadTag, ResolvedHead } from '../../head.js';
import type { Rule, RuleContext } from '../../rule.js';

const DOCS_URL = 'https://svelte-vitals.dev/rules/SEO001';

function detectTitle(head: ResolvedHead): Detection {
  const title: HeadTag | undefined = head.tags.find((t) => t.kind === 'title');
  if (!title) {
    // No <title> anywhere in the layout chain.
    return { presence: 'none', value: 'absent' };
  }
  return { presence: title.presence, value: title.value };
}

function messageFor(detection: Detection): string {
  if (detection.presence === 'none') return 'Missing <title>';
  if (detection.value === 'absent') return 'Empty <title>';
  return '<title>';
}

/**
 * SEO001 — every route should resolve a non-empty <title> (design §11).
 * A dynamic title (`{data.title}`) is the most common correct pattern and must
 * never be flagged as missing; it surfaces as value 'dynamic' (design §4).
 */
export const seo001Title: Rule = {
  id: 'SEO001',
  title: 'Title presence',
  category: 'seo',
  severity: 'critical',
  scope: 'route',

  async check(ctx: RuleContext): Promise<Result[]> {
    return ctx.heads.map((head) => {
      const detection = detectTitle(head);
      return {
        id: 'SEO001',
        severity: 'critical',
        detection,
        route: head.route,
        location: head.file,
        message: messageFor(detection),
        recommendation:
          'Add a <title> inside <svelte:head>, e.g. <title>{data.title}</title>, ' +
          'or set it via your meta component.',
        docsUrl: DOCS_URL,
        fix: {
          description: 'Add a <title> inside <svelte:head> (a dynamic title is fine).',
          snippet: '<svelte:head>\n  <title>{data.title}</title>\n</svelte:head>',
          lang: 'svelte'
        }
      } satisfies Result;
    });
  }
};
