import { lengthRule } from './length-rule.js';
import { intOption } from '../../rule-options.js';

const MIN = 30;
const MAX = 60;

export const seoTitleLength = lengthRule({
  id: 'seo/title-length',
  title: 'Title length',
  label: 'Title length',
  noun: 'Title',
  match: (t) => t.kind === 'title',
  min: MIN,
  max: MAX,
  recommendation: (o) =>
    `Aim for a title of ${intOption(o, 'min', MIN)}–${intOption(o, 'max', MAX)} characters so it is not truncated in search results.`,
  rationale:
    'A title that is too short wastes the strongest on-page signal; one that is too long is truncated in the SERP.'
});
