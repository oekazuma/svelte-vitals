import { WORKFLOW_PATH } from '../ci/workflow.js';

export type ViteTargetId = 'vite-plugin' | 'vite-hooks';
export type AgentTargetId = 'claude-skill' | 'cursor-rules' | 'claude-skill-improve';
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
   * planForConfigTarget). The agent targets list several paths because the same
   * generated content is written to every one — Claude Code, Codex, and Cursor all
   * read the same SKILL.md convention (frontmatter name/description, directory name
   * decides the invocable command), just from different directories, so one skill
   * install target can serve all three without a second content format.
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
    id: 'claude-skill',
    kind: 'agent',
    label: 'Agent skill: svelte-vitals',
    hint: 'Teaches the agent svelte-vitals rules + when to run the scanner (Claude Code, Codex, Cursor)',
    relPaths: [
      '.claude/skills/svelte-vitals/SKILL.md',
      '.agents/skills/svelte-vitals/SKILL.md',
      '.cursor/skills/svelte-vitals/SKILL.md'
    ]
  },
  {
    id: 'cursor-rules',
    kind: 'agent',
    label: 'Cursor rules',
    hint: 'Project rules file so Cursor avoids flagged patterns up front',
    relPaths: ['.cursor/rules/svelte-vitals.mdc']
  },
  {
    id: 'claude-skill-improve',
    kind: 'agent',
    label: 'Agent skill: improve-svelte',
    hint: 'Senior-advisor audit → implementation plans (read-only), for a project-wide improvement roadmap (Claude Code, Codex, Cursor)',
    relPaths: [
      '.claude/skills/improve-svelte/SKILL.md',
      '.agents/skills/improve-svelte/SKILL.md',
      '.cursor/skills/improve-svelte/SKILL.md'
    ]
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
