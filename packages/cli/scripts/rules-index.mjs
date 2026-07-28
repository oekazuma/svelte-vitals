// Renders the generated blocks of the docs site's rule index pages.
// Pure: no core import, no writes — `gen-rules-index.mjs` injects the rules and does the I/O.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// MDX (via @mdx-js/mdx, which Astro's MDX integration uses) does not support raw HTML
// comments anywhere in a `.mdx` file — `<!-- ... -->` fails to compile with "Unexpected
// character `!`". JS-style MDX comments are the documented replacement.
export const START_MARKER = '{/* rules-index:start */}';
export const END_MARKER = '{/* rules-index:end */}';

// Must track `docs/blume.config.ts`'s `i18n.locales` — adding a locale there without adding
// it here silently leaves it un-indexed. A new locale also needs TABLE_HEADER, RULE_COUNT,
// and CATEGORY_BLURB entries.
export const LOCALES = ['en', 'ja'];

/** Same glyphs the console reporter and the CI job summary use. */
const SEVERITY_GLYPH = { critical: '🔴', warning: '🟡', info: '🔵' };

/** Category names stay English in both locales — they are the values the CLI reports. */
const CATEGORY_LABEL = {
  seo: 'SEO',
  performance: 'Performance',
  correctness: 'Correctness',
  security: 'Security',
  architecture: 'Architecture'
};

const CATEGORY_ICON = {
  seo: 'search',
  performance: 'zap',
  correctness: 'circle-check',
  security: 'shield',
  architecture: 'layers'
};

// The one place these blurbs live: core has no localized prose, and duplicating them
// across the top-level page and the five category pages would let the two drift.
const CATEGORY_BLURB = {
  en: {
    seo: 'Resolved <head> metadata, structured data, and crawlability — what search engines actually see.',
    performance: 'Images, render-blocking assets, imports, and load waterfalls — what makes a route slow.',
    correctness: 'Svelte 5 runes and lifecycle misuse — code that compiles but behaves wrong.',
    security: 'Unescaped HTML, unsafe URLs, and server state that leaks across requests.',
    architecture: 'Component size and prop surface — signals that a component is doing too much.'
  },
  ja: {
    seo: '検索エンジンが実際に目にするもの。解決後の <head> メタデータ、構造化データ、クロールのしやすさを見ます。',
    performance:
      'ルートが遅くなる原因。画像、レンダリングを妨げるアセット、import、読み込みのウォーターフォールを見ます。',
    correctness: 'コンパイルは通るのに、思ったとおりに動かないコード。runes とライフサイクルの使い方を見ます。',
    security: 'エスケープされない HTML、安全でない URL、サーバーでリクエストをまたいで漏れる状態を見ます。',
    architecture: 'コンポーネントが抱えすぎているサイン。大きさと props の数を見ます。'
  }
};

const TABLE_HEADER = {
  en: ['Rule', 'Severity', 'Summary'],
  ja: ['ルール', '重大度', '概要']
};

const RULE_COUNT = {
  en: (n) => `(${n} rule${n === 1 ? '' : 's'})`,
  ja: (n) => `（${n} 件のルール）`
};

/** Content directory holding a locale's rule pages. */
export function localeDir(docsRoot, locale) {
  return locale === 'en' ? join(docsRoot, 'rules') : join(docsRoot, locale, 'rules');
}

/** Site-root-relative href for a rule id or a category slug. */
export function localeHref(locale, path) {
  return locale === 'en' ? `/rules/${path}` : `/${locale}/rules/${path}`;
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'"))
    return trimmed.slice(1, -1).replaceAll("''", "'");
  return trimmed;
}

/** Minimal YAML reader for the flat `key: value` frontmatter every rule page uses. */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) throw new Error('missing frontmatter');
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([a-zA-Z]+): (.*)$/.exec(line);
    if (field) fields[field[1]] = unquote(field[2]);
  }
  return fields;
}

/** `<` and `{` are JSX syntax in MDX; summaries contain both (`<title>`, `{#each}`). */
export function escapeMdx(text) {
  return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('{', '&#123;').replaceAll('}', '&#125;');
}

export function escapeCell(text) {
  return escapeMdx(text).replaceAll('|', '\\|');
}

/** Summary column: each locale's own rule page frontmatter, so ja stays Japanese. */
export function readSummaries(docsRoot, locale, rules) {
  const dir = localeDir(docsRoot, locale);
  const summaries = new Map();
  for (const rule of rules) {
    const file = join(dir, `${rule.id}.md`);
    let fields;
    try {
      fields = parseFrontmatter(readFileSync(file, 'utf8'));
    } catch (cause) {
      throw new Error(`${file}: ${cause.message}`, { cause });
    }
    const { description } = fields;
    if (!description) throw new Error(`${file}: frontmatter has no description`);
    summaries.set(rule.id, description);
  }
  return summaries;
}

/** Most severe first, so a table can be read top-down in the order findings matter. */
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };

function bySeverityThenId(a, b) {
  const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (rank !== 0) return rank;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function categoryBlurb(locale, category) {
  const blurb = CATEGORY_BLURB[locale][category];
  if (!blurb) throw new Error(`unknown category ${category}`);
  return blurb;
}

export function renderTable(locale, rules, summaries) {
  const header = TABLE_HEADER[locale];
  // Validate before sorting: an unknown severity would make the comparator return NaN,
  // which silently mis-orders the table instead of failing.
  for (const rule of rules)
    if (!SEVERITY_GLYPH[rule.severity]) throw new Error(`${rule.id}: unknown severity ${rule.severity}`);

  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const rule of [...rules].sort(bySeverityThenId)) {
    const severity = `${SEVERITY_GLYPH[rule.severity]} ${rule.severity}`;
    const summary = escapeCell(summaries.get(rule.id));
    lines.push(`| [\`${rule.id}\`](${localeHref(locale, rule.id)}) | ${severity} | ${summary} |`);
  }
  return lines.join('\n');
}

export function renderCategoryPage(locale, category, rules, summaries) {
  const inCategory = rules.filter((rule) => rule.category === category);
  return [escapeMdx(categoryBlurb(locale, category)), '', renderTable(locale, inCategory, summaries)].join('\n');
}

/** Japanese does not put an ASCII space before a full-width `（` — only en gets a joining space. */
function withRuleCount(locale, blurb, count) {
  const suffix = RULE_COUNT[locale](count);
  return locale === 'ja' ? `${blurb}${suffix}` : `${blurb} ${suffix}`;
}

export function renderRulesPage(locale, categories, rules, summaries) {
  const lines = ['<CardGroup cols={2}>'];
  for (const category of categories) {
    const count = rules.filter((rule) => rule.category === category).length;
    lines.push(
      `  <Card title="${CATEGORY_LABEL[category]}" icon="${CATEGORY_ICON[category]}" href="${localeHref(locale, category)}">`,
      `    ${withRuleCount(locale, escapeMdx(categoryBlurb(locale, category)), count)}`,
      '  </Card>'
    );
  }
  lines.push('</CardGroup>');

  for (const category of categories) {
    const inCategory = rules.filter((rule) => rule.category === category);
    lines.push('', `## ${CATEGORY_LABEL[category]}`, '', renderTable(locale, inCategory, summaries));
  }
  return lines.join('\n');
}

/** Absolute file path → generated block, for every index page in every locale. */
export function renderAll(docsRoot, categories, rules) {
  const blocks = new Map();
  for (const locale of LOCALES) {
    const summaries = readSummaries(docsRoot, locale, rules);
    const dir = localeDir(docsRoot, locale);
    blocks.set(join(dir, 'index.mdx'), renderRulesPage(locale, categories, rules, summaries));
    for (const category of categories)
      blocks.set(join(dir, category, 'index.mdx'), renderCategoryPage(locale, category, rules, summaries));
  }
  return blocks;
}

function markerBounds(fileText) {
  const start = fileText.indexOf(START_MARKER);
  const end = fileText.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) throw new Error(`missing ${START_MARKER} / ${END_MARKER} marker pair`);
  return { start, end };
}

export function replaceBlock(fileText, block) {
  const { start, end } = markerBounds(fileText);
  return `${fileText.slice(0, start)}${START_MARKER}\n\n${block}\n\n${fileText.slice(end)}`;
}

export function extractBlock(fileText) {
  const { start, end } = markerBounds(fileText);
  return fileText.slice(start + START_MARKER.length, end).trim();
}

/**
 * Comparable form of a block. oxfmt pads table cells, re-wraps prose at printWidth, and
 * backslash-escapes markdown-special characters (e.g. a bare `*` becomes `\*`) — so committed
 * text never matches generated text byte-for-byte — compare through this. Every table row still
 * survives as its own line and every table still contributes its header row, so severity,
 * summary, link-locale, and membership drift are all still caught.
 */
export function normalizeBlock(block) {
  const prose = [];
  const rows = [];
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('|')) {
      const cells = trimmed
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split(/(?<!\\)\|/)
        .map((cell) => cell.trim());
      if (cells.every((cell) => /^-+$/.test(cell))) continue; // alignment row
      rows.push(`|${cells.join('|')}|`);
    } else prose.push(trimmed);
  }
  return [prose.join(' ').replace(/\s+/g, ' '), ...rows].join('\n').replace(/\\([^A-Za-z0-9|])/g, '$1');
}

/** Rule ids linked from a block, in the order they appear. */
export function parseRuleIds(block) {
  return [...block.matchAll(/\[`([^`]+)`\]\(/g)].map((match) => match[1]);
}
