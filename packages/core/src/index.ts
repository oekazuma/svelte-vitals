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
export { ROBOTS_SOURCE_PATHS, SITEMAP_SOURCE_PATHS } from './project-paths.js';
export type { Runtime } from './runtime.js';
export type { Rule, RuleContext } from './rule.js';
export { isPenalized, docsUrlFor } from './rule.js';

export { runRules } from './engine.js';
export {
  allRules,
  explainRule,
  seo001Title,
  seo002Description,
  seo003Canonical,
  seo004OgImage,
  seo005OgTitle,
  seo006Robots,
  seo007Sitemap,
  seo008JsonLd,
  seo009HtmlLang,
  perf001ImageDimensions,
  perf002ImageLoading,
  perf003PreloadAs,
  perf004FontPreloadCrossorigin,
  seo010Indexability,
  seo011TwitterCard,
  seo012OgDescription,
  seo013OgUrl,
  seo014Viewport,
  seo015SitemapInRobots,
  seo016JsonLdValidity,
  seo017DeprecatedType,
  seo018RelativeUrl,
  seo019DateFormat,
  seo020Placeholder,
  seo021RequiredProps,
  seo022TitleLength,
  seo023DescriptionLength,
  seo024Charset,
  seo025ImageAlt,
  seo026Hreflang,
  seo027Heading,
  perf005LcpImage,
  perf006ResponsiveImage,
  perf007RenderBlockingScript,
  perf008Preconnect,
  seo028TitleUnique,
  seo029DescriptionUnique,
  seo030HeadingOrder,
  seo031SsrDisabled,
  correct001EachKey,
  correct002EffectDerived,
  correct003EffectAsOnMount,
  correct004UnmutatedState,
  correct005PropMutation,
  correct006OrphanEffect,
  correct007OrphanLifecycle,
  correct008BrowserGlobals,
  correct009InstanceBrowserGlobals,
  sec001Html,
  sec002JavascriptUrl,
  sec003LoadStateWrite,
  sec004ServerModuleState,
  sec005SharedStateImport,
  arch001ComponentSize,
  arch002PropCount,
  perf009HeavyImport,
  perf010NamespaceImport
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

export { selectRules, applyRuleSeverities, applyOverrides } from './config-apply.js';

export type { ScoreModel, ScoreResult, ScoreOptions, HealthResult } from './scoring/score.js';
export { computeScore, scoresByCategory, computeHealth } from './scoring/score.js';
