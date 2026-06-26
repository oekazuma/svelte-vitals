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
import { perf001ImageDimensions, perf002ImageLoading } from './perf/images.js';
import { perf003PreloadAs, perf004FontPreloadCrossorigin } from './perf/resource-hints.js';
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
  seo021RequiredProps
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
  seo021RequiredProps
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
