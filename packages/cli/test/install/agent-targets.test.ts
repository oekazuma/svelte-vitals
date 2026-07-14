import { describe, it, expect } from 'vitest';
import { AGENT_TARGETS, agentTargetById, isAgentTargetId } from '../../src/install/agent-targets.js';

describe('agent targets', () => {
  it('has all three targets with distinct ids', () => {
    expect(AGENT_TARGETS.map((t) => t.id).sort()).toEqual(['claude-skill', 'claude-skill-improve', 'cursor-rules']);
  });
  it('each target has a non-empty label, hint, and relPath', () => {
    for (const t of AGENT_TARGETS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
      expect(t.relPath.length).toBeGreaterThan(0);
    }
  });
  it('agentTargetById resolves a known id', () => {
    expect(agentTargetById('claude-skill')?.relPath).toBe('.claude/skills/svelte-vitals/SKILL.md');
    expect(agentTargetById('cursor-rules')?.relPath).toBe('.cursor/rules/svelte-vitals.mdc');
    expect(agentTargetById('claude-skill-improve')?.relPath).toBe('.claude/skills/improve-svelte/SKILL.md');
  });
  it('agentTargetById returns undefined for an unknown id', () => {
    expect(agentTargetById('nope')).toBeUndefined();
  });
  it('isAgentTargetId is true for all agent target ids and false for an MCP client id', () => {
    expect(isAgentTargetId('claude-skill')).toBe(true);
    expect(isAgentTargetId('cursor-rules')).toBe(true);
    expect(isAgentTargetId('claude-skill-improve')).toBe(true);
    expect(isAgentTargetId('claude-code')).toBe(false);
  });
});
