import { describe, it, expect } from 'vitest';
import { architectureRouteComponentImport } from '../src/rules/architecture/route-component-import.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/types.js';

const config = defineConfig({});
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const passes = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'own');

const comp = (file: string, spans: ComponentFacts['importSpans']): ComponentFacts =>
  ({ file, importSpans: spans, imports: spans.map((s) => s.source), suppressions: [] }) as unknown as ComponentFacts;

const ctx = (components: ComponentFacts[], over: Partial<RuleContext> = {}): RuleContext =>
  ({ heads: [], project: defaultProject, config, components, ...over }) as RuleContext;

const IMPORTER = 'src/lib/Panel.svelte';
const run = (spans: ComponentFacts['importSpans'], file = IMPORTER, over: Partial<RuleContext> = {}) =>
  architectureRouteComponentImport.check(ctx([comp(file, spans)], over));

describe('architecture/route-component-import — the mechanism', () => {
  it('flags each route-entry filename Kit defines', async () => {
    for (const name of ['+page.svelte', '+layout.svelte', '+error.svelte']) {
      const rs = await run([{ source: `../routes/a/${name}`, line: 3 }]);
      expect(fails(rs), name).toHaveLength(1);
      expect(fails(rs)[0]!.line).toBe(3);
    }
  });

  it('flags an @ breakout entry, including a dotted layout name', async () => {
    // Kit strips only the extension before matching `@(.*)`, so a dotted breakout name is a real
    // route entry — see the design doc.
    for (const name of ['+page@.svelte', '+layout@foo.svelte', '+page@foo.bar.svelte']) {
      expect(fails(await run([{ source: `../routes/a/${name}`, line: 1 }])), name).toHaveLength(1);
    }
  });

  it('ignores a route-entry name outside the routes directory', async () => {
    // Kit gives these names meaning only under src/routes.
    expect(fails(await run([{ source: '../widgets/+page.svelte', line: 1 }]))).toEqual([]);
  });

  it('ignores a bare package and an unresolvable specifier', async () => {
    expect(fails(await run([{ source: 'some-pkg', line: 1 }]))).toEqual([]);
  });

  it('resolves through a declared alias', async () => {
    const project = {
      ...defaultProject,
      kitAliases: [
        { find: '$lib', replacement: 'src/lib', match: 'prefix' as const },
        { find: '$r', replacement: 'src/routes', match: 'prefix' as const }
      ]
    };
    expect(fails(await run([{ source: '$r/a/+page.svelte', line: 2 }], IMPORTER, { project }))).toHaveLength(1);
  });

  it('skips an import that produces no runtime binding', async () => {
    expect(fails(await run([{ source: '../routes/a/+page.svelte', line: 1, type: true }]))).toEqual([]);
  });

  it('emits nothing at all for a file importing no route entry', async () => {
    // Neither a penalty nor a seeded pass: no signal in the file.
    expect(await run([{ source: './Button.svelte', line: 1 }])).toEqual([]);
  });
});

describe('architecture/route-component-import — exemptions', () => {
  const span = [{ source: '../routes/a/+page.svelte', line: 1 }];

  it('exempts each built-in importer pattern', async () => {
    for (const file of ['src/lib/A.stories.svelte', 'src/lib/A.test.svelte', 'src/lib/A.spec.svelte']) {
      expect(fails(await run(span, file)), file).toEqual([]);
    }
  });

  it('exempts a suffixed satellite name, since * is a within-segment wildcard', async () => {
    expect(fails(await run(span, 'src/lib/A.error.test.svelte'))).toEqual([]);
  });

  it('gives an exempt importer a PASS, not silence', async () => {
    // Its route-entry imports are fine, which is a true statement worth recording; putting the
    // exemption in `applies` instead would call the file signal-free, which it is not.
    expect(passes(await run(span, 'src/lib/A.test.svelte'))).toHaveLength(1);
  });

  it('exempts a pattern appended through the option', async () => {
    const cfg = defineConfig({
      rules: { 'architecture/route-component-import': { options: { exemptImporters: ['**/*.fixture.svelte'] } } }
    });
    const rs = await architectureRouteComponentImport.check(
      ctx([comp('src/lib/A.fixture.svelte', span)], { config: cfg })
    );
    expect(fails(rs)).toEqual([]);
  });

  it('keeps the built-ins when the option appends to them', async () => {
    // A string-list ADDS to its default; an appended pattern must not replace *.test.svelte.
    const cfg = defineConfig({
      rules: { 'architecture/route-component-import': { options: { exemptImporters: ['**/*.fixture.svelte'] } } }
    });
    const rs = await architectureRouteComponentImport.check(
      ctx([comp('src/lib/A.test.svelte', span)], { config: cfg })
    );
    expect(fails(rs)).toEqual([]);
  });
});
