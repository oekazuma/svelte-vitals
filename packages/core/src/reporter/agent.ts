import type { Config, Result } from '../types.js';
import { classify, effectiveSeverity } from '../summary.js';

/** Render failing findings as an agent-actionable Markdown remediation document (issue #18). */
export function formatAgentReport(results: Result[], config: Config): string {
  const failing = results.filter((r) => classify(r, config) === 'fail');
  const lines: string[] = ['# svelte-vitals — SEO fixes', ''];

  if (failing.length === 0) {
    lines.push('No issues to fix.', '');
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  lines.push(
    `${failing.length} issue(s) to fix. Apply each fix below, then re-run \`svelte-vitals\` (or the build) to confirm each rule passes.`,
    ''
  );

  const groups = new Map<string, Result[]>();
  for (const r of failing) {
    const key = r.location ?? r.route ?? '(project)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  for (const [loc, rs] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${loc}`, '');
    for (const r of rs) {
      lines.push(`### ${r.id} · ${r.message} (${effectiveSeverity(r, config)})`);
      if (r.fix) {
        lines.push(`- Fix: ${r.fix.description}`);
        if (r.fix.snippet) lines.push('', '```' + (r.fix.lang ?? 'svelte'), r.fix.snippet, '```');
      } else if (r.recommendation) {
        lines.push(`- Fix: ${r.recommendation}`);
      }
      if (r.docsUrl) lines.push(`- Docs: ${r.docsUrl}`);
      lines.push(`- Accept: re-run svelte-vitals; ${r.id} passes${r.route ? ` for ${r.route}` : ''}.`, '');
    }
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}
