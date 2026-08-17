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

/**
 * Resolve the reporter: explicit flag → SVELTE_VITALS_REPORTER → agent-env
 * auto-detect → GitHub-Actions auto-detect → console.
 */
export function resolveReporter(
  explicit: ReporterName | undefined,
  env: NodeJS.ProcessEnv = process.env
): ReporterName {
  if (explicit) return explicit;
  const fromEnv = env.SVELTE_VITALS_REPORTER;
  if (isReporterName(fromEnv)) return fromEnv;
  if (isAgentEnv(env)) return 'agent';
  if (isGithubActionsEnv(env)) return 'github';
  return 'console';
}

/**
 * True when the agent reporter is chosen purely by env auto-detection — i.e. no
 * explicit flag and no SVELTE_VITALS_REPORTER, but a known agent env is present.
 * Used to surface a one-line "how to override" hint, since a human running the
 * CLI inside an agent terminal would otherwise get Markdown unexpectedly.
 */
export function isAutoDetectedAgent(explicit: ReporterName | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  return !explicit && !isReporterName(env.SVELTE_VITALS_REPORTER) && isAgentEnv(env);
}

/**
 * True when the github reporter is chosen purely by GITHUB_ACTIONS auto-detection
 * (no explicit flag, no SVELTE_VITALS_REPORTER, not an agent env). Used to surface
 * a one-line "how to override" hint so an existing CI user isn't surprised by the
 * switch from console output to workflow commands.
 */
export function isAutoDetectedGithub(
  explicit: ReporterName | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return !explicit && !isReporterName(env.SVELTE_VITALS_REPORTER) && !isAgentEnv(env) && isGithubActionsEnv(env);
}
