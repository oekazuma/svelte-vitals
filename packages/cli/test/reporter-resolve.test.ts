import { describe, it, expect } from 'vitest';
import { isAgentEnv, isAutoDetectedAgent, isReporterName, resolveReporter } from '../src/reporter-resolve.js';

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

describe('isReporterName', () => {
  it('accepts only the known reporter names', () => {
    for (const name of ['console', 'json', 'agent']) expect(isReporterName(name)).toBe(true);
    for (const bad of ['jsonn', 'Agent', '', undefined]) expect(isReporterName(bad)).toBe(false);
  });
});

describe('isAutoDetectedAgent', () => {
  it('is true only when agent is chosen purely by env auto-detection', () => {
    expect(isAutoDetectedAgent(undefined, { CLAUDECODE: '1' })).toBe(true);
  });
  it('is false when an explicit flag is given', () => {
    expect(isAutoDetectedAgent('agent', { CLAUDECODE: '1' })).toBe(false);
    expect(isAutoDetectedAgent('console', { CLAUDECODE: '1' })).toBe(false);
  });
  it('is false when SVELTE_VITALS_REPORTER opts in explicitly', () => {
    expect(isAutoDetectedAgent(undefined, { CLAUDECODE: '1', SVELTE_VITALS_REPORTER: 'agent' })).toBe(false);
  });
  it('is false outside an agent env', () => {
    expect(isAutoDetectedAgent(undefined, {})).toBe(false);
    expect(isAutoDetectedAgent(undefined, { CI: 'true' })).toBe(false);
  });
});
