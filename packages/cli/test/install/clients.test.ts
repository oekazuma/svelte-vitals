import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { CLIENTS, clientById, MCP_ENTRY } from '../../src/install/clients.js';

const cwd = '/proj';
const home = '/home/u';

describe('client writers', () => {
  it('exposes the fixed MCP entry', () => {
    expect(MCP_ENTRY).toEqual({ command: 'npx', args: ['-y', '@svelte-vitals/mcp'] });
  });
  it('claude-code: project → .mcp.json, global → ~/.claude.json', () => {
    const c = clientById('claude-code')!;
    expect(c.format).toBe('json');
    expect(c.resolvePath('project', cwd, home)).toBe(join('/proj', '.mcp.json'));
    expect(c.resolvePath('global', cwd, home)).toBe(join('/home/u', '.claude.json'));
  });
  it('cursor: project → .cursor/mcp.json, global → ~/.cursor/mcp.json', () => {
    const c = clientById('cursor')!;
    expect(c.format).toBe('json');
    expect(c.resolvePath('project', cwd, home)).toBe(join('/proj', '.cursor', 'mcp.json'));
    expect(c.resolvePath('global', cwd, home)).toBe(join('/home/u', '.cursor', 'mcp.json'));
  });
  it('codex: global-only → ~/.codex/config.toml, toml format', () => {
    const c = clientById('codex')!;
    expect(c.scopes).toEqual(['global']);
    expect(c.format).toBe('toml');
    expect(c.resolvePath('global', cwd, home)).toBe(join('/home/u', '.codex', 'config.toml'));
  });
  it('CLIENTS has all three ids', () => {
    expect(CLIENTS.map((c) => c.id).sort()).toEqual(['claude-code', 'codex', 'cursor']);
  });
});
