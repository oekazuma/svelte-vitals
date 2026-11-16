# Run the scaffolded step through the package manager

**Status:** approved by the owner on 2026-11-17, including the `--` in the npm form that the runner
check below called for. Refines the run step of `2026-11-15-remove-action-design.md` §3.

## Intent

The step `ci install` writes ran `./node_modules/.bin/svelte-vitals`. It works, but it reads as a
workaround in the workflow and in every guide that quotes it. The owner wants the command a reader
would write by hand.

## Decision

- npm shape: `npx --no -- svelte-vitals …`. `--no` makes npx refuse instead of downloading when the
  package is missing. `--` is required: without it, npm 11.19.1 on the GitHub runner read `--diff`,
  `--reporter` and `--baseline` as its own config and the CLI exited 2 (npm 12.0.2 locally did not).
- pnpm shape (pnpm 11 or newer, set up by `pnpm/setup`): `pnpm exec svelte-vitals …`.
- Manual shapes (Yarn, Bun, older or undeclared pnpm, no lockfile) keep `./node_modules/.bin/svelte-vitals`:
  their install is commented out, and no runner form was measured for them.
- The path argument, its quoting and the `env:` base ref are unchanged.
- The scaffolding notes stop quoting the command, so they hold for every shape.

## Measured (2026-11-17, npm 12.0.2, pnpm 12.14.0, Bun on macOS)

With a stub bin that echoes its argv and exits with a chosen code, `npx --no svelte-vitals`,
`npx --no -- svelte-vitals`, `npm exec --no -- svelte-vitals`, `pnpm exec svelte-vitals` and
`bun run svelte-vitals` all passed `./docs --reporter github --diff origin/main --baseline origin/main`
through unchanged and returned exit 0, 1 and 2 unchanged. With svelte-vitals 0.57.0 under
`GITHUB_ACTIONS=true`, `npx --no` and `pnpm exec` wrote the same stdout and job summary as the bin
path. The local npm is newer than the runner's, which is why the runner check below caught the `--`.

What changes:

- A missing install exits 1 (npx: "npx canceled due to missing packages"), not 127. The log names
  the cause; the exit code alone no longer separates it from the gate.
- npm 12.0.2 locally wrote two `npm notice run …` lines to stderr on every run; npm 11.19.1 on the
  runner wrote none.
- pnpm 12 checks that `node_modules` matches the lockfile before `exec`, and installs from the
  lockfile when it does not (measured with `node_modules` deleted, and with a dependency added to
  `package.json`). After the step's frozen install, pnpm 12.20.0 on the runner printed nothing extra.

## Approaches considered

1. Package manager's runner (chosen, npm and pnpm only).
2. Add `node_modules/.bin` to `$GITHUB_PATH` in the install step and run `svelte-vitals`: cleanest
   run line, but a hidden extra line in the install step, and it does not follow a
   `working-directory:` edit.
3. Keep the bin path everywhere.

## Runner check (2026-11-17, private throwaway repository, svelte-vitals 0.57.0 from npm)

Workflows written by this branch's `ci install` / `install --client ci-workflow --app apps/web`, each
run on a pull request that adds one route. The last three rows were edited by hand as stated.

| Shape                                                                                        | Runner                    | Step exit                                                           | Annotations on the new route | Job summary                                 |
| -------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| npm, `npx --no -- svelte-vitals`                                                             | Node 24.22.2, npm 11.19.1 | 1 (gate)                                                            | 13                           | one report, 1 critical · 7 warning · 5 info |
| pnpm, `pnpm exec svelte-vitals`                                                              | pnpm 12.20.0              | 1 (gate)                                                            | 13                           | same                                        |
| pnpm workspace, `pnpm exec svelte-vitals 'apps/web'`                                         | pnpm 12.20.0              | 1 (gate)                                                            | 13, under `apps/web/`        | same                                        |
| npm, setup and install removed                                                               | npm 11.19.1               | 1, `npx canceled due to missing packages`                           | none                         | none                                        |
| pnpm, install line removed                                                                   | pnpm 12.20.0              | 1 (gate), after `pnpm exec` installed 69 packages from the lockfile | 13                           | not read                                    |
| pnpm workspace, CLI only in `apps/web`, `working-directory: apps/web` added as the note says | pnpm 12.20.0              | 1 (gate)                                                            | 13, under `apps/web/`        | not read                                    |

The first npm run, without `--`, exited 2: npm read the step's flags as its own config.
