import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Handle } from '@sveltejs/kit';
import { svelteVitalsHandle } from '../src/hooks/index.js';

function fakeEvent(routeId: string | null, pathname = '/') {
  return { route: { id: routeId }, url: new URL(`http://localhost:5173${pathname}`) } as unknown as Parameters<
    Parameters<Handle>[0]['resolve']
  >[0];
}
function resolveWith(chunks: string[]) {
  return (async (_event: unknown, opts?: { transformPageChunk?: (i: { html: string; done: boolean }) => unknown }) => {
    const tpc = opts?.transformPageChunk;
    if (tpc) for (let i = 0; i < chunks.length; i++) await tpc({ html: chunks[i]!, done: i === chunks.length - 1 });
    return {} as unknown as Response;
  }) as Parameters<Handle>[0]['resolve'];
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
});
