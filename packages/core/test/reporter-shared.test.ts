import { describe, it, expect } from 'vitest';
import { severityToSarifLevel, messageText, ruleMetaById } from '../src/reporter/shared.js';
import type { Result } from '../src/index.js';

describe('severity level maps', () => {
  it('maps info to the SARIF note level', () => {
    expect(severityToSarifLevel('info')).toBe('note');
  });
});

describe('messageText', () => {
  const base: Result = {
    id: 'seo/title-presence',
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
  it('returns undefined for an unknown rule id', () => {
    expect(ruleMetaById('NOPE999')).toBeUndefined();
  });
});
