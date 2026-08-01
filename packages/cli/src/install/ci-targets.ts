import { WORKFLOW_PATH } from '../ci/workflow.js';

export type CiTargetId = 'ci-workflow';

export interface CiTarget {
  id: CiTargetId;
  label: string;
  hint: string;
  /** cwd-relative destination path. */
  relPath: string;
}

// CI install target with metadata for the CLI wizard. Same underlying writer as the
// standalone `svelte-vitals ci install` command (planWorkflowWrite/buildWorkflowYaml in
// ../ci/workflow.js) — this just exposes it as one more selectable target so it can be
// picked in the same pass as the Vite/agent targets, instead of a separate command.
export const CI_TARGETS: CiTarget[] = [
  {
    id: 'ci-workflow',
    label: 'GitHub Actions CI',
    hint: 'Scaffolds a workflow that runs @svelte-vitals/action on pull requests — inline annotations, job summary, sticky PR comment',
    relPath: WORKFLOW_PATH
  }
];

/** Lookup a CI install target by its id. */
export function ciTargetById(id: string): CiTarget | undefined {
  return CI_TARGETS.find((t) => t.id === id);
}

/** Whether an id is the CI install target. */
export function isCiTargetId(id: string): id is CiTargetId {
  return CI_TARGETS.some((t) => t.id === id);
}
