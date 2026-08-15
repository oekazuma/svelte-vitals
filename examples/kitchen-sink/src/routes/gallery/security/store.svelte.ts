// Module-scope $state, imported by +page.server.ts —
// security/shared-state-import: one instance shared by every server request.
export const sharedFilters = $state<{ query: string }>({ query: '' });

// Read-only on the server: never mutated, so it keeps its boot-time value for
// every request there — the read-only flavor of security/shared-state-import
// (the write above is security/handler-state-write instead, since it happens
// inside a load handler).
export const bootConfig = $state<{ version: string }>({ version: '1.0.0' });
