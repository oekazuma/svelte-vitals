import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;

const PERF012_FIX: Fix = {
  description:
    'Remove the minify: false override from vite.config (Vite minifies with esbuild by default), or scope it to non-production builds.',
  snippet: "export default defineConfig({\n  build: {\n    minify: 'esbuild'\n  }\n});",
  lang: 'ts'
};

const RECOMMENDATION =
  'Remove build.minify: false from vite.config, or scope it to non-production builds if it is intentional.';

/**
 * PERF012 — a `build.minify: false` left in vite.config ships unminified JS/CSS
 * to production. Project-scope: the fact is produced by the CLI's static parse
 * of vite.config.* (literal-only) or by the Vite plugin's resolved config
 * (exact). Emits a finding only when the fact is set — no pass result.
 */
export const perf012MinifyDisabled: Rule = {
  id: 'PERF012',
  title: 'Minification disabled',
  category: 'performance',
  severity: 'warning',
  scope: 'project',
  rationale:
    'Disabling minification ships unminified JS/CSS to production, inflating bundle size several-fold and slowing every page load; the override is usually a leftover from debugging.',
  fix: PERF012_FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const hit = ctx.project.viteMinifyDisabled;
    if (!hit) return [];
    const provenance =
      hit.file === undefined
        ? ' The override comes from an inline (programmatic) Vite config.'
        : hit.line === undefined
          ? ' The override was resolved from the actual build — it may come from a plugin or a conditional config, not a literal in the file.'
          : '';
    return [
      {
        id: 'PERF012',
        category: 'performance',
        severity: 'warning',
        detection: PENALIZED,
        ...(hit.file !== undefined ? { location: hit.file } : {}),
        ...(hit.line !== undefined ? { line: hit.line } : {}),
        message:
          'JS/CSS minification is disabled (build.minify: false) — production bundles ship unminified and several times larger.' +
          provenance,
        recommendation: RECOMMENDATION,
        docsUrl: docsUrlFor('PERF012'),
        fix: { ...PERF012_FIX }
      }
    ];
  }
};
