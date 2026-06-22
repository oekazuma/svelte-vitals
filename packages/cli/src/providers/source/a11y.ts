import { compile } from 'svelte/compiler';
import type { Config, Result, Runtime } from '@svelte-vitals/core';
import { defaultConfig } from '@svelte-vitals/core';
import { enumerateRoutePages } from './project.js';
import { chainFiles, deriveRoute } from './routes.js';

interface A11yWarning {
  code: string;
  /** First line of the Svelte message (the trailing docs-URL line is stripped). */
  message: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

function firstLine(message: string): string {
  return message.split('\n')[0] ?? message;
}

/** Compile one file and return its mapped a11y warnings. Resilient: returns [] if compile throws. */
function fileA11y(source: string, rel: string): A11yWarning[] {
  let warnings: ReadonlyArray<{ code?: string; message?: string; start?: { line?: number } }>;
  try {
    ({ warnings = [] } = compile(source, { generate: false, filename: rel }) as {
      warnings?: ReadonlyArray<{ code?: string; message?: string; start?: { line?: number } }>;
    });
  } catch {
    return [];
  }
  const out: A11yWarning[] = [];
  for (const w of warnings) {
    if (typeof w.code === 'string' && w.code.startsWith('a11y_')) {
      out.push({
        code: w.code,
        message: firstLine(w.message ?? w.code),
        line: typeof w.start?.line === 'number' ? w.start.line : 0
      });
    }
  }
  return out;
}

/**
 * Aggregate the Svelte compiler's a11y warnings into per-route findings (issue #10,
 * Accessibility v0.5). Each route's +page.svelte and +layout.svelte chain is compiled
 * (cached per file); each a11y warning becomes a fail Result keyed by its Svelte code,
 * and a warning-free route emits one passing seed so the a11y score anchors at 100.
 */
export async function collectA11y(rt: Runtime, cwd: string, config: Config = defaultConfig): Promise<Result[]> {
  // Sentinel set by buildRulesConfig when the allow-list contains no a11y codes.
  if (config.rules['a11y_category'] === 'off') return [];
  const pages = await enumerateRoutePages(rt, cwd);
  const cache = new Map<string, A11yWarning[]>();
  const results: Result[] = [];

  for (const page of pages) {
    const files = await chainFiles(rt, cwd, page);
    const route = deriveRoute(page);
    const fails: Result[] = [];

    for (const { rel } of files) {
      let warns = cache.get(rel);
      if (!warns) {
        const source = await rt.readFile(rt.join(cwd, rel));
        warns = fileA11y(source, rel);
        cache.set(rel, warns);
      }
      for (const w of warns) {
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

    if (fails.length === 0) {
      // One passing seed per warning-free route anchors the a11y category score at 100.
      results.push({
        id: 'a11y',
        category: 'a11y',
        severity: 'warning',
        detection: { presence: 'own', value: 'static' },
        route,
        message: 'Accessibility'
      });
    } else {
      results.push(...fails);
    }
  }

  return results;
}
