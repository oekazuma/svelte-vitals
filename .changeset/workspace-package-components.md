---
'svelte-vitals': patch
'@svelte-vitals/core': patch
'@svelte-vitals/vite': patch
---

Source analysis now follows components an app imports from a package of the same monorepo. It covers a package the app's `package.json` declares with a `workspace:` range, or with a `link:`/`file:` path inside the repository. svelte-vitals finds the package through the nearest `pnpm-workspace.yaml` or `package.json` `workspaces` above the app, matches it by `name`, and resolves the import through its `exports` (its file layout when it has none). A `kit.alias` into `node_modules/<that package>` reads the package's directory whether or not the checkout was installed. The `<title>`, meta tags, JSON-LD and headings these components render now count for the routes that render them, which removes false "Missing" findings; components that were invisible before can also produce new findings. npm packages in `node_modules` and anything outside the repository are still not read, and the import-following rules (`architecture/private-scope-import`, `architecture/route-component-import`, `security/shared-state-import`, `security/handler-state-write`) resolve imports as before.
