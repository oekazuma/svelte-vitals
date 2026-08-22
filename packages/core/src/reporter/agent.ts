import type { Config, Result } from '../types.js';
import { classify, effectiveSeverity } from '../summary.js';
import { computeHealth } from '../scoring/score.js';
import { mdEscape } from './sanitize.js';
import { SEVERITY_RANK } from './shared.js';

/** Render failing findings as an agent-actionable Markdown remediation document (issue #18). */
export function formatAgentReport(results: Result[], config: Config): string {
  const failing = results.filter((r) => classify(r, config) === 'fail');
  const { health } = computeHealth(results, config);
  const lines: string[] = ['# svelte-vitals — fixes', '', `Health: ${health}/100`, ''];

  if (failing.length === 0) {
    lines.push('No issues to fix.', '');
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  lines.push(
    `${failing.length} issue(s) to fix, ordered most-severe first. Fix critical issues first; warning and info items improve SEO but do not fail the default build. Apply each fix below, then re-run \`svelte-vitals\` (or the build) to confirm each rule passes. Run \`svelte-vitals explain <rule-id>\` for any rule's rationale and options (works offline).`,
    ''
  );

  const groups = new Map<string, Result[]>();
  for (const r of failing) {
    const key = r.location ?? r.route ?? '(project)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  // Order groups by their most severe finding (critical-bearing files first),
  // then alphabetically; within each group, order findings by severity.
  const groupSeverity = (rs: Result[]) => Math.min(...rs.map((r) => SEVERITY_RANK[effectiveSeverity(r, config)]));
  const orderedGroups = [...groups.entries()].sort(
    (a, b) => groupSeverity(a[1]) - groupSeverity(b[1]) || a[0].localeCompare(b[0])
  );

  for (const [loc, rs] of orderedGroups) {
    rs.sort(
      (x, y) =>
        SEVERITY_RANK[effectiveSeverity(x, config)] - SEVERITY_RANK[effectiveSeverity(y, config)] ||
        x.id.localeCompare(y.id)
    );
    // Escaped here at the push site, not on the Map key above — grouping/sorting must
    // stay keyed by the raw location, or two distinct locations that only differ in
    // what mdEscape neutralizes (e.g. embedded newlines) would merge into one group.
    lines.push(`## ${mdEscape(loc)}`, '');
    for (const r of rs) {
      lines.push(`### ${r.id} · ${mdEscape(r.message)} (${effectiveSeverity(r, config)})`);
      if (r.fix) {
        lines.push(`- Fix: ${mdEscape(r.fix.description)}`);
        if (r.fix.snippet) lines.push('', '```' + (r.fix.lang ?? 'svelte'), r.fix.snippet, '```');
      } else if (r.recommendation) {
        lines.push(`- Fix: ${mdEscape(r.recommendation)}`);
      }
      if (r.docsUrl) lines.push(`- Docs: ${r.docsUrl}`);
      // Some rules report a construct that survives its own fix — a sanitized `{@html}` is still
      // an `{@html}` — so "the rule passes" is unreachable by editing, and naming only that exit
      // sends an agent round the same fix twice. Review is the other exit, but an inline directive
      // needs a line to sit above, which is exactly the findings that carry one.
      const byReview =
        r.line == null
          ? ''
          : ` If the code is right as written, a reviewed \`svelte-vitals-disable-next-line ${r.id}\` comment on the line above resolves it instead.`;
      lines.push(
        `- Accept: re-run svelte-vitals; ${r.id} passes${r.route ? ` for ${mdEscape(r.route)}` : ''}.${byReview}`,
        ''
      );
    }
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}
