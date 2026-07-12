import { parseModule, generateCode, builders, MagicastError } from 'magicast';
import type { CodemodResult } from './codemod-types.js';

const FRESH_HANDLE = `import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(svelteVitalsHandle());
`;

const MANUAL_SNIPPET = `import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
import { sequence } from '@sveltejs/kit/hooks';
// wrap your existing \`handle\` in sequence(yourHandle, svelteVitalsHandle())`;

function addImports(mod: ReturnType<typeof parseModule>): void {
  if (!mod.imports.sequence) {
    mod.imports.$append({ imported: 'sequence', local: 'sequence', from: '@sveltejs/kit/hooks' });
  }
  if (!mod.imports.svelteVitalsHandle) {
    mod.imports.$append({
      imported: 'svelteVitalsHandle',
      local: 'svelteVitalsHandle',
      from: '@svelte-vitals/vite/hooks'
    });
  }
}

/**
 * Register the svelte-vitals `svelteVitalsHandle` hook in a hooks.server source.
 * Returns 'manual' (no content) when the existing `handle` export's shape
 * isn't one of: absent, `sequence(...)`, or a single handle expression.
 */
export function codemodHooksServer(existing: string | undefined): CodemodResult {
  if (existing === undefined) {
    return { status: 'created', content: FRESH_HANDLE };
  }
  try {
    const mod = parseModule(existing);
    const handle = mod.exports.handle;

    if (handle === undefined) {
      addImports(mod);
      mod.exports.handle = builders.functionCall('sequence', builders.functionCall('svelteVitalsHandle'));
      // NB: magicast's format auto-detection always reports `objectCurlySpacing: undefined`
      // (it's not actually inferred from source), which recast then treats as `false` instead
      // of falling back to its own default of `true` — collapsing newly-generated single-specifier
      // imports to `import {x} from ...`. Force it explicitly so generated imports match normal style.
      // Also force single-quote strings: when the source has no string literals for
      // detectCodeFormat to sample (e.g. a bare arrow-function handle), it falls back to
      // magicast's own default of double quotes instead of this project's single-quote style.
      return {
        status: 'added',
        content: generateCode(mod, { format: { objectCurlySpacing: true, quote: 'single' } }).code
      };
    }

    if (handle.$type === 'function-call' && handle.$callee === 'sequence') {
      // NB: .find(), not .some() — magicast's Proxified arrays don't invoke .some()'s callback (see Global Constraints).
      const already = handle.$args.find(
        (a: { $type?: string; $callee?: string }) => a?.$type === 'function-call' && a?.$callee === 'svelteVitalsHandle'
      );
      if (already !== undefined) {
        return { status: 'exists' };
      }
      if (!mod.imports.svelteVitalsHandle) {
        mod.imports.$append({
          imported: 'svelteVitalsHandle',
          local: 'svelteVitalsHandle',
          from: '@svelte-vitals/vite/hooks'
        });
      }
      handle.$args.push(builders.functionCall('svelteVitalsHandle'));
      return {
        status: 'added',
        content: generateCode(mod, { format: { objectCurlySpacing: true, quote: 'single' } }).code
      };
    }

    // A single, non-sequence handle expression: wrap it.
    addImports(mod);
    mod.exports.handle = builders.functionCall('sequence', handle, builders.functionCall('svelteVitalsHandle'));
    return {
      status: 'updated',
      content: generateCode(mod, { format: { objectCurlySpacing: true, quote: 'single' } }).code
    };
  } catch (err) {
    if (err instanceof MagicastError) {
      return { status: 'manual', snippet: MANUAL_SNIPPET };
    }
    throw err;
  }
}
