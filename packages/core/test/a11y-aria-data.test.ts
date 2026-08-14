import { describe, it, expect } from 'vitest';
import {
  isKnownRole,
  isAbstractRole,
  isKnownAriaAttribute,
  requiredAriaProps,
  ariaValueKind
} from '../src/rules/a11y/aria-data.js';

describe('aria-data wrapper', () => {
  it('knows real, abstract, and fake roles', () => {
    expect(isKnownRole('button')).toBe(true);
    expect(isKnownRole('bogus')).toBe(false);
    expect(isAbstractRole('widget')).toBe(true);
    expect(isAbstractRole('button')).toBe(false);
  });
  it('knows aria attributes', () => {
    expect(isKnownAriaAttribute('aria-label')).toBe(true);
    expect(isKnownAriaAttribute('aria-bogus')).toBe(false);
  });
  it('reports required props per role', () => {
    expect(requiredAriaProps('checkbox')).toContain('aria-checked');
    expect(requiredAriaProps('button')).toEqual([]);
  });
  it('reports value kinds', () => {
    expect(ariaValueKind('aria-hidden')?.type).toBe('boolean');
    expect(ariaValueKind('aria-bogus')).toBeUndefined();
  });
});
