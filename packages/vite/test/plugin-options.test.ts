import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { svelteVitals } from '../src/index.js';

type CloseBundle = () => Promise<void>;
function closeBundleOf(p: Plugin): CloseBundle {
  const hook = typeof p.closeBundle === 'function' ? p.closeBundle : p.closeBundle?.handler;
  return (hook as CloseBundle).bind({});
}

describe('svelteVitals options', () => {
  let cwd: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-opt-'));
    const pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    // Page is missing <meta description> -> a critical finding on '/'.
    await writeFile(join(pages, 'index.html'), `<html lang="en"><head><title>Home</title></head><body></body></html>`);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(async () => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    await rm(cwd, { recursive: true, force: true });
  });

  it('writes the JSON report to a relative outFile resolved against the project root', async () => {
    const p = svelteVitals({ cwd, ui: false, report: false, failOn: 'info', outFile: 'reports/seo.json' }) as Plugin;
    // failOn:'info' would normally throw on findings; swallow so we can assert the file.
    await closeBundleOf(p)().catch(() => {});
    const written = await readFile(join(cwd, 'reports/seo.json'), 'utf8');
    expect(() => JSON.parse(written)).not.toThrow();
    expect(JSON.parse(written)).toHaveProperty('version');
  });

  it("logs the JSON report to the console when report is 'json'", async () => {
    // Default failOn:'critical' throws after logging; the log fires first.
    const p = svelteVitals({ cwd, ui: false, report: 'json' }) as Plugin;
    await closeBundleOf(p)().catch(() => {});
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = logSpy.mock.calls[0]![0] as string;
    expect(() => JSON.parse(logged)).not.toThrow();
  });

  it('is a no-op (no report, no throw) when the prerendered dir is absent', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'sv-opt-empty-'));
    try {
      const p = svelteVitals({ cwd: empty, ui: false, failOn: 'critical' }) as Plugin;
      await expect(closeBundleOf(p)()).resolves.toBeUndefined();
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it('respects an absolute outFile path unchanged', async () => {
    const abs = join(cwd, 'absolute-report.json');
    const p = svelteVitals({ cwd, ui: false, report: false, failOn: 'info', outFile: abs }) as Plugin;
    await closeBundleOf(p)().catch(() => {});
    await expect(access(abs)).resolves.toBeUndefined();
  });
});
