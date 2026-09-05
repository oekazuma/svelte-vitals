import { getAgentProfile } from 'gunshi/agent';

export type ReporterName = 'console' | 'json' | 'agent' | 'sarif' | 'github' | 'html' | 'md';

/** Single source of truth for the `--reporter` value set — shared with completion's value handler (gunshi/complete.ts). */
export const REPORTER_NAMES: readonly ReporterName[] = ['console', 'json', 'agent', 'sarif', 'github', 'html', 'md'];

export function isReporterName(value: string | undefined): value is ReporterName {
  return REPORTER_NAMES.includes(value as ReporterName);
}

/**
 * True when run by a known AI-agent harness (design: env-var-based, no TTY heuristic).
 * `SVELTE_VITALS_AGENT` is the universal opt-in and is read from whichever `env` is
 * passed in, so tests can inject it. Recognizing specific harnesses (Claude Code,
 * Cursor, Codex, ...) is delegated to gunshi's agent profile (in turn std-env), which
 * takes no arguments and always reads the real process.env — so that check only
 * applies when `env` *is* process.env (the production default and every `run()` call
 * that doesn't override it for a test). A test-injected env object exercises the
 * opt-in only; the delegated detection is exercised end-to-end against the built CLI
 * in scripts/cli-e2e.js, spawning fresh processes so gunshi/std-env's own env read
 * sees exactly the env each check sets up.
 */
export function isAgentEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const optIn = env.SVELTE_VITALS_AGENT;
  if (optIn !== undefined && optIn !== '') return true;
  return env === process.env && getAgentProfile().isAgent;
}

/** True when running inside GitHub Actions, which always sets GITHUB_ACTIONS to exactly 'true'. */
export function isGithubActionsEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GITHUB_ACTIONS === 'true';
}

/** True when CI is set (the widely-adopted convention: GitHub Actions, GitLab, CircleCI, Travis, and most other CI systems all set CI=true). */
export function isCiEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CI === 'true' || env.CI === '1';
}

/** Which layer chose the reporter: explicit flag → SVELTE_VITALS_REPORTER → agent-env auto-detect → GitHub-Actions auto-detect → console. */
function reporterChoice(explicit: ReporterName | undefined, env: NodeJS.ProcessEnv) {
  if (explicit) return { name: explicit, source: 'flag' as const };
  const fromEnv = env.SVELTE_VITALS_REPORTER;
  if (isReporterName(fromEnv)) return { name: fromEnv, source: 'env' as const };
  if (isAgentEnv(env)) return { name: 'agent' as const, source: 'agent' as const };
  if (isGithubActionsEnv(env)) return { name: 'github' as const, source: 'github' as const };
  return { name: 'console' as const, source: 'default' as const };
}

export function resolveReporter(
  explicit: ReporterName | undefined,
  env: NodeJS.ProcessEnv = process.env
): ReporterName {
  return reporterChoice(explicit, env).name;
}

/** Auto-detected (not asked for) — the run prints a one-line "how to override" hint so a human in an agent terminal isn't surprised by Markdown. */
export function isAutoDetectedAgent(explicit: ReporterName | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  return reporterChoice(explicit, env).source === 'agent';
}

/** Auto-detected (not asked for) — same hint, so an existing CI user isn't surprised by workflow commands replacing console output. */
export function isAutoDetectedGithub(
  explicit: ReporterName | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return reporterChoice(explicit, env).source === 'github';
}
