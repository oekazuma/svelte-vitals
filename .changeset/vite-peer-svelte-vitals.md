---
'@svelte-vitals/vite': minor
---

`svelte-vitals` and `@svelte-vitals/core` are now peer dependencies instead of exact-pinned regular dependencies. Previously the plugin bundled its own copy of the rule engine, so a project that also installed the `svelte-vitals` CLI directly ran two independent cores — a config the newer CLI accepted could hard-fail `vite build` against the plugin's older registry, with no warning from any package manager.

With peers, a compatible install resolves one shared copy: the plugin validates and analyzes with the same rule registry the CLI runs, and installing versions outside the plugin's supported range surfaces as an install-time peer warning. npm and pnpm auto-install missing peers; if you install with yarn, add both `svelte-vitals` and `@svelte-vitals/core` as devDependencies alongside `@svelte-vitals/vite` (classic yarn hoists core transitively, but Plug'n'Play resolves only declared packages).
