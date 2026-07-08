import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { handleAnalyze } from '../src/tools/analyze.js';
import { createServer } from '../src/server.js';

const here = dirname(fileURLToPath(import.meta.url));
// Reuse the CLI's fixture project so we don't duplicate a SvelteKit tree.
const fixtureDir = join(here, '..', '..', 'cli', 'test', 'fixtures', 'basic-project');
const configFileFixtureDir = join(here, '..', '..', 'cli', 'test', 'fixtures', 'config-file-project');

describe('analyze tool', () => {
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
});
