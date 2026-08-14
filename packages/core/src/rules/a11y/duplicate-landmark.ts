import type { A11yOccurrenceInfo } from '../../a11y.js';
import { surplusRule } from './route-rule.js';

const KINDS = ['main', 'banner', 'contentinfo'] as const;

/**
 * a11y/duplicate-landmark — a composed route (layout chain + page) yields more than one
 * `main` / `banner` / `contentinfo` landmark. `ctx.a11y[].landmarks` already holds the
 * branch-aware-folded representatives, so this rule only counts them per kind, in the
 * fixed KINDS order (it decides emission order and the PASS anchor).
 */
export const a11yDuplicateLandmark = surplusRule({
  id: 'a11y/duplicate-landmark',
  title: 'Duplicate landmark',
  rationale:
    'Assistive tech users jump between landmarks to skip repeated content; more than one main, banner, or contentinfo per page leaves them guessing which one is the real one.',
  recommendation: 'A route should have at most one main, banner, and contentinfo landmark.',
  map: (route) =>
    Object.fromEntries(
      KINDS.flatMap((kind) => {
        const reps = route.landmarks[kind];
        return reps?.length ? [[kind, reps] as [string, A11yOccurrenceInfo[]]] : [];
      })
    ),
  message: (kind, i, n) => `Duplicate ${kind} landmark (${i + 1} of ${n})`,
  passMessage: 'No duplicate landmarks'
});
