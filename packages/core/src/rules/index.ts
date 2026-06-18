import type { Rule } from '../rule.js';
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
