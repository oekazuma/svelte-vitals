import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';
import { a11yDisallowedElement, a11yRequiredElement } from '../src/internal.js';
import { validateRuleOptions } from '../src/rule-options.js';
import { ELEMENTS_OPTION } from '../src/rules/a11y/element-declarations.js';
import { defineConfig, defaultProject, type Config, type Result } from '../src/types.js';
import type { ResolvedA11y } from '../src/a11y.js';
import type { RuleContext } from '../src/rule.js';

const fails = (rs: Result[]) =>
  rs.filter((r) => r.detection.presence === 'none').map((r) => `${r.line ?? 0}:${r.message}`);
const passes = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'own').length;

describe('the elements declaration grammar', () => {
  const spec = { elements: ELEMENTS_OPTION };
  it('accepts bare tag names, including custom-element names, and rejects selector syntax', () => {
    expect(validateRuleOptions('x', spec, { elements: ['iframe', 'MARQUEE', 'my-widget', 'h1'] })).toEqual([]);
    const errors = validateRuleOptions('x', spec, { elements: ['input[type=file]', '.legacy', 'a > b', 'div#x'] });
    expect(errors).toHaveLength(4);
    expect(errors[0]).toContain("'input[type=file]' is not a bare tag name");
  });
});

describe('a11y/disallowed-element', () => {
  const ctx = (src: string, config: Config): RuleContext => ({
    heads: [],
    project: defaultProject,
    config,
    components: [{ ...parseComponentFacts(src, 'src/lib/C.svelte'), file: 'src/lib/C.svelte' }]
  });
  const on = (elements: string[]) => defineConfig({ rules: { 'a11y/disallowed-element': { options: { elements } } } });

  it('emits nothing at all when nothing is declared', async () => {
    expect(await a11yDisallowedElement.check(ctx('<iframe title="t"></iframe>', defineConfig({})))).toEqual([]);
  });

  it('reports every occurrence of a declared tag, case-insensitively, at the start tag', async () => {
    const out = await a11yDisallowedElement.check(
      ctx('<div>\n<iframe\n  src="/x"\n  title="t"\n></iframe>\n<IFRAME></IFRAME>\n<p>ok</p></div>', on(['IFRAME']))
    );
    // `<IFRAME>` is a component to Svelte, not an element — only the lowercase one is an element.
    expect(fails(out)).toEqual(["2:<iframe> is disallowed by this project's configuration"]);
  });

  it('passes a component with elements and none disallowed, so a clean file stays in the evidence', async () => {
    const out = await a11yDisallowedElement.check(ctx('<div><p>x</p></div>', on(['iframe'])));
    expect(fails(out)).toEqual([]);
    expect(passes(out)).toBe(1);
  });

  it('extends the declaration through a files-scoped override', async () => {
    const config = defineConfig({
      rules: { 'a11y/disallowed-element': { options: { elements: ['iframe'] } } },
      overrides: [{ files: 'src/lib/**', rules: { 'a11y/disallowed-element': { options: { elements: ['marquee'] } } } }]
    });
    const out = await a11yDisallowedElement.check(ctx('<marquee>m</marquee><iframe title="t"></iframe>', config));
    expect(fails(out)).toHaveLength(2);
  });
});

describe('a11y/required-element', () => {
  const route = (over: Partial<ResolvedA11y>): ResolvedA11y => ({
    route: '/x',
    landmarks: {},
    nestedLandmarks: [],
    ids: {},
    idRefs: [],
    idCandidates: [],
    fullyResolved: true,
    elementTags: ['div', 'main', 'h1'],
    elementsClosed: true,
    file: 'src/routes/x/+page.svelte',
    ...over
  });
  const ctx = (a11y: ResolvedA11y[], config: Config): RuleContext => ({
    heads: [],
    project: defaultProject,
    config,
    a11y
  });
  const on = (elements: string[]) => defineConfig({ rules: { 'a11y/required-element': { options: { elements } } } });

  it('emits nothing at all when nothing is declared', async () => {
    expect(await a11yRequiredElement.check(ctx([route({ elementTags: [] })], defineConfig({})))).toEqual([]);
  });

  it('passes a route whose declared elements are present, whether or not the world is closed', async () => {
    for (const closed of [true, false]) {
      const out = await a11yRequiredElement.check(ctx([route({ elementsClosed: closed })], on(['main', 'H1'])));
      expect(fails(out)).toEqual([]);
      expect(passes(out)).toBe(1);
    }
  });

  it('reports a missing element only when the world is closed for elements, at the page file', async () => {
    const closed = await a11yRequiredElement.check(ctx([route({ elementTags: ['div'] })], on(['main'])));
    expect(fails(closed)).toEqual([
      "0:<main> is required on every route by this project's configuration and this route has none"
    ]);
    expect(closed[0]!.location).toBe('src/routes/x/+page.svelte');
    const open = await a11yRequiredElement.check(
      ctx([route({ elementTags: ['div'], elementsClosed: false })], on(['main']))
    );
    expect(open).toEqual([]);
  });

  it('extends the declaration through a route-scoped override', async () => {
    const config = defineConfig({
      rules: { 'a11y/required-element': { options: { elements: ['h1'] } } },
      overrides: [{ route: '/x', rules: { 'a11y/required-element': { options: { elements: ['nav'] } } } }]
    });
    const out = await a11yRequiredElement.check(ctx([route({})], config));
    expect(fails(out).map((m) => m.split(' ')[0])).toEqual(['0:<nav>']);
  });

  it('judges nothing where a provider supplies no presence set', async () => {
    expect(await a11yRequiredElement.check(ctx([route({ elementTags: undefined })], on(['main'])))).toEqual([]);
  });
});
