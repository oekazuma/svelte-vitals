import { componentRule } from '../component-rule.js';

export const correctnessOrphanEffect = componentRule({
  id: 'correctness/orphan-effect',
  title: 'Orphan $effect',
  category: 'correctness',
  severity: 'critical',
  label: '$effect context',
  recommendation:
    'Wrap the effect in $effect.root (and own the returned cleanup), or restructure so the effect is created during component initialisation (e.g. call a setup method from a component).',
  rationale:
    'An $effect created outside component initialisation throws effect_orphan at runtime — the compiler does not catch it, and it typically surfaces as a production 500.',
  // `orphanEffects` is typed required, but a facts object built by an older/external
  // constructor may omit it — default to empty rather than let `applies` throw and
  // take the whole `runRules` Promise.all down with it.
  applies: (c) => (c.orphanEffects ?? []).length > 0,
  bad: (c) =>
    (c.orphanEffects ?? []).map((o) => ({
      line: o.line,
      message:
        o.kind === 'top-level'
          ? '$effect at module scope runs outside component initialisation — it throws effect_orphan at runtime'
          : `class "${o.className}" runs $effect in its constructor and is instantiated at module scope — it throws effect_orphan at runtime`
    }))
});
