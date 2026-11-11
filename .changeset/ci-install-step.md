---
'svelte-vitals': minor
---

`svelte-vitals ci install` and `svelte-vitals install --client ci-workflow` write an install step between checkout and the action step: `npm ci --ignore-scripts` for an npm project, and `pnpm/setup` followed by `pnpm install --frozen-lockfile --ignore-scripts` for a pnpm project that declares pnpm 11 or newer in `packageManager` or `devEngines.packageManager`. For Yarn, Bun, older or undeclared pnpm, or a project without a lockfile, the step is written commented out, and `ci install` prints why and asks you to complete it. `ci install` also prints the command that adds `svelte-vitals` when `package.json` does not declare it.

The bundled pin moves to `oekazuma/svelte-vitals-action` v0.15.0. That release runs the `svelte-vitals` installed in the project (0.44.0 or newer) instead of its bundled analyzer, so CI analyzes with the version in your lockfile and its findings match a local run. An installed CLI that cannot produce a report, for example because of an invalid config, fails the step. Without a usable install, the action analyzes with its bundled analyzer (svelte-vitals 0.55.5) and says so in a message beginning `svelte-vitals: using the bundled svelte-vitals 0.55.5.`

For an existing workflow, `svelte-vitals ci upgrade` moves the pin; it does not add the install step. Add the step by hand before the action step, or regenerate the file with `ci install --force`, which discards your edits to it. Until the workflow has an install step, it runs the bundled analyzer and prints that message. The bundled analyzer is 0.55.5 where v0.13.1 bundled 0.55.2, so findings can change in both directions on the upgrade alone; with an install step, they follow the version in your lockfile.
