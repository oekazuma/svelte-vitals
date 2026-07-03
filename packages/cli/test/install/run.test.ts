import { describe, it, expect } from 'vitest';
import { runInstall, type InstallIO, type InstallPrompts } from '../../src/install/index.js';

function fakeIO(over: { files?: Record<string, string>; isTTY?: boolean; failWritePath?: string } = {}) {
  const files = over.files ?? {};
  const writes: Record<string, string> = {};
  const out: string[] = [];
  const err: string[] = [];
  const io: InstallIO = {
    readFile: (p) => files[p],
    writeFile: (p, c) => {
      if (over.failWritePath && p === over.failWritePath) {
        throw new Error(`EACCES: permission denied, open '${p}'`);
      }
      writes[p] = c;
    },
    cwd: '/proj',
    home: '/home/u',
    isTTY: over.isTTY ?? false,
    log: (l) => out.push(l),
    errorLog: (l) => err.push(l)
  };
  return { io, writes, out, err };
}

const noPrompts: InstallPrompts = {
  selectClients: async () => null,
  selectScope: async () => null,
  confirm: async () => true
};

describe('runInstall', () => {
  it('non-TTY without --client exits 2 with guidance', async () => {
    const { io, err } = fakeIO();
    expect(await runInstall({}, io, noPrompts)).toBe(2);
    expect(err.join('\n')).toContain('--client');
  });
  it('flag-only writes the selected client config', async () => {
    const { io, writes } = fakeIO();
    expect(await runInstall({ client: ['claude-code'], scope: 'project', yes: true }, io, noPrompts)).toBe(0);
    expect(Object.keys(writes)).toEqual(['/proj/.mcp.json']);
    expect(JSON.parse(writes['/proj/.mcp.json']!).mcpServers['svelte-vitals'].command).toBe('npx');
  });
  it('dry-run writes nothing', async () => {
    const { io, writes, out } = fakeIO();
    expect(await runInstall({ client: ['cursor'], scope: 'global', dryRun: true }, io, noPrompts)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run');
  });
  it('codex ignores scope and uses the global config.toml', async () => {
    const { io, writes } = fakeIO();
    await runInstall({ client: ['codex'], yes: true }, io, noPrompts);
    expect(Object.keys(writes)).toEqual(['/home/u/.codex/config.toml']);
  });
  it('an existing identical entry is skipped (no write)', async () => {
    const first = fakeIO();
    await runInstall({ client: ['claude-code'], scope: 'project', yes: true }, first.io, noPrompts);
    const content = first.writes['/proj/.mcp.json']!;
    const { io, writes, out } = fakeIO({ files: { '/proj/.mcp.json': content } });
    await runInstall({ client: ['claude-code'], scope: 'project', yes: true }, io, noPrompts);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('already configured');
  });
  it('force overwrites a differing entry', async () => {
    const existing = JSON.stringify({ mcpServers: { 'svelte-vitals': { command: 'old', args: [] } } });
    const { io, writes } = fakeIO({ files: { '/proj/.mcp.json': existing } });
    await runInstall({ client: ['claude-code'], scope: 'project', yes: true, force: true }, io, noPrompts);
    expect(JSON.parse(writes['/proj/.mcp.json']!).mcpServers['svelte-vitals'].command).toBe('npx');
  });
  it('a multi-client plan writes each config', async () => {
    const { io, writes } = fakeIO();
    await runInstall({ client: ['claude-code', 'cursor'], scope: 'project', yes: true }, io, noPrompts);
    expect(Object.keys(writes).sort()).toEqual(['/proj/.cursor/mcp.json', '/proj/.mcp.json']);
  });
  it('TTY confirm=false writes nothing', async () => {
    const { io, writes } = fakeIO({ isTTY: true });
    const prompts: InstallPrompts = { ...noPrompts, confirm: async () => false };
    expect(await runInstall({ client: ['claude-code'], scope: 'project' }, io, prompts)).toBe(0);
    expect(writes).toEqual({});
  });
  it('TTY client-picker cancel exits 0 without writing', async () => {
    const { io, writes } = fakeIO({ isTTY: true });
    const prompts: InstallPrompts = { ...noPrompts, selectClients: async () => null };
    expect(await runInstall({}, io, prompts)).toBe(0);
    expect(writes).toEqual({});
  });
  it('unparseable existing config exits 2 without writing', async () => {
    const { io, writes, err } = fakeIO({ files: { '/proj/.mcp.json': '{not json' } });
    expect(await runInstall({ client: ['claude-code'], scope: 'project', yes: true }, io, noPrompts)).toBe(2);
    expect(writes).toEqual({});
    expect(err.join('\n')).toContain('/proj/.mcp.json');
  });
  it('non-TTY without --scope defaults to project for multi-scope clients', async () => {
    const { io, writes } = fakeIO();
    await runInstall({ client: ['claude-code'], yes: true }, io, noPrompts);
    expect(Object.keys(writes)).toEqual(['/proj/.mcp.json']);
  });
  it('a per-file write failure names the failing path, keeps earlier writes, and does not abort the run', async () => {
    const { io, writes, err } = fakeIO({ failWritePath: '/proj/.cursor/mcp.json' });
    const code = await runInstall({ client: ['claude-code', 'cursor'], scope: 'project', yes: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes['/proj/.mcp.json']).toBeDefined();
    expect(writes['/proj/.cursor/mcp.json']).toBeUndefined();
    expect(err.join('\n')).toContain('/proj/.cursor/mcp.json');
  });
});
