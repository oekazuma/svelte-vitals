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

describe('realIO().log / errorLog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const oscTitleRewrite = 'a\x1b]0;evil\x07b';

  it('strips terminal escape sequences from log() before they reach console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    realIO().log(oscTitleRewrite);
    expect(spy).toHaveBeenCalledWith('ab');
  });

  it('strips terminal escape sequences from errorLog() before they reach console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    realIO().errorLog(oscTitleRewrite);
    expect(spy).toHaveBeenCalledWith('ab');
  });

  it('preserves newlines and tabs', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    realIO().log('a\nb\tc');
    realIO().errorLog('a\nb\tc');
    expect(logSpy).toHaveBeenCalledWith('a\nb\tc');
    expect(errorSpy).toHaveBeenCalledWith('a\nb\tc');
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

  it('lists the agent rules target id and points Agent Skills at `npx skills add`', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      lines.push(line);
    });
    const code = await runInstallCliGunshi(['--help']);
    expect(code).toBe(0);
    const help = lines.join('\n');
    expect(help).toContain('cursor-rules');
    expect(help).toContain('npx skills add oekazuma/svelte-vitals');
    expect(help).not.toContain('claude-skill');
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
