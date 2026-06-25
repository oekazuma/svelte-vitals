import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';

// Force the analysis itself to fail; the plugin must NOT fail the build for it.
vi.mock('../src/analyze.js', () => ({
  analyze: vi.fn(async () => {
    throw new Error('boom: unreadable output');
  })
}));

import { svelteVitals } from '../src/index.js';

function closeBundleOf(p: Plugin): () => Promise<void> {
  const hook = typeof p.closeBundle === 'function' ? p.closeBundle : p.closeBundle?.handler;
  return (hook as () => Promise<void>).bind({});
}

describe('svelteVitals analysis failure', () => {
  let cwd: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-err-'));
    const pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    await writeFile(join(pages, 'index.html'), `<html lang="en"><head><title>Home</title></head></html>`);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(async () => {
    warnSpy.mockRestore();
    await rm(cwd, { recursive: true, force: true });
  });

  it('warns and skips the gate instead of failing the build when analysis throws', async () => {
    const p = svelteVitals({ cwd, failOn: 'critical' }) as Plugin;
    await expect(closeBundleOf(p)()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toMatch(/analysis failed: boom/);
  });
});
