# Design: MCP server (`@svelte-vitals/mcp`)

Issue: [#24](https://github.com/oekazuma/svelte-vitals/issues/24). Final increment of the agent-native epic (#18).

## Goal

Expose svelte-vitals as a Model Context Protocol (MCP) server so an AI agent can invoke
static-mode analysis directly inside its tool loop and receive structured, fixable findings —
instead of shelling out to the CLI and parsing text. The MCP layer is an **adapter** over the
existing core pipeline; no rule logic is duplicated.

`#11` (`--fix` autofix) was closed as agent-delegated: the only mechanically-safe fixes
(robots.txt/sitemap.xml) are trivial for an agent, and the valuable ones need the real domain /
page content an agent already has. MCP is the higher-leverage path: give the agent fixable
context, let it apply the fix.

## Scope (v1)

Two MCP tools over **stdio** transport:

1. **`analyze`** — run static-mode analysis on a project path; return the structured JSON report
   (same shape the `json` reporter produces), including per-finding `fix`/`recommendation`/`docsUrl`,
   per-route and site-wide scores, and the summary.
2. **`explain_rule`** — given a rule id (e.g. `SEO001`), return its title, category, default
   severity, rationale, docs URL, and fix template.

`suggest_fix` is **out of scope** for v1: `analyze` already returns each finding's `fix` template,
so a dedicated tool would be largely redundant. Add later if a per-rule lookup (without running
analysis) proves needed.

## Package

- New workspace package `packages/mcp` → published as `@svelte-vitals/mcp`.
- Dependencies: `@svelte-vitals/core` (types, rule catalog, `buildJsonReport`, `explainRule`),
  `svelte-vitals` (the CLI package — for `analyzeProject` + the Node runtime/providers),
  `@modelcontextprotocol/sdk`, `zod`.
- Binary `svelte-vitals-mcp` starts a stdio MCP server.
- ESM-only, `tsup` `format: ['esm']`, matching the existing packages' build/exports conventions
  (per #20: `exports`-only is the eventual target; follow whatever convention the other packages
  use at implementation time).

## Architecture & data flow

```
agent (MCP client)
  │  tools/call: analyze { path, route?, treatDynamicAs?, rules?, ignore?, failOn? }
  ▼
@svelte-vitals/mcp  (stdio server, zod-validated tool inputs)
  │  analyzeProject(opts)            ← extracted from CLI run()
  ▼
svelte-vitals (CLI)  detectProject → heads → project facts → runRules → applyRuleSeverities
  │  → { results, config, version }
  ▼
@svelte-vitals/core  buildJsonReport(results, config, { version })
  │  → { version, score, scoreModel, summary, routes, siteIssues }
  ▼
MCP tool result: structuredContent = report object + a short text summary
```

### CLI refactor — extract `analyzeProject`

`packages/cli/src/index.ts` currently inlines the analysis pipeline inside `run()`. Extract it:

```ts
export interface AnalyzeOptions {
  cwd?: string;
  metaComponents?: string[];
  treatDynamicAs?: 'pass' | 'warn' | 'fail';
  route?: string;
  failOn?: Severity;
  rules?: Record<string, RuleSetting>;
}
export interface AnalyzeResult {
  results: Result[];
  config: Config;
  version: string;
}

export async function analyzeProject(opts: AnalyzeOptions): Promise<AnalyzeResult>;
```

- Throws `ProjectError` when the directory is not a SvelteKit project (callers map to their own
  error channel: `run()` → exit 2; MCP → `isError` tool result).
- `run()` is refactored to call `analyzeProject` and then do reporter resolution + formatting +
  exit-code computation. **Behaviour is unchanged** — existing CLI tests must stay green.

### core refactor — extract `buildJsonReport`

`formatJsonReport` builds a report object then `JSON.stringify`s it. Split:

```ts
export function buildJsonReport(results: Result[], config: Config, meta: { version: string }): JsonReport;
export function formatJsonReport(results, config, meta): string; // = JSON.stringify(buildJsonReport(...), null, 2)
```

`JsonReport` is the existing shape: `{ version, score, scoreModel, summary, routes, siteIssues }`.
The `analyze` tool returns this object as `structuredContent`. No behaviour change to the string output.

### Rule catalog — single source of truth for `explain_rule`

Today each rule's `rationale`(≈recommendation)/`docsUrl`/`fix` live inside `check()` output. Promote
them to the `Rule` definition so the catalog and the findings share one source:

- Extend `Rule`: add `rationale: string` and `fix?: Fix`. `docsUrl` is **not** stored — it is
  derived everywhere as `https://svelte-vitals.dev/rules/${id}` (one helper, no per-rule URL to
  drift).
- Populate all nine rules declaratively. `headTagRule` already accepts `opts.fix`; extend its
  options to also carry `rationale`, and have `check()` reference the rule's own `rationale`/`fix`
  and the derived `docsUrl` instead of inline literals. Project rules (SEO006/007/009) move their
  inline `recommendation`/`fix` onto the rule object and derive `docsUrl`.
- core exports:

```ts
export interface RuleInfo {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  rationale: string;
  docsUrl: string;
  fix?: Fix;
}
export function explainRule(id: string): RuleInfo | undefined;
```

`docsUrl` stays derivable (`https://svelte-vitals.dev/rules/${id}`) to avoid a hand-maintained URL
per rule; `rationale` is authored prose per rule (the existing `recommendation` text is a good seed).

## Tool contracts

### `analyze`

Input (zod):

| field            | type                            | default    | notes                                 |
| ---------------- | ------------------------------- | ---------- | ------------------------------------- |
| `path`           | string                          | cwd        | project root to analyze               |
| `route`          | string                          | —          | glob, restrict routes (matches CLI)   |
| `treatDynamicAs` | `'pass'\|'warn'\|'fail'`        | `pass`     |                                       |
| `rules`          | string[]                        | —          | enable only these rule ids            |
| `ignore`         | string[]                        | —          | disable these rule ids                |
| `failOn`         | `'critical'\|'warning'\|'info'` | `critical` | informational in the report's summary |

- Unknown rule ids in `rules`/`ignore` → `isError` tool result listing the unknown ids and the
  known ids (mirrors the CLI's exit-2 message).
- Returns `structuredContent` = `JsonReport`, plus a one-line text summary (`score`, counts).
- Not a SvelteKit project → `isError` tool result with the `ProjectError` message.

### `explain_rule`

- Input: `{ id: string }`.
- Returns `structuredContent` = `RuleInfo`, plus a text rendering.
- Unknown id → `isError` tool result listing known rule ids.

## Error handling

- Tool-level failures (bad project, unknown rule/id) return `{ isError: true, content: [...] }`
  rather than throwing out of the transport — the agent sees a usable message and can retry.
- Unexpected errors are caught at the handler boundary and surfaced as `isError` too; the process
  stays alive to serve further calls.

## Testing (TDD)

- **core**: `buildJsonReport` returns the expected object (and `formatJsonReport` ===
  `JSON.stringify(buildJsonReport(...))`); `explainRule` returns each rule's info and `undefined`
  for unknown ids; every rule in `allRules` has non-empty `rationale`/`docsUrl`.
- **cli**: `analyzeProject` over an in-memory `Runtime` returns expected `results`/`config`/`version`;
  throws `ProjectError` for a non-Kit dir. Existing `run()` tests stay green (no behaviour change).
- **mcp**: tool handlers called directly (not through a live transport) for `analyze`
  (happy path, unknown rule id, non-Kit path) and `explain_rule` (known id, unknown id). A thin
  smoke test that the server registers both tools.

## Out of scope / follow-ups

- `suggest_fix` tool (redundant with `analyze` for now).
- HTTP/SSE transport (stdio only for v1).
- Generated `AGENTS.md`/rules doc (separate idea from #18).
- Plugin-mode (build-time) analysis via MCP — v1 is static-mode only, matching the CLI.

## Roadmap / release

- Update README roadmap: remove the closed `--fix` item; move MCP from **Upcoming** to **Shipped**
  once landed.
- Add a changeset (new `@svelte-vitals/mcp` package; `@svelte-vitals/core` minor for
  `buildJsonReport`/`explainRule`/`Rule` additions; `svelte-vitals` minor for `analyzeProject`).
