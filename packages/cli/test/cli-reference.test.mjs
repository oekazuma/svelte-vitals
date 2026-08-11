import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
// Straight from TypeScript source, not dist: vitest's transform resolves the `.js`→`.ts`
// specifiers these files use internally, which plain `node` (scripts/gen-cli-reference.mjs) can't
// — see gunshi/registry.ts's doc comment. Reading source here means this test catches drift even
// against a stale/unbuilt dist, which a dist-based read could not.
import { ROOT_ARGS } from '../src/gunshi/analyze.js';
import { INSTALL_ARGS } from '../src/gunshi/install.js';
import { JA_ARG_DESCRIPTIONS } from '../src/gunshi/locales/ja.js';
import { extractBlock, normalizeBlock, renderTable } from '../scripts/cli-reference.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const docsRoot = join(repoRoot, 'docs', 'src', 'content', 'docs');
const REGENERATE = 'run `pnpm --filter svelte-vitals run gen:cli-reference && pnpm format`';

const TARGETS = [
  { file: join(docsRoot, 'guides', '(setup)', 'cli.md'), block: renderTable(ROOT_ARGS) },
  {
    file: join(docsRoot, 'ja', 'guides', '(setup)', 'cli.md'),
    block: renderTable(ROOT_ARGS, JA_ARG_DESCRIPTIONS.root)
  },
  { file: join(docsRoot, 'guides', '(setup)', 'install.md'), block: renderTable(INSTALL_ARGS) },
  {
    file: join(docsRoot, 'ja', 'guides', '(setup)', 'install.md'),
    block: renderTable(INSTALL_ARGS, JA_ARG_DESCRIPTIONS.install)
  }
];

describe('docs: the CLI flag reference tables are up to date', () => {
  for (const { file, block } of TARGETS) {
    it(`matches the generator: ${relative(docsRoot, file)}`, () => {
      const committed = extractBlock(readFileSync(file, 'utf8'));
      expect(normalizeBlock(committed), REGENERATE).toBe(normalizeBlock(block));
    });
  }

  // ja `--help` design (docs/superpowers/specs/2026-08-11-cli-ja-help-design.md, item 9): the ja
  // tables now render from JA_ARG_DESCRIPTIONS, not the English source — pins that a translated
  // cell really differs from its en counterpart, catching an edit that silently reverts one side
  // to English (the drift this file's main test cannot catch: a table that matches the generator
  // because BOTH sides regenerated identically would still pass it).
  it('a translated cell differs from the English table', () => {
    const enCli = extractBlock(readFileSync(TARGETS[0].file, 'utf8'));
    const jaCli = extractBlock(readFileSync(TARGETS[1].file, 'utf8'));
    expect(jaCli).not.toBe(enCli);
    expect(jaCli).toContain(JA_ARG_DESCRIPTIONS.root.route);
    expect(enCli).not.toContain(JA_ARG_DESCRIPTIONS.root.route);
  });

  // A ja key absent from the resource falls back to the English description, never a blank cell
  // (same contract `--help` itself has via `localizedOptionsSection`) — exercised directly against
  // `renderTable` since every key ROOT_ARGS declares does have a ja counterpart today.
  it('a flag with no ja key falls back to its English description', () => {
    const table = renderTable({ route: ROOT_ARGS.route }, {});
    expect(table).toContain(ROOT_ARGS.route.description);
  });
});

describe('renderTable', () => {
  it('renders a boolean flag with no placeholder and a string flag with one', () => {
    const table = renderTable({
      verbose: { type: 'boolean', description: 'Be loud' },
      route: { type: 'string', description: 'A glob' }
    });
    expect(table).toBe(
      ['| Flag | Description |', '| --- | --- |', '| `--verbose` | Be loud |', '| `--route <route>` | A glob |'].join(
        '\n'
      )
    );
  });

  it('prefixes the short alias when set', () => {
    const table = renderTable({ help: { type: 'boolean', short: 'h', description: 'Show this help' } });
    expect(table).toContain('| `-h, --help` | Show this help |');
  });

  it('kebab-cases a toKebab key for display, matching how it actually parses on argv', () => {
    const table = renderTable({ noColor: { type: 'boolean', toKebab: true, description: 'Disable color' } });
    expect(table).toContain('| `--no-color` | Disable color |');
  });

  it('collapses an embedded newline to a space and escapes a literal pipe', () => {
    const table = renderTable({
      client: { type: 'string', description: 'Line one\nLine two | with a pipe' }
    });
    expect(table).toContain('| `--client <client>` | Line one Line two \\| with a pipe |');
  });

  it('drops a hidden entry, same as --help and the completion tree', () => {
    const table = renderTable({
      scope: { type: 'string', hidden: true, description: 'obsolete' },
      force: { type: 'boolean', description: 'Overwrite' }
    });
    expect(table).not.toContain('scope');
    expect(table).toContain('--force');
  });
});
