import { componentRule } from '../component-rule.js';

export const correct005PropMutation = componentRule({
  id: 'CORRECT005',
  title: 'Mutated non-bindable prop',
  category: 'correctness',
  label: 'Prop mutation',
  recommendation:
    'Clone the value before mutating it, communicate the change via a callback prop, or declare the prop $bindable if the parent and child should share it.',
  rationale:
    "Svelte's docs say plainly: don't mutate props unless they are $bindable. A plain-object prop mutation is a silent no-op (the object isn't a state proxy); a reactive-state-proxy prop mutation works but triggers the ownership_invalid_mutation dev warning only when that code path actually runs. Neither is caught by the compiler, so this rule catches both statically.",
  applies: (c) => c.mutatedProps.length > 0,
  bad: (c) =>
    c.mutatedProps.map((m) => ({
      line: m.line,
      message: `Prop "${m.name}" is mutated, but it is not declared $bindable`
    }))
});
