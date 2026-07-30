---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Resolve import specifiers through the aliases a project declares in `svelte.config.{js,ts}` (`kit.alias`,
and `kit.files.lib` when `$lib` has been moved), in SvelteKit's own order and with its first-match-wins
semantics.

Projects that import through their own aliases will see findings that were previously invisible —
`security/shared-state-import` in particular was inert for them, since every import it examines has to
resolve to a project-local path first. `$lib` now honours `kit.files.lib` instead of assuming `src/lib`.

An alias whose value is not a plain string, and a project whose SvelteKit options are passed to the
`sveltekit()` Vite plugin, are left unresolved rather than guessed at.
