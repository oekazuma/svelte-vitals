import { componentRule } from '../component-rule.js';

/**
 * correctness/checkable-bind-value — bind:value binds the DOM value property. A
 * checkbox/radio's user interaction toggles checkedness, which bind:value never observes, so
 * the bound state is frozen at its initial value and silently never updates in production.
 * bind:checked (single checkbox) / bind:group (checkbox list, radio group) are the correct
 * bindings.
 */
export const correctnessCheckableBindValue = componentRule({
  id: 'correctness/checkable-bind-value',
  title: 'bind:value on a checkable input',
  category: 'correctness',
  severity: 'warning',
  label: 'bind:checked / bind:group on checkable inputs',
  recommendation: 'Replace bind:value with bind:checked (single checkbox) or bind:group (checkbox list / radio group).',
  rationale:
    "bind:value binds the DOM value property. A checkbox/radio's user interaction toggles checkedness, which bind:value never observes — the bound state is frozen at its initial value. Svelte's checked/grouped bindings (bind:checked, bind:group) are built for exactly this.",
  fix: {
    description:
      "For a single checkbox, replace bind:value={x} with bind:checked={x} (x becomes a boolean). For a checkbox list or radio group, replace bind:value={x} with bind:group={x} on every input sharing the group, keeping each input's static value attribute to identify the option."
  },
  applies: (c) => c.checkableBindValues.length > 0,
  bad: (c) =>
    c.checkableBindValues.map((v) => ({
      line: v.line,
      message:
        v.kind === 'checkbox'
          ? 'bind:value on a checkbox does not track its checked state — the bound value silently never updates when the user toggles it. Use bind:checked (single checkbox) or bind:group (checkbox list) instead.'
          : 'bind:value on a radio input does not track which option is selected — the bound value silently never updates when the user picks one. Use bind:group with a shared group variable across the radio inputs instead.'
    }))
});
