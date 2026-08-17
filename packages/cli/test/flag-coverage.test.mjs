import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kebabnize } from 'gunshi/utils';
import { ROOT_ARGS } from '../dist/gunshi-registry.js';

// A user-facing lever that silently does nothing while the run reports success is this
// project's recurring defect class (design: 2026-08-17-inline-suppression-line-anchored).
// This holds the line at the cheapest enforceable point: no analyzer flag ships without a
// test naming it. It proves a flag is exercised, NOT that the test asserts the right effect —
// that judgement stays with review. There is deliberately no exemption list: every flag is
// covered today, and the first entry would be the crack the class comes back through.
const testDirs = [
  dirname(fileURLToPath(import.meta.url)),
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'examples', 'kitchen-sink', 'test')
];

function allTestSources() {
  return testDirs
    .flatMap((dir) => readdirSync(dir).map((f) => join(dir, f)))
    .filter((p) => /\.test\.(ts|mjs)$/.test(p))
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n');
}

describe('analyzer flag coverage', () => {
  it('names every flag in at least one test', () => {
    const sources = allTestSources();
    const flags = Object.entries(ROOT_ARGS).map(([key, schema]) => (schema.toKebab ? kebabnize(key) : key));
    const uncovered = flags.filter((f) => !new RegExp(`--${f}(?![a-z-])`).test(sources));
    expect(uncovered).toEqual([]);
  });
});
