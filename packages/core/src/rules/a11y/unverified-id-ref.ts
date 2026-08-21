import type { Result } from '../../types.js';
import type { Rule, RuleContext } from '../../rule.js';
import type { A11ySkipCause } from '../../a11y.js';
import { PENALIZED, PASS } from '../detection.js';
import { resultFactory } from './route-rule.js';

const recommendation =
  'The reference could not be verified against the composed route. Confirm the id exists in the rendered page, or resolve the causes so a11y/no-missing-id-ref can verify it.';
const result = resultFactory('a11y/unverified-id-ref', recommendation, 'info');

const CAUSE_LABEL: Record<A11ySkipCause['kind'], string> = {
  component: 'unresolved component',
  spread: 'spread',
  html: '{@html}',
  'dynamic-id': 'dynamic id'
};

function causeList(causes: readonly A11ySkipCause[]): string {
  const shown = causes.slice(0, 3).map((c) => {
    const name = c.kind === 'component' && c.detail ? `${CAUSE_LABEL.component} <${c.detail}>` : CAUSE_LABEL[c.kind];
    return `${name} at ${c.file}:${c.line}`;
  });
  const rest = causes.length - shown.length;
  return shown.join(', ') + (rest > 0 ? `, +${rest} more` : '');
}

/**
 * a11y/unverified-id-ref — the opt-in open-world arm of a11y/no-missing-id-ref (design
 * 2026-08-21): on routes whose composition is NOT fully resolved, a literal id reference
 * matching no optimistic candidate is reported as unverifiable, never as missing — an
 * unresolved component, spread, {@html}, or dynamic id could still define the id.
 */
export const a11yUnverifiedIdRef: Rule = {
  id: 'a11y/unverified-id-ref',
  title: 'Unverified id reference',
  category: 'a11y',
  severity: 'info',
  scope: 'route',
  defaultOff: true,
  rationale:
    'Opt-in: on routes a11y/no-missing-id-ref must skip (composition not fully resolved), an id reference that matches no literal id anywhere analyzed is reported as unverifiable — a real dangling reference and an id hidden inside an unresolved component look the same, so findings need manual confirmation.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.a11y ?? []) {
      if (route.fullyResolved || route.idRefs.length === 0) continue;
      const candidates = new Set(route.idCandidates);
      const causes = causeList(route.unresolvedCauses ?? []);
      let hasUnverified = false;
      for (const ref of route.idRefs) {
        if (candidates.has(ref.id)) continue;
        hasUnverified = true;
        out.push(
          result(
            route.route,
            PENALIZED,
            ref,
            `${ref.attr}="${ref.attr === 'href' ? '#' : ''}${ref.id}" references an id not found in any analyzed source — the route is not fully resolved (${causes}); verify the id exists at runtime`
          )
        );
      }
      if (!hasUnverified) {
        const first = route.idRefs[0]!;
        out.push(
          result(
            route.route,
            PASS,
            { file: first.file, line: 0 },
            'All id references match literal ids (composition not fully resolved)'
          )
        );
      }
    }
    return out;
  }
};
