import type { Config, Result, Severity } from '../types.js';
import { classify, summarize } from '../summary.js';

const RULE = '────────────────────────';
const SEVERITY_TITLE: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warnings',
  info: 'Info'
};

/**
 * Render results as a console report string (design §7). Pure: returns a string,
 * the caller is responsible for printing. Slice 0 lists failures grouped by
 * severity, then passing routes (with a ↯ marker for dynamic values).
 */
export function formatConsoleReport(results: Result[], config: Config): string {
  const summary = summarize(results, config);
  const lines: string[] = [];

  lines.push('Svelte Vitals  ·  SEO (static mode)', '');

  const failures = results.filter((r) => classify(r, config) === 'fail');
  for (const severity of ['critical', 'warning', 'info'] as const) {
    const bucket = failures.filter((r) => r.severity === severity);
    if (bucket.length === 0) continue;
    lines.push(`${SEVERITY_TITLE[severity]} (${bucket.length})`, RULE);
    for (const r of bucket) {
      lines.push(`✗ ${r.id}  ${r.message}`);
      if (r.route) lines.push(`            ${r.route}`);
      if (r.location) lines.push(`            ${r.location}`);
    }
    lines.push('');
  }

  const passed = results.filter((r) => classify(r, config) !== 'fail');
  if (passed.length > 0) {
    lines.push(`Passed (${passed.length})`, RULE);
    for (const r of passed) {
      const marker = classify(r, config) === 'dynamic' ? '  ↯ dynamic' : '';
      lines.push(`✓ ${r.id}  ${r.message}${marker}`);
    }
    lines.push('');
  }

  if (summary.dynamic > 0) {
    lines.push('↯ = set dynamically (verified at runtime).');
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}
