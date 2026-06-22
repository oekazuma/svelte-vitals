import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Handle } from '@sveltejs/kit';
import { svelteVitalsHandle } from '../src/hooks/index.js';

// A minimal fake RequestEvent carrying only what the handle reads.
function fakeEvent(routeId: string | null, pathname = '/') {
  return { route: { id: routeId }, url: new URL(`http://localhost${pathname}`) } as unknown as Parameters<
    Parameters<Handle>[0]['resolve']
  >[0];
}

// A resolve() that feeds the given HTML chunks through transformPageChunk, awaiting each.
function resolveWith(chunks: string[]) {
  return (async (event: unknown, opts?: { transformPageChunk?: (i: { html: string; done: boolean }) => unknown }) => {
    const tpc = opts?.transformPageChunk;
    const seen: unknown[] = [];
    if (tpc) {
      for (let i = 0; i < chunks.length; i++) {
        seen.push(await tpc({ html: chunks[i]!, done: i === chunks.length - 1 }));
      }
    }
    return { seen, transformed: tpc !== undefined } as unknown as Response;
  }) as Parameters<Handle>[0]['resolve'];
}

const PAGE_NO_TITLE = '<html lang="en"><head><meta name="description" content="x"></head><body></body></html>';
const PAGE_OK =
  '<html lang="en"><head><title>Home</title><meta name="description" content="x">' +
  '<link rel="canonical" href="https://e.com/"><meta property="og:title" content="t">' +
  '<meta property="og:image" content="https://e.com/o.png">' +
  '<script type="application/ld+json">{"@context":"https://schema.org"}</script></head><body></body></html>';

afterEach(() => vi.restoreAllMocks());

describe('svelteVitalsHandle', () => {
  it('warns about a missing <title> for the visited route', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    const out = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('[svelte-vitals] /none');
    expect(out).toContain('✗ SEO001  Missing <title>');
  });

  it('prints nothing for a clean page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/ok', '/ok'), resolve: resolveWith([PAGE_OK]) });
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns each chunk unchanged', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    const res = (await handle({
      event: fakeEvent('/none', '/none'),
      resolve: resolveWith(['<html><head>', '</head></html>'])
    })) as unknown as { seen: string[] };
    expect(res.seen).toEqual(['<html><head>', '</head></html>']);
  });

  it('dedups: the same findings on a repeat visit print only once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('is a pass-through in production (no transformPageChunk, no output)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const handle = svelteVitalsHandle();
      const res = (await handle({
        event: fakeEvent('/none', '/none'),
        resolve: resolveWith([PAGE_NO_TITLE])
      })) as unknown as { transformed: boolean };
      expect(res.transformed).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      // Restore precisely: assigning `undefined` would coerce to the string
      // 'undefined' and leave the var set, polluting later tests.
      if (prev === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prev;
    }
  });

  it('passes through when process is undefined (non-Node/edge runtime)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    vi.stubGlobal('process', undefined);
    try {
      const res = (await handle({
        event: fakeEvent('/none', '/none'),
        resolve: resolveWith([PAGE_NO_TITLE])
      })) as unknown as { transformed: boolean };
      expect(res.transformed).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not throw when the HTML is unparseable garbage', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await expect(
      handle({ event: fakeEvent(null, '/x'), resolve: resolveWith(['not really <<< html']) })
    ).resolves.toBeDefined();
  });
});
