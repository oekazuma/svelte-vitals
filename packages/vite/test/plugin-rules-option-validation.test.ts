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
});
