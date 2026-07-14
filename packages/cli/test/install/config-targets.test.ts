import { describe, it, expect } from 'vitest';
import { CONFIG_TARGETS, configTargetById, isConfigTargetId } from '../../src/install/config-targets.js';

describe('config targets', () => {
  it('has exactly one target', () => {
    expect(CONFIG_TARGETS.map((t) => t.id)).toEqual(['config-file']);
  });
  it('each target has a non-empty label, hint, and relPath', () => {
    for (const t of CONFIG_TARGETS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
      expect(t.relPath.length).toBeGreaterThan(0);
    }
  });
  it('configTargetById resolves a known id', () => {
    expect(configTargetById('config-file')?.relPath).toBe('svelte-vitals.config.mjs');
  });
  it('configTargetById returns undefined for an unknown id', () => {
    expect(configTargetById('nope')).toBeUndefined();
  });
  it('isConfigTargetId is true for the config target id and false for an MCP client id', () => {
    expect(isConfigTargetId('config-file')).toBe(true);
    expect(isConfigTargetId('claude-code')).toBe(false);
  });
});
