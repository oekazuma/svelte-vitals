import { join } from 'node:path';
import mri from 'mri';
import type { InstallIO } from '../install/index.js';
import { realIO } from '../install/cli.js';
import { WORKFLOW_PATH, buildWorkflowYaml, planWorkflowWrite } from './workflow.js';
import { upgradeActionPin } from './upgrade.js';
import { ACTION_SHA, ACTION_VERSION } from './action-pin.generated.js';

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

/** Parse `ci` args, print diagnostics, and run the requested subcommand. Returns the exit code. */
export async function runCiCli(args: string[], io: InstallIO = realIO()): Promise<number> {
  const sub = args[0];

  if (sub === '--help' || sub === '-h') {
    io.log(CI_HELP);
    return 0;
  }
  if (sub === 'upgrade') {
    return runCiUpgrade(args.slice(1), io);
  }
  if (sub !== 'install') {
    io.log(CI_HELP);
    return 2;
  }

  const argv = mri(args.slice(1), {
    boolean: ['force', 'dry-run', 'help'],
    alias: { h: 'help' }
  });
  if (argv.help) {
    io.log(CI_HELP);
    return 0;
  }

  const path = join(io.cwd, WORKFLOW_PATH);
  const existing = io.readFile(path);
  const plan = planWorkflowWrite(existing, Boolean(argv.force));

  io.log('Plan:');
  io.log(`  ${WORKFLOW_PATH}  [${plan.status}]`);

  if (argv['dry-run']) {
    io.log('Dry run — no files written.');
    return 0;
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
      return 2;
    }
  }

  io.log('Done. Commit the workflow file and open a PR to see it in action.');
  return 0;
}

/**
 * `ci upgrade` — rewrite only the pinned `@svelte-vitals/action` reference line(s) in an
 * existing workflow to the pin bundled with this CLI build. Never touches other lines (other
 * `uses:` pins, custom triggers/steps a user added) — see upgrade.ts for the replacement logic.
 */
async function runCiUpgrade(args: string[], io: InstallIO): Promise<number> {
  const argv = mri(args, {
    boolean: ['dry-run', 'help'],
    alias: { h: 'help' }
  });
  if (argv.help) {
    io.log(CI_HELP);
    return 0;
  }

  const path = join(io.cwd, WORKFLOW_PATH);
  const existing = io.readFile(path);
  if (existing === undefined) {
    io.errorLog(`svelte-vitals: no ${WORKFLOW_PATH} found — run \`svelte-vitals ci install\` first.`);
    return 2;
  }

  const outcome = upgradeActionPin(existing, ACTION_SHA, ACTION_VERSION);

  if (outcome.status === 'no-reference') {
    io.errorLog(`svelte-vitals: no @svelte-vitals/action reference found in ${WORKFLOW_PATH}.`);
    return 2;
  }

  if (outcome.status === 'up-to-date') {
    io.log(`= already up to date (@svelte-vitals/action@${ACTION_VERSION}).`);
    return 0;
  }

  if (argv['dry-run']) {
    io.log(`Would upgrade @svelte-vitals/action: ${outcome.from} → ${ACTION_VERSION} (${outcome.replaced} line(s)).`);
    io.log('Dry run — no files written.');
    return 0;
  }

  try {
    io.writeFile(path, outcome.content ?? existing);
  } catch (err) {
    io.errorLog(`svelte-vitals: failed to write ${WORKFLOW_PATH}: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  io.log(`✓ upgraded @svelte-vitals/action: ${outcome.from} → ${ACTION_VERSION} (${outcome.replaced} line(s)).`);
  return 0;
}
