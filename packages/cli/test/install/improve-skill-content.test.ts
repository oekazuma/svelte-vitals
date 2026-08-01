import { describe, it, expect } from 'vitest';
import { buildImproveSkillMarkdown } from '../../src/install/improve-skill-content.js';

const CATEGORY_HEADINGS = ['### SEO', '### Performance', '### Correctness', '### Security', '### Architecture'];

describe('buildImproveSkillMarkdown', () => {
  const md = buildImproveSkillMarkdown('1.2.3');

  it('has Claude Code skill frontmatter (name/description)', () => {
    expect(md).toMatch(/^---\nname: improve-svelte\ndescription: .+\n---\n/);
  });

  it('embeds the given version in the generated-by header', () => {
    expect(md).toContain('svelte-vitals 1.2.3');
  });

  it('contains the Rule catalog heading and all 5 category headings', () => {
    expect(md).toContain('## Rule catalog');
    for (const heading of CATEGORY_HEADINGS) {
      expect(md).toContain(heading);
    }
  });

  it('lists a known rule from each end of the registry (seo/title-presence, architecture/prop-count)', () => {
    expect(md).toMatch(/- \*\*seo\/title-presence — .+\*\* \(critical\): .+\(\[docs\]\(.+seo\/title-presence\)\)/);
    expect(md).toMatch(/- \*\*architecture\/prop-count — .+\*\* \(\w+\): .+\(\[docs\]\(.+architecture\/prop-count\)\)/);
  });

  it('contains the structural headings that make up the advisor workflow', () => {
    expect(md).toContain('## Hard rules');
    expect(md).toContain('## Workflow');
    expect(md).toContain('## Plan template');
    expect(md).toContain('## Invocation variants');
  });

  it('sends the agent to `svelte-vitals explain`, not to a tool that no longer exists', () => {
    expect(md).toContain('npx svelte-vitals explain <rule-id>');
    expect(md).not.toContain('explain_rule');
    expect(md).not.toContain('MCP');
  });

  it('does not contain unsubstituted placeholders', () => {
    expect(md).not.toContain('{{RULE_DIGEST}}');
    expect(md).not.toContain('{{VERSION}}');
  });
});
