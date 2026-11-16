import { join } from 'node:path';
import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { generate } from 'gunshi/generator';
import type { InstallIO } from '../install/index.js';
import { realIO } from '../install/cli.js';
import { WORKFLOW_PATH, buildWorkflowYaml, planWorkflowWrite } from '../ci/workflow.js';
import { installStepNote, planInstallStep } from '../ci/install-step.js';
import { workflowNotes } from '../ci/notes.js';
import { guardArgs, splitAtTerminator, stripUnknownFlags, stripAutoVersionLine, suggestClosest } from './guard.js';
import { localizedOptionsSection, type Locale } from './locale.js';

/**
 * Printed verbatim to stderr on `ci`'s non-help exit-2 paths (bare `ci`, an unknown
 * sub-subcommand). `ci --help`/`ci install --help` print a separate, generated OPTIONS block
 * around this same prose instead — see `buildCiHelpText`.
 */
const CI_HELP = `svelte-vitals ci — scaffold CI integration

Usage:
  svelte-vitals ci install [options]

Adds a GitHub Actions workflow (${WORKFLOW_PATH}) that runs the svelte-vitals
installed in the project on pull requests: inline annotations and a job summary for
the findings the pull request introduces, and a failing check when they fail the gate.

Options:
  --force       Overwrite an existing workflow file
  --dry-run     Print the plan and exit without writing
  -h, --help    Show this help`;

/** Exported for gunshi/complete.ts — the completion tree's ci args mirror these, never a second copy. */
export const CI_ARGS = {
  force: { type: 'boolean', description: 'Overwrite an existing workflow file' },
  'dry-run': { type: 'boolean', description: 'Print the plan and exit without writing' },
  help: { type: 'boolean', short: 'h', description: 'Show this help' }
} as const;
const KNOWN_LONG_FLAGS = new Set(['force', 'dry-run', 'help']);
const KNOWN_SHORT_FLAGS = new Set(['h']);

/**
 * Hybrid `--help` text shared by `ci --help` and `ci install --help` — same technique as
 * `gunshi/docs.ts`'s `buildDocsHelpText`. ja-localized when `locale` is 'ja'
 * (`docs/superpowers/specs/2026-08-11-cli-ja-help-design.md`).
 */
async function buildCiHelpText(ciArgsCommand: Parameters<typeof generate>[1], locale: Locale): Promise<string> {
  // `./locales/ja.js` is imported dynamically, only on the `ja` branch — an English
  // invocation of this (already lazily-dispatched) surface never parses the ja strings.
  const ja = locale === 'ja' ? await import('./locales/ja.js') : undefined;
  const optionsSection = stripAutoVersionLine(
    await localizedOptionsSection(ciArgsCommand, 'svelte-vitals ci', locale, ja?.JA_ARG_DESCRIPTIONS.ci ?? {})
  );

  if (locale === 'ja') return ja!.ciHelpJa(optionsSection, WORKFLOW_PATH);

  return `svelte-vitals ci — scaffold CI integration

Usage:
  svelte-vitals ci install [options]

Adds a GitHub Actions workflow (${WORKFLOW_PATH}) that runs the svelte-vitals
installed in the project on pull requests: inline annotations and a job summary for
the findings the pull request introduces, and a failing check when they fail the gate.

${optionsSection}`;
}

/** `ci install`'s own gunshi dispatch: guard/strip on `args.slice(1)`, then bone `cli()`. */
async function runCiInstall(
  args: string[],
  io: InstallIO,
  helpSource: Parameters<typeof generate>[1],
  locale: Locale
): Promise<number> {
  const { head } = splitAtTerminator(args);
  // `errors` is only ever populated by a value-carrying flag (guard.ts's own doc comment) — `ci
  // install` has none, so only `.argv` (the `--flag=false` normalization) is used here.
  const argvForGunshi = stripUnknownFlags(
    guardArgs(head, [], ['force', 'dry-run', 'help']).argv,
    KNOWN_LONG_FLAGS,
    KNOWN_SHORT_FLAGS
  );

  let exitCode = 0;
  const installCommand = define({
    name: 'install',
    args: CI_ARGS,
    run: async (ctx) => {
      if (ctx.values.help) {
        io.log(await buildCiHelpText(helpSource, locale));
        exitCode = 0;
        return;
      }

      const path = join(io.cwd, WORKFLOW_PATH);
      const existing = io.readFile(path);
      const plan = planWorkflowWrite(existing, Boolean(ctx.values.force));

      const installStep = plan.status === 'exists' ? undefined : planInstallStep(io);
      const stepNote = installStep && installStepNote(installStep);
      const notes = [
        ...(stepNote ? [stepNote] : []),
        ...workflowNotes(io, plan.status === 'exists' ? existing : undefined)
      ];

      io.log('Plan:');
      io.log(`  ${WORKFLOW_PATH}  [${plan.status}]`);

      if (ctx.values['dry-run']) {
        for (const note of notes) io.log(note);
        io.log('Dry run — no files written.');
        exitCode = 0;
        return;
      }

      if (!installStep) {
        io.log(`= already installed (${WORKFLOW_PATH}) — use --force to regenerate.`);
      } else {
        try {
          io.writeFile(path, buildWorkflowYaml({ installStep }));
          io.log(`✓ ${plan.status} ${WORKFLOW_PATH}`);
        } catch (err) {
          io.errorLog(
            `svelte-vitals: failed to write ${WORKFLOW_PATH}: ${err instanceof Error ? err.message : String(err)}`
          );
          exitCode = 2;
          return;
        }
      }
      for (const note of notes) io.log(note);

      io.log('Done. Commit the workflow file and open a PR to see it in action.');
      exitCode = 0;
    }
  });

  await cli(argvForGunshi, installCommand, { name: 'svelte-vitals ci install', usageSilent: true });
  return exitCode;
}

/**
 * gunshi/bone port of `ci/cli.ts`'s dispatch (design doc: Phase 3). Unlike `docs`/`explain`/
 * `install`, the outer `ci`/`ci install` split is NOT run through gunshi/guard at
 * all — it's a literal `args[0]` string compare, exactly like the legacy dispatcher. That's
 * deliberate, not a shortcut: `guardArgs`/`stripUnknownFlags` don't understand positions, only
 * flag shapes, so promoting/stripping before this split would dispatch argv shapes the legacy
 * runner never did (`ci -- install` would actually run install instead of erroring; `ci --bogus
 * install` would drop `--bogus` and run install — writing a workflow file where legacy printed
 * help and exited 2 without touching disk). gunshi only takes over *inside* the matched `install`
 * arm, where the family's own guard/strip class from `guard.ts` applies exactly as every other
 * ported surface.
 *
 * `io` defaults to `realIO()` (unlike the read-only `docs`/`explain`/root ports, which default to
 * `consoleIO`) because `ci install` needs disk access for the workflow file — matching
 * `runCiCli`'s own historical default.
 */
export async function runCiCliGunshi(args: string[], io: InstallIO = realIO(), locale: Locale = 'en'): Promise<number> {
  const sub = args[0];

  // Any command with `force`/`dry-run`/`help` declared works as the generator source for the one
  // shared hybrid help text — built fresh per call (not a module singleton) for the same
  // race-safety reason docs.ts/explain.ts build their commands fresh per call.
  const helpSource = define({ name: 'ci', args: CI_ARGS, run: () => {} });

  if (sub === '--help' || sub === '-h') {
    io.log(await buildCiHelpText(helpSource, locale));
    return 0;
  }
  if (sub !== 'install') {
    // A bare `ci` (sub undefined) has no typed token to match against — only a wrong sub-subcommand
    // name gets a suggestion.
    if (sub !== undefined) {
      const hint = suggestClosest(sub, ['install']);
      if (hint) io.errorLog(`svelte-vitals: did you mean \`svelte-vitals ci ${hint}\`?`);
    }
    // Declared movement (design doc invariants / this PR's changeset): stderr, not stdout — the
    // one exit-2 path that used to leave stdout non-empty for callers piping it.
    io.errorLog(CI_HELP);
    return 2;
  }

  return runCiInstall(args.slice(1), io, helpSource, locale);
}
