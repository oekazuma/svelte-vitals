import { bootConfig, sharedFilters } from './store.svelte.js';

// security/server-module-state: a module-scope `let` reassigned from a handler —
// one counter shared by every request on this server process.
let requestCount = 0;

export const load = () => {
  requestCount++; // security/server-module-state
  sharedFilters.query = 'server-mutated'; // security/handler-state-write
  return { requestCount, query: sharedFilters.query, version: bootConfig.version };
};
