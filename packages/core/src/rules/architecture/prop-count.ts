import { componentRule } from '../component-rule.js';

/** More destructured props than this suggests the component is doing too much. */
const MAX_PROPS = 10;

export const arch002PropCount = componentRule({
  id: 'architecture/prop-count',
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
