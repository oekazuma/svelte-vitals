import { componentRule } from '../component-rule.js';

/** A component longer than this many lines is a "god component" smell. */
const MAX_LOC = 400;
/** More destructured props than this suggests the component is doing too much. */
const MAX_PROPS = 10;

export const arch001ComponentSize = componentRule({
  id: 'ARCH001',
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

export const arch002PropCount = componentRule({
  id: 'ARCH002',
  title: 'Prop count',
  category: 'architecture',
  severity: 'info',
  label: 'Prop count',
  recommendation: `Group related props into an object, or split the component, when it takes more than ${MAX_PROPS} props.`,
  rationale:
    'A component taking many props is usually doing too much; grouping or splitting keeps its API understandable.',
  applies: (c) => c.propCount > 0, // only components whose props we could count
  bad: (c) =>
    c.propCount > MAX_PROPS ? [{ line: 1, message: `Component takes ${c.propCount} props (over ${MAX_PROPS})` }] : []
});
