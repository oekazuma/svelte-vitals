import { componentRule } from '../component-rule.js';

export const correctnessEffectAsOnMount = componentRule({
  id: 'correctness/effect-as-onmount',
  title: 'Effect used as onMount',
  category: 'correctness',
  label: '$effect usage',
  recommendation:
    "If this runs in response to a user interaction, use an event handler; to sync an element with an external library, use {@attach} instead. For genuine one-time mount work, use onMount (import { onMount } from 'svelte'). Reserve $effect for logic that reacts to $state/$derived/$props.",
  rationale:
    "An $effect whose body reads no reactive value visible to this analysis runs once after mount and never re-runs on the paths it can see — usually a sign the code belongs in an event handler, {@attach}, or onMount instead of $effect. This can't see a reactive value reached only through a plain function's return value, so a genuinely reactive effect built that way can still be flagged.",
  applies: (c) => c.effects.length > 0,
  bad: (c) =>
    c.effects
      .filter((e) => e.mountOnly)
      .map((e) => ({
        line: e.line,
        message:
          '$effect reads no reactive value this analysis can see — consider an event handler, {@attach}, or onMount instead'
      }))
});
