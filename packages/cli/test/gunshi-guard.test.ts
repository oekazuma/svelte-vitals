// Phase 2a of the gunshi migration (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md):
// unit tests for the shared raw-argv pre-scan (gunshi/guard.ts), reproducing the Phase 1 spike's
// gate-(b) cells (spike-gunshi-parsing.test.ts) against the guard as actually shipped — driven by
// the real `VALUE_FLAGS` import from resolve-args.ts, not a second hardcoded flag list.
import { describe, it, expect } from 'vitest';
import { guardArgs } from '../src/gunshi/guard.js';
import { VALUE_FLAGS } from '../src/resolve-args.js';

describe('guardArgs: value-carrying flags (using the real analyzer VALUE_FLAGS list)', () => {
  it('--reporter= (empty, inline) is rejected with the current wording', () => {
    const { errors } = guardArgs(['--reporter='], VALUE_FLAGS, []);
    expect(errors).toEqual(['svelte-vitals: --reporter requires a value.']);
  });

  it("--reporter '' (empty, split token) is rejected", () => {
    const { errors } = guardArgs(['--reporter', ''], VALUE_FLAGS, []);
    expect(errors).toEqual(['svelte-vitals: --reporter requires a value.']);
  });

  it('--reporter --score (flag-like value) is rejected with the current wording, not invalid-type', () => {
    const { errors } = guardArgs(['--reporter', '--score'], VALUE_FLAGS, []);
    expect(errors).toEqual(['svelte-vitals: --reporter requires a value.']);
  });

  it('--out-file - and --out-file=- are exempted (the documented stdout marker)', () => {
    expect(guardArgs(['--out-file', '-'], VALUE_FLAGS, []).errors).toEqual([]);
    expect(guardArgs(['--out-file=-'], VALUE_FLAGS, []).errors).toEqual([]);
  });

  it('--diff is not in VALUE_FLAGS, so a bare/dash-shaped --diff is never flagged here (parseRunArgs owns its default-ref rewrite)', () => {
    expect(guardArgs(['--diff'], VALUE_FLAGS, []).errors).toEqual([]);
    expect(guardArgs(['--diff', '--staged'], VALUE_FLAGS, []).errors).toEqual([]);
  });

  it('a well-formed run produces no errors', () => {
    expect(guardArgs(['--reporter', 'json', '--min-health', '80'], VALUE_FLAGS, []).errors).toEqual([]);
  });

  it('an unrelated flag not in valueFlags is never checked', () => {
    expect(guardArgs(['--bogus='], [], []).errors).toEqual([]);
  });
});

describe('guardArgs: boolean --flag=false normalization', () => {
  it('drops a --<boolFlag>=false token from argv entirely (equivalent to "not passed")', () => {
    const { argv } = guardArgs(['--json=false', 'show', 'config'], [], ['json']);
    expect(argv).toEqual(['show', 'config']);
  });

  it('leaves --<boolFlag>=true untouched — only the literal false coercion is special-cased', () => {
    const { argv } = guardArgs(['--json=true'], [], ['json']);
    expect(argv).toEqual(['--json=true']);
  });

  it('only drops the token for flags named in booleanFlags, not every =false', () => {
    const { argv } = guardArgs(['--fail-on=false', '--json=false'], [], ['json']);
    expect(argv).toEqual(['--fail-on=false']);
  });

  it('a well-formed run is untouched', () => {
    const { argv } = guardArgs(['show', 'config'], [], ['json', 'help']);
    expect(argv).toEqual(['show', 'config']);
  });

  it('duplicate tokens are last-wins: a trailing =false turns the flag off entirely', () => {
    // Legacy parity: util.parseArgs overwrites on repetition, so `--json --json=false` is off.
    const { argv } = guardArgs(['--json', '--json=false'], [], ['json']);
    expect(argv).toEqual([]);
  });

  it('duplicate tokens are last-wins: a trailing bare flag stays on', () => {
    const { argv } = guardArgs(['--json=false', '--json'], [], ['json']);
    expect(argv).toEqual(['--json']);
  });
});
