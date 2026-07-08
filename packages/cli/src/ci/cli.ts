import { join } from 'node:path';
import mri from 'mri';
import type { InstallIO } from '../install/index.js';
import { realIO } from '../install/cli.js';
import { readPackageVersion } from '../version.js';
import { WORKFLOW_PATH, buildWorkflowYaml, planWorkflowWrite } from './workflow.js';

const CI_HELP = `svelte-vitals ci — scaffold CI integration

Usage:
  svelte-vitals ci install [options]

Adds a GitHub Actions workflow (${WORKFLOW_PATH}) that scans pull requests, posts inline
annotations + a job summary, and maintains a sticky PR comment with the findings.

Options:
  --force       Overwrite an existing workflow file
  --dry-run     Print the plan and exit without writing
  -h, --help    Show this help`;

/** Parse `ci` args, print diagnostics, and run the requested subcommand. Returns the exit code. */
export async function runCiCli(args: string[], io: InstallIO = realIO()): Promise<number> {
  const sub = args[0];

  if (sub === '--help' || sub === '-h') {
    io.log(CI_HELP);
    return 0;
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
    const version = readPackageVersion();
    try {
      io.writeFile(path, buildWorkflowYaml({ version }));
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
