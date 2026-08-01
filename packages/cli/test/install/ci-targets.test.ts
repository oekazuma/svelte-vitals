import { describe, it, expect } from 'vitest';
import { CI_TARGETS, ciTargetById, isCiTargetId } from '../../src/install/ci-targets.js';

describe('ci targets', () => {
  it('has exactly one target', () => {
    expect(CI_TARGETS.map((t) => t.id)).toEqual(['ci-workflow']);
  });
  it('each target has a non-empty label, hint, and relPath', () => {
    for (const t of CI_TARGETS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
      expect(t.relPath.length).toBeGreaterThan(0);
    }
  });
  it('ciTargetById resolves a known id to the GitHub Actions workflow path', () => {
    expect(ciTargetById('ci-workflow')?.relPath).toBe('.github/workflows/svelte-vitals.yml');
  });
  it('ciTargetById returns undefined for an unknown id', () => {
    expect(ciTargetById('nope')).toBeUndefined();
  });
  it("isCiTargetId is true for the ci target id and false for another family's id", () => {
    expect(isCiTargetId('ci-workflow')).toBe(true);
    expect(isCiTargetId('claude-skill')).toBe(false);
  });
});
