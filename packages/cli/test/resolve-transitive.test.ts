import { describe, it, expect } from 'vitest';
import { defaultConfig, type KitAlias } from '@svelte-vitals/core/internal';
import { parseFile } from '../src/providers/source/parse.js';
import { resolveFileTags, resolveComponentFiles } from '../src/providers/source/resolve.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

async function resolveWith(files: Record<string, string>, entryRel: string, aliases?: readonly KitAlias[]) {
  const rt = createMemoryRuntime(files);
  const parsed = parseFile(files[entryRel]!, entryRel);
  return resolveFileTags(rt, '', entryRel, parsed, defaultConfig, 5, new Set([entryRel]), new Map(), aliases);
}

/** The files `<Name>` in `src/routes/+page.svelte` (script `script`) resolves to, over `files`. */
async function filesOf(script: string, name: string, files: Record<string, string>, aliases?: readonly KitAlias[]) {
  const entry = 'src/routes/+page.svelte';
  const source = `<script>${script}</script><${name} />`;
  const rt = createMemoryRuntime({ ...files, [entry]: source });
  return resolveComponentFiles({ rt, cwd: '', cache: new Map(), aliases }, name, parseFile(source, entry), entry);
}

describe('resolveComponentFiles', () => {
  const C = { 'src/lib/C.svelte': '<p>c</p>', 'src/routes/C.svelte': '<p>c</p>' };

  it('maps $lib, relative and extensionless .svelte imports', async () => {
    expect(await filesOf(`import C from '$lib/C.svelte';`, 'C', C)).toEqual({
      files: ['src/lib/C.svelte'],
      complete: true
    });
    expect(await filesOf(`import C from './C.svelte';`, 'C', C)).toEqual({
      files: ['src/routes/C.svelte'],
      complete: true
    });
    expect((await filesOf(`import C from '../lib/C';`, 'C', C)).files).toEqual(['src/lib/C.svelte']);
  });

  it('resolves nothing for a package, a missing file, or an escaping relative path', async () => {
    for (const spec of ['svelte-meta-tags', '$lib/Missing.svelte', '../../../../C.svelte']) {
      expect(await filesOf(`import C from '${spec}';`, 'C', C)).toEqual({ files: [], complete: false });
    }
  });

  it('follows a barrel re-export, nested barrels and export *', async () => {
    const files = {
      'src/lib/seo/index.ts': [
        "export { LANGS } from './constants';",
        "export type { SeoConfig } from './types';",
        "export { buildSeo, type BuildSeoInput } from './build';",
        "export { default as SeoHead } from './SeoHead.svelte';"
      ].join('\n'),
      'src/lib/seo/SeoHead.svelte': '<p>seo</p>',
      'src/lib/index.ts': "export * from './seo';\nexport { PageView } from './views';",
      'src/lib/views/index.js': "export { default as PageView } from './PageView.svelte';",
      'src/lib/views/PageView.svelte': '<p>view</p>'
    };
    expect((await filesOf(`import { SeoHead } from '$lib/seo';`, 'SeoHead', files)).files).toEqual([
      'src/lib/seo/SeoHead.svelte'
    ]);
    expect((await filesOf(`import { SeoHead } from '$lib';`, 'SeoHead', files)).files).toEqual([
      'src/lib/seo/SeoHead.svelte'
    ]);
    expect((await filesOf(`import { PageView } from '$lib/index.js';`, 'PageView', files)).files).toEqual([
      'src/lib/views/PageView.svelte'
    ]);
    expect((await filesOf(`import { buildSeo } from '$lib/seo';`, 'buildSeo', files)).files).toEqual([]);
  });

  it('follows an imported binding the barrel exports, by name or as its default', async () => {
    const files = {
      'src/lib/page/index.ts': "import Title from './title.svelte';\nexport { Title };",
      'src/lib/page/title.svelte': '<h1>t</h1>',
      'src/lib/game/index.ts': "import Dialog from './ui/dialog.svelte';\nexport default Dialog;",
      'src/lib/game/ui/dialog.svelte': '<p>d</p>'
    };
    expect((await filesOf(`import { Title } from '$lib/page';`, 'Title', files)).files).toEqual([
      'src/lib/page/title.svelte'
    ]);
    expect((await filesOf(`import Game from '$lib/game/index';`, 'Game', files)).files).toEqual([
      'src/lib/game/ui/dialog.svelte'
    ]);
  });

  it('follows a member of a namespace import', async () => {
    const files = {
      'src/lib/page/index.ts': "export { default as Title } from './title.svelte';",
      'src/lib/page/title.svelte': '<h1>t</h1>'
    };
    expect((await filesOf(`import * as Page from '$lib/page';`, 'Page.Title', files)).files).toEqual([
      'src/lib/page/title.svelte'
    ]);
  });

  it('ends an export * cycle and a barrel that does not parse without resolving', async () => {
    const files = {
      'src/lib/a.ts': "export * from './b';",
      'src/lib/b.ts': "export * from './a';",
      'src/lib/broken.ts': 'export { from'
    };
    expect(await filesOf(`import { X } from '$lib/a';`, 'X', files)).toEqual({ files: [], complete: false });
    expect(await filesOf(`import { X } from '$lib/broken';`, 'X', files)).toEqual({ files: [], complete: false });
  });

  it('visits each barrel state once in branching export * cycles', async () => {
    const files = {
      'src/lib/a.ts': "export * from './b';\nexport * from './c';",
      'src/lib/b.ts': "export * from './a';\nexport * from './c';",
      'src/lib/c.ts': "export * from './a';\nexport * from './b';"
    };
    const entry = 'src/routes/+page.svelte';
    const source = `<script>import { X } from '$lib/a';</script><X />`;
    const rt = createMemoryRuntime({ ...files, [entry]: source });
    let probes = 0;
    const counted = { ...rt, exists: (p: string) => (probes++, rt.exists(p)) };
    const r = await resolveComponentFiles(
      { rt: counted, cwd: '', cache: new Map(), aliases: undefined },
      'X',
      parseFile(source, entry),
      entry
    );
    expect(r).toEqual({ files: [], complete: false });
    // 3 modules × 9 hop depths, ≤ 5 probes each; unmemoised this is 2^9 visits.
    expect(probes).toBeLessThanOrEqual(3 * 9 * 5);
  });

  it('resolves through a declared alias, first match by position ($lib before $li)', async () => {
    const aliases: KitAlias[] = [
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '$li', replacement: 'src/li', match: 'prefix' }
    ];
    const files = { 'src/lib/Foo.svelte': '', 'src/li/Foo.svelte': '' };
    expect((await filesOf(`import F from '$lib/Foo.svelte';`, 'F', files, aliases)).files).toEqual([
      'src/lib/Foo.svelte'
    ]);
    expect((await filesOf(`import F from '$li/Foo.svelte';`, 'F', files, aliases)).files).toEqual([
      'src/li/Foo.svelte'
    ]);
  });
});

describe('resolveFileTags through barrels, namespaces and runtime-chosen components', () => {
  const lib = {
    'src/lib/index.ts': `export { default as Seo } from './Seo.svelte';\nexport { default as Other } from './Other.svelte';`,
    'src/lib/Seo.svelte': `<svelte:head><title>Seo</title></svelte:head><h1>Seo</h1>`,
    'src/lib/Other.svelte': `<svelte:head><title>Other</title></svelte:head><h1>Other</h1>`
  };
  const page = (script: string, body: string) => ({
    ...lib,
    'src/routes/+page.svelte': `<script>${script}</script>${body}`
  });

  it('follows a barrel re-export and a namespace member', async () => {
    for (const files of [
      page(`import { Seo } from '$lib';`, '<Seo />'),
      page(`import * as Ui from '$lib';`, '<Ui.Seo />')
    ]) {
      const r = await resolveWith(files, 'src/routes/+page.svelte');
      expect(r.tags).toEqual([{ kind: 'title', text: 'Seo', value: 'static' }]);
      expect(r.headings).toEqual([{ level: 1, line: 1, file: 'src/lib/Seo.svelte' }]);
    }
  });

  it('follows a component held by a $derived or a {@const}, or passed to <svelte:component>', async () => {
    for (const files of [
      page(`import { Seo } from '$lib'; const C = $derived(Seo);`, '<C />'),
      page(`import { Seo } from '$lib';`, '<svelte:boundary>{@const C = Seo}<C /></svelte:boundary>'),
      page(`import { Seo } from '$lib';`, '<svelte:component this={Seo} />'),
      page(`import * as Ui from '$lib';`, '<svelte:component this={Ui.Seo} />')
    ]) {
      const r = await resolveWith(files, 'src/routes/+page.svelte');
      expect(r.tags).toEqual([{ kind: 'title', text: 'Seo', value: 'static' }]);
      expect(r.headings).toHaveLength(1);
    }
  });

  it('reads one of several candidates as rendering its tags dynamically and its <h1> as possible', async () => {
    const r = await resolveWith(
      page(`import { Seo, Other } from '$lib'; const C = $derived(x ? Seo : Other);`, '<C />'),
      'src/routes/+page.svelte'
    );
    expect(r.tags).toEqual([{ kind: 'title', value: 'dynamic' }]);
    expect(r.headings).toEqual([]);
    expect(r.dynamicHeading).toBe(true);
  });

  it('reads a {@const} name bound to a different component per arm as one of several', async () => {
    const r = await resolveWith(
      page(`import { Seo, Other } from '$lib';`, '{#if x}{@const C = Seo}<C />{:else}{@const C = Other}<C />{/if}'),
      'src/routes/+page.svelte'
    );
    // One dynamic title per `<C />`, never Other's static one.
    expect(r.tags).toEqual([
      { kind: 'title', value: 'dynamic' },
      { kind: 'title', value: 'dynamic' }
    ]);
    expect(r.headings).toEqual([]);
    expect(r.dynamicHeading).toBe(true);
  });

  it('reads a candidate that may render nothing the same way', async () => {
    const r = await resolveWith(
      page(`import { Seo } from '$lib'; let { prop } = $props(); const C = $derived(prop ?? Seo);`, '<C />'),
      'src/routes/+page.svelte'
    );
    expect(r.tags).toEqual([{ kind: 'title', value: 'dynamic' }]);
    expect(r.dynamicHeading).toBe(true);
  });
});

describe('resolveFileTags transitive (layer 3)', () => {
  it('pulls a title from a custom wrapper component', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import Seo from '$lib/Seo.svelte';</script><Seo />`,
        'src/lib/Seo.svelte': `<svelte:head><title>{data.title}</title></svelte:head>`
      },
      'src/routes/+page.svelte'
    );
    expect(r.tags).toContainEqual({ kind: 'title', value: 'dynamic' });
  });

  it('resolves a wrapper imported without the .svelte extension', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import Seo from '$lib/Seo';</script><Seo />`,
        'src/lib/Seo.svelte': `<svelte:head><title>About</title></svelte:head>`
      },
      'src/routes/+page.svelte'
    );
    expect(r.tags).toContainEqual({ kind: 'title', text: 'About', value: 'static' });
  });

  it('stops on cycles without infinite recursion', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
        'src/lib/A.svelte': `<script>import B from '$lib/B.svelte';</script><B />`,
        'src/lib/B.svelte': `<script>import A from '$lib/A.svelte';</script><A />`
      },
      'src/routes/+page.svelte'
    );
    expect(r.tags.some((t) => t.kind === 'title')).toBe(false);
  });

  it('stops at the depth limit', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
        'src/lib/A.svelte': `<script>import B from '$lib/B.svelte';</script><B />`,
        'src/lib/B.svelte': `<svelte:head><title>deep</title></svelte:head>`
      },
      'src/routes/+page.svelte'
    );
    // depth 5 is enough to reach B here; assert it resolves.
    expect(r.tags).toContainEqual({ kind: 'title', text: 'deep', value: 'static' });
  });
});

describe('resolveFileTags transitive headings (layer 3, issue #425)', () => {
  it('collects an <h1> rendered by a directly imported child component', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import SiteHeader from '$lib/SiteHeader.svelte';</script><SiteHeader />`,
        'src/lib/SiteHeader.svelte': `<h1>Welcome</h1>`
      },
      'src/routes/+page.svelte'
    );
    expect(r.headings).toEqual([{ level: 1, line: expect.any(Number), file: 'src/lib/SiteHeader.svelte' }]);
  });

  it('collects a heading at grandchild depth (page -> A -> B)', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
        'src/lib/A.svelte': `<script>import B from '$lib/B.svelte';</script><B />`,
        'src/lib/B.svelte': `<h1>Deep</h1>`
      },
      'src/routes/+page.svelte'
    );
    expect(r.headings).toEqual([{ level: 1, line: expect.any(Number), file: 'src/lib/B.svelte' }]);
  });

  it('stops on cycles without infinite recursion', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
        'src/lib/A.svelte': `<script>import B from '$lib/B.svelte';</script><B /><h2>A</h2>`,
        'src/lib/B.svelte': `<script>import A from '$lib/A.svelte';</script><A /><h3>B</h3>`
      },
      'src/routes/+page.svelte'
    );
    // A and B are each reached once and contribute their own heading; the second A
    // (reached via B -> A) is already visited and stops before re-entering, so no
    // infinite recursion and no duplicate <h2>.
    expect(r.headings).toEqual([
      { level: 2, line: expect.any(Number), file: 'src/lib/A.svelte' },
      { level: 3, line: expect.any(Number), file: 'src/lib/B.svelte' }
    ]);
  });
});

describe('resolveFileTags transitive with kit.alias (2608-TEST-05)', () => {
  const ALIASES: KitAlias[] = [
    { find: '$lib', replacement: 'src/lib', match: 'prefix' },
    { find: '$components', replacement: 'src/components', match: 'prefix' }
  ];

  it('follows a component imported through a declared alias', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import Seo from '$components/Seo.svelte';</script><Seo />`,
        'src/components/Seo.svelte': `<svelte:head><title>Aliased</title></svelte:head>`
      },
      'src/routes/+page.svelte',
      ALIASES
    );
    expect(r.tags).toContainEqual({ kind: 'title', text: 'Aliased', value: 'static' });
  });

  it('follows an aliased import at grandchild depth (page -> $lib child -> aliased grandchild)', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
        'src/lib/A.svelte': `<script>import B from '$components/B.svelte';</script><B />`,
        'src/components/B.svelte': `<svelte:head><title>Deep aliased</title></svelte:head><h1>Deep</h1>`
      },
      'src/routes/+page.svelte',
      ALIASES
    );
    expect(r.tags).toContainEqual({ kind: 'title', text: 'Deep aliased', value: 'static' });
    expect(r.headings).toEqual([{ level: 1, line: expect.any(Number), file: 'src/components/B.svelte' }]);
  });

  it('an alias whose target does not exist is skipped silently, same as an unresolvable $lib guess', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import Missing from '$components/Missing.svelte';</script><Missing />`
        // src/components/Missing.svelte deliberately absent.
      },
      'src/routes/+page.svelte',
      ALIASES
    );
    expect(r.tags).toEqual([]);
    expect(r.headings).toEqual([]);
  });

  it("counts an aliased child's <h1> in the componentHeadings channel (issue #425 class)", async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import Header from '$components/Header.svelte';</script><Header />`,
        'src/components/Header.svelte': `<h1>From alias</h1>`
      },
      'src/routes/+page.svelte',
      ALIASES
    );
    expect(r.headings).toEqual([{ level: 1, line: expect.any(Number), file: 'src/components/Header.svelte' }]);
  });
});

describe('resolveFileTags: components rendered into <svelte:head>', () => {
  const meta = (script: string, markup = '<meta {name} {property} content={text} />') => ({
    'src/lib/Meta.svelte': `<script>${script}</script>${markup}`
  });
  const runes = 'let { name = undefined, property = undefined, text } = $props();';
  const layout = (head: string, files: Record<string, string>) =>
    resolveWith(
      {
        ...files,
        'src/routes/+layout.svelte': `<script>import Meta from '$lib/Meta.svelte';</script><svelte:head>${head}</svelte:head>`
      },
      'src/routes/+layout.svelte'
    );

  it("reads a head-rendered component's markup, binding bare props to the call site's literals", async () => {
    const r = await layout('<Meta name="description" text={t} /><Meta property="og:title" text="Home" />', meta(runes));
    expect(r.tags).toEqual([
      { kind: 'meta', name: 'description', value: 'dynamic' },
      { kind: 'meta', property: 'og:title', value: 'static' }
    ]);
  });

  it('binds `attr={prop}`, a renamed prop, a legacy `export let` and a literal content', async () => {
    const shapes = [
      meta('let { name: n } = $props();', '<meta name={n} content="Home page" />'),
      meta('export let name;', '<meta name="{name}" content="Home page" />')
    ];
    for (const files of shapes) {
      const r = await layout('<Meta name="description" />', files);
      expect(r.tags).toEqual([{ kind: 'meta', name: 'description', value: 'static', text: 'Home page' }]);
    }
  });

  it('leaves a prop dynamic when the call site passes an expression, nothing, or a spread', async () => {
    for (const call of ['<Meta name={kind} />', '<Meta />', '<Meta name="description" {...rest} />']) {
      const r = await layout(call, meta(runes));
      expect(r.tags).toEqual([{ kind: 'meta', value: 'dynamic' }]);
    }
  });

  it("threads a head-rendered component's props into the components it renders", async () => {
    const r = await resolveWith(
      {
        ...meta(runes),
        'src/lib/Seo.svelte': `<script>import Meta from './Meta.svelte'; let { kind } = $props();</script><Meta name={kind} />`,
        'src/routes/+layout.svelte': `<script>import Seo from '$lib/Seo.svelte';</script><svelte:head><Seo kind="description" /></svelte:head>`
      },
      'src/routes/+layout.svelte'
    );
    expect(r.tags).toEqual([{ kind: 'meta', name: 'description', value: 'dynamic' }]);
  });

  it('ignores a component rendered in the body, whose markup never reaches the head', async () => {
    const r = await resolveWith(
      {
        ...meta(runes),
        'src/routes/+page.svelte': `<script>import Meta from '$lib/Meta.svelte';</script><Meta name="description" />`
      },
      'src/routes/+page.svelte'
    );
    expect(r.tags).toEqual([]);
  });
});

describe('resolveFileTags: components in an {#if}/{#each}/{#await} arm', () => {
  const files = (body: string) => ({
    'src/lib/Modal.svelte': `<svelte:head><title>Forgot Password</title><meta name="description" content="Reset" /></svelte:head><h1>Reset</h1>`,
    'src/routes/+layout.svelte': `<script>import Modal from '$lib/Modal.svelte';</script>${body}`
  });

  it('reads the head tags of a component that may not render as dynamic, but still counts its heading', async () => {
    for (const body of [
      "{#if type === 'login'}<p>login</p>{:else if type === 'forgot'}<Modal />{/if}",
      '{#each items as item}<Modal />{/each}',
      '{#await p then v}<Modal />{/await}',
      '<svelte:head>{#if open}<Modal />{/if}</svelte:head>'
    ]) {
      const r = await resolveWith(files(body), 'src/routes/+layout.svelte');
      expect(r.tags).toEqual([
        { kind: 'title', value: 'dynamic' },
        { kind: 'meta', name: 'description', value: 'dynamic' }
      ]);
      expect(r.headings).toEqual([{ level: 1, line: 1, file: 'src/lib/Modal.svelte' }]);
    }
  });

  it('keeps the literal of a component that always renders', async () => {
    const r = await resolveWith(files('{#key k}<Modal />{/key}'), 'src/routes/+layout.svelte');
    expect(r.tags).toContainEqual({ kind: 'title', text: 'Forgot Password', value: 'static' });
  });
});
