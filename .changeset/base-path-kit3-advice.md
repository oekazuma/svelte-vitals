---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`correctness/base-path-navigation` now names the SvelteKit 3 spelling next to the SvelteKit 2 one. SvelteKit 3 reads a leading `/` as a route ID, so `resolve('/blog/hello-world')` does not type-check there, while SvelteKit 2 requires the slash. The message gives both (`resolve('/blog/hello-world')`, and `resolve('blog/hello-world')` in SvelteKit 3), and the texts say `paths.base` instead of `kit.paths.base`. Detection is unchanged.
