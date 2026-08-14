import { describe, it, expect } from 'vitest';
import { a11yDuplicateLandmark, a11yTopLevelLandmark } from '../src/index.js';
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
