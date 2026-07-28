import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSourceFiles } from '../src/providers/source/components.js';
import { analyze } from '../src/analyze.js';

// fileURLToPath, not URL.pathname: pathname keeps percent-encoding and carries a leading slash
// before a Windows drive letter, so it is not a filesystem path.
const here = fileURLToPath(new URL('.', import.meta.url));
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

describe('collectSourceFiles (vite provider)', () => {
  it('returns paths under src/ for the repository it is pointed at', async () => {
    // Point it at this package: packages/vite/src exists and holds .ts files.
    const files = await collectSourceFiles(packageRoot);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.startsWith('src/'))).toBe(true);
    expect(files).toEqual(files.slice().sort());
  });

  it('returns an empty list for a directory with no src/', async () => {
    expect(await collectSourceFiles(here)).toEqual([]);
  });
});

// The provider tests above prove the collector works; they would still pass if analyze() stopped
// putting `sourceFiles` in the RuleContext, since nothing else in the plugin reads the inventory.
// This exercises the whole path — glob, RuleContext, rule — the way the componentFacts wiring test
// in analyze.test.ts does for the component collector.
describe('analyze wires sourceFiles into the rule context', () => {
  let cwd: string;
  let pages: string;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-source-files-'));
    pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    await writeFile(join(pages, 'index.html'), `<html lang="en"><head><title>Home</title></head><body></body></html>`);
    // A PascalCase directory holding no Card.svelte — a unit-entry-file violation, but only for a
    // run that can see the file inventory.
    await mkdir(join(cwd, 'src/lib/Card'), { recursive: true });
    await writeFile(join(cwd, 'src/lib/Card/index.svelte'), '<div>card</div>');
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('runs a directory-shaped Architecture rule over the collected inventory', async () => {
    const r = await analyze(pages, cwd, {
      report: false,
      rules: { 'architecture/unit-entry-file': { options: { pascalCaseUnits: { 'src/**': '.svelte' } } } }
    });
    const found = r.results.filter((x) => x.id === 'architecture/unit-entry-file');
    expect(found).toHaveLength(1);
    expect(found[0]!.location).toBe('src/lib/Card/index.svelte');
    expect(found[0]!.message).toContain('src/lib/Card/Card.svelte');
  });

  it('emits nothing from that rule when it is left unconfigured', async () => {
    // Guards the assertion above against passing for the wrong reason: the finding must come from
    // the declaration, not from the rule being on by default.
    const r = await analyze(pages, cwd, { report: false });
    expect(r.results.filter((x) => x.id === 'architecture/unit-entry-file')).toEqual([]);
  });
});
