import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Config, Result } from '@svelte-vitals/core';
import { defineConfig } from '@svelte-vitals/core';
import { loadSuppressions, writeSuppressions, applySuppressions, SUPPRESSIONS_FILE } from '../src/suppressions.js';

const r = (over: Partial<Result>): Result => ({
  id: 'X',
  severity: 'warning',
  detection: { presence: 'none', value: 'absent' }, // penalized by default (isPenalized: presence 'none')
  message: 'm',
  ...over
});

const passing = (over: Partial<Result>): Result => ({
  id: 'X',
  severity: 'warning',
  detection: { presence: 'own', value: 'static' }, // not penalized
  message: 'm',
  ...over
});

const config: Config = defineConfig({});

const dirs: string[] = [];
function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-suppressions-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadSuppressions', () => {
  it('returns undefined when the file does not exist', () => {
    expect(loadSuppressions(makeDir())).toBeUndefined();
  });

  it('throws on invalid JSON', () => {
    const dir = makeDir();
    writeFileSync(join(dir, SUPPRESSIONS_FILE), '{not json');
    expect(() => loadSuppressions(dir)).toThrow(/not valid JSON/);
  });

  it('throws when the top level is not an object', () => {
    const dir = makeDir();
    writeFileSync(join(dir, SUPPRESSIONS_FILE), '[]');
    expect(() => loadSuppressions(dir)).toThrow(/expected a top-level JSON object/);
  });

  it('throws on a version mismatch', () => {
    const dir = makeDir();
    writeFileSync(join(dir, SUPPRESSIONS_FILE), JSON.stringify({ version: 2, suppressions: [] }));
    expect(() => loadSuppressions(dir)).toThrow(/expected "version": 1/);
  });

  it('throws when suppressions is not an array', () => {
    const dir = makeDir();
    writeFileSync(join(dir, SUPPRESSIONS_FILE), JSON.stringify({ version: 1, suppressions: {} }));
    expect(() => loadSuppressions(dir)).toThrow(/"suppressions" must be an array/);
  });

  it('throws when an entry is missing a string id', () => {
    const dir = makeDir();
    writeFileSync(join(dir, SUPPRESSIONS_FILE), JSON.stringify({ version: 1, suppressions: [{ route: '/blog' }] }));
    expect(() => loadSuppressions(dir)).toThrow(/must be an object with a string "id"/);
  });

  it('parses valid entries and ignores unknown keys (forward compat)', () => {
    const dir = makeDir();
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        extra: 'ignored',
        suppressions: [{ id: 'seo/title-presence', route: '/blog', location: 'a.svelte', future: 'ignored' }]
      })
    );
    expect(loadSuppressions(dir)).toEqual([{ id: 'seo/title-presence', route: '/blog', location: 'a.svelte' }]);
  });
});

describe('writeSuppressions', () => {
  it('writes only penalized findings, sorted and de-duplicated', () => {
    const dir = makeDir();
    const results: Result[] = [
      r({ id: 'seo/description-presence', route: '/blog' }),
      r({ id: 'seo/title-presence', route: '/a' }),
      r({ id: 'seo/title-presence', route: '/a' }), // duplicate key, should collapse
      passing({ id: 'seo/canonical-url', route: '/pass' }) // passing seed, must not be written
    ];
    const count = writeSuppressions(dir, results, config);
    expect(count).toBe(2);

    const written = JSON.parse(readFileSync(join(dir, SUPPRESSIONS_FILE), 'utf8'));
    expect(written).toEqual({
      version: 1,
      suppressions: [
        { id: 'seo/description-presence', route: '/blog' },
        { id: 'seo/title-presence', route: '/a' }
      ]
    });
  });

  it('prunes stale entries on a full rewrite (no merge with the previous file)', () => {
    const dir = makeDir();
    writeSuppressions(dir, [r({ id: 'OLD', route: '/gone' })], config);
    writeSuppressions(dir, [r({ id: 'NEW', route: '/here' })], config);
    const written = JSON.parse(readFileSync(join(dir, SUPPRESSIONS_FILE), 'utf8'));
    expect(written.suppressions).toEqual([{ id: 'NEW', route: '/here' }]);
  });

  it('writes an empty suppressions array when nothing is penalized', () => {
    const dir = makeDir();
    const count = writeSuppressions(dir, [passing({ id: 'seo/canonical-url' })], config);
    expect(count).toBe(0);
    const written = JSON.parse(readFileSync(join(dir, SUPPRESSIONS_FILE), 'utf8'));
    expect(written).toEqual({ version: 1, suppressions: [] });
  });
});

describe('applySuppressions', () => {
  it('removes penalized findings matching an entry', () => {
    const results: Result[] = [
      r({ id: 'seo/title-presence', route: '/blog' }),
      r({ id: 'seo/description-presence', route: '/other' })
    ];
    const {
      results: kept,
      suppressed,
      stale
    } = applySuppressions(results, [{ id: 'seo/title-presence', route: '/blog' }], config);
    expect(kept.map((x) => x.id)).toEqual(['seo/description-presence']);
    expect(suppressed).toBe(1);
    expect(stale).toBe(0);
  });

  it('never removes a passing seed even if its key matches an entry', () => {
    const results: Result[] = [passing({ id: 'seo/title-presence', route: '/blog' })];
    const { results: kept, suppressed } = applySuppressions(
      results,
      [{ id: 'seo/title-presence', route: '/blog' }],
      config
    );
    expect(kept).toEqual(results);
    expect(suppressed).toBe(0);
  });

  it('counts entries that matched nothing as stale', () => {
    const results: Result[] = [r({ id: 'seo/title-presence', route: '/blog' })];
    const {
      results: kept,
      suppressed,
      stale
    } = applySuppressions(
      results,
      [
        { id: 'seo/title-presence', route: '/blog' },
        { id: 'SEO999', route: '/gone' }
      ],
      config
    );
    expect(kept).toEqual([]);
    expect(suppressed).toBe(1);
    expect(stale).toBe(1);
  });

  it('is a no-op with an empty entry list', () => {
    const results: Result[] = [r({ id: 'seo/title-presence', route: '/blog' })];
    const { results: kept, suppressed, stale } = applySuppressions(results, [], config);
    expect(kept).toEqual(results);
    expect(suppressed).toBe(0);
    expect(stale).toBe(0);
  });
});
