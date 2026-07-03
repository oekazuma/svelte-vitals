import { join } from 'node:path';

export interface McpEntry {
  command: string;
  args: string[];
}

/** The MCP server entry written for every client. */
export const MCP_ENTRY: McpEntry = { command: 'npx', args: ['-y', '@svelte-vitals/mcp'] };

export type ClientId = 'claude-code' | 'cursor' | 'codex';
export type Scope = 'project' | 'global';

export interface ClientWriter {
  id: ClientId;
  label: string;
  scopes: Scope[];
  format: 'json' | 'toml';
  /** Config file path for a scope. `cwd` = project root, `home` = user home dir. */
  resolvePath(scope: Scope, cwd: string, home: string): string;
}

export const CLIENTS: ClientWriter[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    scopes: ['project', 'global'],
    format: 'json',
    resolvePath: (scope, cwd, home) => (scope === 'project' ? join(cwd, '.mcp.json') : join(home, '.claude.json'))
  },
  {
    id: 'cursor',
    label: 'Cursor',
    scopes: ['project', 'global'],
    format: 'json',
    resolvePath: (scope, cwd, home) =>
      scope === 'project' ? join(cwd, '.cursor', 'mcp.json') : join(home, '.cursor', 'mcp.json')
  },
  {
    id: 'codex',
    label: 'Codex',
    scopes: ['global'],
    format: 'toml',
    resolvePath: (_scope, _cwd, home) => join(home, '.codex', 'config.toml')
  }
];

export function clientById(id: ClientId): ClientWriter | undefined {
  return CLIENTS.find((c) => c.id === id);
}
