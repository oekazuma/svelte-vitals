import { describe, it, expect } from 'vitest';
import {
  severityToSarifLevel,
  severityToGithubLevel,
  messageText,
  ruleMetaById
} from '../src/reporter/shared.js';
import type { Result } from '../src/index.js';

describe('severity level maps', () => {
  it('maps to SARIF levels', () => {
    expect(severityToSarifLevel('critical')).toBe('error');
    expect(severityToSarifLevel('warning')).toBe('warning');
    expect(severityToSarifLevel('info')).toBe('note');
  });
  it('maps to GitHub levels', () => {
    expect(severityToGithubLevel('critical')).toBe('error');
    expect(severityToGithubLevel('warning')).toBe('warning');
    expect(severityToGithubLevel('info')).toBe('notice');
  });
});

describe('messageText', () => {
  const base: Result = {
    id: 'SEO001',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    message: 'Missing <title>'
  };
  it('appends the recommendation when present', () => {
    expect(messageText({ ...base, recommendation: 'Add a <title>.' })).toBe('Missing <title> Add a <title>.');
  });
  it('is just the message when there is no recommendation', () => {
    expect(messageText(base)).toBe('Missing <title>');
  });
});

describe('ruleMetaById', () => {
  it('returns canonical metadata for a known rule', () => {
    const m = ruleMetaById('SEO001');
    expect(m).toEqual({
      title: 'Title presence',
      severity: 'critical',
      docsUrl: 'https://svelte-vitals.dev/rules/SEO001'
    });
  });
  it('returns undefined for an unknown rule id', () => {
    expect(ruleMetaById('NOPE999')).toBeUndefined();
  });
});
