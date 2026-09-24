---
'@svelte-vitals/vite': patch
---

The plugin's `vite` and `@sveltejs/kit` peer ranges no longer follow the versions this repository develops against. They had tightened to `vite ^8.3.0` and `@sveltejs/kit ^2.70.3`, so npm refused to install the plugin into an app on Vite 8.1 or any earlier major without `--force`. The peers are now `vite ^5.0.3 || ^6.0.0 || ^7.0.0 || ^8.0.0` (SvelteKit's own Vite range) and `@sveltejs/kit ^2.0.0`.
