import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../src/internal.js';

describe('defaultConfig', () => {
  it('has the documented defaults', () => {
    expect(defaultConfig.metaComponents).toEqual([]);
    expect(defaultConfig.rules).toEqual({});
    expect(defaultConfig.failOn).toBe('critical');
    expect(defaultConfig.treatDynamicAs).toBe('pass');
  });
});
