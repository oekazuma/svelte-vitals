import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { ComponentFacts } from '../../component.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

interface Bad {
  line: number;
  message: string;
}

interface CorrectnessRuleOptions {
  id: string;
  title: string;
  label: string;
  recommendation: string;
  rationale: string;
  /** Whether this component carries the signal at all (no signal → emit nothing for the file). */
  applies: (c: ComponentFacts) => boolean;
  /** The offending occurrences in a component (empty → the file passes). */
  bad: (c: ComponentFacts) => Bad[];
}

/**
 * Build a component-scoped correctness rule (CLI/static only — `ctx.components` is
 * unset in rendered mode, so it emits nothing there). Findings use the source file
 * as the scoring unit (`route` + `location` = file), so each file scores per-unit.
 */
function correctnessRule(opts: CorrectnessRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'correctness',
    severity: 'warning',
    scope: 'component',
    rationale: opts.rationale,
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const c of ctx.components ?? []) {
        if (!opts.applies(c)) continue; // no signal in this file → neither penalize nor seed
        const bad = opts.bad(c);
        if (bad.length === 0) {
          out.push({
            id: opts.id,
            category: 'correctness',
            severity: 'warning',
            detection: PASS,
            route: c.file,
            message: opts.label,
            recommendation: opts.recommendation,
            docsUrl
          });
          continue;
        }
        for (const b of bad) {
          out.push({
            id: opts.id,
            category: 'correctness',
            severity: 'warning',
            detection: PENALIZED,
            route: c.file,
            location: c.file,
            ...(b.line > 0 ? { line: b.line } : {}),
            message: b.message,
            recommendation: opts.recommendation,
            docsUrl
          });
        }
      }
      return out;
    }
  };
}

export const correct001EachKey = correctnessRule({
  id: 'CORRECT001',
  title: 'Keyed each block',
  label: 'Keyed {#each}',
  recommendation: 'Add a key to the {#each} block, e.g. {#each items as item (item.id)}.',
  rationale:
    'An unkeyed {#each} destroys and recreates DOM nodes when the list reorders, losing element state/focus and wasting work; a key lets Svelte move nodes instead.',
  applies: (c) => c.eachBlocks.length > 0,
  bad: (c) => c.eachBlocks.filter((e) => !e.hasKey).map((e) => ({ line: e.line, message: '{#each} block has no key' }))
});

export const correct002EffectDerived = correctnessRule({
  id: 'CORRECT002',
  title: 'Effect used to derive state',
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
