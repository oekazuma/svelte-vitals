import { componentRule } from '../component-rule.js';

/**
 * correctness/stale-prop-derivation — a value computed from a prop without $derived (runes
 * mode) or $: (legacy mode) is evaluated once, at init, and silently stops tracking the
 * parent. Svelte's own guidance: treat props as though they will change. The two modes can't
 * be mixed in one component, so a given finding is always exactly one or the other — see
 * `legacy` on `ComponentFacts.stalePropDerivations` (component-parse.ts).
 */
export const correctnessStalePropDerivation = componentRule({
  id: 'correctness/stale-prop-derivation',
  title: 'Stale prop derivation',
  category: 'correctness',
  severity: 'warning',
  label: 'Props derived reactively',
  recommendation:
    'Wrap the computation in $derived(...) (or $derived.by(() => ...) for a function body) in runes-mode components; prefix the assignment with $: in legacy-mode components.',
  rationale:
    "Svelte's guidance is to treat props as though they will change: a plain `let color = type === 'danger' ? 'red' : 'green'` freezes the first render's value, so the UI silently stops tracking the parent when the prop changes. In runes mode, $derived keeps the computation live at no cost; in legacy mode (export let props), a $: reactive statement does the same job.",
  fix: {
    description:
      'Wrap the prop-derived computation in $derived(...) (or $derived.by(() => ...) for a function body) in runes mode, or prefix the assignment with $: in legacy mode, keeping the same expression.'
  },
  applies: (c) => c.stalePropDerivations.length > 0,
  bad: (c) =>
    c.stalePropDerivations.map((s) => ({
      line: s.line,
      message: s.legacy
        ? `"${s.name}" is computed from a prop once, at initialization — it will not update when the prop changes. Prefix the assignment with $: to make it a reactive statement.`
        : `"${s.name}" is computed from a prop once, at initialization — it will not update when the prop changes. Wrap it in $derived.`
    }))
});
