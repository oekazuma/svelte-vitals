#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main().catch((err) => {
  // stderr is safe on stdio transport (stdout carries the protocol).
  console.error(`svelte-vitals-mcp: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
