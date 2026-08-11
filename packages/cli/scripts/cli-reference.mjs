// Renders the generated "Flag reference" tables embedded in the docs site's CLI guides.
// Pure: no fs, no dist import — gen-cli-reference.mjs supplies the arg schemas and does the I/O.
import { kebabnize } from 'gunshi/utils';
import { normalizeBlock } from './rules-index.mjs';

export { normalizeBlock };

export const START_MARKER = '<!-- cli-reference:start -->';
export const END_MARKER = '<!-- cli-reference:end -->';

function displayName(key, schema) {
  return schema.toKebab ? kebabnize(key) : key;
}

/** Mirrors what `--help` actually prints for this arg (verified against the built CLI) — the
 * value placeholder is the flag's own display name, e.g. `--out-file <out-file>`, not an invented
 * metavar (`ArgSchema.metavar` is unset on every current flag). */
function flagCell(key, schema) {
  const name = displayName(key, schema);
  const long = schema.type === 'boolean' ? `--${name}` : `--${name} <${name}>`;
  return schema.short ? `\`-${schema.short}, ${long}\`` : `\`${long}\``;
}

/** Table cells can't hold literal newlines (INSTALL_ARGS.client/app/refresh wrap for terminal
 * `--help`) — collapsed to single spaces here; word content still matches `--help` exactly,
 * which is what "byte-for-byte" is checked against (word-for-word, not raw bytes: an unavoidable
 * table-cell constraint, not a paraphrase). `|` is escaped so an enum-style description like
 * "console | json | agent" doesn't get read as extra table columns.
 *
 * `jaText`, when given, replaces `schema.description` outright — a key missing from the ja map
 * (`undefined`) falls through to the English description, the same en-fallback `--help` itself
 * applies (`locale.ts`'s `localizedOptionsSection`). This function never talks to
 * `@gunshi/plugin-i18n` at all (it is a hand-rolled Markdown renderer, not `generate()`), so the
 * plugin's own `help`/`version` quirk (`locale.ts`'s doc comment) does not apply here — every key
 * a caller passes lands as typed. */
function descriptionCell(schema, jaText) {
  return (jaText ?? schema.description ?? '').replace(/\s+/g, ' ').trim().replaceAll('|', '\\|');
}

/** One flag-reference table for a command surface's args. Skips `hidden` entries — same as
 * `--help`'s own OPTIONS section and gunshi/complete.ts's `forCompletion`. `jaDescriptions`
 * (optional, keyed the same way `locales/ja.ts`'s per-surface maps are — the raw ArgSchema object
 * key) renders a ja table instead of the English one; omitted entirely for the English tables. */
export function renderTable(args, jaDescriptions) {
  const rows = Object.entries(args)
    .filter(([, schema]) => !schema.hidden)
    .map(([key, schema]) => `| ${flagCell(key, schema)} | ${descriptionCell(schema, jaDescriptions?.[key])} |`);
  return ['| Flag | Description |', '| --- | --- |', ...rows].join('\n');
}

function markerBounds(fileText) {
  const start = fileText.indexOf(START_MARKER);
  const end = fileText.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) throw new Error(`missing ${START_MARKER} / ${END_MARKER} marker pair`);
  return { start, end };
}

export function replaceBlock(fileText, block) {
  const { start, end } = markerBounds(fileText);
  return `${fileText.slice(0, start)}${START_MARKER}\n\n${block}\n\n${fileText.slice(end)}`;
}

export function extractBlock(fileText) {
  const { start, end } = markerBounds(fileText);
  return fileText.slice(start + START_MARKER.length, end).trim();
}
