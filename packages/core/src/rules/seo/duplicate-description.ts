import { uniquenessRule } from './uniqueness-rule.js';

export const seoDuplicateDescription = uniquenessRule({
  id: 'seo/duplicate-description',
  title: 'Duplicate description',
  label: 'Unique description',
  noun: 'Description',
  match: (t) => t.kind === 'meta' && t.name === 'description',
  recommendation: 'Write a unique meta description per route so each search snippet is page-specific.',
  rationale:
    'Duplicate meta descriptions give search engines no per-page summary, so they are often ignored or rewritten.'
});
