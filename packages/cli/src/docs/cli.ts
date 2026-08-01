import mri from 'mri';
import { EMBEDDED_DOCS } from './generated.js';

const DOCS_HELP = `svelte-vitals docs — read the bundled guides without leaving the terminal

Usage:
  svelte-vitals docs list [--json]     List every topic with a one-line description
  svelte-vitals docs show <name>       Print a topic

Options:
  --json        Machine-readable output (list only)
  -h, --help    Show this help

The topics ship inside the CLI, so they always match the version you are running and need no
network. The full docs site is at https://oekazuma.github.io/svelte-vitals.`;

/** The output sink. Narrower than the install wizard's `InstallIO` — docs never touches the filesystem. */
export interface DocsIO {
  log(line: string): void;
  errorLog(line: string): void;
}

const realIO: DocsIO = {
  log: (line) => console.log(line),
  errorLog: (line) => console.error(line)
};

/** `name — description`, column-aligned so a reader can scan the descriptions. */
function renderList(): string {
  const width = Math.max(...EMBEDDED_DOCS.map((d) => d.name.length));
  const lines = EMBEDDED_DOCS.map((d) => `  ${d.name.padEnd(width)}  ${d.description}`);
  return [
    'Topics (read one with `svelte-vitals docs show <name>`):',
    '',
    ...lines,
    '',
    'Rule-level detail is a separate command: `svelte-vitals explain --list`.'
  ].join('\n');
}

function unknownTopic(name: string, io: DocsIO): number {
  io.errorLog(`svelte-vitals: unknown docs topic '${name}'.`);
  io.errorLog(`svelte-vitals: known topics: ${EMBEDDED_DOCS.map((d) => d.name).join(', ')}.`);
  return 2;
}

/**
 * Run `svelte-vitals docs …`. Returns the exit code: 0 on a hit, 2 for a missing or unknown
 * subcommand/topic (the CLI's "execution error" code — nothing was printed).
 */
export function runDocsCli(args: string[], io: DocsIO = realIO): number {
  const argv = mri(args, { boolean: ['json', 'help'], alias: { h: 'help' } });
  const sub = argv._[0] === undefined ? undefined : String(argv._[0]);

  if (argv.help || sub === undefined) {
    // A bare `docs` is a reasonable thing to type when you don't know the subcommands yet, so
    // treat it as a help request rather than an error — but still exit 2, since nothing was read.
    io.log(DOCS_HELP);
    return argv.help ? 0 : 2;
  }

  if (sub === 'list') {
    io.log(
      argv.json
        ? JSON.stringify(
            EMBEDDED_DOCS.map((d) => ({ name: d.name, title: d.title, description: d.description })),
            null,
            2
          )
        : renderList()
    );
    return 0;
  }

  if (sub === 'show') {
    const name = argv._[1] === undefined ? undefined : String(argv._[1]);
    if (name === undefined) {
      io.errorLog('svelte-vitals: docs show needs a topic name, e.g. `svelte-vitals docs show config`.');
      io.errorLog(`svelte-vitals: known topics: ${EMBEDDED_DOCS.map((d) => d.name).join(', ')}.`);
      return 2;
    }
    const doc = EMBEDDED_DOCS.find((d) => d.name === name);
    if (!doc) return unknownTopic(name, io);
    io.log(doc.body);
    return 0;
  }

  io.errorLog(`svelte-vitals: unknown docs subcommand '${sub}'; expected list|show.`);
  io.log(DOCS_HELP);
  return 2;
}
