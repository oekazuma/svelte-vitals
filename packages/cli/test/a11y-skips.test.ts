import { describe, it, expect } from 'vitest';
import { idRefSkipWarning, type SkippedRouteEntry } from '../src/a11y-skips.js';

const cause = (kind: string) => ({ kind, file: 'src/routes/+page.svelte', line: 1 });
const docs = 'https://oekazuma.github.io/svelte-vitals/rules/a11y/no-missing-id-ref';

describe('idRefSkipWarning', () => {
  it('names the causes without counts when a single route is skipped', () => {
    const entries: SkippedRouteEntry[] = [{ route: '/a', refs: 2, causes: [cause('spread'), cause('dynamic-id')] }];
    expect(idRefSkipWarning(entries, 6)).toBe(
      'a11y/no-missing-id-ref skipped 1 of 6 analyzed route(s) — it only checks routes it can fully resolve, so this is not a failure. ' +
        `Causes: spread, dynamic id. Per-route detail: --reporter json → "skipped". Why, and how to widen: ${docs}`
    );
  });

  it('counts the routes carrying each cause, in fixed order, when several are skipped', () => {
    const entries: SkippedRouteEntry[] = [
      { route: '/a', refs: 0, causes: [cause('spread'), cause('component')] },
      { route: '/b', refs: 1, causes: [cause('dynamic-id'), cause('spread')] }
    ];
    expect(idRefSkipWarning(entries, 3)).toContain(
      'skipped 2 of 3 analyzed route(s) — it only checks routes it can fully resolve, so this is not a failure. ' +
        'Causes: unresolved component (1), spread (2), dynamic id (1). '
    );
  });
});
