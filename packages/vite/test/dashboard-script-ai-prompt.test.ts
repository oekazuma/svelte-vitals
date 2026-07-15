// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { APP_SCRIPT as DASHBOARD_SCRIPT } from '@svelte-vitals/core';

/**
 * Executes the hand-authored DASHBOARD_SCRIPT client script (see the doc comment on
 * dashboard-script-staleness.test.ts for why `eval` — no bundler/framework, nothing to
 * import) to cover the "AI Prompt" disclosure added to each finding card: the prompt
 * text itself, and the Copy button's success/failure feedback.
 */

function snapshotJson(): string {
  return JSON.stringify({
    report: {
      version: '1',
      score: 50,
      weights: { seo: 1 },
      categories: { seo: { score: 50, scoreModel: 'weighted' } },
      summary: { critical: 1, warning: 0, info: 0, passed: 0, dynamic: 0 },
      routes: [
        {
          route: '/blog/hello',
          score: 50,
          issues: [
            {
              id: 'SEO001',
              category: 'seo',
              title: 'Missing <title>',
              severity: 'critical',
              location: 'src/routes/blog/hello/+page.svelte',
              line: 3,
              recommendation: 'Add a <title> inside <svelte:head>.',
              fix: {
                description: 'Add a <title> tag.',
                snippet: '<svelte:head>\n  <title>Hello</title>\n</svelte:head>',
                lang: 'svelte'
              },
              docsUrl: 'https://oekazuma.github.io/svelte-vitals/rules/seo001/'
            }
          ]
        }
      ],
      siteIssues: []
    },
    badges: { '/blog/hello': 'static' },
    analyzing: false,
    live: true,
    sequence: 1,
    meta: { version: '9.9.9' }
  });
}

function boot(): void {
  document.body.innerHTML = `
    <div class="dv-app" id="dv-app">
      <header class="dv-topbar" id="dv-topbar"></header>
      <nav class="dv-sidebar" id="dv-sidebar"></nav>
      <main class="dv-detail" id="dv-detail"></main>
    </div>
    <script type="application/json" id="svelte-vitals-data">${snapshotJson()}</script>
  `;
  (0, eval)(DASHBOARD_SCRIPT);
  location.hash = 'route/route-blog-hello';
  window.dispatchEvent(new Event('hashchange'));
}

describe('dashboard client script — AI Prompt disclosure', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a closed-by-default disclosure with a prompt built from the finding', () => {
    boot();
    const details = document.querySelector('.dv-ai-prompt') as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')!.textContent).toBe('AI Prompt');

    const text = details.querySelector('.dv-ai-prompt-pre')!.textContent!;
    expect(text).toContain('SEO001');
    expect(text).toContain('Route: /blog/hello');
    expect(text).toContain('src/routes/blog/hello/+page.svelte:3');
    expect(text).toContain('Add a <title> inside <svelte:head>.');
    expect(text).toContain('```svelte');
    expect(text).toContain('https://oekazuma.github.io/svelte-vitals/rules/seo001/');
  });

  it('shows "Copied!" when navigator.clipboard.writeText succeeds', async () => {
    boot();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const btn = document.querySelector('.dv-ai-copy-btn') as HTMLButtonElement;

    btn.click();

    expect(writeText).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(btn.textContent).toBe('Copied!'));
  });

  it('falls back to execCommand and still shows "Copied!" when the Clipboard API is unavailable', async () => {
    boot();
    vi.stubGlobal('navigator', {});
    // jsdom doesn't implement execCommand at all, so there's nothing for vi.spyOn to wrap —
    // define it directly, same as a real browser exposing it on `document`.
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;
    const btn = document.querySelector('.dv-ai-copy-btn') as HTMLButtonElement;

    btn.click();

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(btn.textContent).toBe('Copied!');
  });

  it('shows "Copy failed" — not a false-positive "Copied!" — when every copy path fails', async () => {
    boot();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    document.execCommand = vi.fn().mockReturnValue(false);
    const btn = document.querySelector('.dv-ai-copy-btn') as HTMLButtonElement;

    btn.click();

    await vi.waitFor(() => expect(btn.textContent).toBe('Copy failed'));
  });
});
