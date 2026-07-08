import { describe, it, expect } from 'vitest';
import mri from 'mri';
import { resolveInstallArgs } from '../../src/install/args.js';

const parse = (args: string[]) =>
  mri(args, { boolean: ['yes', 'dry-run', 'force'], string: ['client', 'scope'], alias: { y: 'yes' } });

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
  it('accepts vite-plugin and vite-dev-overlay in --client', () => {
    const r = resolveInstallArgs(parse(['--client', 'vite-plugin,vite-dev-overlay']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['vite-plugin', 'vite-dev-overlay']);
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
  it('still rejects a genuinely unknown id', () => {
    const r = resolveInstallArgs(parse(['--client', 'not-an-agent-target']));
    expect(r.warnings.join('\n')).toContain('not-an-agent-target');
  });
});
