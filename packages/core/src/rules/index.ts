import type { Category, Fix, Severity } from '../types.js';
import { docsUrlFor, type Rule } from '../rule.js';
import { seoTitlePresence } from './seo/title-presence.js';
import { seoDescriptionPresence } from './seo/description-presence.js';
import { seoCanonicalUrl } from './seo/canonical-url.js';
import { seoOgImage } from './seo/og-image.js';
import { seoOgTitle } from './seo/og-title.js';
import { seoJsonLd } from './seo/json-ld.js';
import { seoRobotsTxt } from './seo/robots-txt.js';
import { seoSitemapXml } from './seo/sitemap-xml.js';
import { seoHtmlLang } from './seo/html-lang.js';
import { performanceImageDimensions } from './perf/image-dimensions.js';
import { performanceImageLoadingHint } from './perf/image-loading-hint.js';
import { performanceResponsiveImage } from './perf/responsive-image.js';
import { performancePreloadMissingAs } from './perf/preload-missing-as.js';
import { performanceFontPreloadCrossorigin } from './perf/font-preload-crossorigin.js';
import { performanceLcpImage } from './perf/lcp-image.js';
import { performanceRenderBlockingScript } from './perf/render-blocking-script.js';
import { performancePreconnect } from './perf/preconnect.js';
import { seoIndexability } from './seo/indexability.js';
import { seoTwitterCard } from './seo/twitter-card.js';
import { seoOgDescription } from './seo/og-description.js';
import { seoOgUrl } from './seo/og-url.js';
import { seoViewport } from './seo/viewport.js';
import { seoSitemapInRobots } from './seo/sitemap-in-robots.js';
import { seoJsonLdValidity } from './seo/json-ld-validity.js';
import { seoJsonLdDeprecatedType } from './seo/json-ld-deprecated-type.js';
import { seoJsonLdRelativeUrl } from './seo/json-ld-relative-url.js';
import { seoJsonLdDateFormat } from './seo/json-ld-date-format.js';
import { seoJsonLdPlaceholder } from './seo/json-ld-placeholder.js';
import { seoJsonLdRequiredProps } from './seo/json-ld-required-props.js';
import { seoTitleLength } from './seo/title-length.js';
import { seoDescriptionLength } from './seo/description-length.js';
import { seoCharset } from './seo/charset.js';
import { seoImageAlt } from './seo/image-alt.js';
import { seoHreflang } from './seo/hreflang.js';
import { seoSingleH1 } from './seo/single-h1.js';
import { seoDuplicateTitle } from './seo/duplicate-title.js';
import { seoDuplicateDescription } from './seo/duplicate-description.js';
import { seoHeadingLevelSkip } from './seo/heading-level-skip.js';
import { seoSsrDisabled } from './seo/ssr-disabled.js';
import { correctnessEachKey } from './correctness/each-key.js';
import { correctnessEachIndexKey } from './correctness/each-index-key.js';
import { correctnessEffectAsDerived } from './correctness/effect-as-derived.js';
import { correctnessEffectAsOnMount } from './correctness/effect-as-onmount.js';
import { correctnessUnmutatedState } from './correctness/unmutated-state.js';
import { correctnessPropMutation } from './correctness/prop-mutation.js';
import { correctnessStalePropDerivation } from './correctness/stale-prop-derivation.js';
import { correctnessNonreactiveBuiltinState } from './correctness/nonreactive-builtin-state.js';
import { correctnessOrphanEffect } from './correctness/orphan-effect.js';
import { correctnessOrphanLifecycle } from './correctness/orphan-lifecycle.js';
import { correctnessServerBrowserGlobal } from './correctness/server-browser-global.js';
import { correctnessInstanceBrowserGlobal } from './correctness/instance-browser-global.js';
import { securityRawHtml } from './security/raw-html.js';
import { securityJavascriptUrl } from './security/javascript-url.js';
import { securityHandlerStateWrite } from './security/handler-state-write.js';
import { securityServerModuleState } from './security/server-module-state.js';
import { securitySharedStateImport } from './security/shared-state-import.js';
import { architectureComponentSize } from './architecture/component-size.js';
import { architecturePropCount } from './architecture/prop-count.js';
import { performanceHeavyImport } from './perf/heavy-import.js';
import { performanceNamespaceImport } from './perf/namespace-import.js';
import { performanceMinifyDisabled } from './perf/minify-disabled.js';
import { performanceLoadWaterfall } from './perf/load-waterfall.js';
import { performanceSequentialAwaits } from './perf/sequential-awaits.js';
import { performanceStateRaw } from './perf/state-raw.js';

export const allRules: Rule[] = [
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
  correctnessOrphanEffect,
  correctnessOrphanLifecycle,
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
];

export {
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
  correctnessOrphanEffect,
  correctnessOrphanLifecycle,
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
};

export interface RuleInfo {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  rationale: string;
  docsUrl: string;
  fix?: Fix;
}

/** Look up a rule's static metadata for the MCP explain_rule tool (issue #24). Rule ids are matched exactly (case-sensitive, e.g. "seo/ssr-disabled"). */
export function explainRule(id: string): RuleInfo | undefined {
  const rule = allRules.find((r) => r.id === id);
  if (!rule) return undefined;
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    rationale: rule.rationale,
    docsUrl: docsUrlFor(rule.id),
    ...(rule.fix ? { fix: rule.fix } : {})
  };
}
