import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { type McpEntry } from './clients.js';

export type MergeStatus = 'created' | 'added' | 'exists' | 'updated';
export interface MergeResult {
  content: string;
  status: MergeStatus;
}

const SERVER_KEY = 'svelte-vitals';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sameEntry(prior: unknown, entry: McpEntry): boolean {
  if (typeof prior !== 'object' || prior === null) return false;
  const o = prior as { command?: unknown; args?: unknown };
  return (
    o.command === entry.command &&
    Array.isArray(o.args) &&
    o.args.length === entry.args.length &&
    o.args.every((v, i) => v === entry.args[i])
  );
}

/** Decide the merge status for a table that may already hold a svelte-vitals key. */
function statusFor(prior: unknown, entry: McpEntry, force: boolean, created: boolean): MergeStatus | 'skip' {
  if (prior !== undefined) {
    if (sameEntry(prior, entry)) return 'exists';
    return force ? 'updated' : 'skip';
  }
  return created ? 'created' : 'added';
}

/** Merge the svelte-vitals server into a JSON `{ mcpServers: {...} }` config. */
export function mergeJson(existing: string | undefined, entry: McpEntry, force: boolean): MergeResult {
  const created = existing === undefined;
  const parsed: unknown = created ? {} : JSON.parse(existing);
  if (!isPlainObject(parsed)) {
    throw new Error('existing config is not a JSON object');
  }
  const root = parsed;
  if (root.mcpServers !== undefined && !isPlainObject(root.mcpServers)) {
    throw new Error('existing config has a non-object "mcpServers" table');
  }
  const servers = isPlainObject(root.mcpServers) ? root.mcpServers : {};
  const status = statusFor(servers[SERVER_KEY], entry, force, created);
  if (status === 'exists' || status === 'skip') return { content: existing as string, status: 'exists' };
  servers[SERVER_KEY] = { command: entry.command, args: entry.args };
  root.mcpServers = servers;
  return { content: JSON.stringify(root, null, 2) + '\n', status };
}

/** Merge the svelte-vitals server into a TOML config under [mcp_servers.svelte-vitals]. */
export function mergeToml(existing: string | undefined, entry: McpEntry, force: boolean): MergeResult {
  const created = existing === undefined;
  const parsed: unknown = created ? {} : parseToml(existing);
  if (!isPlainObject(parsed)) {
    throw new Error('existing config is not a TOML table');
  }
  const root = parsed;
  if (root.mcp_servers !== undefined && !isPlainObject(root.mcp_servers)) {
    throw new Error('existing config has a non-table "mcp_servers" section');
  }
  const servers = isPlainObject(root.mcp_servers) ? root.mcp_servers : {};
  const status = statusFor(servers[SERVER_KEY], entry, force, created);
  if (status === 'exists' || status === 'skip') return { content: existing as string, status: 'exists' };
  servers[SERVER_KEY] = { command: entry.command, args: entry.args };
  root.mcp_servers = servers;
  return { content: stringifyToml(root), status };
}
