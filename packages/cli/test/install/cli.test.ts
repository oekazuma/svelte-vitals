import { describe, it, expect, vi, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { realIO, runInstallCli } from '../../src/install/cli.js';

describe('realIO().readFile', () => {
  it('returns undefined for a nonexistent path (ENOENT)', () => {
    const path = join(tmpdir(), `svelte-vitals-install-cli-test-${Date.now()}-nonexistent.json`);
    expect(realIO().readFile(path)).toBeUndefined();
  });

  it('rethrows non-ENOENT errors instead of swallowing them (e.g. a directory path)', () => {
    expect(() => realIO().readFile(tmpdir())).toThrow();
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
    const code = await runInstallCli(['--help']);
    expect(code).toBe(0);
    const help = lines.join('\n');
    expect(help).toContain('claude-skill');
    expect(help).toContain('cursor-rules');
    expect(help).toContain('claude-skill-improve');
  });

  it('documents --refresh', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      lines.push(line);
    });
    const code = await runInstallCli(['--help']);
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('--refresh');
  });
});
