import { type Detection } from '@svelte-vitals/core';
import {
  ROBOTS_SOURCE_PATHS,
  SITEMAP_SOURCE_PATHS,
  SVELTE_CONFIG_FILES,
  VITE_CONFIG_FILES,
  collectSuppressions,
  findMinifyDisabled,
  resolveKitAliases,
  resolveKitPathsBase,
  type Project,
  type Runtime
} from '@svelte-vitals/core/internal';

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

/**
 * The leading integer in a semver range specifier (`^5.56.6` → 5, `>=4.0.0` → 4); undefined
 * for an empty/unparsable string (`*`, `latest`, `workspace:*`, …) — never guessed. Anchored
 * to the start of the (optionally operator-prefixed) string, not a bare digit search — a
 * `file:../svelte-4` path or a `github:sveltejs/svelte#v4` git specifier contains a `4` too,
 * but isn't a version declaration at all, so it must not be read as "major 4".
 */
function leadingMajor(range: string | undefined): number | undefined {
  const m = range ? /^(?:[\^~]|>=|<=|>|<|=)?\s*(\d+)/.exec(range.trim()) : null;
  return m ? Number(m[1]) : undefined;
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
      'Run this inside a SvelteKit app, or pass a path (e.g. npx svelte-vitals apps/web). ' +
      'See `svelte-vitals docs show monorepo` for how the app is resolved.'
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

/**
 * Literal ids in the shell. `data-id="…"` and the like are excluded by the lookbehind.
 * Comments and script/style bodies are stripped first — an `id="…"` in them is not an
 * element id, and counting one would silently satisfy a genuinely dangling reference.
 * Attribute names are ASCII case-insensitive (`ID="app"`) and values may be unquoted (`id=app`) — both are valid HTML.
 */
/**
 * Tag names inside `<body>` — the part of the shell that is body content on every route
 * (`<main>%sveltekit.body%</main>` is real, and must count as present). A whole-file scan would
 * count `<html>`/`<head>`/`<meta>`, which are not. Comments and script/style bodies are stripped as
 * for ids; a shell with no `<body>` tag contributes nothing.
 */
function detectAppHtmlBodyTags(html: string): string[] {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style[\s\S]*?<\/style\s*>/gi, '');
  const body = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(markup)?.[1];
  if (body === undefined) return [];
  return [...new Set([...body.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b/g)].map((m) => m[1]!.toLowerCase()))];
}

function detectAppHtmlIds(html: string): string[] {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style[\s\S]*?<\/style\s*>/gi, '');
  // The unquoted alternative rejects a leading '{' so templating placeholders (id={x}) stay out.
  const found = markup.matchAll(/(?<![\w-])id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>{][^\s"'>]*))/gi);
  return [...new Set([...found].map((m) => m[1] ?? m[2] ?? m[3] ?? '').filter(Boolean))];
}

/** app.html-derived facts sharing one read (io-budget): <html lang>, the leading doctype, and shell ids. */
async function detectAppHtmlFacts(
  rt: Runtime,
  cwd: string
): Promise<Pick<Project, 'htmlLang' | 'appHtmlDoctype' | 'appHtmlIds' | 'appHtmlBodyTags'>> {
  const appHtmlPath = rt.join(cwd, 'src/app.html');
  if (!(await rt.exists(appHtmlPath))) return { htmlLang: { presence: 'none', value: 'absent' } };
  let content: string;
  try {
    content = await rt.readFile(appHtmlPath);
  } catch {
    return { htmlLang: { presence: 'none', value: 'absent' } }; // unreadable — don't guess
  }
  return {
    htmlLang: detectHtmlLang(content),
    // Comments are stripped first, then a simple anchored match — a starred group over a lazy
    // [\s\S]*? is ambiguous across iterations and backtracks exponentially on a comment run
    // with no doctype (measured: ~45 leading comments hang the process).
    appHtmlDoctype: /^\s*<!doctype\s+html/i.test(content.replace(/<!--[\s\S]*?-->/g, '')),
    appHtmlIds: detectAppHtmlIds(content),
    appHtmlBodyTags: detectAppHtmlBodyTags(content)
  };
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

async function detectViteMinifyDisabled(rt: Runtime, cwd: string): Promise<Project['viteMinifyDisabled']> {
  const exists = await Promise.all(VITE_CONFIG_FILES.map((f) => rt.exists(rt.join(cwd, f))));
  const file = VITE_CONFIG_FILES[exists.indexOf(true)];
  if (!file) return undefined;
  try {
    const source = await rt.readFile(rt.join(cwd, file));
    const hit = findMinifyDisabled(source);
    return hit ? { file, line: hit.line, suppressions: collectSuppressions(source) } : undefined;
  } catch {
    return undefined; // unreadable config — don't guess
  }
}

/**
 * The first config file that exists, with its source. Only the FIRST existing candidate is
 * considered — that is the one the tool would load — so an unreadable first candidate yields
 * undefined rather than silently falling through to a file that is never loaded.
 */
async function readFirstConfig(
  rt: Runtime,
  cwd: string,
  files: readonly string[]
): Promise<{ file: string; source: string } | undefined> {
  for (const file of files) {
    const path = rt.join(cwd, file);
    if (!(await rt.exists(path))) continue;
    try {
      return { file, source: await rt.readFile(path) };
    } catch {
      return undefined; // unreadable config — don't guess
    }
  }
  return undefined;
}

/**
 * Both facts that come out of the Kit config, from ONE pair of reads. Split into two
 * detectors, each reading the configs itself, this would double the collection phase's config
 * reads and move `packages/cli/test/io-budget.test.ts`'s numbers — which is a design decision,
 * not a number edit (AGENTS.md).
 */
async function detectKitConfigFacts(rt: Runtime, cwd: string): Promise<Pick<Project, 'kitPathsBase' | 'kitAliases'>> {
  const [viteConfig, svelteConfig] = await Promise.all([
    readFirstConfig(rt, cwd, VITE_CONFIG_FILES),
    readFirstConfig(rt, cwd, SVELTE_CONFIG_FILES)
  ]);
  const kitPathsBase = resolveKitPathsBase(viteConfig, svelteConfig);
  const kitAliases = resolveKitAliases(viteConfig, svelteConfig);
  return {
    ...(kitPathsBase ? { kitPathsBase } : {}),
    ...(kitAliases ? { kitAliases } : {})
  };
}

/** Precompute project-wide facts for project-scope rules (design §10, §11, §17). */
export async function collectProjectFacts(rt: Runtime, cwd: string): Promise<Project> {
  const [hasRobotsTxt, hasSitemap, appHtmlFacts, viteMinifyDisabled, kitConfig] = await Promise.all([
    existsAny(rt, cwd, ROBOTS_SOURCE_PATHS),
    existsAny(rt, cwd, SITEMAP_SOURCE_PATHS),
    detectAppHtmlFacts(rt, cwd),
    detectViteMinifyDisabled(rt, cwd),
    detectKitConfigFacts(rt, cwd)
  ]);
  const robotsReferencesSitemap = await robotsRefsSitemap(rt, cwd);
  return {
    hasRobotsTxt,
    hasSitemap,
    ...appHtmlFacts,
    ...(robotsReferencesSitemap !== undefined ? { robotsReferencesSitemap } : {}),
    ...(viteMinifyDisabled ? { viteMinifyDisabled } : {}),
    ...kitConfig
  };
}
