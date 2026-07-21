import {
  ROBOTS_SOURCE_PATHS,
  SITEMAP_SOURCE_PATHS,
  findMinifyDisabled,
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
    'No SvelteKit project found in the current directory. ' +
      'Run this inside a SvelteKit app, or pass a path (e.g. npx svelte-vitals apps/web).'
  );
}

/** Enumerate route page files relative to the project root (design §5, #12: incl. +page@ breakouts). */
export async function enumerateRoutePages(rt: Runtime, cwd: string): Promise<string[]> {
  const [plain, breakout] = await Promise.all([
    rt.glob(`${ROUTES_DIR}/**/+page.svelte`, cwd),
    rt.glob(`${ROUTES_DIR}/**/+page@*.svelte`, cwd)
  ]);
  return [...new Set([...plain, ...breakout])].sort();
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

async function robotsRefsSitemap(rt: Runtime, cwd: string): Promise<boolean | undefined> {
  // Only the static file is statically inspectable; a +server endpoint generates
  // its output at runtime, so we must not guess (no false positives).
  const p = rt.join(cwd, 'static/robots.txt');
  if (!(await rt.exists(p))) return undefined;
  try {
    return /^\s*sitemap:/im.test(await rt.readFile(p));
  } catch {
    return undefined;
  }
}

/** Vite's own config resolution order — only the first existing file is the one Vite loads. */
const VITE_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts'
] as const;

async function detectViteMinifyDisabled(rt: Runtime, cwd: string): Promise<Project['viteMinifyDisabled']> {
  const exists = await Promise.all(VITE_CONFIG_FILES.map((f) => rt.exists(rt.join(cwd, f))));
  const file = VITE_CONFIG_FILES[exists.indexOf(true)];
  if (!file) return undefined;
  try {
    const hit = findMinifyDisabled(await rt.readFile(rt.join(cwd, file)));
    return hit ? { file, line: hit.line } : undefined;
  } catch {
    return undefined; // unreadable config — don't guess
  }
}

/** Precompute project-wide facts for project-scope rules (design §10, §11, §17). */
export async function collectProjectFacts(rt: Runtime, cwd: string): Promise<Project> {
  const [hasRobotsTxt, hasSitemap, htmlLang, viteMinifyDisabled] = await Promise.all([
    existsAny(rt, cwd, ROBOTS_SOURCE_PATHS),
    existsAny(rt, cwd, SITEMAP_SOURCE_PATHS),
    detectAppHtmlLang(rt, cwd),
    detectViteMinifyDisabled(rt, cwd)
  ]);
  const robotsReferencesSitemap = await robotsRefsSitemap(rt, cwd);
  return {
    hasRobotsTxt,
    hasSitemap,
    htmlLang,
    ...(robotsReferencesSitemap !== undefined ? { robotsReferencesSitemap } : {}),
    ...(viteMinifyDisabled ? { viteMinifyDisabled } : {})
  };
}
