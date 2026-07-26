import { lengthRule } from './length-rule.js';

export const seoTitleLength = lengthRule({
  id: 'seo/title-length',
  title: 'Title length',
  label: 'Title length',
  noun: 'Title',
  match: (t) => t.kind === 'title',
  min: 30,
  max: 60,
  recommendation: (o) =>
    `Aim for a title of ${o.min as number}–${o.max as number} characters so it is not truncated in search results.`,
  rationale:
    'A title that is too short wastes the strongest on-page signal; one that is too long is truncated in the SERP.'
});
