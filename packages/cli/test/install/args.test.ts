import { describe, it, expect } from 'vitest';
import { parseInstallArgs, resolveInstallArgs } from '../../src/install/args.js';

const parse = parseInstallArgs;

describe('resolveInstallArgs', () => {
  it('parses clients', () => {
    const r = resolveInstallArgs(parse(['--client', 'cursor-rules,vite-plugin']));
    expect(r.flags).toEqual({
      client: ['cursor-rules', 'vite-plugin'],
      yes: false,
      dryRun: false,
      force: false
    });
  });
  it('warns and drops unknown client ids', () => {
    const r = resolveInstallArgs(parse(['--client', 'cursor-rules,bogus']));
    expect(r.flags!.client).toEqual(['cursor-rules']);
    expect(r.warnings.join('\n')).toContain('bogus');
  });
  it('de-duplicates repeated --client ids, preserving first-seen order', () => {
    const r = resolveInstallArgs(parse(['--client', 'cursor-rules,cursor-rules,vite-plugin']));
    expect(r.flags!.client).toEqual(['cursor-rules', 'vite-plugin']);
  });
  it('errors on an all-invalid --client (fatal), naming each unknown id', () => {
    const r = resolveInstallArgs(parse(['--client', 'bogus,nonsense']));
    expect(r.flags).toBeNull();
    expect(r.errors.join('\n')).toContain('cursor-rules');
    expect(r.warnings.join('\n')).toContain('bogus');
    expect(r.warnings.join('\n')).toContain('nonsense');
  });
  it('warns that --scope is obsolete instead of failing the run', () => {
    const r = resolveInstallArgs(parse(['--client', 'cursor-rules', '--scope', 'project']));
    expect(r.errors).toEqual([]);
    expect(r.flags).not.toHaveProperty('scope');
    expect(r.warnings.join('\n')).toContain('--scope is no longer used');
  });
  it('maps -y, --dry-run, --force', () => {
    const r = resolveInstallArgs(parse(['-y', '--dry-run', '--force']));
    expect(r.flags).toMatchObject({ yes: true, dryRun: true, force: true });
  });
  it('omits the client key when not provided', () => {
    const r = resolveInstallArgs(parse([]));
    expect(r.flags).toEqual({ yes: false, dryRun: false, force: false });
  });
});

describe('resolveInstallArgs — target ids', () => {
  it('accepts every install target id in one --client list', () => {
    const r = resolveInstallArgs(parse(['--client', 'vite-plugin,vite-hooks,cursor-rules,config-file,ci-workflow']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['vite-plugin', 'vite-hooks', 'cursor-rules', 'config-file', 'ci-workflow']);
  });
  it('rejects the retired SKILL.md target ids like any unknown id', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-skill,claude-skill-improve']));
    expect(r.flags).toBeNull();
    expect(r.warnings.join('\n')).toContain('claude-skill');
  });
});

describe('resolveInstallArgs — --app', () => {
  it('passes --app through', () => {
    const r = resolveInstallArgs(parse(['--client', 'vite-plugin', '--app', 'apps/web']));
    expect(r.errors).toEqual([]);
    expect(r.flags).toMatchObject({ app: 'apps/web' });
  });
  it('omits the app key when not provided', () => {
    const r = resolveInstallArgs(parse(['--client', 'vite-plugin']));
    expect(r.flags).not.toHaveProperty('app');
  });
  it('ignores an empty --app value', () => {
    const r = resolveInstallArgs(parse(['--client', 'vite-plugin', '--app', ' ']));
    expect(r.flags).not.toHaveProperty('app');
  });
});

describe('resolveInstallArgs — --refresh', () => {
  it('accepts a bare --refresh', () => {
    const r = resolveInstallArgs(parse(['--refresh']));
    expect(r.errors).toEqual([]);
    expect(r.flags).toEqual({ yes: false, dryRun: false, force: false, refresh: true });
  });
  it('errors when combined with --client (fatal)', () => {
    const r = resolveInstallArgs(parse(['--refresh', '--client', 'cursor-rules']));
    expect(r.flags).toBeNull();
    expect(r.errors.join('\n')).toContain('--refresh');
    expect(r.errors.join('\n')).toContain('--client');
  });
  it('warns (but does not error) when combined with --yes/--force', () => {
    const r = resolveInstallArgs(parse(['--refresh', '--yes', '--force']));
    expect(r.errors).toEqual([]);
    expect(r.flags).toMatchObject({ refresh: true });
    expect(r.warnings.join('\n')).toContain('--refresh');
  });
  it('warns and drops --app when combined with --refresh', () => {
    const r = resolveInstallArgs(parse(['--refresh', '--app', 'apps/web']));
    expect(r.errors).toEqual([]);
    expect(r.flags).toMatchObject({ refresh: true });
    expect(r.flags).not.toHaveProperty('app');
    expect(r.warnings.join('\n')).toContain('--app');
  });
});
