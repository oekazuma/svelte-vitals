---
'svelte-vitals': patch
---

A `kit.alias` or `kit.files.lib` value built with `path.join` or `path.resolve` no longer keeps a doubled slash or an empty part. `path.resolve('node_modules/', '@acme/ui/src')` was read as `node_modules//@acme/ui/src`, so an alias into a workspace package's `node_modules` link was not pointed at the package's own directory. It now is.
