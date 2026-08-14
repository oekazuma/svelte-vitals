import { describe, it, expect } from 'vitest';
import { a11yDuplicateLandmark, a11yTopLevelLandmark, a11yIdDuplication, a11yNoMissingIdRef } from '../src/index.js';
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
