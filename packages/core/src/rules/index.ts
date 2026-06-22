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

export const allRules: Rule[] = [
  seo001Title,
  seo002Description,
  seo003Canonical,
  seo004OgImage,
  seo005OgTitle,
  seo006Robots,
  seo007Sitemap,
  seo008JsonLd,
  seo009HtmlLang
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
  seo009HtmlLang
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

/** Look up a rule's static metadata for the MCP explain_rule tool (issue #24). */
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
