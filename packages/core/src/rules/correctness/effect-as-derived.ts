import { componentRule } from '../component-rule.js';

export const correctnessEffectAsDerived = componentRule({
  id: 'correctness/effect-as-derived',
  title: 'Effect used to derive state',
  category: 'correctness',
  label: '$effect usage',
  recommendation: 'Replace the state-syncing $effect with a derived value, e.g. let x = $derived(expr).',
  rationale:
    'An $effect whose body only assigns to $state is the "useEffect → $effect" anti-pattern: it reruns after render and can cause extra passes or loops. $derived expresses the same dependency declaratively.',
  applies: (c) => c.effects.length > 0,
  bad: (c) =>
    c.effects
      .filter((e) => e.assignsOnlyState)
      .map((e) => ({ line: e.line, message: '$effect only assigns state — use $derived instead' }))
});
