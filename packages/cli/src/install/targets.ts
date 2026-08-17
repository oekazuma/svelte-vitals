import { WORKFLOW_PATH } from '../ci/workflow.js';

type ViteTargetId = 'vite-plugin' | 'vite-hooks';
// The SKILL.md targets (claude-skill / claude-skill-improve) moved out of the installer:
// the same files are distributed from the repo-root skills/ via `npx skills add`.
export type AgentTargetId = 'cursor-rules';
export type TargetId = ViteTargetId | AgentTargetId | 'config-file' | 'ci-workflow';
export type TargetKind = 'vite' | 'agent' | 'config' | 'ci';

export interface InstallTarget {
  id: TargetId;
  kind: TargetKind;
  label: string;
  hint: string;
  /**
   * cwd-relative destination paths; empty when the destination is resolved at plan
   * time instead (the Vite targets codemod whichever vite.config/hooks.server file
   * exists; the config target picks its filename per environment — see
   * planForConfigTarget).
   */
  relPaths: string[];
}

// Every install target, with metadata for the CLI wizard. The Vite targets codemod
// existing files, so --force never applies to them; the agent/config/ci targets are
// wholly generated, so --force is safe to regenerate (see index.ts).
export const INSTALL_TARGETS: InstallTarget[] = [
  {
    id: 'vite-plugin',
    kind: 'vite',
    label: 'Vite plugin (build gate)',
    hint: 'Fails `vite build` when prerendered pages cross the SEO/Performance threshold',
    relPaths: []
  },
  {
    id: 'vite-hooks',
    kind: 'vite',
    label: 'Live dashboard accuracy',
    hint: 'Feeds real rendered results into the live dashboard as you browse — improves per-route accuracy, never fails a build',
    relPaths: []
  },
  {
    id: 'cursor-rules',
    kind: 'agent',
    label: 'Cursor rules',
    hint: 'Project rules file so Cursor avoids flagged patterns up front',
    relPaths: ['.cursor/rules/svelte-vitals.mdc']
  },
  {
    id: 'config-file',
    kind: 'config',
    label: 'Config file',
    hint: 'Scaffolds svelte-vitals.config.{mjs,ts} (auto-picks the best one) with every option commented out',
    relPaths: []
  },
  {
    id: 'ci-workflow',
    kind: 'ci',
    label: 'GitHub Actions CI',
    hint: 'Scaffolds a workflow that runs @svelte-vitals/action on pull requests — inline annotations, job summary, sticky PR comment',
    relPaths: [WORKFLOW_PATH]
  }
];

/** Lookup an install target by its id. */
export function targetById(id: string): InstallTarget | undefined {
  return INSTALL_TARGETS.find((t) => t.id === id);
}

/** The install targets of one kind, in declaration order. */
export function targetsOfKind(kind: TargetKind): InstallTarget[] {
  return INSTALL_TARGETS.filter((t) => t.kind === kind);
}

/** Whether `id` names an install target of `kind`. */
export function isKind(id: string, kind: TargetKind): boolean {
  return targetById(id)?.kind === kind;
}
