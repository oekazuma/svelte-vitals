import type { Category, Config, Result, Severity } from '../types.js';
import { docsUrlFor } from '../rule.js';
import { buildJsonReport, type JsonReport } from './json.js';

/** Cap on rendered finding rows — keeps PR comments/job summaries within GitHub's size limits. */
const MAX_FINDINGS = 50;

const SEVERITY_EMOJI: Record<Severity, string> = { critical: '🔴', warning: '🟡', info: '🔵' };
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Escape a value for use inside a Markdown table cell: pipes break columns, newlines break rows. */
function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, ' ');
}

interface FlatFinding {
  severity: Severity;
  id: string;
  location: string;
  message: string;
}

function locationOf(issue: { location?: string; line?: number }, route: string | undefined): string {
  if (issue.location) return issue.line !== undefined ? `${issue.location}:${issue.line}` : issue.location;
  return route ?? '-';
}

/**
 * `title` alone is often a terse label ("Missing robots.txt") — append `recommendation` (the
 * actionable fix, when present) so a reader doesn't have to open the full report to learn what
 * to do. Mirrors `messageText` (reporter/shared.ts), which does the same for `Result.message`.
 */
function messageWithRecommendation(issue: { title: string; recommendation?: string }): string {
  return issue.recommendation ? `${issue.title} ${issue.recommendation}` : issue.title;
}

function flattenFindings(report: JsonReport): FlatFinding[] {
  const findings: FlatFinding[] = [];
  for (const r of report.routes) {
    for (const issue of r.issues) {
      findings.push({
        severity: issue.severity,
        id: issue.id,
        location: locationOf(issue, r.route),
        message: messageWithRecommendation(issue)
      });
    }
  }
  for (const issue of report.siteIssues) {
    findings.push({
      severity: issue.severity,
      id: issue.id,
      location: locationOf(issue, undefined),
      message: messageWithRecommendation(issue)
    });
  }
  // Most severe first (stable within a severity) so truncation at MAX_FINDINGS keeps the
  // worst findings visible in a capped PR comment.
  return findings
    .map((f, index) => ({ f, index }))
    .sort((a, b) => SEVERITY_RANK[a.f.severity] - SEVERITY_RANK[b.f.severity] || a.index - b.index)
    .map(({ f }) => f);
}

function categoryRows(categories: Partial<Record<Category, { score: number }>>): string[] {
  const names = Object.keys(categories).sort() as Category[];
  return names.map((cat) => `| ${cat} | ${categories[cat]!.score} |`);
}

/**
 * Render a compact Markdown summary — Health score, per-category table, severity counts, and
 * a findings table — suitable for a GitHub Actions job summary or a sticky PR comment
 * (`svelte-vitals ci install`). Delegates all aggregation to `buildJsonReport` so the numbers
 * never drift from the JSON/console reporters.
 */
export function formatMarkdownReport(results: Result[], config: Config, meta: { version: string }): string {
  const report = buildJsonReport(results, config, meta);
  const lines: string[] = [];

  lines.push(`<!-- svelte-vitals v${meta.version} -->`);
  lines.push(`## svelte-vitals — Health ${report.score}/100`);
  lines.push('');

  const catRows = categoryRows(report.categories);
  if (catRows.length > 0) {
    lines.push('| Category | Score |');
    lines.push('| --- | --- |');
    lines.push(...catRows);
    lines.push('');
  }

  const { critical, warning, info, passed } = report.summary;
  lines.push(`**${critical} critical · ${warning} warning · ${info} info** (${passed} checks passed)`);
  lines.push('');

  const findings = flattenFindings(report);
  if (findings.length === 0) {
    lines.push('✅ No issues found.');
  } else {
    lines.push('### Findings');
    lines.push('');
    lines.push('| Severity | Rule | Location | Message |');
    lines.push('| --- | --- | --- | --- |');
    const shown = findings.slice(0, MAX_FINDINGS);
    for (const f of shown) {
      const rule = `[${f.id}](${docsUrlFor(f.id)})`;
      lines.push(
        `| ${SEVERITY_EMOJI[f.severity]} ${f.severity} | ${rule} | ${escapeCell(f.location)} | ${escapeCell(f.message)} |`
      );
    }
    if (findings.length > MAX_FINDINGS) {
      lines.push('');
      lines.push(`…and ${findings.length - MAX_FINDINGS} more (run \`npx svelte-vitals\` locally for the full report)`);
    }
    // A blocked adopter reading this comment in CI is exactly who needs the exclusion
    // mechanisms (config overrides / suppressions file) — point there, once, at the end.
    lines.push('');
    lines.push(
      '_Expected findings (e.g. routes behind auth)? See [Excluding routes or rules](https://oekazuma.github.io/svelte-vitals/guides/ci/#excluding-routes-or-rules)._'
    );
  }

  return lines.join('\n');
}
