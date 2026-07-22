import { componentRule } from '../component-rule.js';

export const correctnessEachIndexKey = componentRule({
  id: 'correctness/each-index-key',
  title: 'Index used as each key',
  category: 'correctness',
  label: 'Item-keyed {#each}',
  recommendation: 'Key by a value that uniquely identifies the item, e.g. (item.id).',
  rationale:
    "Svelte's guidance is explicit: the key must uniquely identify the object — do not use the index. An index key gives items position-based identity, so element state (focus, inputs, transitions) sticks to positions when the list reorders or items are inserted or removed, exactly like an unkeyed block — but the visible key masks the problem.",
  applies: (c) => c.eachBlocks.some((e) => e.indexKey),
  bad: (c) =>
    c.eachBlocks
      .filter((e) => e.indexKey)
      .map((e) => ({
        line: e.line,
        message:
          '{#each} is keyed by its index — identity follows position, exactly like an unkeyed block, but the key makes it look safe.'
      }))
});
