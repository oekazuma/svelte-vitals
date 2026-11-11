# `ci install` scaffolds an install step (Phase 1, this repository) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The workflow `ci install` writes installs the project's dependencies before the action step, so the action analyzes with the project's own `svelte-vitals`; the docs describe that behaviour; the bundled pin moves to the action release that has it (v0.15.0).

**Architecture:** A pure planner reads the lockfile name and `package.json` and decides between a live npm step, a live pnpm step, or a commented block. `buildWorkflowYaml` renders that decision. `ci install` prints what the user still has to do. Docs and the pin follow.

**Tech Stack:** TypeScript (ESM), gunshi, vitest; Blume docs (English and Japanese); Changesets.

**Spec:** `docs/superpowers/specs/2026-11-11-action-runs-project-cli-design.md`, section "Phase 1: the scaffold and docs (`svelte-vitals`)".

## Global Constraints

- **The generator never emits a step it can know will fail.** A live step only for: npm with a `package-lock.json`; pnpm with a `pnpm-lock.yaml` and a declared pnpm of 11 or newer. Everything else gets a commented block.
- The install step carries no `continue-on-error`. Lifecycle scripts are disabled in it.
- `pnpm/setup` is pinned at the SHA and version this repository's own `.github/workflows/setup-node/action.yml` uses, asserted by a lockstep test like `CHECKOUT_SHA`'s.
- `ci install` does not edit `package.json`. `ci upgrade` does not change (it rewrites the pin only).
- `ci install` makes no network call.
- The action facts the docs state (all verified against `oekazuma/svelte-vitals-action` v0.15.0): it looks for `node_modules/svelte-vitals` from `path` up to the workspace root; minimum installed version 0.44.0; it runs the installed CLI twice (`--reporter md`, whose exit code is the gate, then `--reporter github`); an installed CLI that cannot produce a report fails the step and is not replaced by the bundled analyzer; without a usable install it analyzes with the bundled analyzer after a message beginning `svelte-vitals: using the bundled svelte-vitals <version>.`, a warning when `svelte-vitals` is declared but not installed or the install is older than 0.44.0, a notice when it is neither declared nor installed.
- Docs are a snapshot of current behaviour: no "now", "previously", "no longer", no issue references. English and Japanese pages change together and are stamped (`pnpm --filter docs run translate:stamp <en-file...>`).
- `packages/cli/docs/*.md` changes need `pnpm --filter svelte-vitals run gen:docs && pnpm format`.
- Comments say only what the code cannot. No rule counts or ID ranges in docs.
- Verify with `pnpm lint`, `pnpm typecheck`, `pnpm test`, judged by exit code.

## Review Focus

1. **pnpm declared as a range or with a hash** (`pnpm@12.18.0+sha512.…`, `devEngines.packageManager.version: "^11.0.0"`). The planner must read the major and not treat an unparseable value as 11+.
2. **A lockfile with no matching declaration, or two lockfiles.** The existing priority order decides; an undeclared pnpm gets the commented block, never `pnpm/setup` without a version.
3. **`install --client ci-workflow`** writes through the same builder and must get the same install step.
4. **YAML validity of every variant**, including the commented block: indentation by spaces, comments at step level, the action step still last.
5. **A project that does not declare `svelte-vitals`.** The workflow is still written; the user is told the command to add it.

---

### Task 1: Decide the install step

**Files:**

- Create: `packages/cli/src/ci/install-step.ts`
- Test: `packages/cli/test/ci/install-step.test.ts`

**Interfaces:**

- Consumes: `detectPackageManagerFromLockfile` (`packages/cli/src/install/package-manager.ts`), `readPkg` (`packages/cli/src/pkg-json.ts`).
- Produces:

  ```ts
  export type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm';

  export type InstallStepPlan =
    | { kind: 'npm' }
    | { kind: 'pnpm' }
    /** `command` is what the commented block shows; `reason` is the sentence `ci install` prints. */
    | { kind: 'manual'; command: string; reason: string };

  export function planInstallStep(io: { cwd: string; readFile(path: string): string | undefined }): InstallStepPlan;
  ```

  `PackageManager` is today a private type in `package-manager.ts`; export it from there and import it here instead of redeclaring it.

  Decision table (lockfile priority is `detectPackageManagerFromLockfile`'s):

  | Lockfile                                  | `package.json`                    | Result                                                    |
  | ----------------------------------------- | --------------------------------- | --------------------------------------------------------- |
  | `package-lock.json`                       | any                               | `{ kind: 'npm' }`                                         |
  | `pnpm-lock.yaml`                          | pnpm declared, major 11 or newer  | `{ kind: 'pnpm' }`                                        |
  | `pnpm-lock.yaml`                          | pnpm declared, major 10 or older  | manual, `pnpm install --frozen-lockfile --ignore-scripts` |
  | `pnpm-lock.yaml`                          | pnpm not declared, or unparseable | manual, same command                                      |
  | `yarn.lock` starting `# yarn lockfile v1` | any                               | manual, `yarn install --frozen-lockfile --ignore-scripts` |
  | `yarn.lock` otherwise                     | any                               | manual, `yarn install --immutable --mode=skip-build`      |
  | `bun.lock` or `bun.lockb`                 | any                               | manual, `bun install --frozen-lockfile --ignore-scripts`  |
  | none                                      | any                               | manual, `npm ci --ignore-scripts`                         |

  "pnpm declared" means `packageManager` is a string starting `pnpm@`, or `devEngines.packageManager` is an object (or an array containing one) with `name: 'pnpm'` and a string `version`. The major is the first run of digits in the version text (`12.18.0+sha512.abc` → 12, `^11.0.0` → 11, `>=10` → 10).

  Reasons (exact text):
  - pnpm 10 or older: `the pinned pnpm setup action installs pnpm 11 and newer, and this project declares pnpm <major>`
  - pnpm undeclared or unparseable: `the pinned pnpm setup action needs the pnpm version from "packageManager" or "devEngines.packageManager" in package.json`
  - yarn: `this CLI does not pin a setup step for Yarn`
  - bun: `this CLI does not pin a setup step for Bun`
  - no lockfile: `no lockfile was found, so the package manager is unknown`

- [ ] **Step 1: Write the failing tests** in `packages/cli/test/ci/install-step.test.ts`, driving `planInstallStep` with an in-memory `readFile` (a `Record<string, string>` keyed by absolute path under a fake `cwd`). One case per table row, plus:

  ```ts
  it.each([
    ['pnpm@12.18.0', 'pnpm'],
    ['pnpm@12.18.0+sha512.abcdef', 'pnpm'],
    ['pnpm@11.0.0', 'pnpm'],
    ['pnpm@10.33.0', 'manual'],
    ['yarn@4.5.0', 'manual'],
    ['pnpm@latest', 'manual']
  ])('reads packageManager %s as %s', ...)

  it.each([
    [{ name: 'pnpm', version: '^11.0.0' }, 'pnpm'],
    [{ name: 'pnpm', version: '>=10' }, 'manual'],
    [[{ name: 'npm', version: '11' }, { name: 'pnpm', version: '12.1.0' }], 'pnpm'],
    [{ name: 'npm', version: '11.0.0' }, 'manual']
  ])('reads devEngines.packageManager %j as %s', ...)

  it('prefers pnpm-lock.yaml over package-lock.json when both exist', ...) // → pnpm or manual, never npm
  it('survives a package.json that is not valid JSON', ...) // pnpm-lock.yaml + '{' → manual, undeclared reason
  it('names the declared major in the reason', ...) // pnpm@10.33.0 → reason contains 'declares pnpm 10'
  ```

- [ ] **Step 2: Run them and watch them fail**

  Run: `pnpm --filter svelte-vitals exec vitest run test/ci/install-step.test.ts`
  Expected: FAIL, cannot resolve `../../src/ci/install-step.js`.

- [ ] **Step 3: Implement `packages/cli/src/ci/install-step.ts`.** `readPkg` returns only the dependency fields' type; read the two extra fields off the parsed object with a local type, without widening `PkgJson`.

- [ ] **Step 4: Run the tests**

  Run: `pnpm --filter svelte-vitals exec vitest run test/ci/install-step.test.ts test/install/package-manager.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/cli/src/ci/install-step.ts packages/cli/src/install/package-manager.ts packages/cli/test/ci/install-step.test.ts
  git commit -m "feat(cli): decide which install step a scaffolded workflow can carry"
  ```

### Task 2: Render it and tell the user

**Files:**

- Modify: `packages/cli/src/ci/workflow.ts`
- Modify: `packages/cli/src/gunshi/ci.ts`
- Modify: `packages/cli/src/install/index.ts` (`planForCiTarget`)
- Test: `packages/cli/test/ci/workflow.test.ts`, `packages/cli/test/ci/lockstep.test.ts`, `packages/cli/test/ci/cli.test.ts`, `packages/cli/test/install/run.test.ts`

**Interfaces:**

- Consumes: `planInstallStep`, `InstallStepPlan` (Task 1).
- Produces:

  ```ts
  // workflow.ts
  export const PNPM_SETUP_SHA: string; // 40 hex, same as .github/workflows/setup-node/action.yml
  export const PNPM_SETUP_VERSION: string; // 'v3.1.2' form
  export function buildWorkflowYaml(opts: {
    actionSha: string;
    actionVersion: string;
    installStep: InstallStepPlan;
  }): string;
  ```

  The step goes between `actions/checkout` and the action call. Exact output per kind, at the steps' indentation:

  npm:

  ```yaml
  - run: npm ci --ignore-scripts
  ```

  pnpm:

  ```yaml
  - uses: pnpm/setup@<PNPM_SETUP_SHA> # <PNPM_SETUP_VERSION>
    with:
      install: false
  - run: pnpm install --frozen-lockfile --ignore-scripts
  ```

  manual (`<command>` from the plan):

  ```yaml
  # The action analyzes with the svelte-vitals installed in this project. Set up your package
  # manager and install dependencies here; without an install it uses its bundled analyzer
  # and says so in a warning.
  # - run: <command>
  ```

  `ci install`, after a workflow was written (`created` or `updated`, not `exists` and not `--dry-run`):
  - for a manual plan, logs: `! Add an install step to <WORKFLOW_PATH> before the svelte-vitals step: <reason>.`
  - when `package.json` in `io.cwd` does not declare `svelte-vitals` (neither `dependencies` nor `devDependencies`), logs: `! svelte-vitals is not in package.json. Add it so CI analyzes with the version you choose: <pm> <install|add> -D svelte-vitals` where `<pm>` is the lockfile's package manager (npm when none) and the verb is `install` for npm and `add` otherwise.

  Both lines also appear on `--dry-run`, after the plan, since that is the preview of what the run will say.

- [ ] **Step 1: Write the failing tests.**

  `workflow.test.ts` — every existing `buildWorkflowYaml` call gains `installStep: { kind: 'npm' }`; add:

  ```ts
  it('installs with npm ci and no lifecycle scripts', ...)
  // installStep { kind: 'npm' } → contains '      - run: npm ci --ignore-scripts'
  it('sets up pnpm at the pinned SHA without installing, then installs without lifecycle scripts', ...)
  // { kind: 'pnpm' } → contains `      - uses: pnpm/setup@${PNPM_SETUP_SHA} # ${PNPM_SETUP_VERSION}`,
  //   '          install: false', '      - run: pnpm install --frozen-lockfile --ignore-scripts'
  it('leaves a commented install step when it cannot write a working one', ...)
  // { kind: 'manual', command: 'bun install --frozen-lockfile --ignore-scripts', reason: 'x' }
  //   → contains '      # - run: bun install --frozen-lockfile --ignore-scripts' and no line starting '      - run:'
  it.each(['npm', 'pnpm', 'manual'])('puts the %s install step after checkout and before the action', ...)
  // index of 'actions/checkout@' < index of the install text < index of 'oekazuma/svelte-vitals-action@'
  it('never marks the install step continue-on-error', ...) // all three variants
  ```

  The existing case "does not scaffold a setup-node step" stays as it is.

  `lockstep.test.ts` — add a case asserting `PNPM_SETUP_SHA`/`PNPM_SETUP_VERSION` against the `uses: pnpm/setup@<sha> # <version>` line in `.github/workflows/setup-node/action.yml`.

  `cli.test.ts` (`ci install`) — with the test's in-memory files:

  ```ts
  it('writes an npm install step for a project with package-lock.json', ...)
  it('writes the pnpm steps for a project that declares pnpm 12', ...)
  it('tells the user to add an install step when it could only leave a commented one', ...)
  // bun.lock → written file has the commented block; stdout has the '! Add an install step' line with the Bun reason
  it('tells the user to add svelte-vitals when package.json does not declare it', ...)
  // package.json without it + pnpm-lock.yaml → stdout contains 'pnpm add -D svelte-vitals'; npm lockfile → 'npm install -D svelte-vitals'
  it('says nothing extra when the step is live and svelte-vitals is declared', ...) // no line starting '!'
  it('shows the same notes on --dry-run and writes nothing', ...)
  it('says nothing extra when the workflow already exists', ...)
  ```

  `install/run.test.ts` — one case: the `ci-workflow` target on a project with `package-lock.json` plans content containing `npm ci --ignore-scripts`.

- [ ] **Step 2: Run them and watch them fail**

  Run: `pnpm --filter svelte-vitals exec vitest run test/ci test/install/run.test.ts`
  Expected: the new cases FAIL (and a type error on the new `installStep` option until Step 3).

- [ ] **Step 3: Implement.** `buildWorkflowYaml` renders the three shapes. `ci.ts` and `planForCiTarget` call `planInstallStep(io)` and pass the result; only `ci.ts` prints the notes (the wizard's plan rows have no place for them, and the commented block in the file carries the instruction there). Update `workflow.ts`'s doc comment where it says the workflow has no install step or describes the template's shape.

- [ ] **Step 4: Run the package's tests**

  Run: `pnpm --filter svelte-vitals exec vitest run`
  Expected: PASS, every file.

- [ ] **Step 5: Lint and typecheck**

  Run: `pnpm lint && pnpm typecheck`
  Expected: both exit 0.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/cli/src packages/cli/test
  git commit -m "feat(cli): scaffold an install step so the action runs the project's svelte-vitals"
  ```

### Task 3: Pin, docs and changeset

**Files:**

- Modify: `packages/cli/src/ci/action-pin.generated.ts` (generated)
- Modify: `docs/src/content/docs/guides/(reporting)/ci.md`, `docs/src/content/docs/ja/guides/(reporting)/ci.md`
- Modify: `packages/cli/docs/ci.md`, `packages/cli/src/docs/generated.ts` (generated)
- Modify: any other page under `docs/src/content/docs/` (and its `ja/` pair) that the new behaviour makes untrue
- Modify: `docs/blume.translations.json` (through the stamp command)
- Delete: `.changeset/action-pin-0-14-0.md`; Create: `.changeset/ci-install-step.md`

- [ ] **Step 1: Move the pin.**

  Run: `pnpm --filter svelte-vitals run update-action-pin && pnpm format`
  Expected: `action-pin.generated.ts` holds `ACTION_VERSION = '0.15.0'` and the SHA of the `v0.15.0` tag (`gh api repos/oekazuma/svelte-vitals-action/git/ref/tags/v0.15.0 --jq .object.sha` prints the same SHA).

- [ ] **Step 2: Rewrite the CI guide (English).** In `guides/(reporting)/ci.md`:
  - "What the workflow does": include the install step and why it is there.
  - A section on which `svelte-vitals` runs: the action uses the one installed in the project, found from `path` upward, minimum 0.44.0; the scan runs twice; an installed CLI that fails (cannot start, exits with an error such as an invalid config, prints no report) fails the step, with no fallback; without a usable install the bundled analyzer runs after the `svelte-vitals: using the bundled svelte-vitals <version>.` message, with a table of the three situations, their level, and how to clear each.
  - What `ci install` generates per package manager (the decision table from Task 1, as prose or a table for a reader), that it leaves a commented step and says so where it cannot write a working one, and that it prints the command to add `svelte-vitals` when `package.json` lacks it.
  - An install that fails at run time fails the job: a lockfile out of step, a registry that cannot be reached. For a private registry, the credentials go on the install step (an `env:` entry, filled from a repository secret, that the project's `.npmrc` reads), because lifecycle scripts are off and nothing else in the job installs.
  - "Action inputs": replace the sentence saying the action "runs the same analysis as the CLI" with what holds.
  - "Writing it by hand": the YAML with the install step (show the npm form, and the pnpm form), still saying `ci install` fills in the pin.
  - For a workflow written before the install step existed: add the step by hand, or re-run `ci install --force`. Say it as a how-to for a workflow without an install step, not as history.
  - Leave "Upgrading the pinned action" as it is unless a sentence there is made untrue.

- [ ] **Step 3: Check the other pages.** `grep -rn "svelte-vitals-action\|@svelte-vitals/action\|ci install" docs/src/content/docs --include="*.md" --include="*.mdx" -l` (English tree), read each hit, and correct any statement the new behaviour makes untrue. Record in the report which pages were read and which needed no change.

- [ ] **Step 4: Mirror every English change in the Japanese pages**, then stamp each changed English page:

  Run: `pnpm --filter docs run translate:stamp <each changed en file, as src/content/docs/...>` then `(cd docs && ./node_modules/.bin/blume translate --check)`
  Expected: the check exits 0.

- [ ] **Step 5: Update the terminal topic.** Edit `packages/cli/docs/ci.md` (terse: what the generated workflow installs and why, the bundled-analyzer message and how to clear it), then:

  Run: `pnpm --filter svelte-vitals run gen:docs && pnpm format`
  Expected: `packages/cli/src/docs/generated.ts` changes with it.

- [ ] **Step 6: Changeset.** Delete `.changeset/action-pin-0-14-0.md` (unreleased, and superseded: the pin goes from the released v0.13.1 to v0.15.0 in one release). Create `.changeset/ci-install-step.md`, `'svelte-vitals': minor`, saying for a user of `ci install`:
  - `ci install` and `install --client ci-workflow` write an install step before the action step: `npm ci --ignore-scripts` for npm, `pnpm/setup` plus `pnpm install --frozen-lockfile --ignore-scripts` for pnpm 11 and newer, and a commented step with a printed note for other setups; `ci install` also prints the command to add `svelte-vitals` when `package.json` does not declare it.
  - The pin moves to `oekazuma/svelte-vitals-action` v0.15.0, which runs the `svelte-vitals` installed in the project (0.44.0 or newer) instead of its bundled analyzer, so CI analyzes with the version in the lockfile. Without an install it uses the bundled analyzer (0.55.5) and says so.
  - What to do: `svelte-vitals ci upgrade` moves the pin in an existing workflow; add the install step by hand or regenerate with `ci install --force`. Until a workflow has an install step it behaves as before, plus the message.

- [ ] **Step 7: Verify everything**

  Run: `pnpm lint && pnpm typecheck && pnpm test`
  Expected: every command exits 0.

- [ ] **Step 8: Commit**

  ```bash
  git add packages/cli docs .changeset
  git commit -m "feat(cli): pin svelte-vitals-action v0.15.0 and document the installed-CLI path"
  ```
