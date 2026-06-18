import type { Project, Detection, Runtime } from '@svelte-vitals/core';

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

async function existsAny(rt: Runtime, cwd: string, paths: string[]): Promise<boolean> {
  for (const p of paths) {
    if (await rt.exists(rt.join(cwd, p))) return true;
  }
  return false;
}

function detectHtmlLang(html: string): Detection {
  const match = /<html[^>]*\slang\s*=\s*("([^"]*)"|'([^']*)')/i.exec(html);
  if (!match) return { presence: 'none', value: 'absent' };
  const value = match[2] ?? match[3] ?? '';
  return { presence: 'own', value: value.trim().length > 0 ? 'static' : 'absent' };
}

/** Precompute project-wide facts for project-scope rules (design §10, §11, §17). */
export async function collectProjectFacts(rt: Runtime, cwd: string): Promise<Project> {
  const hasRobotsTxt = await existsAny(rt, cwd, [
    'static/robots.txt',
    'src/routes/robots.txt/+server.ts',
    'src/routes/robots.txt/+server.js'
  ]);
  const hasSitemap = await existsAny(rt, cwd, [
    'static/sitemap.xml',
    'src/routes/sitemap.xml/+server.ts',
    'src/routes/sitemap.xml/+server.js'
  ]);
  const appHtmlPath = rt.join(cwd, 'src/app.html');
  const htmlLang = (await rt.exists(appHtmlPath))
    ? detectHtmlLang(await rt.readFile(appHtmlPath))
    : { presence: 'none' as const, value: 'absent' as const };
  return { hasRobotsTxt, hasSitemap, htmlLang };
}
