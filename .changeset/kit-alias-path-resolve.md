---
'@svelte-vitals/core': patch
---

A `kit.alias` or `kit.files.lib` value written as `path.resolve('./src/features')`, `join(__dirname, 'src/lib')` or `fileURLToPath(new URL('./src/x', import.meta.url))` in `svelte.config.js` is now read as the project-relative path it names, instead of making the alias unresolvable. Components and modules imported through such aliases are followed by head, heading and a11y resolution and by the rules that resolve imports (`architecture/private-scope-import`, `architecture/route-component-import`, `security/shared-state-import`, `security/handler-state-write`), so those rules can now report findings they previously could not see.
