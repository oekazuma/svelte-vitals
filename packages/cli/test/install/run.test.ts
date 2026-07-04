import { describe, it, expect } from 'vitest';
import { runInstall, type InstallIO, type InstallPrompts } from '../../src/install/index.js';

function fakeIO(
  over: {
    files?: Record<string, string>;
    isTTY?: boolean;
    failWritePath?: string;
    throwOnRead?: string;
    runCommand?: (command: string, args: string[], cwd: string) => number;
  } = {}
) {
  const files = over.files ?? {};
  const writes: Record<string, string> = {};
  const out: string[] = [];
  const err: string[] = [];
  const io: InstallIO = {
    readFile: (p) => {
      if (over.throwOnRead && p === over.throwOnRead) {
        throw new Error(`EACCES: permission denied, open '${p}'`);
      }
      return files[p];
    },
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
    errorLog: (l) => err.push(l),
    ...(over.runCommand ? { runCommand: over.runCommand } : {})
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
  it('TTY detection tolerates a throwing readFile (e.g. EACCES) without crashing', async () => {
    const { io, writes } = fakeIO({ isTTY: true, throwOnRead: '/proj/.cursor/mcp.json' });
    const prompts: InstallPrompts = {
      ...noPrompts,
      selectClients: async () => ['claude-code'],
      selectScope: async () => 'project',
      confirm: async () => true
    };
    expect(await runInstall({}, io, prompts)).toBe(0);
    expect(writes['/proj/.mcp.json']).toBeDefined();
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

describe('runInstall — Vite targets', () => {
  it('vite-plugin: no vite.config found → manual, no write, snippet shown in the plan', async () => {
    const { io, writes, out } = fakeIO();
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('manual');
    expect(out.join('\n')).toContain("import { svelteVitals } from '@svelte-vitals/vite';");
  });

  it('vite-plugin: recognized vite.config.ts → written, and @svelte-vitals/vite is installed', async () => {
    const viteConfig = `
import { sveltekit } from '@sveltejs/kit/vite';
export default { plugins: [sveltekit()] };
`;
    const runCalls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const { io, writes } = fakeIO({
      files: { '/proj/vite.config.ts': viteConfig, '/proj/package.json': '{}' },
      runCommand: (command, args, cwd) => {
        runCalls.push({ command, args, cwd });
        return 0;
      }
    });
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes['/proj/vite.config.ts']).toContain('svelteVitals()');
    expect(runCalls).toEqual([{ command: 'npm', args: ['install', '-D', '@svelte-vitals/vite'], cwd: '/proj' }]);
  });

  it('vite-plugin: package already installed → no install command run', async () => {
    const viteConfig = `export default { plugins: [] };`;
    const runCalls: unknown[] = [];
    const { io } = fakeIO({
      files: {
        '/proj/vite.config.ts': viteConfig,
        '/proj/package.json': JSON.stringify({ devDependencies: { '@svelte-vitals/vite': '^1.0.0' } })
      },
      runCommand: (...args) => (runCalls.push(args), 0)
    });
    await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(runCalls).toEqual([]);
  });

  it('vite-plugin: already registered → exists, no write, no install attempt', async () => {
    const viteConfig = `
import { svelteVitals } from '@svelte-vitals/vite';
export default { plugins: [svelteVitals()] };
`;
    const runCalls: unknown[] = [];
    const { io, writes, out } = fakeIO({
      files: { '/proj/vite.config.ts': viteConfig },
      runCommand: (...args) => (runCalls.push(args), 0)
    });
    await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(writes).toEqual({});
    expect(runCalls).toEqual([]);
    expect(out.join('\n')).toContain('already configured');
  });

  it('vite-dev-overlay: no hooks.server.ts → created', async () => {
    const { io, writes } = fakeIO({ files: { '/proj/package.json': '{}' }, runCommand: () => 0 });
    await runInstall({ client: ['vite-dev-overlay'], yes: true }, io, noPrompts);
    expect(writes['/proj/src/hooks.server.ts']).toContain('svelteVitalsHandle');
  });

  it('dry-run does not write vite targets or run the package manager', async () => {
    const runCalls: unknown[] = [];
    const { io, writes } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };` },
      runCommand: (...args) => (runCalls.push(args), 0)
    });
    await runInstall({ client: ['vite-plugin'], dryRun: true }, io, noPrompts);
    expect(writes).toEqual({});
    expect(runCalls).toEqual([]);
  });

  it('a plan can mix an MCP client and a Vite target in one run', async () => {
    const { io, writes } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };`, '/proj/package.json': '{}' },
      runCommand: () => 0
    });
    await runInstall({ client: ['claude-code', 'vite-plugin'], scope: 'project', yes: true }, io, noPrompts);
    expect(Object.keys(writes).sort()).toEqual(['/proj/.mcp.json', '/proj/vite.config.ts']);
  });

  it('a failed package-manager install is reported but does not fail the run', async () => {
    const { io, err } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };`, '/proj/package.json': '{}' },
      runCommand: () => 1
    });
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(err.join('\n')).toContain('@svelte-vitals/vite');
  });

  it('a partial failure (an MCP client write fails) still runs the package-manager install for a Vite target that already succeeded', async () => {
    const runCalls: unknown[] = [];
    const { io, writes, err } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };`, '/proj/package.json': '{}' },
      failWritePath: '/proj/.mcp.json',
      runCommand: (...args) => (runCalls.push(args), 0)
    });
    const code = await runInstall(
      { client: ['claude-code', 'vite-plugin'], scope: 'project', yes: true },
      io,
      noPrompts
    );
    expect(code).toBe(2);
    expect(writes['/proj/vite.config.ts']).toContain('svelteVitals()');
    expect(runCalls.length).toBe(1);
    expect(err.join('\n')).toContain('/proj/.mcp.json');
  });
});
