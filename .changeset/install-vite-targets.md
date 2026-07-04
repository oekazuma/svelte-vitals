---
'svelte-vitals': minor
---

`npx svelte-vitals install` can now also set up `@svelte-vitals/vite`: `--client vite-plugin` registers the build-mode plugin in `vite.config.{ts,js,mjs}`, and `--client vite-dev-overlay` wires the dev-overlay hook into `src/hooks.server.{ts,js}`. Both use a `magicast` codemod that only edits a file whose shape it confidently recognizes — anything else is left untouched and a snippet is printed instead. When either target is written and `@svelte-vitals/vite` isn't already a dependency, it's installed automatically via the detected package manager. `--force` does not apply to these two targets — an existing registration is always left as-is.
