import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const facts = (src: string) => parseComponentFacts(src, 'src/lib/C.svelte');
const moduleFacts = (src: string) => parseComponentFacts(src, 'src/lib/x.svelte.ts');

describe('attribute-level facts', () => {
  it('reads javascript: URLs and root-relative links from elements only, at the attribute line', () => {
    const src =
      '<Link href="javascript:alert(1)" />\n<a\n  href="javascript:void(0)">x</a>\n<Link href="/x" />\n<a\n  href="/y">y</a>';
    const f = facts(src);
    expect([f.javascriptUrls.map((s) => s.line), f.basePathLinks.map((l) => l.line)]).toEqual([[3], [6]]);
  });

  it('records a checkable bind:value at the directive line', () => {
    expect(facts('<input\n  type="checkbox"\n  bind:value={v} />').checkableBindValues).toEqual([
      { kind: 'checkbox', line: 3 }
    ]);
  });

  it('classifies a quoted lone expression as an expression, not literal text', () => {
    expect(facts('<div role="button" aria-label="{label}"></div>').ariaElements[0]!.aria).toEqual([
      { name: 'aria-label', line: 1, expression: true }
    ]);
  });

  it('carries the literal role of a container', () => {
    expect(facts('<div class="x" role="button" tabindex="0"><a href="/y">y</a></div>').interactiveNestings).toEqual([
      { containerTag: 'div', containerRole: 'button', descendantTag: 'a', line: 1 }
    ]);
  });
});

describe('accessible names', () => {
  it('takes a blank alt as no name and aria-labelledby as a name', () => {
    const src =
      '<button><img alt="" /></button>\n<button><img alt=" " /></button>\n<button aria-labelledby="lbl"></button>';
    expect(facts(src).unnamedInteractive.map((u) => u.line)).toEqual([1, 2]);
  });
});

describe('file-level facts', () => {
  it('counts no lines in an empty component', () => {
    expect(facts('').loc).toBe(0);
  });

  it('takes a dotted package name as bare and a re-export as no import', () => {
    const f = moduleFacts("import * as M from 'lodash.merge';\nexport { a } from './b';\nconst f = M[k];");
    expect([f.namespaceImports, f.imports]).toEqual([[{ source: 'lodash.merge', line: 1 }], ['lodash.merge']]);
  });
});
