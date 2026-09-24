// Renders the generated block of scripts/corpus/README.md (the internal rule-reliability report) from
// the committed corpus measurement. Pure apart from hashing: gen-rule-reliability.js and
// scripts/corpus-measure.js do the I/O. Design: docs/superpowers/specs/2026-09-23-corpus-precision-design.md
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { normalizeBlock } from './rules-index.js';

export { normalizeBlock };

export const START_MARKER = '<!-- rule-reliability:start -->';
export const END_MARKER = '<!-- rule-reliability:end -->';

export const VERDICTS = ['tp', 'fp', 'design', 'unclear'];

const HEADER = ['Rule', 'Corpus findings', 'Apps', 'Reviewed (tp / fp / design / unclear)', 'Precision'];

/** The report file, relative to the repo root. */
export function reportPath(repoRoot) {
  return join(repoRoot, 'scripts', 'corpus', 'README.md');
}

/** Of the parsed value, so reformatting a committed JSON file never reads as an edit. */
export function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

export function appId({ repo, path }) {
  return path === '.' ? repo : `${repo}:${path}`;
}

function repoUrl({ repo, path, sha }) {
  return `https://github.com/${repo}/tree/${sha}${path === '.' ? '' : `/${path}`}`;
}

/** Carries its sample size: "100%" over one verdict must not read like "100%" over hundreds. */
function precision({ tp, fp }) {
  return tp + fp === 0 ? '—' : `${Math.round((100 * tp) / (tp + fp))}% (${tp}/${tp + fp})`;
}

/**
 * Throws when a rule has no row in the measurement: a rule added without `pnpm corpus update`
 * must fail the drift test rather than render as an empty row nobody measured.
 */
export function renderBlock(rules, measurement, targets) {
  const lines = [`Measured on ${targets.length} apps, each pinned to a commit:`, ''];
  for (const target of targets)
    lines.push(`- [${appId(target).replace(':', '/')}](${repoUrl(target)}) (\`${target.sha.slice(0, 7)}\`)`);

  let total = 0;
  let reviewed = 0;
  const rows = [];
  for (const rule of [...rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const m = measurement.rules[rule.id];
    if (!m) throw new Error(`${rule.id} is missing from scripts/corpus/measurement.json`);
    const labeled = VERDICTS.reduce((sum, v) => sum + m[v], 0);
    total += m.findings;
    reviewed += labeled;
    const verdicts =
      m.findings === 0 ? '—' : labeled === 0 ? 'not yet reviewed' : VERDICTS.map((v) => m[v]).join(' / ');
    rows.push(
      `| [\`${rule.id}\`](../../docs/src/content/docs/rules/${rule.id}.md) | ${m.findings} | ${m.apps} | ${verdicts} | ${precision(m)} |`
    );
  }
  lines.push('', `${reviewed} of ${total} corpus findings have a verdict.`, '');
  lines.push(`| ${HEADER.join(' | ')} |`, `| ${HEADER.map(() => '---').join(' | ')} |`, ...rows);
  return lines.join('\n');
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
