import { describe, it, expect } from 'vitest';
import { allRules } from '@svelte-vitals/core/internal';
import { buildSetupSkillMarkdown, configurableRulesReference } from '../src/install/setup-skill-content.js';

describe('configurableRulesReference', () => {
  const reference = configurableRulesReference();

  it('lists every rule that declares options, and no rule that does not', () => {
    for (const rule of allRules) {
      if (rule.options) expect(reference).toContain(rule.id);
      else expect(reference).not.toContain(`**${rule.id}**`);
    }
  });

  it('marks a rule inert when every one of its options defaults empty', () => {
    // architecture/directory-naming declares `directories` and `exclude`, both empty by default.
    expect(reference).toMatch(/architecture\/directory-naming[^\n]*inert/);
    // performance/heavy-import declares options with real defaults, so it is not inert.
    expect(reference).not.toMatch(/performance\/heavy-import[^\n]*inert/);
  });

  it('carries the reserved grammar where an option declares one', () => {
    expect(reference).toContain('a bare tag name');
  });

  it('sends the reader to the docs page for the meaning of an option', () => {
    expect(reference).toContain('https://oekazuma.github.io/svelte-vitals/rules/architecture/directory-naming');
  });
});

describe('the setup skill body', () => {
  const md = buildSetupSkillMarkdown('<!-- generated -->');

  it('carries the frontmatter name and the given header', () => {
    expect(md.startsWith('---\nname: setup-svelte-vitals\n')).toBe(true);
    expect(md).toContain('<!-- generated -->');
  });

  it('states the markuplint version its tables were checked against', () => {
    expect(md).toContain('4.18');
  });

  it('carries a catch-all so an unmapped markuplint rule is reported, not guessed', () => {
    expect(md).toMatch(/unconvertible/);
    expect(md).toContain('require-accessible-name');
  });

  it('tells the agent a preset makes absence mean on, not unset', () => {
    expect(md).toContain('extends');
    expect(md).toMatch(/absent[^.]*preset|preset[^.]*absent/i);
  });

  it('requires the measured candidate to be the complete future config', () => {
    expect(md).toMatch(/complete future config/i);
  });

  it('hands the non-config targets back to install', () => {
    expect(md).toContain('svelte-vitals install');
  });
});
