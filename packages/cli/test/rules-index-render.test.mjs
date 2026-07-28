import { describe, it, expect } from 'vitest';
import {
  END_MARKER,
  START_MARKER,
  escapeCell,
  escapeMdx,
  extractBlock,
  localeHref,
  normalizeBlock,
  parseFrontmatter,
  parseRuleIds,
  renderTable,
  replaceBlock
} from '../scripts/rules-index.mjs';

const RULES = [
  { id: 'seo/title-presence', category: 'seo', severity: 'critical' },
  { id: 'seo/charset', category: 'seo', severity: 'warning' }
];

const SUMMARIES = new Map([
  ['seo/title-presence', 'Every route should resolve a non-empty <title>.'],
  ['seo/charset', 'Declare {charset}, not a | pipe.']
]);

describe('parseFrontmatter', () => {
  it('reads an unquoted description', () => {
    const text = '---\ntitle: seo/charset · Character encoding\ndescription: Declare a charset.\n---\n\nBody.';
    expect(parseFrontmatter(text)).toEqual({
      title: 'seo/charset · Character encoding',
      description: 'Declare a charset.'
    });
  });

  it('unwraps a single-quoted description and unescapes doubled quotes', () => {
    const text = "---\ntitle: T\ndescription: 'Sanitize it — {@html} renders unescaped HTML. It''s unsafe.'\n---\n";
    expect(parseFrontmatter(text).description).toBe("Sanitize it — {@html} renders unescaped HTML. It's unsafe.");
  });

  it('throws when the file has no frontmatter', () => {
    expect(() => parseFrontmatter('# Just a heading\n')).toThrow(/frontmatter/);
  });
});

describe('escaping', () => {
  it('escapes MDX-significant characters', () => {
    expect(escapeMdx('a <title> and {expr}')).toBe('a &lt;title&gt; and &#123;expr&#125;');
  });

  it('also escapes table pipes in a cell', () => {
    expect(escapeCell('a | b')).toBe('a \\| b');
  });

  it('leaves plain text untouched', () => {
    expect(escapeMdx('Every route should have a canonical URL.')).toBe('Every route should have a canonical URL.');
  });
});

describe('localeHref', () => {
  it('uses a bare path for en', () => {
    expect(localeHref('en', 'seo/charset')).toBe('/rules/seo/charset');
  });

  it('prefixes the locale otherwise', () => {
    expect(localeHref('ja', 'seo/charset')).toBe('/ja/rules/seo/charset');
  });
});

describe('renderTable', () => {
  it('sorts rows by rule id and renders link, severity glyph, and escaped summary', () => {
    expect(renderTable('en', RULES, SUMMARIES)).toBe(
      [
        '| Rule | Severity | Summary |',
        '| --- | --- | --- |',
        '| [`seo/charset`](/rules/seo/charset) | 🟡 warning | Declare &#123;charset&#125;, not a \\| pipe. |',
        '| [`seo/title-presence`](/rules/seo/title-presence) | 🔴 critical | Every route should resolve a non-empty &lt;title&gt;. |'
      ].join('\n')
    );
  });

  it('uses the ja header labels and link prefix', () => {
    const lines = renderTable('ja', RULES, SUMMARIES).split('\n');
    expect(lines[0]).toBe('| ルール | 重大度 | 概要 |');
    expect(lines[2]).toContain('](/ja/rules/seo/charset)');
  });
});

describe('normalizeBlock', () => {
  it('ignores table padding and prose re-wrapping', () => {
    const generated = [
      'Intro sentence that oxfmt will wrap.',
      '',
      '| Rule | Severity |',
      '| --- | --- |',
      '| a | b |'
    ].join('\n');
    const formatted = [
      'Intro sentence that oxfmt',
      'will wrap.',
      '',
      '| Rule | Severity |',
      '| ---- | -------- |',
      '| a    | b        |'
    ].join('\n');
    expect(normalizeBlock(formatted)).toBe(normalizeBlock(generated));
  });

  it('still sees a changed cell', () => {
    expect(normalizeBlock('| a | b |')).not.toBe(normalizeBlock('| a | c |'));
  });
});

describe('parseRuleIds', () => {
  it('collects the rule ids linked from a block', () => {
    expect(parseRuleIds(renderTable('en', RULES, SUMMARIES))).toEqual(['seo/charset', 'seo/title-presence']);
  });
});

describe('replaceBlock / extractBlock', () => {
  const file = `---\ntitle: T\n---\n\nIntro.\n\n${START_MARKER}\n${END_MARKER}\n\nFooter.\n`;

  it('replaces only the marker region', () => {
    const out = replaceBlock(file, 'GENERATED');
    expect(out).toContain('Intro.');
    expect(out).toContain('Footer.');
    expect(out).toContain(`${START_MARKER}\n\nGENERATED\n\n${END_MARKER}`);
  });

  it('round-trips through extractBlock', () => {
    expect(extractBlock(replaceBlock(file, 'GENERATED'))).toBe('GENERATED');
  });

  it('throws when the markers are missing', () => {
    expect(() => replaceBlock('no markers here', 'GENERATED')).toThrow(/marker/);
  });
});
