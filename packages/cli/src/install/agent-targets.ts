export type AgentTargetId = 'claude-skill' | 'cursor-rules';

export interface AgentTarget {
  id: AgentTargetId;
  label: string;
  hint: string;
  /** cwd-relative destination path. */
  relPath: string;
}

// Agent instruction-file install targets with metadata for the CLI wizard. Unlike the
// MCP clients and Vite targets, these are wholly generated from core's rule metadata, so
// --force is safe to apply (see index.ts).
export const AGENT_TARGETS: AgentTarget[] = [
  {
    id: 'claude-skill',
    label: 'Claude Code skill',
    hint: 'Teaches the agent svelte-vitals rules + when to run the scanner',
    relPath: '.claude/skills/svelte-vitals/SKILL.md'
  },
  {
    id: 'cursor-rules',
    label: 'Cursor rules',
    hint: 'Project rules file so Cursor avoids flagged patterns up front',
    relPath: '.cursor/rules/svelte-vitals.mdc'
  }
];

/** Lookup an agent instruction-file target by its id. */
export function agentTargetById(id: string): AgentTarget | undefined {
  return AGENT_TARGETS.find((t) => t.id === id);
}

/** Whether an id is one of the agent instruction-file install targets. */
export function isAgentTargetId(id: string): id is AgentTargetId {
  return AGENT_TARGETS.some((t) => t.id === id);
}
