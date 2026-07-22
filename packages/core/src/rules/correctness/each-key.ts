import { componentRule } from '../component-rule.js';

export const correctnessEachKey = componentRule({
  id: 'correctness/each-key',
  title: 'Keyed each block',
  category: 'correctness',
  label: 'Keyed {#each}',
  recommendation: 'Add a key to the {#each} block, e.g. {#each items as item (item.id)}.',
  rationale:
    'An unkeyed {#each} adds/removes nodes at the end and rewrites the data of the DOM nodes in between when the list reorders, so element state/focus sticks to positions instead of items; a key lets Svelte insert, move, and delete the right nodes instead.',
  applies: (c) => c.eachBlocks.length > 0,
  bad: (c) => c.eachBlocks.filter((e) => !e.hasKey).map((e) => ({ line: e.line, message: '{#each} block has no key' }))
});
