---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

New rule `architecture/private-scope-import`: a unit inside a directory you have declared private
must not be imported from outside that directory's owner. It is **inert until configured** — set
`scopes` to a list of globs naming your private directories, and nothing changes for projects that
do not.

Each glob matches a private directory and its parent becomes the boundary, so the same directory
name can mean different things in different places: with `scopes: ['src/routes/**/components']`, a
route's `components/` is private to that route while `src/lib/components` stays shared. When private
directories nest, the innermost one wins.

Only imports written in a `.svelte` component are checked, and only when the specifier is `$lib/` or
relative. An import resolved through a custom `svelte.config.js` alias, one written in a
`.svelte.ts` / `.svelte.js` module or a Kit module (`+page.ts`, `+server.ts`, `hooks.*.ts`), and one
naming a directory rather than a file are all unchecked for now. Each rule page lists the same set.
Type-only imports **are** checked — the coupling they create survives into source even though the
import is erased at build.
