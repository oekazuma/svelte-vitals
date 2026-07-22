import { componentRule } from '../component-rule.js';

/**
 * correctness/stale-prop-derivation — a value computed from a prop without
 * $derived is evaluated once, at init, and silently stops tracking the parent.
 * Svelte's own guidance: treat props as though they will change.
 */
export const correctnessStalePropDerivation = componentRule({
  id: 'correctness/stale-prop-derivation',
  title: 'Stale prop derivation',
  category: 'correctness',
  severity: 'warning',
  label: 'Props derived reactively',
  recommendation: 'Wrap the computation in $derived(...), or $derived.by(() => ...) when it needs a function body.',
  rationale:
    "Svelte's guidance is to treat props as though they will change: a plain `let color = type === 'danger' ? 'red' : 'green'` freezes the first render's value, so the UI silently stops tracking the parent when the prop changes. $derived keeps the computation live at no cost.",
  fix: {
    description:
      'Wrap the prop-derived computation in $derived(...) (or $derived.by(() => ...) for a function body), keeping the same expression.'
  },
  applies: (c) => c.stalePropDerivations.length > 0,
  bad: (c) =>
    c.stalePropDerivations.map((s) => ({
      line: s.line,
      message: `"${s.name}" is computed from a prop once, at initialization — it will not update when the prop changes. Wrap it in $derived.`
    }))
});
