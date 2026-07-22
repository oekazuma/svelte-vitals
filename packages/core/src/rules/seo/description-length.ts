import { lengthRule } from './length-rule.js';

export const seoDescriptionLength = lengthRule({
  id: 'seo/description-length',
  title: 'Description length',
  label: 'Description length',
  noun: 'Description',
  match: (t) => t.kind === 'meta' && t.name === 'description',
  min: 70,
  max: 160,
  recommendation: 'Aim for a meta description of 70–160 characters so it is not truncated in search results.',
  rationale:
    'A description that is too short under-uses the SERP snippet; one that is too long is truncated by search engines.'
});
