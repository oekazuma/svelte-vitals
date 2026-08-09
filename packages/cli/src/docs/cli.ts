import { docsUrlFor } from '@svelte-vitals/core';
import { parseCliArgs } from '../cli-args.js';
import { consoleIO, type CliIO } from '../cli-io.js';
import { knownRuleIds } from '../rules-config.js';
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

/** Mirrors `knownRuleIds()`. */
function knownTopicNames(): string {
  return EMBEDDED_DOCS.map((d) => d.name).join(', ');
}

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

/** Returns 0 on a hit, 2 otherwise. Every exit-2 path leaves stdout empty, for callers piping it. */
export function runDocsCli(args: string[], io: CliIO = consoleIO): number {
  const argv = parseCliArgs(args, { boolean: ['json', 'help'], short: { h: 'help' } });
  const [sub, ...rest] = argv._;

  if (argv.help) {
    io.log(DOCS_HELP);
    return 0;
  }
  if (sub === undefined) {
    io.errorLog(DOCS_HELP);
    return 2;
  }

  if (sub === 'list') {
    if (rest.length > 0) {
      // Accepting it would read as "list, filtered to config".
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
    // `docs show a b` printing only `a` would misrepresent itself as "here are both".
    if (rest.length !== 1) {
      io.errorLog(
        rest.length === 0
          ? 'svelte-vitals: docs show needs a topic name, e.g. `svelte-vitals docs show config`.'
          : 'svelte-vitals: docs show takes one topic at a time.'
      );
      io.errorLog(`svelte-vitals: known topics: ${knownTopicNames()}.`);
      return 2;
    }
    const name = rest[0]!; // rest.length === 1, checked above
    const doc = EMBEDDED_DOCS.find((d) => d.name === name);
    if (!doc) {
      // The agent reporter and web docs print rule ids as `<category>/<slug>` (and the web
      // path as `rules/<category>/<slug>`); redirect those to `explain` instead of the
      // generic "unknown topic" list, which does not include rule ids at all.
      const ruleId = name.startsWith('rules/') ? name.slice('rules/'.length) : name;
      if (knownRuleIds().includes(ruleId)) {
        io.errorLog(`svelte-vitals: '${ruleId}' is a rule, not a docs topic.`);
        io.errorLog(`svelte-vitals: rule detail: \`svelte-vitals explain ${ruleId}\`; web: ${docsUrlFor(ruleId)}`);
        return 2;
      }
      io.errorLog(`svelte-vitals: unknown docs topic '${name}'.`);
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
