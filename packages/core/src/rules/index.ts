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
import { correct001EachKey, correct002EffectDerived } from './correctness/correct001-002.js';
import { sec001Html, sec002JavascriptUrl } from './security/sec001-002.js';

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
  correct001EachKey,
  correct002EffectDerived,
  sec001Html,
  sec002JavascriptUrl
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
  correct001EachKey,
  correct002EffectDerived,
  sec001Html,
  sec002JavascriptUrl
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
