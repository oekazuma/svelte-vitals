import { DASHBOARD_STYLE } from './dashboard-style.js';
import { DASHBOARD_SCRIPT } from './dashboard-script.js';
import type { DashboardSnapshot } from './snapshot.js';

/**
 * JSON.stringify escapes `"` inside string values but not `<` or the JS line terminators
 * U+2028/U+2029 — all three matter once the result is embedded inside an inline
 * <script type="application/json"> element: an unescaped `</script>` in any finding-derived
 * string (route path, location, recommendation, fix snippet, title) would close the tag
 * early, and U+2028/U+2029 can still break some script-parsing environments.
 */
function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** The dashboard's shell HTML: empty sidebar/detail/topbar containers, the stylesheet, the
 * client script, and the current snapshot embedded as JSON for the client's first paint. */
export function renderDashboardShell(snapshot: DashboardSnapshot): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>svelte-vitals dashboard</title><style>${DASHBOARD_STYLE}</style></head><body>` +
    `<div class="dv-app" id="dv-app">` +
    `<header class="dv-topbar" id="dv-topbar"></header>` +
    `<nav class="dv-sidebar" id="dv-sidebar"></nav>` +
    `<main class="dv-detail" id="dv-detail"></main>` +
    `</div>` +
    `<script type="application/json" id="svelte-vitals-data">${embedJson(snapshot)}</script>` +
    `<script>${DASHBOARD_SCRIPT}</script>` +
    `</body></html>`
  );
}
