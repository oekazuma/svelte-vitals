import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { defineConfig, type Result } from '@svelte-vitals/core';
import { allRules, isPenalized } from '@svelte-vitals/core/internal';
import { svelteVitalsHandle } from '../src/hooks/index.js';

// A minimal fake RequestEvent carrying only what the handle reads (single boundary cast).
function fakeEvent(routeId: string | null, pathname = '/') {
  return { route: { id: routeId }, url: new URL(`http://localhost${pathname}`) } as RequestEvent;
}

// A resolve() that feeds the given HTML chunks through transformPageChunk, awaiting each.
// What each transform returned is exposed on `seen`; `wasTransformed()` reports whether
// the handle passed a transformPageChunk at all.
function resolveWith(chunks: string[]) {
  const seen: (string | undefined)[] = [];
  let transformed = false;
  const resolve: Parameters<Handle>[0]['resolve'] = async (_event, opts) => {
    const tpc = opts?.transformPageChunk;
    transformed = tpc !== undefined;
    if (tpc) {
      for (let i = 0; i < chunks.length; i++) {
        seen.push(await tpc({ html: chunks[i]!, done: i === chunks.length - 1 }));
      }
    }
    return new Response();
  };
  return Object.assign(resolve, { seen, wasTransformed: () => transformed });
}

// The handle analyzes fire-and-forget (it never blocks the response), so the
// resulting ingest POST lands a few microtasks after handle() resolves. One
// macrotask tick drains that chain — analysis is purely in-memory, no real I/O.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const PAGE_NO_TITLE = '<html lang="en"><head><meta name="description" content="x"></head><body></body></html>';
const PAGE_OK =
  '<html lang="en"><head><meta charset="utf-8"><title>Quality Widgets and Tools for Modern Builders Shop</title><meta name="description" content="Browse our curated selection of quality widgets and builder tools for modern projects and teams.">' +
  '<link rel="canonical" href="https://e.com/"><meta property="og:title" content="t">' +
  '<meta property="og:image" content="https://e.com/o.png">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<meta name="twitter:card" content="summary_large_image">' +
  '<meta property="og:description" content="x">' +
  '<meta property="og:url" content="https://e.com/">' +
  '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Home","url":"https://e.com/"}</script></head><body><h1>Quality Widgets</h1></body></html>';

// PAGE_OK with a second <h1> in the body — everything else stays clean, so the
// only finding is seo/single-h1 (heading hierarchy), confirming the rule sees the
// rendered body through the dev hook.
const PAGE_TWO_H1 = PAGE_OK.replace('</body>', '<h1>Second heading</h1></body>');

// PAGE_OK with a body <img> missing alt + dimensions — proves the dev hook now
// threads rendered images into the rule context (image rules were CLI-only before).
const PAGE_BAD_IMG = PAGE_OK.replace('</body>', '<img src="/photo.jpg"></body>');

const config = defineConfig({});

// Ids of results that actually penalize the score — mirrors format.ts's own filter,
// so these tests check the same "did this rule fail" question the dashboard cares
// about, without depending on any internal (non-exported) helper.
function penalizedIds(results: Result[]): string[] {
  return results.filter((r) => isPenalized(r.detection, config.treatDynamicAs)).map((r) => r.id);
}

function setup() {
  process.env.SVELTE_VITALS_UI = '1';
  const fetchMock = vi.fn<(url: string | URL, init?: RequestInit) => Promise<Response>>(
    async () => ({ ok: true }) as Response
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentResults(fetchMock: ReturnType<typeof setup>, callIndex = 0): Result[] {
  const [, init] = fetchMock.mock.calls[callIndex]!;
  return JSON.parse((init as RequestInit).body as string).results as Result[];
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SVELTE_VITALS_UI;
});

describe('svelteVitalsHandle', () => {
  it('reports a missing <title> for the visited route', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(penalizedIds(sentResults(fetchMock))).toContain('seo/title-presence');
  });

  it('reports no penalized findings for a clean page', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/ok', '/ok'), resolve: resolveWith([PAGE_OK]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(penalizedIds(sentResults(fetchMock))).toEqual([]);
  });

  it('runs only route-scoped rules that judge a route on their own — no cross-route or project rules', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/ok', '/ok'), resolve: resolveWith([PAGE_OK]) });
    await flush();
    const byId = new Map(allRules.map((r) => [r.id, r]));
    const ids = [...new Set(sentResults(fetchMock).map((r) => r.id))];
    expect(ids.length).toBeGreaterThan(0);
    const wrong = ids.filter((id) => byId.get(id)!.scope !== 'route' || byId.get(id)!.crossRoute);
    expect(wrong).toEqual([]);
    expect(ids).not.toContain('seo/duplicate-title');
    expect(ids).not.toContain('seo/robots-txt');
  });

  it('reports multiple <h1> from the rendered body (seo/single-h1)', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/two-h1', '/two-h1'), resolve: resolveWith([PAGE_TWO_H1]) });
    await flush();
    expect(penalizedIds(sentResults(fetchMock))).toContain('seo/single-h1');
  });

  it('reports a rendered <img> missing alt/dimensions (image rules in rendered mode)', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/img', '/img'), resolve: resolveWith([PAGE_BAD_IMG]) });
    await flush();
    const ids = penalizedIds(sentResults(fetchMock));
    expect(ids).toContain('seo/image-alt'); // missing alt
    expect(ids).toContain('performance/image-dimensions'); // missing width/height
  });

  it('returns each chunk unchanged', async () => {
    setup();
    const handle = svelteVitalsHandle();
    const resolve = resolveWith(['<html><head>', '</head></html>']);
    await handle({ event: fakeEvent('/none', '/none'), resolve });
    expect(resolve.seen).toEqual(['<html><head>', '</head></html>']);
  });

  it('dedups: the same findings on a repeat visit POST only once', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries the ingest on the next render when the first POST failed (non-ok response)', async () => {
    const fetchMock = setup();
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 403 }) as Response);
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries the ingest on the next render when the first POST threw', async () => {
    const fetchMock = setup();
    fetchMock.mockImplementationOnce(async () => {
      throw new Error('ECONNREFUSED');
    });
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('after a successful POST the same findings are still deduplicated', async () => {
    const fetchMock = setup();
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500 }) as Response);
    const handle = svelteVitalsHandle();
    for (let i = 0; i < 3; i++) {
      await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
      await flush();
    }
    // 1st fails → 2nd succeeds → 3rd is deduplicated.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends POSTs for the same route in render order even when an earlier one is slow', async () => {
    const fetchMock = setup();
    const bodies: string[] = [];
    let releaseFirst!: () => void;
    fetchMock.mockImplementationOnce(async (_url, init) => {
      bodies.push(String(init?.body));
      await new Promise<void>((r) => (releaseFirst = r));
      return { ok: true } as Response;
    });
    fetchMock.mockImplementation(async (_url, init) => {
      bodies.push(String(init?.body));
      return { ok: true } as Response;
    });
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_TWO_H1]) });
    await flush();
    // The second POST must not have been issued while the first is still in flight.
    expect(bodies).toHaveLength(1);
    releaseFirst();
    await flush();
    await flush();
    expect(bodies).toHaveLength(2);
    expect(JSON.parse(bodies[0]!).results.some((r: Result) => r.id === 'seo/title-presence')).toBe(true);
    expect(JSON.parse(bodies[1]!).results.some((r: Result) => r.id === 'seo/single-h1')).toBe(true);
  });

  it('re-sends a route whose findings changed back while an older POST was still in flight', async () => {
    const fetchMock = setup();
    const bodies: string[] = [];
    let releaseSecond!: () => void;
    fetchMock
      .mockImplementationOnce(async (_url, init) => {
        bodies.push(String(init?.body));
        return { ok: true } as Response;
      })
      .mockImplementationOnce(async (_url, init) => {
        bodies.push(String(init?.body));
        await new Promise<void>((r) => (releaseSecond = r));
        return { ok: true } as Response;
      })
      .mockImplementation(async (_url, init) => {
        bodies.push(String(init?.body));
        return { ok: true } as Response;
      });
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) }); // A, acked
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_TWO_H1]) }); // B, hangs
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) }); // A again — must be queued, not deduped
    await flush();
    releaseSecond();
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(bodies[2]!).results.some((r: Result) => r.id === 'seo/title-presence')).toBe(true);
  });

  it('a failed older POST must not clear a newer queued signature', async () => {
    const fetchMock = setup();
    let releaseFirst!: () => void;
    fetchMock.mockImplementationOnce(async () => {
      await new Promise<void>((r) => (releaseFirst = r));
      return { ok: false, status: 500 } as Response;
    });
    fetchMock.mockImplementation(async () => ({ ok: true }) as Response);
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) }); // A, hangs
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_TWO_H1]) }); // B, queued behind A
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1); // B not sent yet — still queued behind A
    releaseFirst(); // A resolves with 500
    await flush();
    await flush();
    // A's failure must not clear B's queued signature (a newer render already replaced it),
    // so the chain still sends B next.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_TWO_H1]) }); // B again — deduped
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) }); // A again — sent
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('an identical re-render while its own POST is still hanging is deduped (exactly 1 call after release)', async () => {
    const fetchMock = setup();
    let release!: () => void;
    fetchMock.mockImplementationOnce(async () => {
      await new Promise<void>((r) => (release = r));
      return { ok: true } as Response;
    });
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) }); // same signature, still in flight
    await flush();
    release();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts a hung ingest after the timeout, unblocking the route's queued ingest behind it", async () => {
    const fetchMock = setup();
    const bodies: string[] = [];
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    fetchMock.mockImplementation(async (_url, init) => {
      bodies.push(String(init?.body));
      return { ok: true } as Response;
    });
    vi.useFakeTimers();
    try {
      const handle = svelteVitalsHandle();
      await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) }); // A, hangs forever
      await vi.advanceTimersByTimeAsync(0);
      await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_TWO_H1]) }); // B, queued behind A
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1); // B still queued behind the hung A

      // Past INGEST_TIMEOUT_MS (packages/vite/src/hooks/handle.ts) — A's fetch is aborted,
      // which frees the chain for B's already-queued ingest.
      await vi.advanceTimersByTimeAsync(10_001);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(bodies[0]).toContain('seo/single-h1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a failed older POST does not clear a newer identical render already queued behind a different one', async () => {
    const fetchMock = setup();
    let releaseFirst!: () => void;
    fetchMock.mockImplementationOnce(async () => {
      await new Promise<void>((r) => (releaseFirst = r));
      return { ok: false, status: 500 } as Response;
    });
    fetchMock.mockImplementation(async () => ({ ok: true }) as Response);
    const handle = svelteVitalsHandle();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) }); // A, hangs
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_TWO_H1]) }); // B, queued behind A
    await flush();
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) }); // A′, queued behind B — same signature as A
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only A's own fetch has fired so far

    releaseFirst(); // A settles with 500 — a string-keyed queue would wrongly clear A′'s entry here
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3); // A, then B, then A′ each sent once

    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) }); // A again — must dedupe against A′'s queued entry
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  // Outside dev (production builds, and non-Node/edge runtimes), esm-env resolves
  // `DEV` to false, so the handle short-circuits to a pass-through. Mocking esm-env
  // is the canonical way to exercise that branch — `DEV` is a static import, not a
  // runtime read of NODE_ENV, so toggling env vars wouldn't flip it.
  it('is a pass-through when not in dev (no transformPageChunk, no ingest)', async () => {
    vi.resetModules();
    vi.doMock('esm-env', () => ({ DEV: false }));
    const fetchMock = setup();
    try {
      const { svelteVitalsHandle: prodHandle } = await import('../src/hooks/index.js');
      const handle = prodHandle();
      const resolve = resolveWith([PAGE_NO_TITLE]);
      await handle({ event: fakeEvent('/none', '/none'), resolve });
      expect(resolve.wasTransformed()).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('esm-env');
      vi.resetModules();
    }
  });

  it('does not throw when the HTML is unparseable garbage', async () => {
    setup();
    const handle = svelteVitalsHandle();
    await expect(
      handle({ event: fakeEvent(null, '/x'), resolve: resolveWith(['not really <<< html']) })
    ).resolves.toBeDefined();
  });

  it('honors per-rule overrides from options (rules)', async () => {
    const fetchMock = setup();
    const handle = svelteVitalsHandle({ rules: { 'seo/title-presence': 'off' } });
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
    // The page still trips other rules, so results are still sent — but with seo/title-presence
    // disabled, it's excluded from the penalized set. Proves options flow into the config.
    expect(penalizedIds(sentResults(fetchMock))).not.toContain('seo/title-presence');
  });

  it("forwards a crashed rule's id as failedRuleIds on the ingest POST", async () => {
    vi.resetModules();
    vi.doMock('@svelte-vitals/core/internal', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@svelte-vitals/core/internal')>();
      return {
        ...actual,
        runAnalysis: async (...args: Parameters<typeof actual.runAnalysis>) => ({
          ...(await actual.runAnalysis(...args)),
          results: [],
          failedRules: [{ id: 'seo/title-presence', message: 'boom' }],
          failedRuleIds: ['seo/title-presence']
        })
      };
    });
    const fetchMock = setup();
    try {
      const { svelteVitalsHandle: mockedHandle } = await import('../src/hooks/index.js');
      const handle = mockedHandle();
      await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
      await flush();
      const [, init] = fetchMock.mock.calls[0]!;
      const sent = JSON.parse((init as RequestInit).body as string);
      expect(sent.failedRuleIds).toEqual(['seo/title-presence']);
    } finally {
      vi.doUnmock('@svelte-vitals/core/internal');
      vi.resetModules();
    }
  });

  it('sends an empty failedRuleIds array once a previously-crashing rule recovers', async () => {
    vi.resetModules();
    let shouldFail = true;
    vi.doMock('@svelte-vitals/core/internal', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@svelte-vitals/core/internal')>();
      return {
        ...actual,
        runAnalysis: async (...args: Parameters<typeof actual.runAnalysis>) => {
          // Real results on both runs — only the failed-rule fields differ while `shouldFail`
          // is true — so the second POST below can only be explained by the failed-id
          // dedup suffix changing, not by `findingSignature`'s `results` shifting too.
          const result = await actual.runAnalysis(...args);
          if (shouldFail) {
            return {
              ...result,
              failedRules: [{ id: 'seo/title-presence', message: 'boom' }],
              failedRuleIds: ['seo/title-presence']
            };
          }
          return result;
        }
      };
    });
    const fetchMock = setup();
    try {
      const { svelteVitalsHandle: mockedHandle } = await import('../src/hooks/index.js');
      const handle = mockedHandle();
      await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
      await flush();
      shouldFail = false;
      // Re-render the same page: `results` are identical on both runs, so `findingSignature`
      // alone can't explain a second POST — only the failed-id dedup suffix clearing can.
      // This POST must still fire.
      await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [, init] = fetchMock.mock.calls[1]!;
      const sent = JSON.parse((init as RequestInit).body as string);
      expect(sent.failedRuleIds).toEqual([]);
    } finally {
      vi.doUnmock('@svelte-vitals/core/internal');
      vi.resetModules();
    }
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
      expect(out).toContain('svelte-vitals: dev analysis failed:');
    } finally {
      // Restore precisely: assigning `undefined` would coerce to the string 'undefined'.
      if (prev === undefined) delete process.env.SVELTE_VITALS_DEBUG;
      else process.env.SVELTE_VITALS_DEBUG = prev;
      vi.doUnmock('../src/providers/rendered/parse-html.js');
      vi.resetModules();
    }
  });
});
