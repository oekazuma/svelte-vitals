import { describe, it, expect } from 'vitest';
import { isPenalized, effectiveSeverity, summarize, defineConfig, type Result } from '../src/index.js';

const dynResult: Result = {
  id: 'SEO001',
  severity: 'critical',
  detection: { presence: 'own', value: 'dynamic' },
  route: '/x',
  message: '<title>'
};

describe('treatDynamicAs handling', () => {
  it('does not penalize dynamic under pass', () => {
    expect(isPenalized(dynResult.detection, 'pass')).toBe(false);
  });
  it('penalizes dynamic under warn and fail', () => {
    expect(isPenalized(dynResult.detection, 'warn')).toBe(true);
    expect(isPenalized(dynResult.detection, 'fail')).toBe(true);
  });
  it('effective severity downgrades dynamic to warning under warn', () => {
    expect(effectiveSeverity(dynResult, defineConfig({ treatDynamicAs: 'warn' }))).toBe('warning');
    expect(effectiveSeverity(dynResult, defineConfig({ treatDynamicAs: 'fail' }))).toBe('critical');
  });
  it('summarize buckets a warn-dynamic finding as a warning', () => {
    const s = summarize([dynResult], defineConfig({ treatDynamicAs: 'warn' }));
    expect(s.warning).toBe(1);
    expect(s.critical).toBe(0);
  });
});
