import { EMBEDDED_DOCS } from './generated.js';

/**
 * Frozen error-path text: `gunshi/docs.ts` prints this verbatim on `docs`'s non-help exit-2 paths
 * (bare `docs`, unknown subcommand) and on `docs --help` builds a separate, generated OPTIONS
 * block around this file's own prose instead — see `buildDocsHelpText` there.
 */
export const DOCS_HELP = `svelte-vitals docs — read the bundled guides without leaving the terminal

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

/** Mirrors `knownRuleIds()`. Exported: shared with the gunshi/bone port. */
export function knownTopicNames(): string {
  return EMBEDDED_DOCS.map((d) => d.name).join(', ');
}

/** Exported: shared with the gunshi/bone port. */
export function renderList(): string {
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
