import { compile } from 'svelte/compiler';
import type { Config, Result, Runtime } from '@svelte-vitals/core';
import { defaultConfig } from '@svelte-vitals/core';
import { enumerateRoutePages } from './project.js';
import { chainFiles, deriveRoute } from './routes.js';
import { A11Y_CATEGORY_KEY, A11Y_CODE_PREFIX } from '../../rules-config.js';

interface A11yWarning {
  code: string;
  /** First line of the Svelte message (the trailing docs-URL line is stripped). */
  message: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/**
 * The a11y outcome of compiling one file. `ok: false` means the compiler threw
 * (unparseable source) — distinct from `ok: true` with no warnings (compiled clean).
 * The distinction matters: an unparseable route must NOT be seeded as passing.
 */
interface FileA11y {
  ok: boolean;
  warnings: A11yWarning[];
}

function firstLine(message: string): string {
  return message.split('\n')[0] ?? message;
}

/** Compile one file and return its mapped a11y warnings. Resilient: `ok: false` if compile throws. */
function fileA11y(source: string, rel: string): FileA11y {
  let warnings: ReturnType<typeof compile>['warnings'];
  try {
    ({ warnings } = compile(source, { generate: false, filename: rel }));
  } catch {
    return { ok: false, warnings: [] };
  }
  const out: A11yWarning[] = [];
  for (const w of warnings) {
    if (w.code.startsWith(A11Y_CODE_PREFIX)) {
      out.push({
        code: w.code,
        message: firstLine(w.message),
        line: w.start?.line ?? 0
      });
    }
  }
  return { ok: true, warnings: out };
}

/**
 * Aggregate the Svelte compiler's a11y warnings into per-route findings (issue #10,
 * Accessibility v0.5). Each route's +page.svelte and +layout.svelte chain is compiled
 * (cached per file); each a11y warning becomes a fail Result keyed by its Svelte code,
 * and a warning-free route emits one passing seed so the a11y score anchors at 100.
 *
 * A route whose chain has an unparseable file and no other findings is left
 * *unchecked*: it emits nothing and is excluded from the category average, rather
 * than being falsely seeded as passing.
 */
export async function collectA11y(rt: Runtime, cwd: string, config: Config = defaultConfig): Promise<Result[]> {
  // Sentinel set by buildRulesConfig when the allow-list contains no a11y codes.
  if (config.rules[A11Y_CATEGORY_KEY] === 'off') return [];
  const pages = await enumerateRoutePages(rt, cwd);
  const cache = new Map<string, FileA11y>();
  const results: Result[] = [];

  for (const page of pages) {
    const files = await chainFiles(rt, cwd, page);
    const route = deriveRoute(page);
    const fails: Result[] = [];
    let compiledAll = true;

    for (const { rel } of files) {
      let entry = cache.get(rel);
      if (!entry) {
        const source = await rt.readFile(rt.join(cwd, rel));
        entry = fileA11y(source, rel);
        cache.set(rel, entry);
      }
      if (!entry.ok) compiledAll = false;
      for (const w of entry.warnings) {
        if (config.rules[w.code] === 'off') continue;
        fails.push({
          id: w.code,
          category: 'a11y',
          severity: 'warning',
          detection: { presence: 'none', value: 'absent' },
          route,
          location: rel,
          ...(w.line > 0 ? { line: w.line } : {}),
          message: w.message,
          docsUrl: `https://svelte.dev/e/${w.code}`
        });
      }
    }

    if (fails.length > 0) {
      results.push(...fails);
    } else if (compiledAll) {
      // One passing seed per warning-free route anchors the a11y category score at 100.
      results.push({
        id: 'a11y',
        category: 'a11y',
        severity: 'warning',
        detection: { presence: 'own', value: 'static' },
        route,
        message: 'Accessibility'
      });
    }
    // else: a file in the chain failed to compile and nothing was found — leave the
    // route unchecked (no seed) so an unparseable route can't report a false 100.
  }

  return results;
}
