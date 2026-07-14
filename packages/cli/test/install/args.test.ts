import { describe, it, expect } from 'vitest';
import mri from 'mri';
import { resolveInstallArgs } from '../../src/install/args.js';

const parse = (args: string[]) =>
  mri(args, { boolean: ['yes', 'dry-run', 'force', 'refresh'], string: ['client', 'scope'], alias: { y: 'yes' } });

describe('resolveInstallArgs', () => {
  it('parses clients and scope', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-code,cursor', '--scope', 'project']));
    expect(r.flags).toEqual({
      client: ['claude-code', 'cursor'],
      scope: 'project',
      yes: false,
      dryRun: false,
      force: false
    });
  });
  it('warns and drops unknown client ids', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-code,bogus']));
    expect(r.flags!.client).toEqual(['claude-code']);
    expect(r.warnings.join('\n')).toContain('bogus');
  });
  it('de-duplicates repeated --client ids, preserving first-seen order', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-code,claude-code,cursor']));
    expect(r.flags!.client).toEqual(['claude-code', 'cursor']);
  });
  it('errors on an all-invalid --client (fatal)', () => {
    const r = resolveInstallArgs(parse(['--client', 'bogus']));
    expect(r.flags).toBeNull();
    expect(r.errors.join('\n')).toContain('claude-code');
  });
  it('errors on an invalid scope (fatal)', () => {
    const r = resolveInstallArgs(parse(['--scope', 'weird']));
    expect(r.flags).toBeNull();
    expect(r.errors.join('\n')).toContain('weird');
  });
  it('maps -y, --dry-run, --force', () => {
    const r = resolveInstallArgs(parse(['-y', '--dry-run', '--force']));
    expect(r.flags).toMatchObject({ yes: true, dryRun: true, force: true });
  });
  it('omits client/scope keys when not provided', () => {
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
  it('mixes an MCP client id with a Vite target id', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-code,vite-plugin']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['claude-code', 'vite-plugin']);
  });
  it('still rejects a genuinely unknown id', () => {
    const r = resolveInstallArgs(parse(['--client', 'not-a-real-target']));
    expect(r.warnings.join('\n')).toContain('not-a-real-target');
  });
});

describe('resolveInstallArgs — agent targets', () => {
  it('accepts claude-skill and cursor-rules in --client', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-skill,cursor-rules']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['claude-skill', 'cursor-rules']);
  });
  it('mixes an MCP client id with an agent target id', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-code,claude-skill']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['claude-code', 'claude-skill']);
  });
  it('accepts claude-skill-improve in --client', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-skill-improve']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['claude-skill-improve']);
  });
  it('still rejects a genuinely unknown id', () => {
    const r = resolveInstallArgs(parse(['--client', 'not-an-agent-target']));
    expect(r.warnings.join('\n')).toContain('not-an-agent-target');
  });
});

describe('resolveInstallArgs — --refresh', () => {
  it('accepts a bare --refresh', () => {
    const r = resolveInstallArgs(parse(['--refresh']));
    expect(r.errors).toEqual([]);
    expect(r.flags).toEqual({ yes: false, dryRun: false, force: false, refresh: true });
  });
  it('errors when combined with --client (fatal)', () => {
    const r = resolveInstallArgs(parse(['--refresh', '--client', 'claude-skill']));
    expect(r.flags).toBeNull();
    expect(r.errors.join('\n')).toContain('--refresh');
    expect(r.errors.join('\n')).toContain('--client');
  });
  it('warns (but does not error) when combined with --scope/--yes/--force', () => {
    const r = resolveInstallArgs(parse(['--refresh', '--scope', 'project', '--yes', '--force']));
    expect(r.errors).toEqual([]);
    expect(r.flags).toMatchObject({ refresh: true });
    expect(r.warnings.join('\n')).toContain('--refresh');
  });
});
