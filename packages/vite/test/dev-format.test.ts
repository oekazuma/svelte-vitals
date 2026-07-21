import { describe, it, expect } from 'vitest';
import { findingSignature } from '../src/hooks/format.js';
import { defineConfig, type Result } from '@svelte-vitals/core';

const config = defineConfig({});

const failing: Result[] = [
  {
    id: 'seo/canonical-url',
    severity: 'warning',
    detection: { presence: 'none', value: 'absent' },
    route: '/p',
    message: 'Missing <link rel="canonical">'
  },
  {
    id: 'seo/title-presence',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    route: '/p',
    message: 'Missing <title>'
  }
];

const passing: Result[] = [
  {
    id: 'seo/title-presence',
    severity: 'critical',
    detection: { presence: 'own', value: 'static' },
    route: '/p',
    message: '<title>'
  }
];

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

  it('distinguishes a missing tag from an empty one (same id and severity)', () => {
    const missing: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/p',
        message: 'Missing <title>'
      }
    ];
    const empty: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'own', value: 'absent' },
        route: '/p',
        message: 'Empty <title>'
      }
    ];
    expect(findingSignature(missing, config)).not.toBe(findingSignature(empty, config));
  });
});
