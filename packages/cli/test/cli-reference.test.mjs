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
import { extractBlock, normalizeBlock, renderTable } from '../scripts/cli-reference.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const docsRoot = join(repoRoot, 'docs', 'src', 'content', 'docs');
const REGENERATE = 'run `pnpm --filter svelte-vitals run gen:cli-reference && pnpm format`';

const TARGETS = [
  { file: join(docsRoot, 'guides', '(setup)', 'cli.md'), block: renderTable(ROOT_ARGS) },
  { file: join(docsRoot, 'ja', 'guides', '(setup)', 'cli.md'), block: renderTable(ROOT_ARGS) },
  { file: join(docsRoot, 'guides', '(setup)', 'install.md'), block: renderTable(INSTALL_ARGS) },
  { file: join(docsRoot, 'ja', 'guides', '(setup)', 'install.md'), block: renderTable(INSTALL_ARGS) }
];

describe('docs: the CLI flag reference tables are up to date', () => {
  for (const { file, block } of TARGETS) {
    it(`matches the generator: ${relative(docsRoot, file)}`, () => {
      const committed = extractBlock(readFileSync(file, 'utf8'));
      expect(normalizeBlock(committed), REGENERATE).toBe(normalizeBlock(block));
    });
  }

  // The en and ja tables are the SAME English-generated block by design (design doc addendum:
  // flag names/descriptions stay English until i18n adoption lands) — pinning this catches a
  // future edit that accidentally translates one side without the other.
  it('the ja tables are byte-identical to their en counterparts', () => {
    const [enCli, jaCli, enInstall, jaInstall] = TARGETS.map(({ file }) => extractBlock(readFileSync(file, 'utf8')));
    expect(jaCli).toBe(enCli);
    expect(jaInstall).toBe(enInstall);
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
