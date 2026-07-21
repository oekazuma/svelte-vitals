import type { Category, Fix, Severity } from '../types.js';
import { docsUrlFor, type Rule } from '../rule.js';
import { seo001Title } from './seo/title-presence.js';
import { seo002Description } from './seo/description-presence.js';
import { seo003Canonical } from './seo/canonical-url.js';
import { seo004OgImage } from './seo/og-image.js';
import { seo005OgTitle } from './seo/og-title.js';
import { seo008JsonLd } from './seo/json-ld.js';
import { seo006Robots } from './seo/robots-txt.js';
import { seo007Sitemap } from './seo/sitemap-xml.js';
import { seo009HtmlLang } from './seo/html-lang.js';
import { perf001ImageDimensions } from './perf/image-dimensions.js';
import { perf002ImageLoading } from './perf/image-loading-hint.js';
import { perf006ResponsiveImage } from './perf/responsive-image.js';
import { perf003PreloadAs } from './perf/preload-missing-as.js';
import { perf004FontPreloadCrossorigin } from './perf/font-preload-crossorigin.js';
import { perf005LcpImage } from './perf/lcp-image.js';
import { perf007RenderBlockingScript } from './perf/render-blocking-script.js';
import { perf008Preconnect } from './perf/preconnect.js';
import { seo010Indexability } from './seo/indexability.js';
import { seo011TwitterCard } from './seo/twitter-card.js';
import { seo012OgDescription } from './seo/og-description.js';
import { seo013OgUrl } from './seo/og-url.js';
import { seo014Viewport } from './seo/viewport.js';
import { seo015SitemapInRobots } from './seo/sitemap-in-robots.js';
import { seo016JsonLdValidity } from './seo/json-ld-validity.js';
import { seo017DeprecatedType } from './seo/json-ld-deprecated-type.js';
import { seo018RelativeUrl } from './seo/json-ld-relative-url.js';
import { seo019DateFormat } from './seo/json-ld-date-format.js';
import { seo020Placeholder } from './seo/json-ld-placeholder.js';
import { seo021RequiredProps } from './seo/json-ld-required-props.js';
import { seo022TitleLength } from './seo/title-length.js';
import { seo023DescriptionLength } from './seo/description-length.js';
import { seo024Charset } from './seo/charset.js';
import { seo025ImageAlt } from './seo/image-alt.js';
import { seo026Hreflang } from './seo/hreflang.js';
import { seo027Heading } from './seo/single-h1.js';
import { seo028TitleUnique } from './seo/duplicate-title.js';
import { seo029DescriptionUnique } from './seo/duplicate-description.js';
import { seo030HeadingOrder } from './seo/heading-level-skip.js';
import { seo031SsrDisabled } from './seo/ssr-disabled.js';
import { correct001EachKey } from './correctness/each-key.js';
import { correct002EffectDerived } from './correctness/effect-as-derived.js';
import { correct003EffectAsOnMount } from './correctness/effect-as-onmount.js';
import { correct004UnmutatedState } from './correctness/unmutated-state.js';
import { correct005PropMutation } from './correctness/prop-mutation.js';
import { correct006OrphanEffect } from './correctness/orphan-effect.js';
import { correct007OrphanLifecycle } from './correctness/orphan-lifecycle.js';
import { correct008BrowserGlobals } from './correctness/server-browser-global.js';
import { correct009InstanceBrowserGlobals } from './correctness/instance-browser-global.js';
import { sec001Html } from './security/raw-html.js';
import { sec002JavascriptUrl } from './security/javascript-url.js';
import { sec003LoadStateWrite } from './security/handler-state-write.js';
import { sec004ServerModuleState } from './security/server-module-state.js';
import { sec005SharedStateImport } from './security/shared-state-import.js';
import { arch001ComponentSize } from './architecture/component-size.js';
import { arch002PropCount } from './architecture/prop-count.js';
import { perf009HeavyImport } from './perf/heavy-import.js';
import { perf010NamespaceImport } from './perf/namespace-import.js';
import { perf012MinifyDisabled } from './perf/minify-disabled.js';
import { perf011LoadWaterfall } from './perf/load-waterfall.js';
import { perf013SequentialAwaits } from './perf/sequential-awaits.js';

export const allRules: Rule[] = [
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
  perf010NamespaceImport,
  perf012MinifyDisabled,
  perf011LoadWaterfall,
  perf013SequentialAwaits
];

export {
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
  perf010NamespaceImport,
  perf012MinifyDisabled,
  perf011LoadWaterfall,
  perf013SequentialAwaits
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

/** Look up a rule's static metadata for the MCP explain_rule tool (issue #24). Rule ids are matched case-insensitively. */
export function explainRule(id: string): RuleInfo | undefined {
  const target = id.toUpperCase();
  const rule = allRules.find((r) => r.id === target);
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
