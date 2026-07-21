import { componentRule } from '../component-rule.js';

export const correct003EffectAsOnMount = componentRule({
  id: 'correctness/effect-as-onmount',
  title: 'Effect used as onMount',
  category: 'correctness',
  label: '$effect usage',
  recommendation:
    "Move mount-time side effects to onMount (import { onMount } from 'svelte'); reserve $effect for logic that reacts to $state/$derived/$props.",
  rationale:
    'An $effect that reads no reactive value runs once after mount and never re-runs — it is an onMount in disguise, which obscures intent and misuses the reactivity system.',
  applies: (c) => c.effects.length > 0,
  bad: (c) =>
    c.effects
      .filter((e) => e.mountOnly)
      .map((e) => ({ line: e.line, message: '$effect reads no reactive value — use onMount instead' }))
});
