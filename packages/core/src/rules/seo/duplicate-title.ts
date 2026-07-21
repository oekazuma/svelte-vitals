import { uniquenessRule } from './uniqueness-rule.js';

export const seo028TitleUnique = uniquenessRule({
  id: 'seo/duplicate-title',
  title: 'Duplicate title',
  label: 'Unique title',
  noun: 'Title',
  match: (t) => t.kind === 'title',
  recommendation: 'Give each route a unique <title> that describes that page specifically.',
  rationale:
    'Duplicate titles across pages make them compete in search results and weaken each page’s relevance signal.'
});
