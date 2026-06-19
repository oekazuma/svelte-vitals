import { describe, it, expect } from 'vitest';
import { isAgentEnv, resolveReporter } from '../src/reporter-resolve.js';

describe('isAgentEnv', () => {
  it('is true when a known agent env var is set', () => {
    expect(isAgentEnv({ CLAUDECODE: '1' })).toBe(true);
    expect(isAgentEnv({ SVELTE_VITALS_AGENT: '1' })).toBe(true);
  });
  it('is false for a plain/CI env', () => {
    expect(isAgentEnv({})).toBe(false);
    expect(isAgentEnv({ CI: 'true' })).toBe(false);
    expect(isAgentEnv({ CLAUDECODE: '' })).toBe(false);
  });
});

describe('resolveReporter', () => {
  it('honors the explicit reporter first', () => {
    expect(resolveReporter('json', { CLAUDECODE: '1' })).toBe('json');
    expect(resolveReporter('console', { SVELTE_VITALS_REPORTER: 'agent' })).toBe('console');
  });
  it('uses SVELTE_VITALS_REPORTER when no explicit flag', () => {
    expect(resolveReporter(undefined, { SVELTE_VITALS_REPORTER: 'agent' })).toBe('agent');
    expect(resolveReporter(undefined, { SVELTE_VITALS_REPORTER: 'json' })).toBe('json');
  });
  it('auto-selects agent under a known agent env', () => {
    expect(resolveReporter(undefined, { CLAUDECODE: '1' })).toBe('agent');
  });
  it('defaults to console otherwise', () => {
    expect(resolveReporter(undefined, {})).toBe('console');
    expect(resolveReporter(undefined, { CI: 'true' })).toBe('console');
  });
});
