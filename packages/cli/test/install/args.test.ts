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

describe('resolveInstallArgs — Vite targets', () => {
  it('accepts vite-plugin and vite-hooks in --client', () => {
    const r = resolveInstallArgs(parse(['--client', 'vite-plugin,vite-hooks']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['vite-plugin', 'vite-hooks']);
  });
  it('mixes an agent target id with a Vite target id', () => {
    const r = resolveInstallArgs(parse(['--client', 'cursor-rules,vite-plugin']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['cursor-rules', 'vite-plugin']);
  });
  it('still rejects a genuinely unknown id', () => {
    const r = resolveInstallArgs(parse(['--client', 'not-a-real-target']));
    expect(r.warnings.join('\n')).toContain('not-a-real-target');
  });
});

describe('resolveInstallArgs — agent targets', () => {
  it('accepts cursor-rules in --client', () => {
    const r = resolveInstallArgs(parse(['--client', 'cursor-rules']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['cursor-rules']);
  });
  it('rejects the retired SKILL.md target ids like any unknown id', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-skill,claude-skill-improve']));
    expect(r.flags).toBeNull();
    expect(r.warnings.join('\n')).toContain('claude-skill');
  });
  it('still rejects a genuinely unknown id', () => {
    const r = resolveInstallArgs(parse(['--client', 'not-an-agent-target']));
    expect(r.warnings.join('\n')).toContain('not-an-agent-target');
  });
});

describe('resolveInstallArgs — config target', () => {
  it('accepts config-file in --client', () => {
    const r = resolveInstallArgs(parse(['--client', 'config-file']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['config-file']);
  });
  it('mixes an agent target id with the config target id', () => {
    const r = resolveInstallArgs(parse(['--client', 'cursor-rules,config-file']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['cursor-rules', 'config-file']);
  });
});

describe('resolveInstallArgs — ci target', () => {
  it('accepts ci-workflow in --client', () => {
    const r = resolveInstallArgs(parse(['--client', 'ci-workflow']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['ci-workflow']);
  });
  it('mixes an agent target id with the ci target id', () => {
    const r = resolveInstallArgs(parse(['--client', 'cursor-rules,ci-workflow']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['cursor-rules', 'ci-workflow']);
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
