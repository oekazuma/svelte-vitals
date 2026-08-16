import { describe, it, expect } from 'vitest';
import { defaultConfig, seoTitlePresence, seoSingleH1 } from '@svelte-vitals/core/internal';
import { collectAll } from '../src/collect-all.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

/**
 * Mirrors kit-alias-e2e.test.ts's structure, for the transitive <head>/heading resolution
 * path (`resolveComponentPath`, issue class #425/2608-TEST-05) instead of the kit-module
 * path that test already covers.
 */
const JSONLD = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Aliased"}</script>`;

const TREE = (config: string) => ({
  'src/app.html': `<!doctype html><html lang="en"><body></body></html>`,
  'svelte.config.js': config,
  'src/routes/+page.svelte': `<script>\n  import Seo from '$components/Seo.svelte';\n</script>\n<Seo />\n`,
  'src/components/Seo.svelte': `<svelte:head><title>Aliased title</title>\n  ${JSONLD}\n</svelte:head>\n<h1>Aliased heading</h1>\n`
});

const findings = async (config: string) => {
  const facts = await collectAll(createMemoryRuntime(TREE(config)), '', defaultConfig);
  const titleResults = await seoTitlePresence.check({
    heads: facts.heads,
    project: facts.project,
    config: defaultConfig
  });
  const h1Results = await seoSingleH1.check({
    heads: facts.heads,
    headings: facts.headings,
    project: facts.project,
    config: defaultConfig
  });
  return { heads: facts.heads, titleResults, h1Results };
};

describe('kit.alias resolution in transitive <head>/heading resolution, end to end', () => {
  it('follows a component imported through a declared svelte.config alias', async () => {
    const { heads, titleResults, h1Results } = await findings(
      `export default { kit: { alias: { '$components': 'src/components' } } };`
    );

    expect(titleResults[0]!.detection).toEqual({ presence: 'own', value: 'static' });
    expect(titleResults[0]!.message).toBe('<title>');

    expect(h1Results[0]!.message).toBe('Heading hierarchy');
    expect(h1Results[0]!.location).toBe('src/components/Seo.svelte');

    expect(heads[0]!.tags.some((t) => t.kind === 'jsonld')).toBe(true);
  });

  it('reports Missing for the same tree when the alias is not declared (negative control)', async () => {
    // The negative control: without the alias declared, resolveComponentPath cannot
    // map `$components/Seo.svelte` to a file, so the child is never followed and its
    // <title>/<h1>/jsonld stay invisible — this is today's (and every un-configured
    // project's) behavior, pinned so the assertions above are proven to come from alias
    // resolution and not from something else.
    const { heads, titleResults, h1Results } = await findings(`export default { kit: {} };`);

    expect(titleResults[0]!.detection).toEqual({ presence: 'none', value: 'absent' });
    expect(titleResults[0]!.message).toBe('Missing <title>');

    expect(h1Results[0]!.message).toBe('Missing <h1>');

    expect(heads[0]!.tags.some((t) => t.kind === 'jsonld')).toBe(false);
  });
});
