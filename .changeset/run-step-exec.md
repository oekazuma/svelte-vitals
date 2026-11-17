---
'svelte-vitals': patch
---

The workflow `ci install` and `install --client ci-workflow` scaffold now runs the installed CLI through the package manager: `npx --no -- svelte-vitals` for npm and `pnpm exec svelte-vitals` for pnpm, in place of `./node_modules/.bin/svelte-vitals`, which the commented-out shapes (Yarn, Bun, older or undeclared pnpm, no lockfile) keep. `--no` makes npx refuse to download, so without an install the npm step still fails, now with exit `1` and `npx canceled due to missing packages` instead of exit `127`. The pnpm step sets `pnpm_config_verify_deps_before_run: error` in its `env:`, so `pnpm exec` fails with exit `1` rather than installing first, which would run the project's lifecycle scripts. A workflow already written is left as it is; re-run with `--force` to regenerate it.
