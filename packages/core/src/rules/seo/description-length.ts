import { lengthRule } from './length-rule.js';
import { intOption } from '../../rule-options.js';

const MIN = 70;
const MAX = 160;

export const seoDescriptionLength = lengthRule({
  id: 'seo/description-length',
  title: 'Description length',
  label: 'Description length',
  noun: 'Description',
  match: (t) => t.kind === 'meta' && t.name === 'description',
  min: MIN,
  max: MAX,
  recommendation: (o) =>
    `Aim for a meta description of ${intOption(o, 'min', MIN)}–${intOption(o, 'max', MAX)} characters so it is not truncated in search results.`,
  rationale:
    'A description that is too short under-uses the SERP snippet; one that is too long is truncated by search engines.'
});
