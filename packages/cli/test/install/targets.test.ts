import { describe, it, expect } from 'vitest';
import { INSTALL_TARGETS, isKind, targetById, targetsOfKind } from '../../src/install/targets.js';

describe('install targets', () => {
  it('has all five targets with distinct ids', () => {
    expect(INSTALL_TARGETS.map((t) => t.id).sort()).toEqual([
      'ci-workflow',
      'config-file',
      'cursor-rules',
      'vite-hooks',
      'vite-plugin'
    ]);
  });

  it('each target has a non-empty label and hint', () => {
    for (const t of INSTALL_TARGETS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
    }
  });

  it('agent and ci targets carry non-empty relPaths', () => {
    expect(targetById('cursor-rules')?.relPaths).toEqual(['.cursor/rules/svelte-vitals.mdc']);
    expect(targetById('ci-workflow')?.relPaths).toEqual(['.github/workflows/svelte-vitals.yml']);
  });

  it('targetById resolves a known id and returns undefined for an unknown one', () => {
    expect(targetById('vite-plugin')?.label).toBe('Vite plugin (build gate)');
    expect(targetById('nope')).toBeUndefined();
  });

  it('the SKILL.md targets stay retired — skills are distributed via `npx skills add`, not the installer', () => {
    expect(targetById('claude-skill')).toBeUndefined();
    expect(targetById('claude-skill-improve')).toBeUndefined();
  });

  it('targetsOfKind partitions the registry without gaps or overlap', () => {
    expect(targetsOfKind('vite').map((t) => t.id)).toEqual(['vite-plugin', 'vite-hooks']);
    expect(targetsOfKind('agent').map((t) => t.id)).toEqual(['cursor-rules']);
    expect(targetsOfKind('config').map((t) => t.id)).toEqual(['config-file']);
    expect(targetsOfKind('ci').map((t) => t.id)).toEqual(['ci-workflow']);
  });

  it("isKind is true for a target of that kind and false for another family's id", () => {
    expect(isKind('vite-plugin', 'vite')).toBe(true);
    expect(isKind('cursor-rules', 'vite')).toBe(false);
    expect(isKind('cursor-rules', 'agent')).toBe(true);
    expect(isKind('config-file', 'config')).toBe(true);
    expect(isKind('ci-workflow', 'ci')).toBe(true);
    expect(isKind('nope', 'ci')).toBe(false);
  });
});
