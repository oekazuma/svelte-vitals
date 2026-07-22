import { componentRule } from '../component-rule.js';

export const correctnessUnmutatedState = componentRule({
  id: 'correctness/unmutated-state',
  title: 'Unmutated $state',
  category: 'correctness',
  severity: 'info',
  label: '$state usage',
  recommendation:
    'If a value never changes, use const — or $derived if it is computed from props or state; if you only ever reassign it wholesale (never mutate its properties), use $state.raw to skip deep proxying.',
  rationale:
    'A $state that is never mutated pays for reactivity (deep proxying, tracking) it never uses; const (or $state.raw) is clearer and cheaper.',
  applies: (c) => c.constableStates.length > 0,
  bad: (c) =>
    c.constableStates.map((s) => ({
      line: s.line,
      message: `$state "${s.name}" is never mutated — use const (or $state.raw if you only reassign it)`
    }))
});
