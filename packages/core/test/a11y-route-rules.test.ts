import { describe, it, expect } from 'vitest';
import {
  a11yDuplicateLandmark,
  a11yTopLevelLandmark,
  a11yIdDuplication,
  a11yNoMissingIdRef,
  a11yUnverifiedIdRef
} from '../src/internal.js';
import { defineConfig, defaultProject, type Result } from '../src/types.js';
import type { ResolvedA11y } from '../src/a11y.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ra = (over: Partial<ResolvedA11y>): ResolvedA11y => ({
  route: '/',
  landmarks: {},
  nestedLandmarks: [],
  ids: {},
  idRefs: [],
  idCandidates: [],
  fullyResolved: true,
  ...over
});
const ctxA11y = (a11y: ResolvedA11y[]): RuleContext => ({ heads: [], project: defaultProject, config, a11y });

describe('a11y/duplicate-landmark', () => {
  it('one finding per surplus representative, located at it', async () => {
    const rs = await a11yDuplicateLandmark.check(
      ctxA11y([
        ra({
          landmarks: {
            main: [
              { file: 'src/routes/+layout.svelte', line: 2 },
              { file: 'src/routes/+page.svelte', line: 5 }
            ]
          }
        })
      ])
    );
    const f = fails(rs);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ location: 'src/routes/+page.svelte', line: 5, route: '/' });
  });
  it('PASS with one main, nothing with zero landmarks', async () => {
    const one = await a11yDuplicateLandmark.check(ctxA11y([ra({ landmarks: { main: [{ file: 'f', line: 1 }] } })]));
    expect(one).toHaveLength(1);
    expect(fails(one)).toHaveLength(0);
    expect(await a11yDuplicateLandmark.check(ctxA11y([ra({})]))).toHaveLength(0);
  });
});

describe('a11y/top-level-landmark', () => {
  it('one finding per nested landmark, located at it', async () => {
    const rs = await a11yTopLevelLandmark.check(
      ctxA11y([
        ra({
          nestedLandmarks: [{ kind: 'complementary', within: 'main', file: 'src/routes/+page.svelte', line: 9 }]
        })
      ])
    );
    const f = fails(rs);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      location: 'src/routes/+page.svelte',
      line: 9,
      route: '/',
      message: 'complementary landmark is nested inside main'
    });
  });
  it('PASS with a landmark and no nesting, nothing with zero landmarks', async () => {
    const one = await a11yTopLevelLandmark.check(ctxA11y([ra({ landmarks: { main: [{ file: 'f', line: 1 }] } })]));
    expect(one).toHaveLength(1);
    expect(fails(one)).toHaveLength(0);
    expect(await a11yTopLevelLandmark.check(ctxA11y([ra({})]))).toHaveLength(0);
  });
});

describe('a11y/id-duplication', () => {
  it('one finding per surplus representative, located at it', async () => {
    const rs = await a11yIdDuplication.check(
      ctxA11y([
        ra({
          ids: {
            x: [
              { file: 'a', line: 1 },
              { file: 'b', line: 2 }
            ]
          }
        })
      ])
    );
    const f = fails(rs);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ location: 'b', line: 2, message: 'Duplicate id "x"' });
  });
  it('PASS with only single-occurrence ids, nothing with zero ids', async () => {
    const one = await a11yIdDuplication.check(
      ctxA11y([ra({ ids: { x: [{ file: 'a', line: 1 }], y: [{ file: 'b', line: 3 }] } })])
    );
    expect(one).toHaveLength(1);
    expect(fails(one)).toHaveLength(0);
    expect(await a11yIdDuplication.check(ctxA11y([ra({})]))).toHaveLength(0);
  });
  it('names the shell when the first representative is src/app.html', async () => {
    const rs = await a11yIdDuplication.check(
      ctxA11y([
        ra({
          ids: {
            'shell-root': [
              { file: 'src/app.html', line: 8 },
              { file: 'src/routes/+page.svelte', line: 4 }
            ]
          }
        })
      ])
    );
    const f = fails(rs);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      location: 'src/routes/+page.svelte',
      line: 4,
      message: 'Duplicate id "shell-root" — also defined by the src/app.html shell (line 8)'
    });
  });

  it('keeps the plain message for route-internal duplicates', async () => {
    const rs = await a11yIdDuplication.check(
      ctxA11y([
        ra({
          ids: {
            x: [
              { file: 'a.svelte', line: 1 },
              { file: 'b.svelte', line: 2 }
            ]
          }
        })
      ])
    );
    expect(fails(rs)[0]!.message).toBe('Duplicate id "x"');
  });
});

describe('a11y/id-duplication — entry ordering', () => {
  it('anchors PASS at the (file, line)-first id even when integer-like ids exist', async () => {
    const rs = await a11yIdDuplication.check(
      ctxA11y([
        ra({
          ids: {
            '9': [{ file: 'src/routes/b.svelte', line: 1 }],
            hero: [{ file: 'src/routes/a.svelte', line: 2 }]
          }
        })
      ])
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ detection: { presence: 'own' }, location: 'src/routes/a.svelte' });
  });
});

describe('a11y/no-missing-id-ref', () => {
  it('one finding per dangling ref, located at it', async () => {
    const rs = await a11yNoMissingIdRef.check(
      ctxA11y([ra({ idRefs: [{ id: 'ghost', attr: 'for', file: 'f', line: 3 }], idCandidates: [] })])
    );
    const f = fails(rs);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ location: 'f', line: 3, message: 'for="ghost" references a missing id' });
  });
  it('PASS when the referenced id is a candidate', async () => {
    const rs = await a11yNoMissingIdRef.check(
      ctxA11y([ra({ idRefs: [{ id: 'ghost', attr: 'for', file: 'f', line: 3 }], idCandidates: ['ghost'] })])
    );
    expect(rs).toHaveLength(1);
    expect(fails(rs)).toHaveLength(0);
  });
  it('emits nothing on a not-fully-resolved route, even with a dangling ref', async () => {
    const rs = await a11yNoMissingIdRef.check(
      ctxA11y([
        ra({ idRefs: [{ id: 'ghost', attr: 'for', file: 'f', line: 3 }], idCandidates: [], fullyResolved: false })
      ])
    );
    expect(rs).toHaveLength(0);
  });
  it('emits nothing on a fully resolved route with zero refs', async () => {
    expect(await a11yNoMissingIdRef.check(ctxA11y([ra({})]))).toHaveLength(0);
  });
});

describe('a11y/unverified-id-ref', () => {
  const cause = (over: object) => ({
    kind: 'component' as const,
    file: 'src/lib/A.svelte',
    line: 2,
    detail: 'A',
    ...over
  });
  const open = (over: Partial<ResolvedA11y>) => ra({ fullyResolved: false, unresolvedCauses: [cause({})], ...over });

  it('flags an unmatched ref on a non-resolved route, naming the blocking cause', async () => {
    const rs = await a11yUnverifiedIdRef.check(
      ctxA11y([open({ idRefs: [{ id: 'ghost', attr: 'for', file: 'f', line: 3 }], idCandidates: [] })])
    );
    const f = fails(rs);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ location: 'f', line: 3, severity: 'info' });
    expect(f[0]!.message).toBe(
      'for="ghost" references an id not found in any analyzed source — the route is not fully resolved ' +
        '(unresolved component <A> at src/lib/A.svelte:2); verify the id exists at runtime'
    );
  });

  it('caps the cause list at three plus a count', async () => {
    const causes = [
      cause({}),
      cause({ kind: 'spread', detail: undefined, file: 'b.svelte', line: 1 }),
      cause({ kind: 'html', detail: undefined, file: 'c.svelte', line: 4 }),
      cause({ kind: 'dynamic-id', detail: undefined, file: 'd.svelte', line: 5 }),
      cause({ kind: 'spread', detail: undefined, file: 'e.svelte', line: 6 })
    ];
    const rs = await a11yUnverifiedIdRef.check(
      ctxA11y([open({ unresolvedCauses: causes, idRefs: [{ id: 'g', attr: 'for', file: 'f', line: 1 }] })])
    );
    expect(fails(rs)[0]!.message).toContain(
      '(unresolved component <A> at src/lib/A.svelte:2, spread at b.svelte:1, {@html} at c.svelte:4, +2 more)'
    );
  });

  it('PASS when every ref matches an optimistic candidate; href fragments use the # display form', async () => {
    const rs = await a11yUnverifiedIdRef.check(
      ctxA11y([open({ idRefs: [{ id: 'x', attr: 'href', file: 'f', line: 2 }], idCandidates: ['x'] })])
    );
    expect(rs).toHaveLength(1);
    expect(fails(rs)).toHaveLength(0);
    const miss = await a11yUnverifiedIdRef.check(
      ctxA11y([open({ idRefs: [{ id: 'x', attr: 'href', file: 'f', line: 2 }], idCandidates: [] })])
    );
    expect(fails(miss)[0]!.message).toMatch(/^href="#x" references /);
  });

  it('emits nothing on fully resolved routes and on routes without refs', async () => {
    const resolved = await a11yUnverifiedIdRef.check(
      ctxA11y([ra({ idRefs: [{ id: 'g', attr: 'for', file: 'f', line: 1 }], idCandidates: [] })])
    );
    expect(resolved).toHaveLength(0);
    expect(await a11yUnverifiedIdRef.check(ctxA11y([open({})]))).toHaveLength(0);
  });

  it('declares the opt-in class', () => {
    expect(a11yUnverifiedIdRef.defaultOff).toBe(true);
    expect(a11yUnverifiedIdRef.severity).toBe('info');
  });
});
