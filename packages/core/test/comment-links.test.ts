import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const links = (src: string) =>
  parseComponentFacts(src, 'src/lib/A/A.svelte').commentLinks.map((l) => `${l.line}:${l.url}`);

describe('markdown links in comments', () => {
  it('reads line comments in scripts and markup comments outside them, and nothing else', () => {
    const src = [
      '<script>',
      "  const md = '[a](https://a.test)';",
      '  // [b](https://b.test)',
      '// [c](https://c.test)',
      '</script>',
      '<!-- [d](https://d.test) --> [e](https://e.test)',
      '[f](https://f.test) <!-- g -->',
      '<style>',
      "  a::before { content: 'x\\",
      "// [h](https://h.test)'; }",
      "  a::after { content: '<!-- [i](https://i.test) -->'; }",
      '</style>',
      '<!-- [j](https://j.test) -->'
    ].join('\n');
    expect(links(src)).toEqual(['3:https://b.test', '4:https://c.test', '6:https://d.test', '13:https://j.test']);
  });

  it('closes a script or style block opened and closed on one line', () => {
    const src = [
      '<script>const one = 1;</script>',
      '<!-- [k](https://k.test) -->',
      '<style>a { color: red; }</style>',
      '<!-- [l](https://l.test) -->'
    ].join('\n');
    expect(links(src)).toEqual(['2:https://k.test', '4:https://l.test']);
  });
});
