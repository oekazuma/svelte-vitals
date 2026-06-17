import type { Rule } from '../rule.js';
import { seo001Title } from './seo/seo001-title.js';

/** Rule registry. Slice 0 ships SEO001 only; later slices append here. */
export const allRules: Rule[] = [seo001Title];

export { seo001Title };
