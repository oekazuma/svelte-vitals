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

describe('the mapping tables name things that exist', () => {
  const md = buildSetupSkillMarkdown('<!-- generated -->');
  const ids = new Set(allRules.map((r) => r.id));

  it('every svelte-vitals rule id in the body is a real rule', () => {
    const cited = [...md.matchAll(/`((?:a11y|seo|architecture|correctness|security|performance)\/[a-z0-9-]+)`/g)].map(
      (m) => m[1]!
    );
    expect([...new Set(cited)].filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every option name the tables reference exists on its rule', () => {
    // Pairs the body relies on. Add a row here when the tables start naming another option.
    const pairs: Array<[string, string]> = [
      ['architecture/directory-naming', 'directories'],
      ['a11y/disallowed-element', 'elements'],
      ['a11y/required-element', 'elements']
    ];
    for (const [id, option] of pairs) {
      const rule = allRules.find((r) => r.id === id);
      expect(rule, id).toBeDefined();
      expect(Object.keys(rule!.options ?? {}), `${id}.${option}`).toContain(option);
    }
  });

  it('every bare markuplint name in the direct-mapping list resolves as a11y/<name>', () => {
    // The surrounding prose tells the agent to prefix these with `a11y/`; a backticked-id regex
    // can't see them, so this parses the fenced list out of the generated body itself (never
    // re-typed here) and checks each name the same way the prose instructs the agent to.
    const block = md.match(/These map that way today:\n\n```\n([\s\S]*?)\n```/);
    expect(block, 'direct-mapping fenced block not found').not.toBeNull();
    const bareNames = block![1]!.split(/\s+/).filter(Boolean);
    expect(bareNames.length).toBeGreaterThan(0);
    expect(bareNames.filter((name) => !ids.has(`a11y/${name}`))).toEqual([]);
  });
});

describe('the frontmatter parses', () => {
  const md = buildSetupSkillMarkdown('<!-- generated -->');

  /**
   * Just enough of YAML to catch the one bug that matters here: a plain (unquoted) scalar
   * containing ": " is a "nested mapping in a compact mapping" — real YAML parsers reject it
   * (verified against the `yaml` package) rather than reading past it, and that is exactly what
   * broke this file's frontmatter before it was quoted. `yaml` is not a dependency of this
   * package, so this is the minimum reimplementation that still fails on that shape.
   */
  function parseTwoLineFrontmatter(source: string): Record<string, string> {
    const match = source.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) throw new Error('no frontmatter block found');
    const parsed: Record<string, string> = {};
    for (const line of match[1]!.split('\n').filter(Boolean)) {
      const sep = line.indexOf(': ');
      if (sep === -1) throw new Error(`not a mapping line: ${line}`);
      const key = line.slice(0, sep);
      const raw = line.slice(sep + 2);
      if (raw.startsWith("'")) {
        if (!raw.endsWith("'") || raw.length < 2) throw new Error(`unterminated single-quoted scalar: ${line}`);
        parsed[key] = raw.slice(1, -1).replace(/''/g, "'");
      } else {
        if (raw.includes(': ')) throw new Error(`ambiguous plain scalar (unquoted ": "): ${line}`);
        parsed[key] = raw;
      }
    }
    return parsed;
  }

  it('parses into exactly {name, description} with the expected values', () => {
    const parsed = parseTwoLineFrontmatter(md);
    expect(Object.keys(parsed)).toEqual(['name', 'description']);
    expect(parsed.name).toBe('setup-svelte-vitals');
    expect(parsed.description).toBe(
      'Set up svelte-vitals in a SvelteKit project: inspect what the project already uses, derive a svelte-vitals.config from its markuplint / eslint-plugin-check-file config and its actual directory conventions, measure each candidate rule before adopting it, and hand the remaining targets to `svelte-vitals install`. Use when asked to set up, configure, adopt or onboard svelte-vitals, or to fill in the config file — including the first run on a project that has never used it.'
    );
  });

  it('rejects the historical bug: an unquoted ": " inside a plain scalar', () => {
    const broken =
      '---\nname: setup-svelte-vitals\ndescription: Set up svelte-vitals in a SvelteKit project: inspect what the project already uses\n---\n';
    expect(() => parseTwoLineFrontmatter(broken)).toThrow();
  });
});
