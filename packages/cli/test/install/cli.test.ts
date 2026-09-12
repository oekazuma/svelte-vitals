import { describe, it, expect, vi, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { realIO } from '../../src/install/cli.js';

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
