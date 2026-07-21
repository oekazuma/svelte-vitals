import type { Category, Fix, Severity } from '../types.js';
import { docsUrlFor, type Rule } from '../rule.js';
import { seo001Title } from './seo/seo001-title.js';
import {
  seo002Description,
  seo003Canonical,
  seo004OgImage,
  seo005OgTitle,
  seo008JsonLd
} from './seo/seo002-005-008.js';
import { seo006Robots, seo007Sitemap, seo009HtmlLang } from './seo/project-rules.js';
import { perf001ImageDimensions, perf002ImageLoading, perf006ResponsiveImage } from './perf/images.js';
import { perf003PreloadAs, perf004FontPreloadCrossorigin } from './perf/resource-hints.js';
import { perf005LcpImage } from './perf/perf005-lcp-image.js';
import { perf007RenderBlockingScript } from './perf/perf007-render-blocking.js';
import { perf008Preconnect } from './perf/perf008-preconnect.js';
import {
  seo010Indexability,
  seo011TwitterCard,
  seo012OgDescription,
  seo013OgUrl,
  seo014Viewport,
  seo015SitemapInRobots
} from './seo/seo010-015.js';
import {
  seo016JsonLdValidity,
  seo017DeprecatedType,
  seo018RelativeUrl,
  seo019DateFormat,
  seo020Placeholder,
  seo021RequiredProps
} from './seo/seo016-021.js';
import { seo022TitleLength, seo023DescriptionLength } from './seo/seo022-023.js';
import { seo024Charset } from './seo/seo024-charset.js';
import { seo025ImageAlt } from './seo/seo025-image-alt.js';
import { seo026Hreflang } from './seo/seo026-hreflang.js';
import { seo027Heading } from './seo/seo027-heading.js';
import { seo028TitleUnique, seo029DescriptionUnique } from './seo/seo028-029-uniqueness.js';
import { seo030HeadingOrder } from './seo/seo030-heading-order.js';
import { seo031SsrDisabled } from './seo/seo031-ssr-disabled.js';
import { correct001EachKey, correct002EffectDerived, correct003EffectAsOnMount } from './correctness/correct001-002.js';
import { correct004UnmutatedState } from './correctness/correct004-unmutated-state.js';
import { correct005PropMutation } from './correctness/correct005-prop-mutation.js';
import { correct006OrphanEffect } from './correctness/correct006-orphan-effect.js';
import { correct007OrphanLifecycle } from './correctness/correct007-orphan-lifecycle.js';
import { correct008BrowserGlobals } from './correctness/correct008-browser-globals.js';
import { correct009InstanceBrowserGlobals } from './correctness/correct009-instance-browser-globals.js';
import { sec001Html, sec002JavascriptUrl } from './security/sec001-002.js';
import { sec003LoadStateWrite } from './security/sec003-load-state-write.js';
import { sec004ServerModuleState } from './security/sec004-server-module-state.js';
import { sec005SharedStateImport } from './security/sec005-shared-state-import.js';
import { arch001ComponentSize } from './architecture/component-size.js';
import { arch002PropCount } from './architecture/prop-count.js';
import { perf009HeavyImport } from './perf/perf009-heavy-import.js';
import { perf010NamespaceImport } from './perf/perf010-namespace-import.js';
import { perf012MinifyDisabled } from './perf/perf012-minify-disabled.js';
import { perf011LoadWaterfall } from './perf/perf011-load-waterfall.js';
import { perf013SequentialAwaits } from './perf/perf013-sequential-awaits.js';

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
