import { describe, it, expect } from 'vitest';
import { VITE_TARGETS, viteTargetById } from '../../src/install/vite-targets.js';

describe('vite targets', () => {
  it('has both targets with distinct ids', () => {
    expect(VITE_TARGETS.map((t) => t.id).sort()).toEqual(['vite-dev-overlay', 'vite-plugin']);
  });
  it('each target has a non-empty label and hint', () => {
    for (const t of VITE_TARGETS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
    }
  });
  it('viteTargetById resolves a known id', () => {
    expect(viteTargetById('vite-plugin')?.label).toBe('Vite plugin (build gate)');
  });
  it('viteTargetById returns undefined for an unknown id', () => {
    expect(viteTargetById('nope')).toBeUndefined();
  });
});
