export type ReporterName = 'console' | 'json' | 'agent';

/** Env vars set by AI-agent harnesses. Curated + extensible; SVELTE_VITALS_AGENT is the universal opt-in. */
const AGENT_ENV_VARS = ['CLAUDECODE', 'SVELTE_VITALS_AGENT'];

function isReporterName(value: string | undefined): value is ReporterName {
  return value === 'console' || value === 'json' || value === 'agent';
}

/** True when run by a known AI-agent harness (design: curated allow-list, no TTY heuristic). */
export function isAgentEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return AGENT_ENV_VARS.some((key) => {
    const v = env[key];
    return v !== undefined && v !== '';
  });
}

/**
 * Resolve the reporter: explicit flag → SVELTE_VITALS_REPORTER → agent-env
 * auto-detect → console.
 */
export function resolveReporter(
  explicit: ReporterName | undefined,
  env: NodeJS.ProcessEnv = process.env
): ReporterName {
  if (explicit) return explicit;
  const fromEnv = env.SVELTE_VITALS_REPORTER;
  if (isReporterName(fromEnv)) return fromEnv;
  if (isAgentEnv(env)) return 'agent';
  return 'console';
}
