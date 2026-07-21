import { componentRule } from '../component-rule.js';

/** A component longer than this many lines is a "god component" smell. */
const MAX_LOC = 400;

export const arch001ComponentSize = componentRule({
  id: 'architecture/component-size',
  title: 'Component size',
  category: 'architecture',
  severity: 'info',
  label: 'Component size',
  recommendation: `Split components over ${MAX_LOC} lines into smaller, focused pieces.`,
  rationale:
    'A very large component is hard to read, test, and reuse, and is a common sign that several responsibilities should be split out.',
  applies: (c) => c.loc > 0, // skip unanalyzable files (loc 0 = read/parse failure), don't PASS them
  bad: (c) => (c.loc > MAX_LOC ? [{ line: 1, message: `Component is ${c.loc} lines (over ${MAX_LOC})` }] : [])
});
