import { describe, it, expect } from 'vitest';
import { defineConfig } from '../src/index.js';
import { resolveRuleOptions, validateRuleSetting, shouldSkipRangeCheck, compileOverrides } from '../src/internal.js';
import { isMentionedAnywhere, validateRuleOptions, intOption, listOption, mapOption } from '../src/rule-options.js';
import type { RuleOptionsSpec } from '../src/internal.js';

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
  it('accepts an empty options object on a rule that declares none', () => {
    // `{ options: {} }` configures nothing, so it can't be the typo this check
    // exists to catch — failing it would only annoy.
    expect(validateRuleOptions('r', undefined, {})).toEqual([]);
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
      const errors = validateRuleOptions('seo/title-length', lengthSpec, { min: '100' });
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

// The whole skip decision, shared by the CLI's config-file loader and the Vite
// plugin (they held line-for-line copies of it before).
describe('shouldSkipRangeCheck', () => {
  const entry = (options: Record<string, unknown>) => ({ rules: { 'seo/title-length': { options } } });

  it('skips when another entry narrows the opposite side', () => {
    const overrides = [entry({ max: 200 }), entry({ min: 100 })];
    expect(shouldSkipRangeCheck(overrides, 1, 'seo/title-length', overrides[1]!.rules['seo/title-length'])).toBe(true);
  });
  it('does not skip when no other entry touches the opposite side', () => {
    const overrides = [entry({ min: 100 })];
    expect(shouldSkipRangeCheck(overrides, 0, 'seo/title-length', overrides[0]!.rules['seo/title-length'])).toBe(false);
  });
  it('does not skip when the entry sets both sides itself', () => {
    const overrides = [entry({ max: 200 }), entry({ min: 100, max: 150 })];
    expect(shouldSkipRangeCheck(overrides, 1, 'seo/title-length', overrides[1]!.rules['seo/title-length'])).toBe(false);
  });
  it('does not skip when the entry sets neither side', () => {
    const overrides = [entry({ max: 200 }), entry({})];
    expect(shouldSkipRangeCheck(overrides, 1, 'seo/title-length', overrides[1]!.rules['seo/title-length'])).toBe(false);
  });
  it('ignores the same side set by another entry', () => {
    const overrides = [entry({ min: 40 }), entry({ min: 100 })];
    expect(shouldSkipRangeCheck(overrides, 1, 'seo/title-length', overrides[1]!.rules['seo/title-length'])).toBe(false);
  });
  it('ignores a bare string setting and a malformed entry', () => {
    expect(shouldSkipRangeCheck([{ rules: { 'seo/title-length': 'off' } }], 0, 'seo/title-length', 'off')).toBe(false);
    const overrides = [null, entry({ min: 100 })];
    expect(shouldSkipRangeCheck(overrides, 1, 'seo/title-length', overrides[1]!.rules['seo/title-length'])).toBe(false);
  });
});

// The single definition of what a rule setting may look like — the CLI config-file
// loader and the Vite plugin both funnel through it, so a config file and the
// equivalent plugin option are accepted or rejected identically.
describe('validateRuleSetting', () => {
  const opts = { allowOptions: true };

  it('accepts every bare string form', () => {
    for (const s of ['off', 'critical', 'warning', 'info']) {
      expect(validateRuleSetting('rules.r', 'r', s, spec, opts)).toEqual([]);
    }
  });
  it('rejects an unknown bare string', () => {
    expect(validateRuleSetting('rules.r', 'r', 'error', spec, opts)[0]).toContain("invalid setting 'error'");
  });
  it('rejects a non-object, non-string setting', () => {
    expect(validateRuleSetting('rules.r', 'r', 3, spec, opts)[0]).toContain("an object with 'severity'");
    expect(validateRuleSetting('rules.r', 'r', ['off'], spec, opts)[0]).toContain("an object with 'severity'");
  });
  it('accepts the object form with only a severity, or only options', () => {
    expect(validateRuleSetting('rules.r', 'r', { severity: 'off' }, spec, opts)).toEqual([]);
    expect(validateRuleSetting('rules.r', 'r', { options: { max: 4 } }, spec, opts)).toEqual([]);
  });
  it('rejects an invalid severity in the object form', () => {
    expect(validateRuleSetting('rules.r', 'r', { severity: 'error' }, spec, opts)[0]).toContain(
      "rules.r.severity: invalid setting 'error'"
    );
  });
  it('rejects an unknown key in the object form', () => {
    expect(validateRuleSetting('rules.r', 'r', { sevrity: 'warning' }, spec, opts)[0]).toContain(
      'unknown key(s) sevrity'
    );
  });
  it('reports a bad severity and a bad option together', () => {
    const errors = validateRuleSetting('rules.r', 'r', { severity: 'error', options: { maxx: 1 } }, spec, opts);
    expect(errors.some((e) => e.includes("invalid setting 'error'"))).toBe(true);
    expect(errors.some((e) => e.includes("unknown option 'maxx'"))).toBe(true);
  });
  it('rejects options on a category key', () => {
    expect(
      validateRuleSetting('overrides[0].rules.seo', 'seo', { options: { max: 4 } }, undefined, {
        allowOptions: false
      })[0]
    ).toContain('options are not allowed on a category key');
  });
  it('accepts a severity on a category key', () => {
    expect(
      validateRuleSetting('overrides[0].rules.seo', 'seo', { severity: 'critical' }, undefined, { allowOptions: false })
    ).toEqual([]);
  });
  it('rejects a non-object options value', () => {
    expect(validateRuleSetting('rules.r', 'r', { options: 4 }, spec, opts)[0]).toContain(
      'rules.r.options: must be an object'
    );
  });
  it('passes baseline and skipRangeCheck through to validateRuleOptions', () => {
    const lengthSpec: RuleOptionsSpec = {
      min: { kind: 'integer', default: 30, min: 0 },
      max: { kind: 'integer', default: 60, min: 1 }
    };
    const setting = { options: { min: 150 } };
    expect(validateRuleSetting('rules.r', 'r', setting, lengthSpec, opts)[0]).toContain('must be <= max (60)');
    expect(
      validateRuleSetting('rules.r', 'r', setting, lengthSpec, { ...opts, baseline: { min: 100, max: 200 } })
    ).toEqual([]);
    expect(validateRuleSetting('rules.r', 'r', setting, lengthSpec, { ...opts, skipRangeCheck: true })).toEqual([]);
  });
});

describe('typed option accessors', () => {
  it('reads a declared value of each kind', () => {
    const o = resolveRuleOptions('r', spec, defineConfig({}));
    expect(intOption(o, 'max')).toBe(6);
    expect(listOption(o, 'origins')).toEqual(['fonts.googleapis.com']);
    expect(mapOption(o, 'packages')).toEqual({ lodash: 'use lodash-es' });
  });
  it('falls back rather than crashing on a key the rule never declared', () => {
    expect(intOption({}, 'max')).toBe(0);
    expect(intOption({}, 'max', 6)).toBe(6);
    expect(listOption({}, 'origins')).toEqual([]);
    expect(mapOption({}, 'packages')).toEqual({});
  });
  it('falls back on a value of the wrong kind', () => {
    expect(intOption({ max: 'six' }, 'max', 6)).toBe(6);
    expect(listOption({ origins: 'a.com' }, 'origins')).toEqual([]);
    expect(mapOption({ packages: ['lodash'] }, 'packages')).toEqual({});
    expect(mapOption({ packages: null }, 'packages')).toEqual({});
  });
});

describe('isMentionedAnywhere', () => {
  const ID = 'architecture/unit-entry-file';

  it('is false when no layer names the rule', () => {
    expect(isMentionedAnywhere(defineConfig({}), ID)).toBe(false);
    expect(isMentionedAnywhere(defineConfig({ rules: { 'seo/title-presence': 'off' } }), ID)).toBe(false);
  });

  it('is true for a `rules` entry, even a bare severity carrying no options', () => {
    // Conservative on purpose: the caller then does its normal work and finds nothing declared. A
    // version answering `false` here would make a rule skip work it owed, which is the one failure
    // this helper must not have.
    expect(isMentionedAnywhere(defineConfig({ rules: { [ID]: 'off' } }), ID)).toBe(true);
  });

  it('is true for a rule mentioned only inside an overrides entry', () => {
    // The case that matters. These rules resolve options per directory, so a declaration can arrive
    // from an override alone — an early return keyed on the global layer only would swallow it.
    const config = defineConfig({
      overrides: [{ files: 'src/**', rules: { [ID]: { options: { units: { 'src/*': '.ts' } } } } }]
    });
    expect(isMentionedAnywhere(config, ID)).toBe(true);
  });

  it('is false for a name inherited from Object.prototype, in either layer', () => {
    // A presence test would find `Object.prototype.toString` on these plain objects and report the
    // rule as mentioned. No registered rule id can reach this — every one contains a `/` — but the
    // helper takes the id as a parameter, so it should not rely on every caller passing a literal.
    expect(isMentionedAnywhere(defineConfig({}), 'toString')).toBe(false);
    expect(isMentionedAnywhere(defineConfig({}), 'constructor')).toBe(false);
    expect(isMentionedAnywhere(defineConfig({ overrides: [{ files: 'src/**', rules: {} }] }), 'toString')).toBe(false);
  });

  it('is false when an overrides entry names only other rules', () => {
    expect(isMentionedAnywhere(defineConfig({ overrides: [{ files: 'src/**', rules: { seo: 'off' } }] }), ID)).toBe(
      false
    );
  });
});
