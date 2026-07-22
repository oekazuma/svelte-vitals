import { componentRule } from '../component-rule.js';

/**
 * performance/state-raw — deep $state proxies every property access; a binding
 * that is only ever reassigned never uses that machinery. Svelte's guidance:
 * large reassign-only objects (API responses, canonically) belong in $state.raw.
 * "Large" is not statically knowable, so a non-primitive literal initializer is
 * the proxy condition.
 */
export const performanceStateRaw = componentRule({
  id: 'performance/state-raw',
  title: 'Raw state opportunity',
  category: 'performance',
  severity: 'info',
  label: 'Deep reactivity only where mutated',
  recommendation:
    'Declare it with $state.raw(...) — reassignment stays reactive; only property-level mutation needs the deep proxy.',
  rationale:
    "Objects and arrays in $state are made deeply reactive through proxying, which taxes every property access. A binding that is only ever reassigned — API responses are the canonical case — never uses that machinery; Svelte's own guidance is to use $state.raw for it.",
  fix: {
    description: 'Replace $state(...) with $state.raw(...); keep the same initializer.'
  },
  applies: (c) => c.rawableStates.length > 0,
  bad: (c) =>
    c.rawableStates.map((s) => ({
      line: s.line,
      message: `"${s.name}" is an object/array $state that is only ever reassigned, never mutated — $state.raw skips the deep-proxy overhead (reassignment stays reactive).`
    }))
});
