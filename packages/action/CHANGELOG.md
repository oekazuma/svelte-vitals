# @svelte-vitals/action

## 0.2.4

### Patch Changes

- Updated dependencies [58ccebc]
  - svelte-vitals@0.24.1

## 0.2.3

### Patch Changes

- Updated dependencies [ca6d1af]
- Updated dependencies [c2ee668]
- Updated dependencies [7da8bb7]
- Updated dependencies [085c622]
- Updated dependencies [08aa27e]
- Updated dependencies [5d9f0d1]
  - svelte-vitals@0.24.0

## 0.2.2

### Patch Changes

- Updated dependencies [7acad5a]
  - @svelte-vitals/core@0.23.0
  - svelte-vitals@0.23.0

## 0.2.1

### Patch Changes

- Updated dependencies [2652572]
- Updated dependencies [2652572]
  - svelte-vitals@0.22.1
  - @svelte-vitals/core@0.22.1

## 0.2.0

### Minor Changes

- d9efc77: First release of `@svelte-vitals/action`, a first-party GitHub Action that runs svelte-vitals in-process during CI: PR annotations, a job summary, and a sticky PR comment, then gates the job on qualifying findings. Inputs: `path` (project directory, default `.`), `diff` (scope findings to files changed vs. a git ref), `baseline` (report only findings not already present at a git ref), and `github-token` (used to read/post/update the sticky PR comment). On pull requests from forks, annotations and the job summary still run, but the sticky comment step is skipped because GitHub Actions downgrades `GITHUB_TOKEN` to read-only in that context.

### Patch Changes

- Updated dependencies [d9efc77]
  - svelte-vitals@0.22.0
