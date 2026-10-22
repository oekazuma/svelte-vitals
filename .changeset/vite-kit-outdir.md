---
'@svelte-vitals/vite': patch
---

The build-mode HTML check now reads prerendered pages from `kit.outDir`. It used to look only in `.svelte-kit/output/prerendered/pages`, so an app that sets `kit.outDir` (directly, or computed in `svelte.config.js` from an environment variable) had its prerendered pages skipped with "no prerendered pages found". The plugin takes the directory from SvelteKit's own resolved build output (`${kit.outDir}/output/server`), so a computed `outDir` is read as SvelteKit resolved it. The `prerenderDir` option still overrides it.
