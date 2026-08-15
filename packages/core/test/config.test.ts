import { describe, it, expect } from 'vitest';
import { defineConfig } from '../src/index.js';
import { defaultConfig } from '../src/internal.js';

describe('Config.metaComponents', () => {
  it('defaults to an empty array', () => {
    expect(defaultConfig.metaComponents).toEqual([]);
  });

  it('is overridable via defineConfig and keeps other defaults', () => {
    const config = defineConfig({ metaComponents: ['Seo', 'Meta'] });
    expect(config.metaComponents).toEqual(['Seo', 'Meta']);
    expect(config.treatDynamicAs).toBe('pass');
  });
});

describe('Config.rules and failOn', () => {
  it('defaults rules to {} and failOn to critical', () => {
    expect(defaultConfig.rules).toEqual({});
    expect(defaultConfig.failOn).toBe('critical');
  });

  it('merges rules and failOn via defineConfig', () => {
    const config = defineConfig({
      rules: { 'seo/json-ld': 'off', 'seo/canonical-url': 'critical' },
      failOn: 'warning'
    });
    expect(config.rules).toEqual({ 'seo/json-ld': 'off', 'seo/canonical-url': 'critical' });
    expect(config.failOn).toBe('warning');
    expect(config.metaComponents).toEqual([]);
  });
});
