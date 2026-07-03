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
