import {
  ROBOTS_SOURCE_PATHS,
  SITEMAP_SOURCE_PATHS,
  type Project,
  type Detection,
  type Runtime
} from '@svelte-vitals/core';

/** Thrown when the target directory is not a SvelteKit project (CLI maps to exit 2). */
export class ProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectError';
  }
}

const ROUTES_DIR = 'src/routes';

/**
 * Verify the cwd is a SvelteKit project (design §17): either `@sveltejs/kit`
 * appears in package.json, or a svelte.config.js exists alongside src/routes/.
 * Throws ProjectError with a friendly message otherwise.
 */
export async function detectProject(rt: Runtime, cwd: string): Promise<void> {
  const pkgPath = rt.join(cwd, 'package.json');
  let hasKitDep = false;
  if (await rt.exists(pkgPath)) {
    try {
      const pkg = JSON.parse(await rt.readFile(pkgPath)) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      hasKitDep = Boolean(pkg.dependencies?.['@sveltejs/kit'] ?? pkg.devDependencies?.['@sveltejs/kit']);
    } catch {
      // Malformed package.json — fall through to the config-based check.
    }
  }

  const hasConfig =
    (await rt.exists(rt.join(cwd, 'svelte.config.js'))) || (await rt.exists(rt.join(cwd, 'svelte.config.ts')));
  const hasRoutes = await rt.exists(rt.join(cwd, ROUTES_DIR));

  if (hasKitDep || (hasConfig && hasRoutes)) return;

  throw new ProjectError(
    'No SvelteKit project found in the current directory. ' + 'Run this inside a SvelteKit app, or pass --config.'
  );
}

/** Enumerate route page files relative to the project root (design §5). */
export async function enumerateRoutePages(rt: Runtime, cwd: string): Promise<string[]> {
  const pages = await rt.glob(`${ROUTES_DIR}/**/+page.svelte`, cwd);
  return pages.sort();
}

async function existsAny(rt: Runtime, cwd: string, paths: readonly string[]): Promise<boolean> {
  const found = await Promise.all(paths.map((p) => rt.exists(rt.join(cwd, p))));
  return found.some(Boolean);
}

function detectHtmlLang(html: string): Detection {
  // Match double-quoted, single-quoted, or unquoted lang values (e.g. <html lang=en>).
  const match = /<html[^>]*\slang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(html);
  if (!match) return { presence: 'none', value: 'absent' };
  const value = match[1] ?? match[2] ?? match[3] ?? '';
  return { presence: 'own', value: value.trim().length > 0 ? 'static' : 'absent' };
}

async function detectAppHtmlLang(rt: Runtime, cwd: string): Promise<Detection> {
  const appHtmlPath = rt.join(cwd, 'src/app.html');
  if (!(await rt.exists(appHtmlPath))) return { presence: 'none', value: 'absent' };
  return detectHtmlLang(await rt.readFile(appHtmlPath));
}

/** Precompute project-wide facts for project-scope rules (design §10, §11, §17). */
export async function collectProjectFacts(rt: Runtime, cwd: string): Promise<Project> {
  const [hasRobotsTxt, hasSitemap, htmlLang] = await Promise.all([
    existsAny(rt, cwd, ROBOTS_SOURCE_PATHS),
    existsAny(rt, cwd, SITEMAP_SOURCE_PATHS),
    detectAppHtmlLang(rt, cwd)
  ]);
  return { hasRobotsTxt, hasSitemap, htmlLang };
}
