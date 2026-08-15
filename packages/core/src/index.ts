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
export type { JsonReport, RuleEvidence } from './reporter/json.js';
export type { ScoreModel } from './scoring/score.js';
