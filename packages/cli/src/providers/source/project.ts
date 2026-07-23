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
 * Minimum Svelte/SvelteKit major versions this tool's rules assume (Svelte 5 runes —
 * `$props()`/`$state()`/`$derived()` — and SvelteKit 2 APIs). Advisory only: an older
 * project still gets analyzed normally, but rules that key off runes syntax (e.g.
 * correctness/stale-prop-derivation, correctness/prop-mutation) can't recognize the
 * legacy (`export let`, `$:`) equivalent of the same bugs, so findings may be incomplete.
 */
const MIN_SVELTE_MAJOR = 5;
const MIN_KIT_MAJOR = 2;

/** The leading integer in a semver range specifier (`^5.56.6` → 5, `>=4.0.0` → 4); undefined for an empty/unparsable string (`*`, `latest`, `workspace:*`, …) — never guessed. */
function leadingMajor(range: string | undefined): number | undefined {
  const m = range ? /\d+/.exec(range) : null;
  return m ? Number(m[0]) : undefined;
}

/**
 * Warn (never block) when the analyzed project declares a Svelte or SvelteKit version
 * below the floor rules assume — read from package.json's declared range, same source
 * `detectProject` already uses for the `@sveltejs/kit` presence check. A missing/
 * unparsable package.json or an unparsable version range yields no warning (silent,
 * consistent with `detectProject`'s own conservative fallbacks) rather than guessing.
 */
export async function checkVersionFloor(rt: Runtime, cwd: string): Promise<string[]> {
  const pkgPath = rt.join(cwd, 'package.json');
  if (!(await rt.exists(pkgPath))) return [];
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(await rt.readFile(pkgPath));
  } catch {
    return [];
  }

  const warnings: string[] = [];
  const svelteRange = pkg.dependencies?.svelte ?? pkg.devDependencies?.svelte;
  const svelteMajor = leadingMajor(svelteRange);
  if (svelteMajor !== undefined && svelteMajor < MIN_SVELTE_MAJOR) {
    warnings.push(
      `this project declares svelte "${svelteRange}", but rules assume Svelte ${MIN_SVELTE_MAJOR}+ (runes) — ` +
        `findings may miss the legacy (export let / $:) equivalent of runes-only checks.`
    );
  }
  const kitRange = pkg.dependencies?.['@sveltejs/kit'] ?? pkg.devDependencies?.['@sveltejs/kit'];
  const kitMajor = leadingMajor(kitRange);
  if (kitMajor !== undefined && kitMajor < MIN_KIT_MAJOR) {
    warnings.push(
      `this project declares @sveltejs/kit "${kitRange}", but rules assume SvelteKit ${MIN_KIT_MAJOR}+ — some checks may not apply.`
    );
  }
  return warnings;
}

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
