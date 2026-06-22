# @svelte-vitals/mcp

## 0.1.0

### Minor Changes

- 396a783: Add `@svelte-vitals/mcp`, a Model Context Protocol server exposing `analyze` and `explain_rule` tools over stdio (#24). Core gains `buildJsonReport`, `explainRule`, `RuleInfo`, and `docsUrlFor`; the JSON report's per-finding objects now include `docsUrl`; the CLI gains `analyzeProject` for reuse.

### Patch Changes

- Updated dependencies [396a783]
  - @svelte-vitals/core@0.6.0
  - svelte-vitals@0.5.0
