// @svelte-vitals/core/internal — the plumbing `svelte-vitals` and `@svelte-vitals/vite` share.
//
// **No semver guarantee. Anything here may change in any release, including a patch.** The three
// packages are versioned in lockstep through workspace ranges, so a breaking change here is a
// same-PR change. Depend on this from outside at your own risk; the stable surface is the
// package root.
//
// This module does not re-export the root's names: a file needing both keeps two imports.

export type { Project, KitAlias, Scope } from './types.js';
export { defaultConfig, defaultProject } from './types.js';

export type { HeadTag, ResolvedHead } from './head.js';
export { isClassicScriptType } from './head.js';
export type { ImageInfo, ResolvedImages } from './images.js';
export type { HeadingInfo, ResolvedHeadings } from './headings.js';
export type { BranchStep, A11yOccurrenceInfo, ResolvedA11y, A11ySkipCause, LandmarkInput } from './a11y.js';
export {
  foldOccurrences,
  decodeFragmentId,
  splitTokens,
  isTopFragment,
  stripTextDirective,
  SECTIONING_TAGS,
  ASIDE_DEMOTING_TAGS,
  ANCESTRY_DEPENDENT_TAGS,
  NAMING_ATTRS,
  resolveLandmark,
  IDREF_ATTRS
} from './a11y.js';
export type {
  EachBlockFact,
  EffectFact,
  OrphanEffectFact,
  SourceSpan,
  ComponentFacts,
  SuppressionDirective
} from './component.js';
export { parseComponentFacts, collectSuppressions } from './component-parse.js';
export { applyInlineDirectives, unknownDirectiveIds, type DirectiveIndex } from './inline-directives.js';
export { skippedFileWarnings } from './component.js';
export { collectComponentFacts } from './component-collect.js';
export { collectSourceFiles } from './source-files.js';
export type { KitModuleFacts } from './kit-module.js';
export { resolveRepoLocalPath } from './kit-module-parse.js';
export { collectKitModuleFacts } from './kit-module-collect.js';
export { findMinifyDisabled } from './vite-config-parse.js';
export { resolveKitPathsBase, resolveKitAliases } from './svelte-config-parse.js';
export {
  CHILD_NODE_KEYS,
  lineOf,
  findAttr,
  valueFromNodes,
  textFromNodes,
  attrText,
  attrValue,
  attrValueOf,
  attrTextOf,
  parseSvelte
} from './svelte-ast.js';
export { ROBOTS_SOURCE_PATHS, SITEMAP_SOURCE_PATHS, VITE_CONFIG_FILES, SVELTE_CONFIG_FILES } from './project-paths.js';
export type { Runtime } from './runtime.js';
export { withReadLimit } from './runtime.js';
export type { Rule, RuleContext } from './rule.js';
export { isPenalized, docsUrlFor } from './rule.js';

export { runRules } from './engine.js';
export type { FailedRule } from './engine.js';

// Star re-export: the rule registry is the single list. A hand-maintained copy here would be a
// fourth place to register a rule that TypeScript cannot check.
export * from './rules/index.js';

export type { Classification } from './summary.js';
export { summarize, classify, hasFailureAtOrAbove, effectiveSeverity } from './summary.js';

export type { ConsoleReportOptions } from './reporter/console.js';
export { formatConsoleReport } from './reporter/console.js';
export { terminalSafe } from './reporter/sanitize.js';
export { noColorPalette, scoreColor } from './reporter/palette.js';
export type { Palette } from './reporter/palette.js';
export { buildJsonReport, formatJsonReport } from './reporter/json.js';
export { formatAgentReport } from './reporter/agent.js';
export { formatSarifReport } from './reporter/sarif.js';
export { formatGithubReport } from './reporter/github.js';
export { formatMarkdownReport } from './reporter/markdown.js';
export {
  buildHtmlDocument,
  formatHtmlReport,
  escapeHtml,
  safeHref,
  renderAppShell,
  APP_SCRIPT
} from './reporter/app-shell.js';
export type { AppSnapshot, RouteBadge } from './reporter/app-shell.js';

export {
  selectRules,
  applyRuleSeverities,
  applyOverrides,
  compileOverrides,
  settingSeverity,
  withFailedRulesOff,
  formatFailedRuleWarning
} from './config-apply.js';
export type { CompiledOverride } from './config-apply.js';

export { resolveRuleOptions, validateRuleSetting, shouldSkipRangeCheck } from './rule-options.js';
export type { RuleOptionSpec, RuleOptionsSpec } from './rule-options.js';

export type { ScoreResult, ScoreOptions, HealthResult } from './scoring/score.js';
export { computeScore, computeHealth } from './scoring/score.js';
