import type { Result, Severity } from '../types.js';
import { allRules } from '../rules/index.js';
import { docsUrlFor } from '../rule.js';
export { docsUrlFor } from '../rule.js';

/** Map a rule severity to a SARIF result/configuration level. */
export function severityToSarifLevel(sev: Severity): 'error' | 'warning' | 'note' {
  return sev === 'critical' ? 'error' : sev === 'warning' ? 'warning' : 'note';
}

/** Map a rule severity to a GitHub Actions workflow-command level. */
export function severityToGithubLevel(sev: Severity): 'error' | 'warning' | 'notice' {
  return sev === 'critical' ? 'error' : sev === 'warning' ? 'warning' : 'notice';
}

/** Human-readable text for a finding: its message, plus the recommendation when present. */
export function messageText(result: Result): string {
  return result.recommendation ? `${result.message} ${result.recommendation}` : result.message;
}

/** Stable, registry-sourced metadata for a rule id (single source of titles/severities). */
export interface RuleMeta {
  title: string;
  severity: Severity;
  docsUrl: string;
}

const RULE_META: Map<string, RuleMeta> = new Map(
  allRules.map((r) => [r.id, { title: r.title, severity: r.severity, docsUrl: docsUrlFor(r.id) }])
);

export function ruleMetaById(id: string): RuleMeta | undefined {
  return RULE_META.get(id);
}
