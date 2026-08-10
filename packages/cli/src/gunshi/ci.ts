import { join } from 'node:path';
import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { generate } from 'gunshi/generator';
import type { InstallIO } from '../install/index.js';
import { realIO } from '../install/cli.js';
import { WORKFLOW_PATH, buildWorkflowYaml, planWorkflowWrite } from '../ci/workflow.js';
import { upgradeActionPin } from '../ci/upgrade.js';
import { ACTION_SHA, ACTION_VERSION } from '../ci/action-pin.generated.js';
import { guardArgs, splitAtTerminator, stripUnknownFlags, stripAutoVersionLine } from './guard.js';

/**
 * Frozen error-path text: printed verbatim on `ci`'s non-help exit-2 paths (bare `ci`, an unknown
 * sub-subcommand) — see the changeset for the one declared movement on this text's OWN dispatch:
 * those paths now write it to stderr, not stdout (Phase-0 discovery, design doc invariants).
 * `ci --help`/`ci install --help`/`ci upgrade --help` print a separate, generated OPTIONS block
 * around this same prose instead — see `buildCiHelpText`.
 */
const CI_HELP = `svelte-vitals ci — scaffold CI integration

Usage:
  svelte-vitals ci install [options]
  svelte-vitals ci upgrade [--dry-run]

Adds a GitHub Actions workflow (${WORKFLOW_PATH}) that calls the \`@svelte-vitals/action\`
GitHub Action on pull requests: inline annotations, a job summary, and a sticky PR
comment with the findings.

\`ci upgrade\` rewrites only the pinned \`@svelte-vitals/action\` reference in an existing
workflow to the pin bundled with this CLI, leaving the rest of the file (and any other
pins, like actions/checkout) untouched. To pick up the latest pin, run
\`npx svelte-vitals@latest ci upgrade\`.

Options:
  --force       Overwrite an existing workflow file (install only)
  --dry-run     Print the plan and exit without writing
  -h, --help    Show this help`;

/** Shared by both `ci install` and `ci upgrade` — `ci upgrade` doesn't read `force` itself, but
 * this is also the generator source for the one combined `--help` text every entry point shares
 * (matching CI_HELP's own merged options list), so it declares the full family. Exported for
 * gunshi/complete.ts — the completion tree's ci args mirror these, never a second copy. */
export const CI_ARGS = {
  force: { type: 'boolean', description: 'Overwrite an existing workflow file (install only)' },
  'dry-run': { type: 'boolean', description: 'Print the plan and exit without writing' },
  help: { type: 'boolean', short: 'h', description: 'Show this help' }
} as const;
/** `ci upgrade` only ever reads a subset of CI_ARGS (it has no `--force` to strip) — this is that
 * subset's single source, shared by `runCiUpgrade`'s real dispatch and the completion tree. */
export const CI_UPGRADE_ARGS = { 'dry-run': CI_ARGS['dry-run'], help: CI_ARGS.help } as const;
const KNOWN_LONG_FLAGS = new Set(['force', 'dry-run', 'help']);
const KNOWN_SHORT_FLAGS = new Set(['h']);

/**
 * Hybrid `--help` text shared by `ci --help`, `ci install --help`, and `ci upgrade --help` (the
 * legacy dispatcher printed the identical `CI_HELP` for all three) — same technique as
 * `gunshi/docs.ts`'s `buildDocsHelpText`.
 */
async function buildCiHelpText(ciArgsCommand: Parameters<typeof generate>[1]): Promise<string> {
  const generated = await generate(null, ciArgsCommand, { name: 'svelte-vitals ci', renderHeader: null });
  const optionsIndex = generated.indexOf('OPTIONS:');
  const optionsSection = stripAutoVersionLine(
    optionsIndex === -1 ? generated.trimEnd() : generated.slice(optionsIndex).trimEnd()
  );

  return `svelte-vitals ci — scaffold CI integration

Usage:
  svelte-vitals ci install [options]
  svelte-vitals ci upgrade [--dry-run]

Adds a GitHub Actions workflow (${WORKFLOW_PATH}) that calls the \`@svelte-vitals/action\`
GitHub Action on pull requests: inline annotations, a job summary, and a sticky PR
comment with the findings.

\`ci upgrade\` rewrites only the pinned \`@svelte-vitals/action\` reference in an existing
workflow to the pin bundled with this CLI, leaving the rest of the file (and any other
pins, like actions/checkout) untouched. To pick up the latest pin, run
\`npx svelte-vitals@latest ci upgrade\`.

${optionsSection}`;
}

/** `ci install`'s own gunshi dispatch: guard/strip on `args.slice(1)`, then bone `cli()`. */
async function runCiInstall(
  args: string[],
  io: InstallIO,
  helpSource: Parameters<typeof generate>[1]
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
        io.log(await buildCiHelpText(helpSource));
        exitCode = 0;
        return;
      }

      const path = join(io.cwd, WORKFLOW_PATH);
      const existing = io.readFile(path);
      const plan = planWorkflowWrite(existing, Boolean(ctx.values.force));

      io.log('Plan:');
      io.log(`  ${WORKFLOW_PATH}  [${plan.status}]`);

      if (ctx.values['dry-run']) {
        io.log('Dry run — no files written.');
        exitCode = 0;
        return;
      }

      if (plan.status === 'exists') {
        io.log(`= already installed (${WORKFLOW_PATH}) — use --force to regenerate.`);
      } else {
        try {
          io.writeFile(path, buildWorkflowYaml({ actionSha: ACTION_SHA, actionVersion: ACTION_VERSION }));
          io.log(`✓ ${plan.status} ${WORKFLOW_PATH}`);
        } catch (err) {
          io.errorLog(
            `svelte-vitals: failed to write ${WORKFLOW_PATH}: ${err instanceof Error ? err.message : String(err)}`
          );
          exitCode = 2;
          return;
        }
      }

      io.log('Done. Commit the workflow file and open a PR to see it in action.');
      exitCode = 0;
    }
  });

  await cli(argvForGunshi, installCommand, { name: 'svelte-vitals ci install', usageSilent: true });
  return exitCode;
}

/**
 * `ci upgrade` — rewrite only the pinned `@svelte-vitals/action` reference line(s) in an existing
 * workflow to the pin bundled with this CLI build. Never touches other lines (other `uses:` pins,
 * like `actions/checkout`) — see upgrade.ts for the replacement logic.
 */
async function runCiUpgrade(
  args: string[],
  io: InstallIO,
  helpSource: Parameters<typeof generate>[1]
): Promise<number> {
  const { head } = splitAtTerminator(args);
  // `errors` is only ever populated by a value-carrying flag (guard.ts's own doc comment) — `ci
  // upgrade` has none, so only `.argv` (the `--flag=false` normalization) is used here.
  const argvForGunshi = stripUnknownFlags(
    guardArgs(head, [], ['dry-run', 'help']).argv,
    new Set(['dry-run', 'help']),
    KNOWN_SHORT_FLAGS
  );

  let exitCode = 0;
  const upgradeCommand = define({
    name: 'upgrade',
    args: CI_UPGRADE_ARGS,
    run: async (ctx) => {
      if (ctx.values.help) {
        io.log(await buildCiHelpText(helpSource));
        exitCode = 0;
        return;
      }

      const path = join(io.cwd, WORKFLOW_PATH);
      const existing = io.readFile(path);
      if (existing === undefined) {
        io.errorLog(`svelte-vitals: no ${WORKFLOW_PATH} found — run \`svelte-vitals ci install\` first.`);
        exitCode = 2;
        return;
      }

      const outcome = upgradeActionPin(existing, ACTION_SHA, ACTION_VERSION);

      if (outcome.status === 'no-reference') {
        io.errorLog(`svelte-vitals: no @svelte-vitals/action reference found in ${WORKFLOW_PATH}.`);
        exitCode = 2;
        return;
      }

      if (outcome.status === 'up-to-date') {
        io.log(`= already up to date (@svelte-vitals/action@${ACTION_VERSION}).`);
        exitCode = 0;
        return;
      }

      if (ctx.values['dry-run']) {
        io.log(
          `Would upgrade @svelte-vitals/action: ${outcome.from} → ${ACTION_VERSION} (${outcome.replaced} line(s)).`
        );
        io.log('Dry run — no files written.');
        exitCode = 0;
        return;
      }

      try {
        io.writeFile(path, outcome.content ?? existing);
      } catch (err) {
        io.errorLog(
          `svelte-vitals: failed to write ${WORKFLOW_PATH}: ${err instanceof Error ? err.message : String(err)}`
        );
        exitCode = 2;
        return;
      }

      io.log(`✓ upgraded @svelte-vitals/action: ${outcome.from} → ${ACTION_VERSION} (${outcome.replaced} line(s)).`);
      exitCode = 0;
    }
  });

  await cli(argvForGunshi, upgradeCommand, { name: 'svelte-vitals ci upgrade', usageSilent: true });
  return exitCode;
}

/**
 * gunshi/bone port of `ci/cli.ts`'s dispatch (design doc: Phase 3). Unlike `docs`/`explain`/
 * `install`, the outer `ci`/`ci install`/`ci upgrade` split is NOT run through gunshi/guard at
 * all — it's a literal `args[0]` string compare, exactly like the legacy dispatcher. That's
 * deliberate, not a shortcut: `guardArgs`/`stripUnknownFlags` don't understand positions, only
 * flag shapes, so promoting/stripping before this split would dispatch argv shapes the legacy
 * runner never did (`ci -- install` would actually run install instead of erroring; `ci --bogus
 * install` would drop `--bogus` and run install — writing a workflow file where legacy printed
 * help and exited 2 without touching disk). gunshi only takes over *inside* the matched `install`/
 * `upgrade` arms, where the family's own guard/strip class from `guard.ts` applies exactly as
 * every other ported surface.
 *
 * `io` defaults to `realIO()` (unlike the read-only `docs`/`explain`/root ports, which default to
 * `consoleIO`) because `ci install`/`ci upgrade` need disk access for the workflow file — matching
 * `runCiCli`'s own historical default.
 */
export async function runCiCliGunshi(args: string[], io: InstallIO = realIO()): Promise<number> {
  const sub = args[0];

  // Any command with `force`/`dry-run`/`help` declared works as the generator source for the one
  // shared hybrid help text — built fresh per call (not a module singleton) for the same
  // race-safety reason docs.ts/explain.ts build their commands fresh per call.
  const helpSource = define({ name: 'ci', args: CI_ARGS, run: () => {} });

  if (sub === '--help' || sub === '-h') {
    io.log(await buildCiHelpText(helpSource));
    return 0;
  }
  if (sub === 'upgrade') {
    return runCiUpgrade(args.slice(1), io, helpSource);
  }
  if (sub !== 'install') {
    // Declared movement (design doc invariants / this PR's changeset): stderr, not stdout — the
    // one exit-2 path that used to leave stdout non-empty for callers piping it.
    io.errorLog(CI_HELP);
    return 2;
  }

  return runCiInstall(args.slice(1), io, helpSource);
}
