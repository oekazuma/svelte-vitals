import { describe, it, expect } from 'vitest';
import { resolveRuleOptions, validateRuleOptions, compileOverrides, defineConfig } from '../src/index.js';
import type { RuleOptionsSpec } from '../src/index.js';

const spec: RuleOptionsSpec = {
  max: { kind: 'integer', default: 6, min: 1 },
  packages: { kind: 'string-map', default: { lodash: 'use lodash-es' } },
  origins: { kind: 'string-list', default: ['fonts.googleapis.com'] }
};

describe('resolveRuleOptions', () => {
  it('returns the built-in defaults with an empty config', () => {
    expect(resolveRuleOptions('r', spec, defineConfig({}))).toEqual({
      max: 6,
      packages: { lodash: 'use lodash-es' },
      origins: ['fonts.googleapis.com']
    });
  });
  it('returns an empty object for a rule with no spec', () => {
    expect(resolveRuleOptions('r', undefined, defineConfig({}))).toEqual({});
  });
  it('replaces an integer from the global setting', () => {
    const config = defineConfig({ rules: { r: { options: { max: 10 } } } });
    expect(resolveRuleOptions('r', spec, config).max).toBe(10);
  });
  it('adds to a list rather than replacing it', () => {
    const config = defineConfig({ rules: { r: { options: { origins: ['cdn.example.com'] } } } });
    expect(resolveRuleOptions('r', spec, config).origins).toEqual(['fonts.googleapis.com', 'cdn.example.com']);
  });
  it('adds to a map rather than replacing it', () => {
    const config = defineConfig({ rules: { r: { options: { packages: { moment: 'use dayjs' } } } } });
    expect(resolveRuleOptions('r', spec, config).packages).toEqual({
      lodash: 'use lodash-es',
      moment: 'use dayjs'
    });
  });
  it('lets a matching override replace the global integer', () => {
    const config = defineConfig({
      rules: { r: { options: { max: 10 } } },
      overrides: [{ files: 'src/lib/**', rules: { r: { options: { max: 4 } } } }]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/lib/B.svelte' }).max).toBe(4);
    expect(resolveRuleOptions('r', spec, config, { file: 'src/routes/+page.svelte' }).max).toBe(10);
  });
  it('takes the last matching override for an integer', () => {
    const config = defineConfig({
      overrides: [
        { files: 'src/**', rules: { r: { options: { max: 4 } } } },
        { files: 'src/lib/**', rules: { r: { options: { max: 8 } } } }
      ]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/lib/B.svelte' }).max).toBe(8);
  });
  it('accumulates lists across defaults, global and overrides', () => {
    const config = defineConfig({
      rules: { r: { options: { origins: ['a.example.com'] } } },
      overrides: [{ files: 'src/**', rules: { r: { options: { origins: ['b.example.com'] } } } }]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/x.svelte' }).origins).toEqual([
      'fonts.googleapis.com',
      'a.example.com',
      'b.example.com'
    ]);
  });
  it('ignores options under a category key', () => {
    const config = defineConfig({
      overrides: [{ files: 'src/**', rules: { seo: { options: { max: 99 } } } }]
    });
    expect(resolveRuleOptions('r', spec, config, { file: 'src/x.svelte' }).max).toBe(6);
  });
  it('gives the same answer with a hoisted compiled list', () => {
    const config = defineConfig({ overrides: [{ files: 'src/lib/**', rules: { r: { options: { max: 4 } } } }] });
    const compiled = compileOverrides(config);
    expect(resolveRuleOptions('r', spec, config, { file: 'src/lib/B.svelte' }, compiled).max).toBe(4);
  });
  it('returns a list default the caller can mutate without corrupting the spec', () => {
    const result = resolveRuleOptions('r', spec, defineConfig({}));
    (result.origins as string[]).push('mutated.example.com');
    expect(spec.origins!.default).toEqual(['fonts.googleapis.com']);
    expect(resolveRuleOptions('r', spec, defineConfig({})).origins).toEqual(['fonts.googleapis.com']);
  });
  it('returns a map default the caller can mutate without corrupting the spec', () => {
    const result = resolveRuleOptions('r', spec, defineConfig({}));
    (result.packages as Record<string, string>).moment = 'use dayjs';
    expect(spec.packages!.default).toEqual({ lodash: 'use lodash-es' });
    expect(resolveRuleOptions('r', spec, defineConfig({})).packages).toEqual({ lodash: 'use lodash-es' });
  });
});

describe('validateRuleOptions', () => {
  it('accepts valid options', () => {
    expect(validateRuleOptions('r', spec, { max: 10, origins: ['a.com'], packages: { m: 'x' } })).toEqual([]);
  });
  it('rejects an unknown option key', () => {
    expect(validateRuleOptions('r', spec, { maxx: 10 })[0]).toContain("unknown option 'maxx'");
  });
  it('rejects options on a rule that declares none', () => {
    expect(validateRuleOptions('r', undefined, { max: 1 })[0]).toContain('takes no options');
  });
  it('rejects a non-integer for an integer option', () => {
    expect(validateRuleOptions('r', spec, { max: '10' })[0]).toContain('must be an integer');
    expect(validateRuleOptions('r', spec, { max: 1.5 })[0]).toContain('must be an integer');
  });
  it('rejects an integer below the spec minimum', () => {
    expect(validateRuleOptions('r', spec, { max: 0 })[0]).toContain('must be >= 1');
  });
  it('rejects a non-list for a list option', () => {
    expect(validateRuleOptions('r', spec, { origins: 'a.com' })[0]).toContain('array of non-empty strings');
    expect(validateRuleOptions('r', spec, { origins: [''] })[0]).toContain('array of non-empty strings');
  });
  it('rejects a non-map for a map option', () => {
    expect(validateRuleOptions('r', spec, { packages: ['lodash'] })[0]).toContain('string → non-empty string');
    expect(validateRuleOptions('r', spec, { packages: { lodash: 1 } })[0]).toContain('string → non-empty string');
  });

  describe('min/max cross-check (Finding 3)', () => {
    const lengthSpec: RuleOptionsSpec = {
      min: { kind: 'integer', default: 30, min: 0 },
      max: { kind: 'integer', default: 60, min: 1 }
    };
    it('rejects a configured min above the built-in max', () => {
      const errors = validateRuleOptions('seo/title-length', lengthSpec, { min: 100 });
      expect(errors[0]).toContain('min (100) must be <= max (60)');
    });
    it('rejects a configured max below the built-in min', () => {
      const errors = validateRuleOptions('seo/title-length', lengthSpec, { max: 1 });
      expect(errors[0]).toContain('min (30) must be <= max (1)');
    });
    it('rejects both sides configured but inverted', () => {
      const errors = validateRuleOptions('seo/title-length', lengthSpec, { min: 20, max: 10 });
      expect(errors[0]).toContain('min (20) must be <= max (10)');
    });
    it('accepts a valid configured range', () => {
      expect(validateRuleOptions('seo/title-length', lengthSpec, { min: 5, max: 10 })).toEqual([]);
    });
    it('does not double-report when a per-key type error already fired', () => {
      const errors = validateRuleOptions('seo/title-length', lengthSpec, { min: '100' as unknown as number });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('must be an integer');
    });

    // 2026-07-26 second review, Finding B: the guard used to be `errors.length
    // === 0`, so ANY unrelated error (e.g. a typo'd key) suppressed the range
    // check too, hiding a real inversion behind a fixable typo.
    it('still reports the range problem alongside an unrelated unknown-key error', () => {
      const errors = validateRuleOptions('seo/title-length', lengthSpec, { min: 100, foo: 1 });
      expect(errors).toHaveLength(2);
      expect(errors.some((e) => e.includes("unknown option 'foo'"))).toBe(true);
      expect(errors.some((e) => e.includes('min (100) must be <= max (60)'))).toBe(true);
    });

    // 2026-07-26 second review, Finding A: the cross-check must compare against
    // the value actually resolved from earlier layers (`baseline`), not blindly
    // against the spec's own built-in default — otherwise a layer that narrows
    // one side of an already-widened range is falsely rejected, and a layer that
    // narrows one side of an already-narrowed range is falsely accepted.
    describe('with a baseline (resolved earlier layers)', () => {
      it('accepts a layer that only sets one side, when it is valid against the baseline', () => {
        // Global range is 100-200; this layer only narrows min to 150, which is
        // still <= the baseline max of 200 — valid, even though 150 > the spec's
        // own built-in max of 60.
        expect(validateRuleOptions('seo/title-length', lengthSpec, { min: 150 }, { min: 100, max: 200 })).toEqual([]);
      });
      it('rejects a layer that only sets one side, when it inverts the baseline', () => {
        // Baseline (an earlier layer) is min: 40, max: 60 — each side alone is
        // valid against the spec default (40 <= 60, 30 <= 60). This layer sets
        // only max: 35, which inverts against the baseline's min of 40, even
        // though 35 >= the spec's own built-in min of 30.
        const errors = validateRuleOptions('seo/title-length', lengthSpec, { max: 35 }, { min: 40, max: 60 });
        expect(errors[0]).toContain('min (40) must be <= max (35)');
      });

      // Task 3 (Minor, 2026-07-26 third review): a partial baseline used to
      // silently no-op the cross-check, since `minVal > maxVal` is always
      // `false` in JS when either side is `undefined`. Every in-repo caller
      // passes a fully resolved baseline, but `validateRuleOptions` is a
      // public `@svelte-vitals/core` export, so a caller that passes a
      // partial baseline must not have the check quietly do nothing.
      it('does not report a false positive when the baseline only has one side (missing side unresolved)', () => {
        expect(validateRuleOptions('seo/title-length', lengthSpec, { min: 50 }, { min: 40 })).toEqual([]);
      });
      it('still catches an inversion when the baseline is partial but options sets both sides', () => {
        const errors = validateRuleOptions('seo/title-length', lengthSpec, { min: 50, max: 10 }, { min: 40 });
        expect(errors[0]).toContain('min (50) must be <= max (10)');
      });
    });

    // Task 2 (2026-07-26 third review, Finding A continued): a caller can tell
    // `validateRuleOptions` to skip the cross-check entirely when it statically
    // cannot rule out that some other config layer (e.g. a sibling `overrides[]`
    // entry) narrows the opposite side at the same target — see the CLI's and
    // the Vite plugin's `otherOverrideNarrowsOppositeSide`.
    describe('skipRangeCheck', () => {
      it('suppresses the cross-check even when options+baseline would otherwise invert', () => {
        expect(validateRuleOptions('seo/title-length', lengthSpec, { min: 100 }, { min: 30, max: 60 }, true)).toEqual(
          []
        );
      });
      it('still reports non-range errors (e.g. an unknown key) while the range check is skipped', () => {
        const errors = validateRuleOptions('seo/title-length', lengthSpec, { min: 100, foo: 1 }, undefined, true);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("unknown option 'foo'");
      });
    });
  });
});
