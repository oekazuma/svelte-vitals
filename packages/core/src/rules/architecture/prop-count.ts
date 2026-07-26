import { componentRule } from '../component-rule.js';

/**
 * More destructured props than this suggests the component is doing too much.
 *
 * Derived empirically (2026-07-25): the median of the per-repository 90th percentile across
 * 2,591 countable components in 10 real Svelte 5 codebases (5 libraries, 5 applications) — see
 * docs/superpowers/specs/2026-07-25-architecture-threshold-recalibration-design.md for the
 * corpus and method. Pooling every repository into one distribution instead gives 9, but that
 * figure is set by a single outlier project contributing about half the sample. Widening the
 * corpus from 7 repositories to 13 left this value unchanged.
 */
const MAX_PROPS = 6;

export const architecturePropCount = componentRule({
  id: 'architecture/prop-count',
  title: 'Prop count',
  category: 'architecture',
  severity: 'info',
  label: 'Prop count',
  options: { max: { kind: 'integer', default: MAX_PROPS, min: 1 } },
  recommendation: (o) =>
    `Group related props into an object, or split the component, when it takes more than ${o.max as number} props.`,
  rationale:
    'A component taking many props is usually doing too much; grouping or splitting keeps its API understandable.',
  applies: (c) => c.propCount > 0, // only components whose props we could count
  bad: (c, o) => {
    const max = o.max as number;
    return c.propCount > max ? [{ line: 1, message: `Component takes ${c.propCount} props (over ${max})` }] : [];
  }
});
