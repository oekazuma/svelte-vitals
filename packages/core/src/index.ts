// @svelte-vitals/core — runtime-agnostic core (design §8).
// No `node:` imports, no I/O, no runtime-specific globals.
//
// This entry is the semver-stable surface, scoped to the two jobs an outside caller has:
// authoring a config, and reading a JSON report. Everything the CLI and the Vite plugin share
// lives in `./internal`. Keep this entry **type-closed** — a name exported here may not reference
// a type that is only internal, or a patch-legal change to that type would break the contract.

export type {
  Config,
  RuleSetting,
  RuleSettingObject,
  RuleOptions,
  RuleOverride,
  Severity,
  Category,
  TreatDynamicAs,
  Result,
  Detection,
  Presence,
  Value,
  Fix
} from './types.js';
export { defineConfig, CATEGORIES } from './types.js';

export type { Summary } from './summary.js';
export { summarize, hasFailureAtOrAbove } from './summary.js';

/**
 * Rendering a report and gating on it. Promoted from `./internal` for the first-party GitHub
 * Action, which draws the analysis onto three GitHub surfaces and decides its step's outcome — the
 * analysis entry (`analyzeProject`) was stable while rendering and gating were not.
 *
 * What is frozen here is each function's **existence and signature**, not the text it produces:
 * markdown and workflow-command output stay human/agent-readable, and their prose, ordering and
 * caps may change in any release (`2026-08-16-v1-public-surface.md`). A consumer calls these to
 * render; it must not parse what comes back — `JsonReport` is the shape for that.
 */
export { formatGithubReport } from './reporter/github.js';
export { formatMarkdownReport } from './reporter/markdown.js';
export type { JsonReport, RuleEvidence } from './reporter/json.js';
export type { ScoreModel } from './scoring/score.js';
