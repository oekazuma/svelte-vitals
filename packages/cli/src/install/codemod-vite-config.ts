import { parseModule, generateCode, builders, MagicastError } from 'magicast';
import type { CodemodResult } from './codemod-types.js';

const MANUAL_SNIPPET = `import { svelteVitals } from '@svelte-vitals/vite';
// add svelteVitals() to your \`plugins\` array`;

/**
 * Register the svelte-vitals build-mode plugin in a vite.config source.
 * Returns 'manual' (no content) when the file is missing, or its shape isn't a
 * recognized `export default { plugins: [...] }` / `defineConfig({ plugins: [...] })`.
 */
export function codemodViteConfig(existing: string | undefined): CodemodResult {
  if (existing === undefined) {
    return { status: 'manual', snippet: MANUAL_SNIPPET };
  }
  try {
    const mod = parseModule(existing);
    if (mod.imports.svelteVitals) {
      return { status: 'exists' };
    }
    const def = mod.exports.default;
    const configObj = def?.$type === 'function-call' ? def.$args[0] : def;
    if (!configObj || configObj.$type !== 'object' || configObj.plugins?.$type !== 'array') {
      return { status: 'manual', snippet: MANUAL_SNIPPET };
    }
    // NB: .find(), not .some() — magicast's Proxified arrays don't invoke .some()'s callback (see Global Constraints).
    const already = configObj.plugins.find(
      (p: { $type?: string; $callee?: string }) => p?.$type === 'function-call' && p?.$callee === 'svelteVitals'
    );
    if (already !== undefined) {
      return { status: 'exists' };
    }
    mod.imports.$append({ imported: 'svelteVitals', local: 'svelteVitals', from: '@svelte-vitals/vite' });
    configObj.plugins.unshift(builders.functionCall('svelteVitals'));
    // NB: magicast's format auto-detection always reports `objectCurlySpacing: undefined`
    // (it's not actually inferred from source), which recast then treats as `false` instead
    // of falling back to its own default of `true` — collapsing newly-generated single-specifier
    // imports to `import {x} from ...`. Force it explicitly so generated imports match normal style.
    return { status: 'added', content: generateCode(mod, { format: { objectCurlySpacing: true } }).code };
  } catch (err) {
    if (err instanceof MagicastError) {
      return { status: 'manual', snippet: MANUAL_SNIPPET };
    }
    throw err;
  }
}
