import { componentRule } from '../component-rule.js';
import { intOption } from '../../rule-options.js';

/**
 * A component longer than this many lines is a "god component" smell.
 *
 * Derived empirically (2026-07-25) from the same corpus as architecture/prop-count: across 13
 * real Svelte 5 codebases the median per-repository 90th percentile is 132 lines and the 95th
 * is 183 — see docs/superpowers/specs/2026-07-25-architecture-threshold-recalibration-design.md.
 * This threshold sits deliberately above both: a long component is a weaker signal than a wide
 * prop list, since tables, forms, and generated markup are legitimately long.
 */
const MAX_LOC = 200;

export const architectureComponentSize = componentRule({
  id: 'architecture/component-size',
  title: 'Component size',
  category: 'architecture',
  severity: 'info',
  label: 'Component size',
  options: { max: { kind: 'integer', default: MAX_LOC, min: 1 } },
  recommendation: (o) => `Split components over ${intOption(o, 'max', MAX_LOC)} lines into smaller, focused pieces.`,
  rationale:
    'A very large component is hard to read, test, and reuse, and is a common sign that several responsibilities should be split out.',
  applies: (c) => c.loc > 0, // skip unanalyzable files (loc 0 = read/parse failure), don't PASS them
  bad: (c, o) => {
    const max = intOption(o, 'max', MAX_LOC);
    return c.loc > max ? [{ line: 1, message: `Component is ${c.loc} lines (over ${max})` }] : [];
  }
});
