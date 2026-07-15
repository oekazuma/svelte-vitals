// HTML-report primitives + the html reporter's public entry points. The document itself
// is the shared app shell in ./app-shell.ts — one renderer behind both the CLI's
// `--reporter html` and the vite live dashboard, so the two can't drift apart again.
// Runtime-agnostic: pure string building, no `node:` imports, no external resources.

type Band = 'good' | 'warn' | 'poor';

export const BAND_COLOR: Record<Band, string> = {
  good: '#2FA968',
  warn: '#E8A317',
  poor: '#E5484D'
};

export function scoreBand(score: number): Band {
  return score >= 90 ? 'good' : score >= 50 ? 'warn' : 'poor';
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}

/**
 * Return the URL only when it uses a safe http/https scheme, else null.
 * Guards a finding's `docsUrl` against `javascript:`/`data:` hrefs — escapeHtml
 * neutralizes attribute breakout but not a malicious scheme. Browsers strip
 * ASCII whitespace (tab/newline/CR) from a URL before resolving its scheme (so
 * `java\tscript:` runs as `javascript:`), so strip whitespace first; anything not
 * plainly http(s):// afterward is rejected. Pure string work — no `URL` global,
 * keeping core runtime-agnostic and lib-minimal.
 */
export function safeHref(url: string): string | null {
  const normalized = url.replace(/\s/g, '').toLowerCase();
  return /^https?:\/\//.test(normalized) ? url : null;
}

export { buildHtmlDocument, formatHtmlReport } from './app-shell.js';
