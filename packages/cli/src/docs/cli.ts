import mri from 'mri';
import { consoleIO, type CliIO } from '../cli-io.js';
import { EMBEDDED_DOCS } from './generated.js';

const DOCS_HELP = `svelte-vitals docs — read the bundled guides without leaving the terminal

Usage:
  svelte-vitals docs list [--json]     List every topic with a one-line description
  svelte-vitals docs show <name>       Print a topic

Options:
  --json        Machine-readable output (list only)
  -h, --help    Show this help

The topics ship inside the CLI, so they always match the version you are running and need no
network. The full docs site is at https://oekazuma.github.io/svelte-vitals.

\`docs\` is a subcommand, so it wins over a directory of the same name: to analyze a directory
called \`docs\`, write \`svelte-vitals ./docs\`.`;

/** Every topic name, for the "here are the valid ones" half of an error. Mirrors `knownRuleIds()`. */
function knownTopicNames(): string {
  return EMBEDDED_DOCS.map((d) => d.name).join(', ');
}

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

/**
 * Run `svelte-vitals docs …`. Returns the exit code: 0 on a hit, 2 for a missing or unknown
 * subcommand/topic.
 *
 * Every exit-2 path leaves stdout empty: exit 2 means the analysis did not happen, and a caller
 * piping stdout (the reason `--json` exists) must not find prose there.
 */
export function runDocsCli(args: string[], io: CliIO = consoleIO): number {
  const argv = mri(args, { boolean: ['json', 'help'], alias: { h: 'help' } });
  const [sub, ...rest] = argv._;

  if (argv.help) {
    io.log(DOCS_HELP);
    return 0;
  }
  if (sub === undefined) {
    // A bare `docs` is a reasonable thing to type before you know the subcommands, so answer
    // with the help — on stderr, because nothing was read and this is still an exit-2 path.
    io.errorLog(DOCS_HELP);
    return 2;
  }

  if (sub === 'list') {
    if (rest.length > 0) {
      // Silently dropping the extra would let `docs list config` read as "list, filtered to
      // config" and come back exit 0 with something else entirely.
      io.errorLog('svelte-vitals: docs list takes no arguments; use `docs show <name>` to read one.');
      return 2;
    }
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
    // One arity check for both shapes: `docs show` with nothing to read, and `docs show a b`,
    // which printing only `a` at exit 0 would misrepresent as "here are both topics".
    if (rest.length !== 1) {
      io.errorLog(
        rest.length === 0
          ? 'svelte-vitals: docs show needs a topic name, e.g. `svelte-vitals docs show config`.'
          : 'svelte-vitals: docs show takes one topic at a time.'
      );
      io.errorLog(`svelte-vitals: known topics: ${knownTopicNames()}.`);
      return 2;
    }
    const doc = EMBEDDED_DOCS.find((d) => d.name === rest[0]);
    if (!doc) {
      io.errorLog(`svelte-vitals: unknown docs topic '${rest[0]}'.`);
      io.errorLog(`svelte-vitals: known topics: ${knownTopicNames()}.`);
      return 2;
    }
    io.log(doc.body);
    return 0;
  }

  io.errorLog(`svelte-vitals: unknown docs subcommand '${sub}'; expected list|show.`);
  io.errorLog(DOCS_HELP);
  return 2;
}
