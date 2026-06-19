import { describe, it, expect } from 'vitest';
import type { Fix, Result } from '../src/index.js';

describe('Result.fix', () => {
  it('accepts a Fix object', () => {
    const fix: Fix = { description: 'Add a <title>.', snippet: '<title>x</title>', lang: 'svelte' };
    const result: Result = {
      id: 'SEO001',
      severity: 'critical',
      detection: { presence: 'none', value: 'absent' },
      message: 'Missing <title>',
      fix
    };
    expect(result.fix?.description).toBe('Add a <title>.');
    expect(result.fix?.lang).toBe('svelte');
  });
});
