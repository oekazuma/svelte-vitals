// @svelte-vitals/core — runtime-agnostic core (design §8).
// No `node:` imports, no I/O, no runtime-specific globals.

export type {
  Severity,
  Presence,
  Value,
  Detection,
  Project,
  Fix,
  Result,
  Scope,
  Category,
  TreatDynamicAs,
  RuleSetting,
  RuleSettingObject,
  RuleOptions,
  RuleOverride,
  Config
} from './types.js';
export { defaultConfig, defineConfig, defaultProject } from './types.js';

export type { HeadTag, ResolvedHead, HeadProvider } from './head.js';
export type { ImageInfo, ResolvedImages } from './images.js';
export type { HeadingInfo, ResolvedHeadings } from './headings.js';
export type {
  EachBlockFact,
  EffectFact,
  OrphanEffectFact,
  SourceSpan,
  ComponentFacts,
  SuppressionDirective
} from './component.js';
export { parseComponentFacts } from './component-parse.js';
export { collectComponentFacts, emptyComponentFacts } from './component-collect.js';
export type { KitModuleFacts } from './kit-module.js';
export { parseKitModuleFacts, resolveRunesModuleSpecifier } from './kit-module-parse.js';
export { collectKitModuleFacts, emptyKitModuleFacts } from './kit-module-collect.js';
export { findMinifyDisabled } from './vite-config-parse.js';
export {
  findKitPathsBaseInSvelteConfig,
  findKitPathsBaseInViteConfig,
  resolveKitPathsBase
} from './svelte-config-parse.js';
export type { ViteKitConfigResult } from './svelte-config-parse.js';
export {
  CHILD_NODE_KEYS,
  lineOf,
  findAttr,
  valueFromNodes,
  textFromNodes,
  attrText,
  attrValue,
  attrValueOf,
  attrTextOf
} from './svelte-ast.js';
export { ROBOTS_SOURCE_PATHS, SITEMAP_SOURCE_PATHS, VITE_CONFIG_FILES, SVELTE_CONFIG_FILES } from './project-paths.js';
export type { Runtime } from './runtime.js';
export type { Rule, RuleContext } from './rule.js';
export { isPenalized, docsUrlFor } from './rule.js';

export { runRules } from './engine.js';
export {
  allRules,
  explainRule,
  seoTitlePresence,
  seoDescriptionPresence,
  seoCanonicalUrl,
  seoOgImage,
  seoOgTitle,
  seoRobotsTxt,
  seoSitemapXml,
  seoJsonLd,
  seoHtmlLang,
  performanceImageDimensions,
  performanceImageLoadingHint,
  performancePreloadMissingAs,
  performanceFontPreloadCrossorigin,
  seoIndexability,
  seoTwitterCard,
  seoOgDescription,
  seoOgUrl,
  seoViewport,
  seoSitemapInRobots,
  seoJsonLdValidity,
  seoJsonLdDeprecatedType,
  seoJsonLdRelativeUrl,
  seoJsonLdDateFormat,
  seoJsonLdPlaceholder,
  seoJsonLdRequiredProps,
  seoTitleLength,
  seoDescriptionLength,
  seoCharset,
  seoImageAlt,
  seoHreflang,
  seoSingleH1,
  performanceLcpImage,
  performanceResponsiveImage,
  performanceRenderBlockingScript,
  performancePreconnect,
  seoDuplicateTitle,
  seoDuplicateDescription,
  seoHeadingLevelSkip,
  seoSsrDisabled,
  correctnessEachKey,
  correctnessEachIndexKey,
  correctnessEffectAsDerived,
  correctnessEffectAsOnMount,
  correctnessUnmutatedState,
  correctnessPropMutation,
  correctnessStalePropDerivation,
  correctnessNonreactiveBuiltinState,
  correctnessCheckableBindValue,
  correctnessOrphanEffect,
  correctnessOrphanLifecycle,
  correctnessBasePathNavigation,
  correctnessServerBrowserGlobal,
  correctnessInstanceBrowserGlobal,
  securityRawHtml,
  securityJavascriptUrl,
  securityHandlerStateWrite,
  securityServerModuleState,
  securitySharedStateImport,
  architectureComponentSize,
  architecturePropCount,
  performanceHeavyImport,
  performanceNamespaceImport,
  performanceMinifyDisabled,
  performanceLoadWaterfall,
  performanceSequentialAwaits,
  performanceStateRaw
} from './rules/index.js';
export type { RuleInfo } from './rules/index.js';
export { headTagRule } from './rules/seo/head-tag-rule.js';
export { imageRule } from './rules/perf/image-rule.js';
export { linkRule } from './rules/perf/link-rule.js';

export type { Summary, Classification } from './summary.js';
export { summarize, classify, hasFailureAtOrAbove, effectiveSeverity } from './summary.js';

export type { ConsoleReportOptions } from './reporter/console.js';
export { formatConsoleReport } from './reporter/console.js';
export { noColorPalette, scoreColor } from './reporter/palette.js';
export type { Palette } from './reporter/palette.js';
export { buildJsonReport, formatJsonReport } from './reporter/json.js';
export type { JsonReport } from './reporter/json.js';
export { formatAgentReport } from './reporter/agent.js';
export { formatSarifReport } from './reporter/sarif.js';
export { formatGithubReport } from './reporter/github.js';
export { formatMarkdownReport } from './reporter/markdown.js';
export { buildHtmlDocument, formatHtmlReport, escapeHtml, safeHref, scoreBand, BAND_COLOR } from './reporter/html.js';
export { renderAppShell, APP_SCRIPT, APP_STYLE } from './reporter/app-shell.js';
export type { AppSnapshot, RouteBadge } from './reporter/app-shell.js';

export { selectRules, applyRuleSeverities, applyOverrides, settingSeverity, settingOptions } from './config-apply.js';

export type { ScoreModel, ScoreResult, ScoreOptions, HealthResult } from './scoring/score.js';
export { computeScore, scoresByCategory, computeHealth } from './scoring/score.js';
