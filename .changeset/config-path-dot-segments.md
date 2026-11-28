---
'svelte-vitals': patch
---

A `kit.alias` or `kit.files.lib` value now has its `.` and `..` segments folded the way SvelteKit's `path.resolve` folds them, so an alias such as `path.resolve('src/../node_modules/@acme/ui/src')` is pointed at the workspace package's own directory, as `node_modules/@acme/ui/src` already was. `path.join(__dirname, '/src/ui')` is now read as `src/ui` under the project root, as Node joins it, and no longer as the absolute path `/src/ui`, so imports through such an alias are followed.
