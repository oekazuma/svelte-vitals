import type { Result, Detection, Fix } from '../../types.js';
import type { HeadTag, ResolvedHead } from '../../head.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const FIX: Fix = {
  description: 'Add a <title> inside <svelte:head> (a dynamic title is fine).',
  snippet: '<svelte:head>\n  <title>{data.title}</title>\n</svelte:head>',
  lang: 'svelte'
};

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
  rationale:
    'A unique, non-empty <title> is the single strongest on-page SEO signal and the text shown in search results and browser tabs.',
  fix: FIX,

  async check(ctx: RuleContext): Promise<Result[]> {
    return ctx.heads.map((head) => {
      const detection = detectTitle(head);
      return {
        id: 'SEO001',
        category: 'seo',
        severity: 'critical',
        detection,
        route: head.route,
        location: head.file,
        message: messageFor(detection),
        recommendation:
          'Add a <title> inside <svelte:head>, e.g. <title>{data.title}</title>, ' +
          'or set it via your meta component.',
        docsUrl: docsUrlFor('SEO001'),
        fix: { ...FIX }
      } satisfies Result;
    });
  }
};
