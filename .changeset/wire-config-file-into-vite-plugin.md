---
'@svelte-vitals/vite': minor
---

The Vite plugin now reads `svelte-vitals.config.{mjs,js,ts}` automatically, in both build mode (`vite build`) and the dev-time live dashboard (`vite dev`) — matching the CLI/MCP server's per-field precedence (explicit `svelteVitals({ ... })` option > config file > built-in default). This includes a new `weights` plugin option, which now flows into the plugin's Health score the same way it already does for the CLI. Previously the plugin ignored `svelte-vitals.config.*` entirely, even though the file already existed as a recognized re-analysis trigger for the dev dashboard's file watcher — a project could set `weights`/`rules`/etc. once and have the CLI honor it while the Vite plugin silently used its own defaults. No action needed if you don't have a config file; if you do, double-check the plugin's effective config now matches what you expect (non-fatal config-file issues are logged to the console with a `svelte-vitals:` prefix).
