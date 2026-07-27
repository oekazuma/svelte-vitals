import { describe, it, expect } from 'vitest';
import { svelteVitals } from '../src/index.js';

// Finding 4 (2026-07-26 rule-options review): the Vite plugin took `options.rules`
// straight into the Config with no validation, so `resolveRuleOptions` silently
// dropped an unknown option key (e.g. a typo) instead of failing loudly the way
// the CLI's config-file loader does for the same input.
describe('svelteVitals rules option validation', () => {
  it('throws synchronously on an unknown option key', () => {
    expect(() => svelteVitals({ ui: false, rules: { 'architecture/prop-count': { options: { maxx: 10 } } } })).toThrow(
      /unknown option 'maxx'/
    );
  });

  it('throws synchronously on an out-of-range option value', () => {
    expect(() => svelteVitals({ ui: false, rules: { 'architecture/prop-count': { options: { max: 0 } } } })).toThrow(
      /must be >= 1/
    );
  });

  it('throws synchronously on options for a rule that takes none', () => {
    expect(() => svelteVitals({ ui: false, rules: { 'seo/title-presence': { options: { max: 1 } } } })).toThrow(
      /takes no options/
    );
  });

  it('throws synchronously on an inverted min/max range', () => {
    expect(() => svelteVitals({ ui: false, rules: { 'seo/title-length': { options: { min: 100 } } } })).toThrow(
      /min \(100\) must be <= max \(60\)/
    );
  });

  it('accepts a valid rules option', () => {
    expect(() =>
      svelteVitals({ ui: false, rules: { 'architecture/prop-count': { options: { max: 10 } } } })
    ).not.toThrow();
  });

  it('accepts the bare string form and object forms without options', () => {
    expect(() =>
      svelteVitals({
        ui: false,
        rules: { 'seo/title-presence': 'off', 'architecture/prop-count': { severity: 'warning' } }
      })
    ).not.toThrow();
  });

  it('accepts no rules option at all', () => {
    expect(() => svelteVitals({ ui: false })).not.toThrow();
  });

  // 2026-07-26 second review, Finding D: an unknown rule id with options used to
  // report the misleading "takes no options" (ruleOptionsSpec returns undefined
  // for an unknown id), instead of pointing at the actual problem — the typo'd id.
  it('throws "unknown rule id" (not "takes no options") for a typo\'d id carrying options', () => {
    expect(() => svelteVitals({ ui: false, rules: { 'seo/titel-length': { options: { max: 10 } } } })).toThrowError(
      /unknown rule id\(s\): seo\/titel-length/
    );
  });

  it('throws "unknown rule id" for a typo\'d id with no options at all (pre-existing silent gap, now closed)', () => {
    expect(() => svelteVitals({ ui: false, rules: { 'seo/titel-length': 'off' } })).toThrowError(
      /unknown rule id\(s\): seo\/titel-length/
    );
  });

  // The setting shape itself is now checked too, through the same
  // `validateRuleSetting` the CLI's config-file loader uses. TypeScript catches
  // these for a `vite.config.ts`, but a `vite.config.js` got no help at all and
  // the typo'd field silently left the rule at its built-in severity — the exact
  // failure mode this validation exists to prevent.
  it('throws on an invalid severity string', () => {
    expect(() => svelteVitals({ ui: false, rules: { 'architecture/prop-count': 'error' as never } })).toThrow(
      /invalid setting 'error'/
    );
  });

  it('throws on an invalid severity in the object form', () => {
    expect(() =>
      svelteVitals({ ui: false, rules: { 'architecture/prop-count': { severity: 'error' as never } } })
    ).toThrow(/rules\.architecture\/prop-count\.severity: invalid setting 'error'/);
  });

  it('throws on an unrecognized key in the object form', () => {
    expect(() =>
      svelteVitals({ ui: false, rules: { 'architecture/prop-count': { sevrity: 'warning' } as never } })
    ).toThrow(/unknown key\(s\) sevrity/);
  });
});

// 2026-07-26 second review, Finding C: only `options.rules` was validated, so a
// typo inside `options.overrides[].rules[id].options` was silently dropped by
// `resolveRuleOptions` instead of failing loudly — the exact failure mode the
// per-rule-options feature exists to prevent, in the field the changeset
// advertises as the per-path home for options.
describe('svelteVitals overrides option validation', () => {
  it('throws synchronously on an unknown option key inside an override', () => {
    expect(() =>
      svelteVitals({
        ui: false,
        overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { maxx: 10 } } } }]
      })
    ).toThrow(/unknown option 'maxx'/);
  });

  it('throws synchronously on an unknown rule id inside an override', () => {
    expect(() =>
      svelteVitals({ ui: false, overrides: [{ route: '/x', rules: { 'seo/titel-length': { options: { max: 10 } } } }] })
    ).toThrow(/unknown rule id\(s\) or categories: seo\/titel-length/);
  });

  it('throws synchronously on options under a category key inside an override', () => {
    expect(() =>
      svelteVitals({ ui: false, overrides: [{ route: '/x', rules: { seo: { options: { max: 10 } } } }] })
    ).toThrow(/options are not allowed on a category key/);
  });

  it('accepts a valid overrides option', () => {
    expect(() =>
      svelteVitals({
        ui: false,
        overrides: [{ route: '/x', rules: { 'architecture/prop-count': { options: { max: 4 } } } }]
      })
    ).not.toThrow();
  });

  it('accepts an override that only narrows one side of an otherwise-valid global range (Finding A)', () => {
    expect(() =>
      svelteVitals({
        ui: false,
        rules: { 'seo/title-length': { options: { min: 100, max: 200 } } },
        overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { min: 150 } } } }]
      })
    ).not.toThrow();
  });

  it('rejects an override whose resolved range is inverted even though neither layer is inverted alone (Finding A)', () => {
    expect(() =>
      svelteVitals({
        ui: false,
        rules: { 'seo/title-length': { options: { min: 40 } } },
        overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { max: 35 } } } }]
      })
    ).toThrow(/min \(40\) must be <= max \(35\)/);
  });

  it('accepts no overrides option at all', () => {
    expect(() => svelteVitals({ ui: false })).not.toThrow();
  });

  it('accepts two override entries that jointly widen a range, when validating one against the built-in default alone would falsely invert it (Finding A, third pass)', () => {
    expect(() =>
      svelteVitals({
        ui: false,
        overrides: [
          { files: 'src/routes/**', rules: { 'seo/title-length': { options: { max: 200 } } } },
          { route: '/landing', rules: { 'seo/title-length': { options: { min: 100 } } } }
        ]
      })
    ).not.toThrow();
  });

  // With no `rules` option, `analyze()` resolves the global layer from
  // svelte-vitals.config.* instead — a file this synchronous construction-time
  // check cannot read. A config file widening `max` while this override narrows
  // `min` is a valid combination, so judging the override against the built-in
  // default alone would hard-fail `vite build` over a correct config.
  it('does not range-check an override when no rules option is given (the config file may widen the range)', () => {
    expect(() =>
      svelteVitals({
        ui: false,
        overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { min: 100 } } } }]
      })
    ).not.toThrow();
  });

  it('still range-checks an override that inverts on its own once a rules option is given', () => {
    expect(() =>
      svelteVitals({
        ui: false,
        rules: {},
        overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { min: 100 } } } }]
      })
    ).toThrow(/min \(100\) must be <= max \(60\)/);
  });

  it('still reports type and unknown-key problems in an override with no rules option', () => {
    expect(() =>
      svelteVitals({
        ui: false,
        overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { min: 0.5 } } } }]
      })
    ).toThrow(/must be an integer/);
    expect(() =>
      svelteVitals({ ui: false, overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { mn: 10 } } } }] })
    ).toThrow(/unknown option 'mn'/);
  });

  it('validates the setting shape inside an override (severity and unknown keys)', () => {
    expect(() =>
      svelteVitals({ ui: false, overrides: [{ route: '/x', rules: { 'seo/title-length': 'error' as never } }] })
    ).toThrow(/invalid setting 'error'/);
    expect(() =>
      svelteVitals({ ui: false, overrides: [{ route: '/x', rules: { seo: { severity: 'error' as never } } }] })
    ).toThrow(/overrides\[0\]\.rules\.seo\.severity: invalid setting 'error'/);
  });
});
