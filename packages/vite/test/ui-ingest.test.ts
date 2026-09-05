import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { svelteVitalsHandle } from '../src/hooks/handle.js';

// A minimal fake RequestEvent carrying only what the handle reads (single boundary cast).
// `pathname` may also be an absolute URL, overriding the default loopback origin.
function fakeEvent(routeId: string | null, pathname = '/') {
  return { route: { id: routeId }, url: new URL(pathname, 'http://localhost:5173') } as RequestEvent;
}
function resolveWith(chunks: string[]): Parameters<Handle>[0]['resolve'] {
  return async (_event, opts) => {
    const tpc = opts?.transformPageChunk;
    if (tpc) for (let i = 0; i < chunks.length; i++) await tpc({ html: chunks[i]!, done: i === chunks.length - 1 });
    return new Response();
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const PAGE_NO_TITLE = '<html lang="en"><head><meta name="description" content="x"></head><body></body></html>';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SVELTE_VITALS_UI;
});

describe('handle ingest (UI feed)', () => {
  it('POSTs findings to /__svelte-vitals/ingest when the UI env flag is set', async () => {
    process.env.SVELTE_VITALS_UI = '1';
    const fetchMock = vi.fn<(url: string | URL, init?: RequestInit) => Promise<Response>>(
      async () => ({ ok: true }) as Response
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [urlArg, init] = fetchMock.mock.calls[0]!;
    expect(String(urlArg)).toBe('http://localhost:5173/__svelte-vitals/ingest');
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.route).toBe('/none');
    expect(Array.isArray(sent.results)).toBe(true);
  });

  it('does NOT POST when the UI env flag is unset', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does NOT POST to a non-loopback origin (spoofed Host)', async () => {
    process.env.SVELTE_VITALS_UI = '1';
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const evilEvent = fakeEvent('/none', 'http://evil.example.com/none');
    const handle = svelteVitalsHandle();
    await handle({ event: evilEvent, resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
