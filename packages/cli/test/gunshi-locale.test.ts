// ja `--help` design (docs/superpowers/specs/2026-08-11-cli-ja-help-design.md): locale resolution
// is a pure function over an injected env, POSIX first-non-empty-wins across
// SVELTE_VITALS_LANG > LC_ALL > LC_MESSAGES > LANG.
import { describe, it, expect } from 'vitest';
import { resolveLocale } from '../src/gunshi/locale.js';

describe('resolveLocale', () => {
  it('defaults to en when every precedence var is absent', () => {
    expect(resolveLocale({})).toBe('en');
  });

  it('an empty string counts as absent, same as unset', () => {
    expect(resolveLocale({ SVELTE_VITALS_LANG: '', LANG: 'ja_JP.UTF-8' })).toBe('ja');
  });

  it('canonicalizes ja_JP.UTF-8 to ja', () => {
    expect(resolveLocale({ LANG: 'ja_JP.UTF-8' })).toBe('ja');
  });

  it('canonicalizes ja-JP to ja', () => {
    expect(resolveLocale({ LANG: 'ja-JP' })).toBe('ja');
  });

  it('canonicalizes the bare ja to ja', () => {
    expect(resolveLocale({ LANG: 'ja' })).toBe('ja');
  });

  it('en_US does not canonicalize to ja', () => {
    expect(resolveLocale({ LANG: 'en_US.UTF-8' })).toBe('en');
  });

  it('a garbage locale value falls back to en', () => {
    expect(resolveLocale({ LANG: 'not-a-real-locale' })).toBe('en');
  });

  it('a value merely containing "ja" as a substring does not canonicalize (japanese !== ja)', () => {
    expect(resolveLocale({ LANG: 'japanese' })).toBe('en');
  });

  // Three adjacent-precedence cells — one per boundary in the four-tier chain — each proving the
  // higher-priority var decides regardless of which direction (ja vs. non-ja) it points, not just
  // that "English always wins."
  describe('precedence (each level beats the next, regardless of direction)', () => {
    it('SVELTE_VITALS_LANG beats LC_ALL/LC_MESSAGES/LANG even when it is the non-Japanese one', () => {
      expect(
        resolveLocale({
          SVELTE_VITALS_LANG: 'en',
          LC_ALL: 'ja_JP.UTF-8',
          LC_MESSAGES: 'ja_JP.UTF-8',
          LANG: 'ja_JP.UTF-8'
        })
      ).toBe('en');
    });

    it("LC_ALL beats LC_MESSAGES/LANG even when it is the non-Japanese one (design doc's own example)", () => {
      expect(resolveLocale({ LC_ALL: 'en_US', LC_MESSAGES: 'ja_JP', LANG: 'ja_JP' })).toBe('en');
    });

    it('LC_MESSAGES beats LANG even when it is the Japanese one', () => {
      expect(resolveLocale({ LC_MESSAGES: 'ja_JP.UTF-8', LANG: 'en_US.UTF-8' })).toBe('ja');
    });
  });

  it('an explicit SVELTE_VITALS_LANG=ja wins under an otherwise-English env', () => {
    expect(resolveLocale({ SVELTE_VITALS_LANG: 'ja', LANG: 'en_US.UTF-8' })).toBe('ja');
  });

  // The help goldens (help-golden.test.ts / help-golden-ja.test.ts) call `runCli` without an `env`
  // argument on the en side, relying on `process.env` carrying no locale override in the test
  // harness — this pins that assumption so a future CI/dev env change fails loudly here instead of
  // silently flipping the English goldens to ja.
});
