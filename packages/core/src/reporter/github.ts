import type { Config, Result } from '../types.js';
import { isPenalized } from '../rule.js';
import { effectiveSeverity } from '../summary.js';
import { messageText, ruleMetaById, severityToGithubLevel } from './shared.js';

/** Escape workflow-command message data (the text after `::`). */
function escapeData(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** Escape a workflow-command property value: message-data escapes plus `:` and `,`. */
function escapeProp(s: string): string {
  return escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

/**
 * Render penalized findings as GitHub Actions workflow commands (issue #18, design slice 5).
 * GitHub turns these into inline PR annotations and job-summary entries. Returns '' when clean.
 */
export function formatGithubReport(results: Result[], config: Config): string {
  const penalized = results.filter((r) => isPenalized(r.detection, config.treatDynamicAs));
  const lines = penalized.map((r) => {
    const level = severityToGithubLevel(effectiveSeverity(r, config));
    const meta = ruleMetaById(r.id);
    const title = meta ? `${r.id}: ${meta.title}` : r.id;
    const props: string[] = [];
    if (r.location) props.push(`file=${escapeProp(r.location)}`);
    props.push(`title=${escapeProp(title)}`);
    return `::${level} ${props.join(',')}::${escapeData(messageText(r))}`;
  });
  return lines.join('\n');
}
