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

// The handle analyzes fire-and-forget (it never blocks the response), so the
// resulting console.warn lands a few microtasks after handle() resolves. One
// macrotask tick drains that chain — analysis is purely in-memory, no real I/O.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const PAGE_NO_TITLE = '<html lang="en"><head><meta name="description" content="x"></head><body></body></html>';
const PAGE_OK =
  '<html lang="en"><head><title>Quality Widgets and Tools for Modern Builders Shop</title><meta name="description" content="Browse our curated selection of quality widgets and builder tools for modern projects and teams.">' +
  '<link rel="canonical" href="https://e.com/"><meta property="og:title" content="t">' +
  '<meta property="og:image" content="https://e.com/o.png">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<meta name="twitter:card" content="summary_large_image">' +
  '<meta property="og:description" content="x">' +
  '<meta property="og:url" content="https://e.com/">' +
  '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Home","url":"https://e.com/"}</script></head><body></body></html>';

afterEach(() => vi.restoreAllMocks());

describe('svelteVitalsHandle', () => {
  it('warns about a missing <title> for the visited route', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    const out = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('[svelte-vitals] /none');
    expect(out).toContain('✗ SEO001  Missing <title>');
  });

  it('prints nothing for a clean page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/ok', '/ok'), resolve: resolveWith([PAGE_OK]) });
    await flush();
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
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  // Outside dev (production builds, and non-Node/edge runtimes), esm-env resolves
  // `DEV` to false, so the handle short-circuits to a pass-through. Mocking esm-env
  // is the canonical way to exercise that branch — `DEV` is a static import, not a
  // runtime read of NODE_ENV, so toggling env vars wouldn't flip it.
  it('is a pass-through when not in dev (no transformPageChunk, no output)', async () => {
    vi.resetModules();
    vi.doMock('esm-env', () => ({ DEV: false }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { svelteVitalsHandle: prodHandle } = await import('../src/hooks/index.js');
      const handle = prodHandle();
      const res = (await handle({
        event: fakeEvent('/none', '/none'),
        resolve: resolveWith([PAGE_NO_TITLE])
      })) as unknown as { transformed: boolean };
      expect(res.transformed).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('esm-env');
      vi.resetModules();
    }
  });

  it('does not throw when the HTML is unparseable garbage', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await expect(
      handle({ event: fakeEvent(null, '/x'), resolve: resolveWith(['not really <<< html']) })
    ).resolves.toBeDefined();
  });

  it('honors per-rule overrides from options (rules)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle({ rules: { SEO001: 'off' } });
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    const out = warn.mock.calls.map((c) => String(c[0])).join('\n');
    // The page still trips other rules, so the route is reported — but with SEO001
    // disabled, the missing-title line is gone. Proves options flow into the config.
    expect(out).toContain('[svelte-vitals] /none');
    expect(out).not.toContain('SEO001');
  });

  it('surfaces swallowed analysis errors when SVELTE_VITALS_DEBUG is set', async () => {
    vi.resetModules();
    vi.doMock('../src/providers/rendered/parse-html.js', () => ({
      parseHtmlHead: () => {
        throw new Error('boom');
      }
    }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prev = process.env.SVELTE_VITALS_DEBUG;
    process.env.SVELTE_VITALS_DEBUG = '1';
    try {
      const { svelteVitalsHandle: debugHandle } = await import('../src/hooks/index.js');
      const handle = debugHandle();
      await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
      await flush();
      const out = warn.mock.calls.map((c) => String(c[0])).join('\n');
      expect(out).toContain('[svelte-vitals] dev analysis failed:');
    } finally {
      // Restore precisely: assigning `undefined` would coerce to the string 'undefined'.
      if (prev === undefined) delete process.env.SVELTE_VITALS_DEBUG;
      else process.env.SVELTE_VITALS_DEBUG = prev;
      vi.doUnmock('../src/providers/rendered/parse-html.js');
      vi.resetModules();
    }
  });
});
