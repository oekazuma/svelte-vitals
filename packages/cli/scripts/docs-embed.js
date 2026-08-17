// Generator + staleness pair for packages/cli/docs/, mirroring scripts/rules-index.js.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));

export const DOCS_DIR = join(scriptsDir, '..', 'docs');
export const GENERATED_PATH = join(scriptsDir, '..', 'src', 'docs', 'generated.ts');

/** Every key a topic's frontmatter may carry, and must carry. */
export const FRONTMATTER_KEYS = ['title', 'description'];

/** Strict: an unknown, duplicate, empty or quoted value throws — a bad topic must not ship silently. */
export function parseTopic(fileName, raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error(`${fileName}: missing --- frontmatter block`);
  const [, front, body] = match;

  const seen = new Map();
  for (const line of front.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`${fileName}: frontmatter line is not \`key: value\`: ${line}`);
    const [, key, value] = kv;
    if (!FRONTMATTER_KEYS.includes(key)) {
      throw new Error(`${fileName}: unknown frontmatter key \`${key}\`; expected ${FRONTMATTER_KEYS.join(', ')}`);
    }
    if (seen.has(key)) throw new Error(`${fileName}: duplicate frontmatter key \`${key}\``);
    if (value.trim() === '') throw new Error(`${fileName}: frontmatter \`${key}\` is empty`);
    // rules-index.js unquotes; this keeps values verbatim, so quotes would reach `docs list`.
    if (/^['"].*['"]$/.test(value.trim())) {
      throw new Error(`${fileName}: frontmatter \`${key}\` must not be quoted`);
    }
    seen.set(key, value.trim());
  }
  for (const key of FRONTMATTER_KEYS) {
    if (!seen.has(key)) throw new Error(`${fileName}: frontmatter has no \`${key}\``);
  }

  return {
    name: fileName.replace(/\.md$/, ''),
    title: seen.get('title'),
    description: seen.get('description'),
    body: body.trim()
  };
}

/** Ordered by filename, so the listing and the module are deterministic. */
export function readTopics(dir = DOCS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => parseTopic(f, readFileSync(join(dir, f), 'utf8')));
}

/** Render the committed TypeScript module. */
export function renderModule(topics) {
  return `// Generated from packages/cli/docs/*.md by \`pnpm --filter svelte-vitals run gen:docs\`.
// Edit the markdown, not this file — test/docs-embed.test.ts fails on drift.

/** One \`svelte-vitals docs show <name>\` topic. */
export interface EmbeddedDoc {
  /** Filename stem — the \`<name>\` argument. */
  name: string;
  title: string;
  description: string;
  /** Markdown body, frontmatter stripped. */
  body: string;
}

export const EMBEDDED_DOCS: EmbeddedDoc[] = ${JSON.stringify(topics, null, 2)};
`;
}
