import { isAbsolute, posix, relative, sep } from 'node:path';

export const RETIRED_ACTION = 'oekazuma/svelte-vitals-action';

/** True inside the retired action's own CLI run; its child processes inherit `GITHUB_ACTION_REPOSITORY`. */
export function isRetiredActionCaller(env: NodeJS.ProcessEnv): boolean {
  return env.GITHUB_ACTION_REPOSITORY === RETIRED_ACTION;
}

/**
 * Rewrites project-relative locations to workspace-relative ones, which is what GitHub resolves an
 * annotation's `file=` against. Undefined when there is nothing to prefix.
 */
export function workspaceLocationMapper(
  env: NodeJS.ProcessEnv,
  projectDir: string
): ((location: string) => string) | undefined {
  const workspace = env.GITHUB_WORKSPACE;
  if (!workspace) return undefined;
  const rel = relative(workspace, projectDir);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return undefined;
  const prefix = rel.split(sep).join('/');
  return (location) => {
    // A file in a sibling workspace package is reported as `../ui/...`.
    const joined = posix.join(prefix, location);
    return isAbsolute(location) || joined === '..' || joined.startsWith('../') ? location : joined;
  };
}
