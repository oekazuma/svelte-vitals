import { componentRule } from '../component-rule.js';

/**
 * correctness/checkable-bind-value — bind:value binds the DOM value property. A
 * checkbox/radio's user interaction toggles checkedness, which bind:value never observes. A
 * checkbox throws bind_invalid_checkbox_value in dev (silently tracks value instead of
 * checkedness in prod); a radio throws nothing and its bound state silently never updates.
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
    "bind:value binds the DOM value property. A checkbox/radio's user interaction toggles checkedness, which bind:value never observes. On a checkbox this throws bind_invalid_checkbox_value in a development build; in production the check is skipped and the binding silently tracks the value attribute instead of checkedness. On a radio it throws nothing in either build — it renders once with the initial value, then silently never updates. Svelte's checked/grouped bindings (bind:checked, bind:group) are built for exactly this.",
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
          ? 'bind:value on a checkbox does not track its checked state — it throws bind_invalid_checkbox_value in development; in a production build it silently tracks the value attribute instead of checkedness. Use bind:checked (single checkbox) or bind:group (checkbox list) instead.'
          : 'bind:value on a radio input does not track which option is selected — the bound value silently never updates when the user picks one. Use bind:group with a shared group variable across the radio inputs instead.'
    }))
});
