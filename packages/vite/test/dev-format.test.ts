import { describe, it, expect } from 'vitest';
import { formatDevReport, findingSignature } from '../src/hooks/format.js';
import { defineConfig, type Result } from '@svelte-vitals/core';

const config = defineConfig({});

const failing: Result[] = [
  {
    id: 'SEO003',
    severity: 'warning',
    detection: { presence: 'none', value: 'absent' },
    route: '/p',
    message: 'Missing <link rel="canonical">'
  },
  {
    id: 'SEO001',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    route: '/p',
    message: 'Missing <title>'
  }
];

const passing: Result[] = [
  { id: 'SEO001', severity: 'critical', detection: { presence: 'own', value: 'static' }, route: '/p', message: '<title>' }
];

describe('formatDevReport', () => {
  it('lists only penalized findings, most-severe first, under a route header', () => {
    const out = formatDevReport('/p', failing, config);
    const lines = out.split('\n');
    expect(lines[0]).toBe('[svelte-vitals] /p');
    expect(lines[1]).toBe('  ✗ SEO001  Missing <title>');
    expect(lines[2]).toBe('  ⚠ SEO003  Missing <link rel="canonical">');
  });

  it('returns an empty string for a clean route', () => {
    expect(formatDevReport('/p', passing, config)).toBe('');
  });
});

describe('findingSignature', () => {
  it('is stable regardless of input order', () => {
    const reversed = [...failing].reverse();
    expect(findingSignature(failing, config)).toBe(findingSignature(reversed, config));
  });

  it('ignores passing findings and changes when penalized findings change', () => {
    expect(findingSignature(passing, config)).toBe('');
    const sigA = findingSignature(failing, config);
    const sigB = findingSignature([failing[0]!], config);
    expect(sigA).not.toBe(sigB);
  });
});
