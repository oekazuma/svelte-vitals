export type ReporterName = 'console' | 'json' | 'agent' | 'sarif' | 'github';

/** Env vars set by AI-agent harnesses. Curated + extensible; SVELTE_VITALS_AGENT is the universal opt-in. */
const AGENT_ENV_VARS = ['CLAUDECODE', 'SVELTE_VITALS_AGENT'];

export function isReporterName(value: string | undefined): value is ReporterName {
  return (
    value === 'console' || value === 'json' || value === 'agent' || value === 'sarif' || value === 'github'
  );
}

/** True when run by a known AI-agent harness (design: curated allow-list, no TTY heuristic). */
export function isAgentEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return AGENT_ENV_VARS.some((key) => {
    const v = env[key];
    return v !== undefined && v !== '';
  });
}

/** True when running inside GitHub Actions (GITHUB_ACTIONS is 'true' there). */
export function isGithubActionsEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.GITHUB_ACTIONS;
  return v !== undefined && v !== '';
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
  return (
    !explicit && !isReporterName(env.SVELTE_VITALS_REPORTER) && !isAgentEnv(env) && isGithubActionsEnv(env)
  );
}
