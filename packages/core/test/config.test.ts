import { describe, it, expect } from 'vitest';
import { defaultConfig, defineConfig } from '../src/index.js';

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
