import { describe, it, expect } from 'vitest';
import { buildImproveSkillMarkdown } from '../../src/install/improve-skill-content.js';
import { installHeader } from '../../src/install/skill-content.js';

describe('buildImproveSkillMarkdown', () => {
  const md = buildImproveSkillMarkdown(installHeader('1.2.3'));

  it('has Claude Code skill frontmatter (name/description)', () => {
    expect(md).toMatch(/^---\nname: improve-svelte\ndescription: .+\n---\n/);
  });

  it('contains the structural headings that make up the advisor workflow', () => {
    expect(md).toContain('## Hard rules');
    expect(md).toContain('## Workflow');
    expect(md).toContain('## Plan template');
    expect(md).toContain('## Invocation variants');
  });
});
