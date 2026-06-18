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
export {
  allRules,
  seo001Title,
  seo002Description,
  seo003Canonical,
  seo004OgImage,
  seo005OgTitle,
  seo008JsonLd,
  seo006Robots,
  seo007Sitemap,
  seo009HtmlLang
} from './rules/index.js';
export { headTagRule } from './rules/seo/head-tag-rule.js';

export type { Summary, Classification } from './summary.js';
export { summarize, classify, hasFailureAtOrAbove, effectiveSeverity } from './summary.js';

export type { ConsoleReportOptions } from './reporter/console.js';
export { formatConsoleReport } from './reporter/console.js';
export { formatJsonReport } from './reporter/json.js';

export { selectRules, applyRuleSeverities } from './config-apply.js';

export type { ScoreModel, ScoreResult, ScoreOptions } from './scoring/score.js';
export { computeScore } from './scoring/score.js';
