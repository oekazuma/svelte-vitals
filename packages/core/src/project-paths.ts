/**
 * Source-file locations that satisfy the project-scope rules, shared by every
 * mode so the static (CLI) and rendered (plugin) collectors never drift. This
 * module is pure data: no I/O, no `node:` imports (design §8).
 */

/** Locations that satisfy the robots.txt project rule (seo/robots-txt). */
export const ROBOTS_SOURCE_PATHS = [
  'static/robots.txt',
  'src/routes/robots.txt/+server.ts',
  'src/routes/robots.txt/+server.js'
] as const;

/** Locations that satisfy the sitemap.xml project rule (seo/sitemap-xml). */
export const SITEMAP_SOURCE_PATHS = [
  'static/sitemap.xml',
  'src/routes/sitemap.xml/+server.ts',
  'src/routes/sitemap.xml/+server.js'
] as const;

/** Vite's own config resolution order — only the first existing file is the one Vite loads. */
export const VITE_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts'
] as const;

/** SvelteKit's config resolution order (`@sveltejs/kit` checks js before ts). */
export const SVELTE_CONFIG_FILES = ['svelte.config.js', 'svelte.config.ts'] as const;
