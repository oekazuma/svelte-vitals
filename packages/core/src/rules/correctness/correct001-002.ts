import { componentRule } from '../component-rule.js';

export const correct001EachKey = componentRule({
  id: 'CORRECT001',
  title: 'Keyed each block',
  category: 'correctness',
  label: 'Keyed {#each}',
  recommendation: 'Add a key to the {#each} block, e.g. {#each items as item (item.id)}.',
  rationale:
    'An unkeyed {#each} destroys and recreates DOM nodes when the list reorders, losing element state/focus and wasting work; a key lets Svelte move nodes instead.',
  applies: (c) => c.eachBlocks.length > 0,
  bad: (c) => c.eachBlocks.filter((e) => !e.hasKey).map((e) => ({ line: e.line, message: '{#each} block has no key' }))
});

export const correct002EffectDerived = componentRule({
  id: 'CORRECT002',
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
