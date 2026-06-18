/**
 * Source-file locations that satisfy the project-scope rules, shared by every
 * mode so the static (CLI) and rendered (plugin) collectors never drift. This
 * module is pure data: no I/O, no `node:` imports (design §8).
 */

/** Locations that satisfy the robots.txt project rule (SEO006). */
export const ROBOTS_SOURCE_PATHS = [
  'static/robots.txt',
  'src/routes/robots.txt/+server.ts',
  'src/routes/robots.txt/+server.js'
] as const;

/** Locations that satisfy the sitemap.xml project rule (SEO007). */
export const SITEMAP_SOURCE_PATHS = [
  'static/sitemap.xml',
  'src/routes/sitemap.xml/+server.ts',
  'src/routes/sitemap.xml/+server.js'
] as const;
