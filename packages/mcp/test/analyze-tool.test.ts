import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { handleAnalyze } from '../src/tools/analyze.js';
import { createServer } from '../src/server.js';

const here = dirname(fileURLToPath(import.meta.url));
// Reuse the CLI's fixture project so we don't duplicate a SvelteKit tree.
const fixtureDir = join(here, '..', '..', 'cli', 'test', 'fixtures', 'basic-project');
const configFileFixtureDir = join(here, '..', '..', 'cli', 'test', 'fixtures', 'config-file-project');

// diff/baseline scoping goes through applyScope's real git integration
// (packages/cli/src/changed-files.ts / baseline.ts), which the CLI's own tests stub
// out via vi.mock on internal modules that aren't part of svelte-vitals' public API —
// not reusable from this package. So these tests spin up a minimal real git repo
// instead, following run-suppressions.test.ts's temp-directory-copy pattern for the
// (mock-free) suppressions case.
const dirs: string[] = [];
function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
function makeGitProjectCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-mcp-scope-'));
  dirs.push(dir);
  cpSync(fixtureDir, dir, { recursive: true });
  git(['init'], dir);
  git(['add', '-A'], dir);
  // CI runners have no global git user configured, so `commit` fails with "Author
  // identity unknown" unless we supply one explicitly (local machines usually have
  // ~/.gitconfig set, which is why this only failed in CI).
  git(
    [
      '-c',
      'user.name=svelte-vitals-test',
      '-c',
      'user.email=test@svelte-vitals.invalid',
      'commit',
      '-m',
      'init',
      '--no-gpg-sign'
    ],
    dir
  );
  return dir;
}

describe('analyze tool', () => {
  afterEach(() => {
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns a structured JSON report for a project path', async () => {
    const res = await handleAnalyze({ path: fixtureDir });
    expect(res.isError).toBeFalsy();
    const report = res.structuredContent as { score: number; weights: unknown; routes: unknown[]; summary: unknown };
    expect(typeof report.score).toBe('number');
    expect(report).toHaveProperty('weights');
    expect(Array.isArray(report.routes)).toBe(true);
    // The text payload and the structured payload must be the same report — guard
    // against drift between the two shapes (summary, finding metadata, scores).
    expect(JSON.parse(res.content[0]!.text)).toEqual(report);
  });

  it('honors metaComponents so a wrapper-supplied title is not flagged', async () => {
    type Report = { routes: Array<{ route: string; issues: Array<{ id: string }> }> };
    const widgetIssues = (report: Report) =>
      report.routes.find((r) => r.route === '/widget')?.issues.map((i) => i.id) ?? [];

    // Baseline: /widget renders <Widget /> with no <title>, so SEO001 fires there.
    const base = await handleAnalyze({ path: fixtureDir });
    expect(widgetIssues(base.structuredContent as Report)).toContain('SEO001');

    // Declaring Widget as a meta component promotes its title to dynamic/pass.
    const withMeta = await handleAnalyze({ path: fixtureDir, metaComponents: ['Widget'] });
    expect(withMeta.isError).toBeFalsy();
    expect(widgetIssues(withMeta.structuredContent as Report)).not.toContain('SEO001');
  });

  it('accepts rule ids case-insensitively', async () => {
    const res = await handleAnalyze({ path: fixtureDir, rules: ['seo001'] });
    expect(res.isError).toBeFalsy();
    const report = res.structuredContent as { routes: Array<{ issues: Array<{ id: string }> }> };
    const ids = new Set(report.routes.flatMap((r) => r.issues.map((i) => i.id)));
    // Allow-list of a single rule disables the others, so only SEO001 can appear.
    // Guard against a vacuous pass: the fixture must surface at least one SEO001.
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(id).toBe('SEO001');
  });

  it('restricts findings to a single category via categories', async () => {
    const res = await handleAnalyze({ path: fixtureDir, categories: ['seo'] });
    expect(res.isError).toBeFalsy();
    const report = res.structuredContent as { routes: Array<{ issues: Array<{ id: string }> }> };
    const ids = new Set(report.routes.flatMap((r) => r.issues.map((i) => i.id)));
    // Guard against a vacuous pass: the fixture must surface at least one SEO finding.
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(id).toMatch(/^SEO/);
  });

  it('returns findings across all categories when categories is not passed', async () => {
    const res = await handleAnalyze({ path: fixtureDir });
    expect(res.isError).toBeFalsy();
    const report = res.structuredContent as { routes: Array<{ issues: Array<{ id: string }> }> };
    const ids = new Set(report.routes.flatMap((r) => r.issues.map((i) => i.id)));
    // The unfiltered fixture surfaces findings outside SEO too (unlike the categories: ['seo'] case above).
    expect([...ids].some((id) => !id.startsWith('SEO'))).toBe(true);
  });

  it('accepts categories case-insensitively (via the real input schema, not handleAnalyze directly)', async () => {
    // Case-insensitivity is implemented as a zod preprocess step on the input schema,
    // so — like the weights case-insensitivity test below — this must go through a real
    // client-server pair; calling handleAnalyze directly would bypass the schema entirely
    // and the uppercase category would never get lowercased.
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createServer();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(clientTransport);
    try {
      const lower = await handleAnalyze({ path: fixtureDir, categories: ['seo'] });
      const res = await client.callTool({ name: 'analyze', arguments: { path: fixtureDir, categories: ['SEO'] } });
      expect(res.isError).toBeFalsy();
      expect(res.structuredContent).toEqual(lower.structuredContent);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('rejects an unknown category at the input-schema layer (isError, before analysis runs)', async () => {
    // Go through a real client-server pair so the tool's zod inputSchema is applied
    // (handleAnalyze alone would bypass it — validation lives in the MCP SDK layer).
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createServer();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(clientTransport);
    try {
      const res = await client.callTool({ name: 'analyze', arguments: { path: fixtureDir, categories: ['a11y'] } });
      expect(res.isError).toBe(true);
      const text = (res.content as Array<{ type: string; text: string }>)[0]!.text;
      expect(text).toContain('Input validation error');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('reports an error for an unknown rule id', async () => {
    const res = await handleAnalyze({ path: fixtureDir, rules: ['NOPE999'] });
    expect(res.isError).toBe(true);
    const text = res.content[0]!.text;
    expect(text).toContain('Unknown rule id(s): NOPE999');
    expect(text).toContain('Known rule ids:');
    expect(text).toContain('SEO001');
  });

  it('reports an error for a non-SvelteKit path', async () => {
    const res = await handleAnalyze({ path: here });
    expect(res.isError).toBe(true);
    // Propagates the CLI's ProjectError message verbatim.
    expect(res.content[0]!.text).toContain('No SvelteKit project found');
  });

  it('reflects a project config file (svelte-vitals.config.mjs disables SEO001 via rules)', async () => {
    const res = await handleAnalyze({ path: configFileFixtureDir });
    expect(res.isError).toBeFalsy();
    const report = res.structuredContent as { routes: Array<{ issues: Array<{ id: string }> }> };
    const ids = new Set(report.routes.flatMap((r) => r.issues.map((i) => i.id)));
    expect(ids.has('SEO001')).toBe(false);
  });

  it('applies a weights argument to the combined Health score', async () => {
    const res = await handleAnalyze({ path: fixtureDir, weights: { seo: 5 } });
    expect(res.isError).toBeFalsy();
    const report = res.structuredContent as { weights: Record<string, number> };
    expect(report.weights.seo).toBe(5);
  });

  it('accepts weights category keys case-insensitively (via the real input schema, not handleAnalyze directly)', async () => {
    // Case-insensitivity is implemented as a zod preprocess step on the input schema,
    // so — like the negative-weight test below — this must go through a real
    // client-server pair; calling handleAnalyze directly would bypass the schema
    // entirely and the uppercase key would never get lowercased.
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createServer();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(clientTransport);
    try {
      const res = await client.callTool({ name: 'analyze', arguments: { path: fixtureDir, weights: { SEO: 2 } } });
      expect(res.isError).toBeFalsy();
      const report = res.structuredContent as { weights: Record<string, number> };
      expect(report.weights.seo).toBe(2);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('rejects a negative weight at the input-schema layer (isError, before analysis runs)', async () => {
    // Go through a real client-server pair so the tool's zod inputSchema is applied
    // (handleAnalyze alone would bypass it — validation lives in the MCP SDK layer).
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createServer();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(clientTransport);
    try {
      const res = await client.callTool({ name: 'analyze', arguments: { path: fixtureDir, weights: { seo: -1 } } });
      expect(res.isError).toBe(true);
      const text = (res.content as Array<{ type: string; text: string }>)[0]!.text;
      expect(text).toContain('Input validation error');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('scopes findings to files changed vs a git ref via diff', async () => {
    const dir = makeGitProjectCopy();

    // Unscoped: the fixture's usual findings (e.g. /widget's SEO001) are present.
    const unscoped = await handleAnalyze({ path: dir });
    expect(unscoped.isError).toBeFalsy();
    const unscopedReport = unscoped.structuredContent as { routes: Array<{ issues: Array<{ id: string }> }> };
    expect(unscopedReport.routes.flatMap((r) => r.issues.map((i) => i.id))).toContain('SEO001');

    // The repo was just committed with no further changes, so diffing against HEAD
    // finds no changed (or untracked) files — every finding is filtered out.
    const scoped = await handleAnalyze({ path: dir, diff: 'HEAD' });
    expect(scoped.isError).toBeFalsy();
    const scopedReport = scoped.structuredContent as { routes: Array<{ issues: Array<{ id: string }> }> };
    expect(scopedReport.routes.flatMap((r) => r.issues.map((i) => i.id))).not.toContain('SEO001');
  });

  it('drops findings already present at the baseline ref via baseline', async () => {
    const dir = makeGitProjectCopy();

    // Unscoped: the fixture's usual findings are present.
    const unscoped = await handleAnalyze({ path: dir });
    expect(unscoped.isError).toBeFalsy();
    const unscopedReport = unscoped.structuredContent as { routes: Array<{ issues: Array<{ id: string }> }> };
    expect(unscopedReport.routes.flatMap((r) => r.issues.map((i) => i.id))).toContain('SEO001');

    // The baseline ref (HEAD) is identical to the current project, so every current
    // finding is "already present" there and gets filtered out as not-new.
    const scoped = await handleAnalyze({ path: dir, baseline: 'HEAD' });
    expect(scoped.isError).toBeFalsy();
    const scopedReport = scoped.structuredContent as { routes: Array<{ issues: Array<{ id: string }> }> };
    expect(scopedReport.routes.flatMap((r) => r.issues.map((i) => i.id))).not.toContain('SEO001');
  });

  it('ignores svelte-vitals-suppressions.json when noSuppressions is set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-mcp-suppressions-'));
    dirs.push(dir);
    cpSync(fixtureDir, dir, { recursive: true });
    writeFileSync(
      join(dir, 'svelte-vitals-suppressions.json'),
      JSON.stringify({
        version: 1,
        suppressions: [{ id: 'SEO001', route: '/widget', location: 'src/routes/widget/+page.svelte' }]
      })
    );

    type Report = { routes: Array<{ route: string; issues: Array<{ id: string }> }> };
    const widgetIssues = (report: Report) =>
      report.routes.find((r) => r.route === '/widget')?.issues.map((i) => i.id) ?? [];

    // Default: the accepted finding (widget's SEO001) is suppressed and does not surface.
    const suppressed = await handleAnalyze({ path: dir });
    expect(suppressed.isError).toBeFalsy();
    expect(widgetIssues(suppressed.structuredContent as Report)).not.toContain('SEO001');

    // noSuppressions: true bypasses the file, so the finding reappears.
    const unsuppressed = await handleAnalyze({ path: dir, noSuppressions: true });
    expect(unsuppressed.isError).toBeFalsy();
    expect(widgetIssues(unsuppressed.structuredContent as Report)).toContain('SEO001');
  });
});
