import { componentRule } from '../component-rule.js';

/**
 * correctness/nonreactive-builtin-state — $state's deep proxy covers plain
 * objects and arrays only. A plain Map/Set/Date/URL/URLSearchParams in $state
 * keeps working as data, but its mutations never reach effects, deriveds, or
 * the template: the UI silently stops updating. svelte/reactivity ships
 * drop-in reactive equivalents for exactly this.
 */
export const correctnessNonreactiveBuiltinState = componentRule({
  id: 'correctness/nonreactive-builtin-state',
  title: 'Non-reactive built-in in $state',
  category: 'correctness',
  severity: 'warning',
  label: 'Reactive collections in $state',
  recommendation:
    "Import the reactive equivalent from 'svelte/reactivity' (SvelteMap, SvelteSet, SvelteDate, SvelteURL, SvelteURLSearchParams) and construct that instead.",
  rationale:
    "$state deep-proxies plain objects and arrays only; built-in collection, date, and URL instances stay untracked, so property-level changes never reach effects, deriveds, or the template. Svelte's own answer is the drop-in classes in svelte/reactivity.",
  fix: {
    description:
      "Import Svelte<Type> from 'svelte/reactivity' and replace new <Type>(...) with new Svelte<Type>(...) — the API is identical."
  },
  applies: (c) => c.nonreactiveBuiltinStates.length > 0,
  bad: (c) =>
    c.nonreactiveBuiltinStates.map((s) => ({
      line: s.line,
      message: `"${s.name}" is a plain ${s.type} in $state — its mutations are not tracked, so the UI silently stops updating when it changes. Use Svelte${s.type} from 'svelte/reactivity'.`
    }))
});
