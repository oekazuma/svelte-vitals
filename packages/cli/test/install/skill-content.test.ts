import { describe, it, expect } from 'vitest';
import { allRules } from '@svelte-vitals/core';
import { buildSkillMarkdown, buildCursorRules, oneLine } from '../../src/install/skill-content.js';

const CATEGORY_HEADINGS = [
  '### SEO',
  '### Performance',
  '### Correctness',
  '### Security',
  '### Architecture',
  '### Accessibility'
];

describe('buildSkillMarkdown', () => {
  const md = buildSkillMarkdown('1.2.3');

  it('has Claude Code skill frontmatter (name/description)', () => {
    expect(md).toMatch(/^---\nname: svelte-vitals\ndescription: .+\n---\n/);
  });

  it('embeds the given version in the generated-by header', () => {
    expect(md).toContain('svelte-vitals 1.2.3');
  });

  it('has all 6 category headings', () => {
    for (const heading of CATEGORY_HEADINGS) {
      expect(md).toContain(heading);
    }
  });

  it('lists a known rule from each end of the registry (seo/title-presence, architecture/prop-count)', () => {
    expect(md).toMatch(/- \*\*seo\/title-presence — .+\*\* \(critical\): .+\(\[docs\]\(.+seo\/title-presence\)\)/);
    expect(md).toMatch(/- \*\*architecture\/prop-count — .+\*\* \(\w+\): .+\(\[docs\]\(.+architecture\/prop-count\)\)/);
  });

  it('has one rule line per registered rule', () => {
    const ruleLines = md.split('\n').filter((l) => l.startsWith('- **'));
    expect(ruleLines).toHaveLength(allRules.length);
  });

  it('sends the agent to the bundled docs for anything outside the rule catalog', () => {
    // Complete invocations: an agent copies these verbatim, and a bare `docs show` is not runnable.
    expect(md).toContain('npx svelte-vitals docs list');
    expect(md).toContain('npx svelte-vitals docs show <name>');
  });

  it('sends the agent to `svelte-vitals explain`, not to the removed MCP tool', () => {
    expect(md).toContain('npx svelte-vitals explain <rule-id>');
    expect(md).not.toContain('explain_rule');
    expect(md).not.toContain('MCP');
  });

  it('includes a Fix note when the rule defines one', () => {
    const ruleWithFix = allRules.find((r) => r.fix?.description);
    expect(ruleWithFix).toBeDefined();
    expect(md).toContain(`Fix: ${oneLine(ruleWithFix!.fix!.description)}`);
  });

  it('marks a rule as inert until configured when every declared option defaults to empty', () => {
    // architecture/private-scope-import: its only option, `scopes`, defaults to `[]` — the
    // rule emits nothing at all until a project declares scopes, so a project that never
    // configures it must not be told to act on it.
    const line = md.split('\n').find((l) => l.includes('architecture/private-scope-import — '));
    expect(line).toBeDefined();
    expect(line).toContain('(inert until configured)');
  });

  it('does not mark a rule with no options as inert until configured', () => {
    const line = md.split('\n').find((l) => l.includes('seo/title-presence — '));
    expect(line).toBeDefined();
    expect(line).not.toContain('(inert until configured)');
  });

  it('does not mark a rule whose option has a non-empty default as inert until configured', () => {
    // architecture/prop-count's `max` option defaults to a real threshold, not an empty
    // collection, so the rule already checks something out of the box.
    const line = md.split('\n').find((l) => l.includes('architecture/prop-count — '));
    expect(line).toBeDefined();
    expect(line).not.toContain('(inert until configured)');
  });
});

describe('buildCursorRules', () => {
  const mdc = buildCursorRules('1.2.3');

  it('has Cursor rules frontmatter (description/globs/alwaysApply)', () => {
    expect(mdc).toMatch(/^---\ndescription: .+\nglobs: \[.+\]\nalwaysApply: false\n---\n/);
  });

  it('embeds the given version in the generated-by header', () => {
    expect(mdc).toContain('svelte-vitals 1.2.3');
  });

  it('has all 6 category headings', () => {
    for (const heading of CATEGORY_HEADINGS) {
      expect(mdc).toContain(heading);
    }
  });

  it('lists seo/title-presence and architecture/prop-count', () => {
    expect(mdc).toContain('seo/title-presence');
    expect(mdc).toContain('architecture/prop-count');
  });
});

describe('oneLine', () => {
  it('is a no-op for plain single-line text', () => {
    expect(oneLine('hello world.')).toBe('hello world.');
  });

  it('collapses embedded newlines so a rule stays on one Markdown list line', () => {
    expect(oneLine('first line\nsecond line')).toBe('first line second line');
  });

  it('collapses CRLF and repeated newlines into a single space', () => {
    expect(oneLine('a\r\n\n\nb')).toBe('a b');
  });

  it('trims leading/trailing whitespace', () => {
    expect(oneLine('  padded  ')).toBe('padded');
  });
});
