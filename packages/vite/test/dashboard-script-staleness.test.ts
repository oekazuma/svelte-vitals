// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APP_SCRIPT as DASHBOARD_SCRIPT } from '@svelte-vitals/core/internal';

/**
 * These tests execute the hand-authored `DASHBOARD_SCRIPT` client script (no bundler, no
 * framework — see the doc comment on `DASHBOARD_SCRIPT` itself) in a jsdom environment to
 * verify the SSE staleness guard in `fetchSnapshot()` (dashboard-script.ts): a re-fetched
 * `/__svelte-vitals/data.json` response is only applied if its `sequence` is strictly newer
 * than what's already rendered. The script exposes nothing globally (no `fetchSnapshot`/
 * `state` to import or spy on directly) — `fetchSnapshot()` is only reachable through the
 * EventSource's `open`/`update` listeners registered by `boot()`, so a fake `EventSource` is
 * used to drive it indirectly, exactly as a real browser connection would.
 *
 * The observable signal used throughout is the topbar's `.dv-analyzing` indicator, which
 * `renderTopbar()` renders iff `state.snapshot.analyzing` is true — a boolean the tests flip
 * between fetch responses so a passing/failing guard produces a visible DOM difference.
 */

function snapshotJson(sequence: number, analyzing: boolean): string {
  return JSON.stringify({
    report: {
      version: '1',
      score: 80,
      weights: { seo: 1 },
      categories: { seo: { score: 80, scoreModel: 'weighted' } },
      summary: { critical: 0, warning: 0, info: 0, passed: 0, dynamic: 0 },
      routes: [],
      siteIssues: []
    },
    badges: {},
    analyzing,
    live: true,
    sequence,
    meta: { version: '9.9.9', coreVersion: '0.21.0' }
  });
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  listeners: Record<string, Array<() => void>> = {};

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: () => void): void {
    (this.listeners[type] ??= []).push(cb);
  }

  dispatch(type: string): void {
    (this.listeners[type] ?? []).forEach((cb) => cb());
  }
}

/** Flushes pending microtasks (the fetch/json promise chain inside fetchSnapshot) so that,
 * after this resolves, any render triggered by the dispatched event has already happened.
 * A macrotask (0ms timeout) is enough — it runs strictly after all queued microtasks, so
 * this doesn't need (and gains no extra safety from) a longer real-time delay. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('dashboard client script — SSE staleness guard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Initial boot snapshot: sequence 1, analyzing:false — the client script reads this
    // synchronously in boot() before any fetch happens.
    document.body.innerHTML = `
      <div class="dv-app" id="dv-app">
        <header class="dv-topbar" id="dv-topbar"></header>
        <nav class="dv-sidebar" id="dv-sidebar"></nav>
        <main class="dv-detail" id="dv-detail"></main>
      </div>
      <script type="application/json" id="svelte-vitals-data">${snapshotJson(1, false)}</script>
    `;
    FakeEventSource.instances = [];
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('discards an out-of-order response with a lower sequence than what is already rendered', async () => {
    // 'open' fires fetchSnapshot() once (boot()'s open handler). Resolve it with sequence 5,
    // analyzing:true, so state.snapshot becomes sequence 5 and the analyzing indicator
    // appears — proving this first render actually happened (it differs from the initial
    // boot snapshot's analyzing:false).
    fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve(JSON.parse(snapshotJson(5, true))) });

    // Executing the hand-authored client script under test, by design (see the doc comment
    // above): DASHBOARD_SCRIPT is a plain string, not a module, so there's no import to drive.
    (0, eval)(DASHBOARD_SCRIPT);
    expect(FakeEventSource.instances).toHaveLength(1);
    FakeEventSource.instances[0]!.dispatch('open');
    await vi.waitFor(() => expect(document.querySelector('.dv-analyzing')).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Simulate a second 'update' event whose fetch resolves with an OLDER sequence (4,
    // analyzing:false) than what's already rendered (5) — the staleness guard must discard
    // it. If the guard were broken (e.g. `<=` became `<`, or it read the wrong field), this
    // response would be applied and the analyzing indicator would disappear.
    fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve(JSON.parse(snapshotJson(4, false))) });
    FakeEventSource.instances[0]!.dispatch('update');
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.dv-analyzing')).not.toBeNull();
  });

  it('applies a newer response and updates the rendered state', async () => {
    fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve(JSON.parse(snapshotJson(5, true))) });

    (0, eval)(DASHBOARD_SCRIPT);
    FakeEventSource.instances[0]!.dispatch('open');
    await vi.waitFor(() => expect(document.querySelector('.dv-analyzing')).not.toBeNull());

    // A newer sequence (6, analyzing:false) than what's rendered (5) must be applied — proves
    // the guard isn't simply discarding everything, only genuinely stale responses.
    fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve(JSON.parse(snapshotJson(6, false))) });
    FakeEventSource.instances[0]!.dispatch('update');
    await vi.waitFor(() => expect(document.querySelector('.dv-analyzing')).toBeNull());

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
