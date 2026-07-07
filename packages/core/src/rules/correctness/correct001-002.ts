import { componentRule } from '../component-rule.js';

export const correct001EachKey = componentRule({
  id: 'CORRECT001',
  title: 'Keyed each block',
  category: 'correctness',
  label: 'Keyed {#each}',
  recommendation: 'Add a key to the {#each} block, e.g. {#each items as item (item.id)}.',
  rationale:
    'An unkeyed {#each} adds/removes nodes at the end and rewrites the data of the DOM nodes in between when the list reorders, so element state/focus sticks to positions instead of items; a key lets Svelte insert, move, and delete the right nodes instead.',
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

export const correct003EffectAsOnMount = componentRule({
  id: 'CORRECT003',
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
