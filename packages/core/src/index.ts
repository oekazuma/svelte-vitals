// @svelte-vitals/core — runtime-agnostic core (design §8).
// No `node:` imports, no I/O, no runtime-specific globals.

export type {
  Severity,
  Presence,
  Value,
  Detection,
  Project,
  Result,
  Scope,
  Category,
  TreatDynamicAs,
  RuleSetting,
  Config
} from './types.js';
export { defaultConfig, defineConfig, defaultProject } from './types.js';

export type { HeadTag, ResolvedHead, HeadProvider } from './head.js';
export type { Runtime } from './runtime.js';
export type { Rule, RuleContext } from './rule.js';
export { isPenalized } from './rule.js';

export { runRules } from './engine.js';
export { allRules, seo001Title } from './rules/index.js';

export type { Summary, Classification } from './summary.js';
export { summarize, classify, hasFailureAtOrAbove, effectiveSeverity } from './summary.js';

export { formatConsoleReport } from './reporter/console.js';
