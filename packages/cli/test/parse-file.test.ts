import { describe, it, expect } from 'vitest';
import { parseFile } from '../src/providers/source/parse.js';

describe('parseFile', () => {
  it('returns head tags, component usages, and imports', () => {
    const pf = parseFile(
      `<script>import { MetaTags } from 'svelte-meta-tags';</script>` +
        `<svelte:head><title>About</title></svelte:head>` +
        `<MetaTags title={data.title} {...rest} /><div>x</div>`,
      'src/routes/+page.svelte'
    );
    expect(pf.headTags).toEqual([{ kind: 'title', value: 'static' }]);
    expect(pf.imports.get('MetaTags')?.source).toBe('svelte-meta-tags');
    expect(pf.components).toHaveLength(1);
    expect(pf.components[0]!.name).toBe('MetaTags');
    expect(pf.components[0]!.hasSpread).toBe(true);
  });

  it('does not treat regular HTML elements as components', () => {
    const pf = parseFile('<div><p>x</p></div>', 'x.svelte');
    expect(pf.components).toHaveLength(0);
  });
});
