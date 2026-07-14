---
'svelte-vitals': minor
---

`svelte-vitals install --client config-file` now auto-picks the best extension for the environment instead of always scaffolding `.mjs`: `.ts` (using `defineConfig` for real type-checking/autocomplete) when the current Node supports loading it natively, the project looks TypeScript-oriented (a `tsconfig.json` or `vite.config.ts` present), and `svelte-vitals` is a declared dependency (the `defineConfig` import resolves at load time, so npx-only projects keep getting the dependency-free default); otherwise the safe `.mjs`. Detecting whether a config file already exists now checks all three candidate extensions (`.mjs`/`.js`/`.ts`), not just `.mjs` — a project with an existing `svelte-vitals.config.ts` no longer gets a redundant `.mjs` created alongside it. `--force` always regenerates whichever file is already there, never switching its extension or module syntax (a `.js` config in a CommonJS project is regenerated as `module.exports`, not ESM).
