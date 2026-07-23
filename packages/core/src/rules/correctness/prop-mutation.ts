import { componentRule } from '../component-rule.js';

/**
 * correctness/prop-mutation — mutating a prop directly is a silent bug in both Svelte modes,
 * for different reasons: in runes mode, a non-$bindable prop mutation doesn't propagate to the
 * parent; in legacy mode (export let), Svelte's reactivity is assignment-based, so a mutating
 * method call (`.push(...)`, etc.) doesn't trigger an update at all without a following
 * reassignment. The two modes can't be mixed in one component, so a given finding is always
 * exactly one or the other — see `legacy` on `ComponentFacts.mutatedProps` (component-parse.ts).
 */
export const correctnessPropMutation = componentRule({
  id: 'correctness/prop-mutation',
  title: 'Mutated non-bindable prop',
  category: 'correctness',
  label: 'Prop mutation',
  recommendation:
    "Runes mode: clone the value before mutating it, communicate the change via a callback prop, or declare the prop $bindable if the parent and child should share it. Legacy mode: reassign the prop after mutating it (e.g. `list = list`) so Svelte's assignment-based reactivity picks up the change.",
  rationale:
    "Svelte's docs say plainly: don't mutate props unless they are $bindable. A plain-object prop mutation is a silent no-op (the object isn't a state proxy); a reactive-state-proxy prop mutation works but triggers the ownership_invalid_mutation dev warning only when that code path actually runs. In legacy mode, mutating methods like .push()/.splice() never trigger an update on their own — Svelte's reactivity there is based on assignments, not mutations. Neither case is caught by the compiler, so this rule catches both statically.",
  applies: (c) => c.mutatedProps.length > 0,
  bad: (c) =>
    c.mutatedProps.map((m) => ({
      line: m.line,
      message: m.legacy
        ? `Prop "${m.name}" is mutated directly — Svelte's legacy-mode reactivity is assignment-based, so this alone will not update the UI. Reassign it after mutating (e.g. "${m.name} = ${m.name}").`
        : `Prop "${m.name}" is mutated, but it is not declared $bindable`
    }))
});
