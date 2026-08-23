import { describe, it, expect } from 'vitest';
import { allRules } from '@svelte-vitals/core/internal';
import { configurableRulesReference } from '../src/install/setup-skill-content.js';

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
