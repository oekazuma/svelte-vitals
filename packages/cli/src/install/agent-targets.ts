export type AgentTargetId = 'claude-skill' | 'cursor-rules' | 'claude-skill-improve';

export interface AgentTarget {
  id: AgentTargetId;
  label: string;
  hint: string;
  /**
   * cwd-relative destination paths. The same generated content is written to
   * every path in this list — Claude Code, Codex, and Cursor all read the
   * same SKILL.md convention (frontmatter name/description, directory name
   * decides the invocable command), just from different directories, so one
   * skill install target can serve all three without a second content
   * format. A single-path target (cursor-rules, whose .mdc format is
   * Cursor-specific) is just a one-element array.
   */
  relPaths: string[];
}

// Agent instruction-file install targets with metadata for the CLI wizard. Unlike the
// MCP clients and Vite targets, these are wholly generated from core's rule metadata, so
// --force is safe to apply (see index.ts).
export const AGENT_TARGETS: AgentTarget[] = [
  {
    id: 'claude-skill',
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
    label: 'Cursor rules',
    hint: 'Project rules file so Cursor avoids flagged patterns up front',
    relPaths: ['.cursor/rules/svelte-vitals.mdc']
  },
  {
    id: 'claude-skill-improve',
    label: 'Agent skill: improve-svelte',
    hint: 'Senior-advisor audit → implementation plans (read-only), for a project-wide improvement roadmap (Claude Code, Codex, Cursor)',
    relPaths: [
      '.claude/skills/improve-svelte/SKILL.md',
      '.agents/skills/improve-svelte/SKILL.md',
      '.cursor/skills/improve-svelte/SKILL.md'
    ]
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
