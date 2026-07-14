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

  it('lists a known rule from each end of the registry (SEO001, ARCH002)', () => {
    expect(md).toMatch(/- \*\*SEO001 — .+\*\* \(critical\): .+\(\[docs\]\(.+seo001\)\)/);
    expect(md).toMatch(/- \*\*ARCH002 — .+\*\* \(\w+\): .+\(\[docs\]\(.+arch002\)\)/);
  });

  it('contains the structural headings that make up the advisor workflow', () => {
    expect(md).toContain('## Hard rules');
    expect(md).toContain('## Workflow');
    expect(md).toContain('## Plan template');
    expect(md).toContain('## Invocation variants');
  });

  it('does not contain unsubstituted placeholders', () => {
    expect(md).not.toContain('{{RULE_DIGEST}}');
    expect(md).not.toContain('{{VERSION}}');
  });
});
