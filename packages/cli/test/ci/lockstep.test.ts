import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CHECKOUT_SHA, CHECKOUT_VERSION } from '../../src/ci/workflow.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ciWorkflow = readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf-8');

describe('actions/checkout pin lockstep', () => {
  it("workflow.ts's CHECKOUT_SHA/CHECKOUT_VERSION match the pin this repo's own ci.yml uses", () => {
    const match = ciWorkflow.match(/uses: actions\/checkout@([0-9a-f]{40}) # (v\d+\.\d+\.\d+)/);
    expect(match).not.toBeNull();
    const [, sha, version] = match!;
    expect(CHECKOUT_SHA).toBe(sha);
    expect(CHECKOUT_VERSION).toBe(version);
  });
});
