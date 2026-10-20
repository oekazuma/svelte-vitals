import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allRules } from '@svelte-vitals/core/internal';
import {
  digest,
  extractBlock,
  normalizeBlock,
  readVerdicts,
  renderBlock,
  reportPath
} from '../scripts/rule-reliability.js';

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

  // Reads every verdict file of the corpus: about 2s on a busy CI runner at 534 apps, and growing with it.
  it('was measured against the committed targets and verdicts', { timeout: 20_000 }, () => {
    expect(measurement.targets, REGENERATE).toBe(digest(targets));
    expect(measurement.verdicts, REGENERATE).toBe(digest(readVerdicts(join(corpusDir, 'verdicts'))));
  });

  it('matches the generator', () => {
    const committed = extractBlock(readFileSync(reportPath(repoRoot), 'utf8'));
    expect(normalizeBlock(committed), REGENERATE).toBe(normalizeBlock(renderBlock(allRules, measurement, targets)));
  });
});

describe('readVerdicts', () => {
  it('names the ledger file that does not parse', () => {
    const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-verdicts-'));
    try {
      writeFileSync(join(dir, 'a__good.json'), '[]');
      writeFileSync(join(dir, 'b__broken.json'), '[{"key":');
      expect(() => readVerdicts(dir)).toThrow(/b__broken\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
