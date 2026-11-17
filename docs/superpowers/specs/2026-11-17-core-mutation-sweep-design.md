# Mutation-test sweep of the core package

## Intent

A rule's unit tests can pass without pinning what the rule reports. A one-off mutation-testing sweep over `packages/core` shows where the tests do not notice a behaviour change, and the sweep adds tests for the gaps a user would see. Its measured numbers decide whether a standing mutation job is worth its upkeep.

## Goals

- Run mutation testing over `packages/core/src/**` and add tests for the surviving mutants that change user-visible output.
- Record mutants, survivors per class, runtime, and the kill rate on the touched files before and after, so the standing-job decision rests on data.

## Non-goals

- No mutation tool, config, script, or CI job is committed.
- No rule source changes. Dead branches and suspected rule bugs are listed and reported separately: they change detection semantics, which needs corpus measurement and review.
- No score target.

## Anti-goal

Tests that exist only to kill a mutant whose change no user sees.

## Constraints

- Tool: a Vitest 5 mutation runner, at its latest release. That release is younger than the 3-day `minimumReleaseAge` in `pnpm-workspace.yaml`, so the throwaway worktree exempts the tool's own packages from the check. The committed setting is unchanged.
- The tool is installed only in that throwaway worktree off `origin/main`, and nothing is committed from it. The PR comes from a separate clean worktree.
- Scope: `packages/core/src/**`, except the generated `html-spec/generated.ts` and `rules/seo/schema-vocabulary.generated.ts`. It runs in three passes: the rules, then the fact extraction under `src/*.ts`, then `reporter/` and `scoring/`. The cli tests import core from its built `dist`, so a mutant in core source is judged by core's own suite only.

## Approaches

- **One-off sweep (chosen):** measure, triage, and add tests, leaving no tooling behind. This is the cheapest way to learn what the tests miss.
- **Standing job:** a catalog devDependency, a script, and a weekly scheduled workflow like the ecosystem smoke. Deferred until the sweep shows it pays for itself.

## Process

1. Pilot on one rule directory. Measure mutants per file, seconds per mutant, the extrapolated full-scope runtime, and which operators fire. Report these before the full run.
2. Run the full scope.
3. Sort each survivor into exactly one class:
   - **Equivalent:** no observable change. Skipped.
   - **Covered elsewhere:** a kitchen-sink e2e or cli test asserts the behaviour, but no core unit test does. Counted separately. Adding unit tests for this class is the owner's call.
   - **Gap:** the mutant changes whether a finding is reported, or its severity, location, or the values interpolated into its message. A test is added.
   - **Dead code or bug candidate:** listed only.
4. Each new test fails with its mutant applied and passes without it.
5. Re-run on the touched files and report only those numbers.

Builder's call: message wording is not user-visible output for this sweep. Asserting exact prose would make tests brittle without guarding detection.

## Deliverable

A tests-only PR with this document and no changeset. Test names state behaviour and do not mention mutants or the tool.
