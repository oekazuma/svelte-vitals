import { describe, it, expect } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import { mergeJson, mergeToml } from '../../src/install/merge.js';
import { MCP_ENTRY } from '../../src/install/clients.js';

describe('mergeJson', () => {
  it('creates a new config when none exists', () => {
    const r = mergeJson(undefined, MCP_ENTRY, false);
    expect(r.status).toBe('created');
    expect(JSON.parse(r.content)).toEqual({
      mcpServers: { 'svelte-vitals': { command: 'npx', args: ['-y', '@svelte-vitals/mcp'] } }
    });
    expect(r.content.endsWith('\n')).toBe(true);
  });
  it('adds to an existing config without clobbering other servers', () => {
    const existing = JSON.stringify({ mcpServers: { other: { command: 'x', args: [] } } });
    const r = mergeJson(existing, MCP_ENTRY, false);
    expect(r.status).toBe('added');
    const parsed = JSON.parse(r.content);
    expect(parsed.mcpServers.other).toEqual({ command: 'x', args: [] });
    expect(parsed.mcpServers['svelte-vitals'].command).toBe('npx');
  });
  it('preserves unrelated top-level keys', () => {
    const existing = JSON.stringify({ theme: 'dark', mcpServers: {} });
    const r = mergeJson(existing, MCP_ENTRY, false);
    expect(JSON.parse(r.content).theme).toBe('dark');
  });
  it('is exists (no change) when already identical', () => {
    const first = mergeJson(undefined, MCP_ENTRY, false).content;
    expect(mergeJson(first, MCP_ENTRY, false).status).toBe('exists');
  });
  it('skips a differing entry without force; updates with force', () => {
    const existing = JSON.stringify({ mcpServers: { 'svelte-vitals': { command: 'old', args: [] } } });
    expect(mergeJson(existing, MCP_ENTRY, false).status).toBe('exists');
    const forced = mergeJson(existing, MCP_ENTRY, true);
    expect(forced.status).toBe('updated');
    expect(JSON.parse(forced.content).mcpServers['svelte-vitals'].command).toBe('npx');
  });
  it('throws on unparseable existing content', () => {
    expect(() => mergeJson('{not json', MCP_ENTRY, false)).toThrow();
  });
  it('throws when existing content parses to a non-object root', () => {
    expect(() => mergeJson('["x"]', MCP_ENTRY, false)).toThrow();
  });
  it('throws when mcpServers is not a plain object', () => {
    const existing = JSON.stringify({ mcpServers: ['x'] });
    expect(() => mergeJson(existing, MCP_ENTRY, false)).toThrow();
  });
});

describe('mergeToml', () => {
  it('creates a new toml config', () => {
    const r = mergeToml(undefined, MCP_ENTRY, false);
    expect(r.status).toBe('created');
    const parsed = parseToml(r.content) as { mcp_servers: Record<string, { command: string; args: unknown[] }> };
    expect(parsed.mcp_servers['svelte-vitals']).toEqual({ command: 'npx', args: ['-y', '@svelte-vitals/mcp'] });
  });
  it('adds without clobbering existing tables or scalars', () => {
    const existing = 'model = "gpt"\n\n[mcp_servers.other]\ncommand = "x"\nargs = []\n';
    const r = mergeToml(existing, MCP_ENTRY, false);
    expect(r.status).toBe('added');
    const parsed = parseToml(r.content) as {
      model?: string;
      mcp_servers: Record<string, { command: string; args: unknown[] }>;
    };
    expect(parsed.model).toBe('gpt');
    expect(parsed.mcp_servers.other!.command).toBe('x');
    expect(parsed.mcp_servers['svelte-vitals']!.command).toBe('npx');
  });
  it('exists when identical; updates with force', () => {
    const first = mergeToml(undefined, MCP_ENTRY, false).content;
    expect(mergeToml(first, MCP_ENTRY, false).status).toBe('exists');
    const existing = '[mcp_servers.svelte-vitals]\ncommand = "old"\nargs = []\n';
    expect(mergeToml(existing, MCP_ENTRY, false).status).toBe('exists');
    expect(mergeToml(existing, MCP_ENTRY, true).status).toBe('updated');
  });
  it('throws on unparseable toml', () => {
    expect(() => mergeToml('= = =', MCP_ENTRY, false)).toThrow();
  });
  it('throws when mcp_servers is not a table', () => {
    const existing = 'mcp_servers = ["x"]\n';
    expect(() => mergeToml(existing, MCP_ENTRY, false)).toThrow();
  });
});
