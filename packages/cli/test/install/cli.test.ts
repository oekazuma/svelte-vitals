import { describe, it, expect, vi, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { realIO } from '../../src/install/cli.js';
import { runInstallCliGunshi } from '../../src/gunshi/install.js';

describe('realIO().readFile', () => {
  it('returns undefined for a nonexistent path (ENOENT)', () => {
    const path = join(tmpdir(), `svelte-vitals-install-cli-test-${Date.now()}-nonexistent.json`);
    expect(realIO().readFile(path)).toBeUndefined();
  });

  it('rethrows non-ENOENT errors instead of swallowing them (e.g. a directory path)', () => {
    expect(() => realIO().readFile(tmpdir())).toThrow();
  });
});

describe('realIO().isTTY', () => {
  it('is false when stdin is not a TTY even if stdout is (piped stdin would hang a prompt)', () => {
    const stdin = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    const stdout = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    try {
      expect(realIO().isTTY).toBe(false);
    } finally {
      if (stdin) Object.defineProperty(process.stdin, 'isTTY', stdin);
      else delete (process.stdin as { isTTY?: boolean }).isTTY;
      if (stdout) Object.defineProperty(process.stdout, 'isTTY', stdout);
      else delete (process.stdout as { isTTY?: boolean }).isTTY;
    }
  });
});

describe('runInstallCli --help', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the agent skill/rules target ids', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      lines.push(line);
    });
    const code = await runInstallCliGunshi(['--help']);
    expect(code).toBe(0);
    const help = lines.join('\n');
    expect(help).toContain('claude-skill');
    expect(help).toContain('cursor-rules');
    expect(help).toContain('claude-skill-improve');
  });

  it('documents --app for monorepos', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      lines.push(line);
    });
    const code = await runInstallCliGunshi(['--help']);
    expect(code).toBe(0);
    // Placeholder is the generated format's own convention (the arg's key name, `<app>`) — the
    // hand-written `<dir>` hint went away with the static help text it lived in.
    expect(lines.join('\n')).toContain('--app <app>');
  });

  it('lists the ci-workflow target id', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      lines.push(line);
    });
    const code = await runInstallCliGunshi(['--help']);
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('ci-workflow');
  });

  it('documents --refresh', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      lines.push(line);
    });
    const code = await runInstallCliGunshi(['--help']);
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('--refresh');
  });
});
