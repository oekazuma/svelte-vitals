import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allRules } from '@svelte-vitals/core/internal';
import { digest, extractBlock, normalizeBlock, renderBlock, reportPath } from '../scripts/rule-reliability.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const corpusDir = join(repoRoot, 'scripts', 'corpus');
const readJson = (name: string) => JSON.parse(readFileSync(join(corpusDir, name), 'utf8'));
const REGENERATE =
  'run `pnpm build && pnpm corpus update && pnpm format` (design: 2026-09-23-corpus-precision-design.md)';

const measurement = readJson('measurement.json');
const targets = readJson('targets.json');

describe('scripts/corpus/README.md matches the committed corpus measurement', () => {
  it('measures every registered rule', () => {
    const missing = allRules.map((rule) => rule.id).filter((id) => !(id in measurement.rules));
    expect(missing, REGENERATE).toEqual([]);
  });

  it('was measured against the committed targets and verdicts', () => {
    expect(measurement.targets, REGENERATE).toBe(digest(targets));
    expect(measurement.verdicts, REGENERATE).toBe(digest(readJson('verdicts.json')));
  });

  it('matches the generator', () => {
    const committed = extractBlock(readFileSync(reportPath(repoRoot), 'utf8'));
    expect(normalizeBlock(committed), REGENERATE).toBe(normalizeBlock(renderBlock(allRules, measurement, targets)));
  });
});
