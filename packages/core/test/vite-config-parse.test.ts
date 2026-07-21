import { describe, it, expect } from 'vitest';
import { findMinifyDisabled } from '../src/vite-config-parse.js';

describe('findMinifyDisabled', () => {
  it('detects a literal build.minify: false in a defineConfig call', () => {
    const src = `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: false
  }
});
`;
    expect(findMinifyDisabled(src)).toEqual({ line: 5 });
  });

  it('detects it in a plain default-exported object', () => {
    const src = `export default {
  build: { minify: false }
};
`;
    expect(findMinifyDisabled(src)).toEqual({ line: 2 });
  });

  it('resolves a same-file alias export', () => {
    const src = `import { defineConfig } from 'vite';
const config = defineConfig({
  build: {
    minify: false
  }
});
export default config;
`;
    expect(findMinifyDisabled(src)).toEqual({ line: 4 });
  });

  it('unwraps satisfies/as on the config and on nested values', () => {
    const src = `import type { UserConfig } from 'vite';
export default {
  build: {
    minify: false as const
  }
} satisfies UserConfig;
`;
    expect(findMinifyDisabled(src)).toEqual({ line: 4 });
  });

  it('accepts a string-literal build key', () => {
    const src = `export default { 'build': { minify: false } };\n`;
    expect(findMinifyDisabled(src)).toEqual({ line: 1 });
  });

  it('skips function-form configs', () => {
    const src = `import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
  build: { minify: mode === 'production' ? 'esbuild' : false }
}));
`;
    expect(findMinifyDisabled(src)).toBeUndefined();
  });

  it('skips non-literal minify values', () => {
    const src = `const DEBUG = true;
export default { build: { minify: DEBUG ? false : 'esbuild' } };
`;
    expect(findMinifyDisabled(src)).toBeUndefined();
    expect(findMinifyDisabled(`export default { build: { minify: DEBUG } };\n`)).toBeUndefined();
  });

  it("does not flag 'esbuild' / 'terser' / true", () => {
    for (const v of [`'esbuild'`, `'terser'`, `true`]) {
      expect(findMinifyDisabled(`export default { build: { minify: ${v} } };\n`)).toBeUndefined();
    }
  });

  it('ignores minify keys outside the build object', () => {
    const src = `export default {
  plugins: [{ options: { minify: false } }],
  worker: { minify: false }
};
`;
    expect(findMinifyDisabled(src)).toBeUndefined();
  });

  it('ignores computed keys', () => {
    const src = `const k = 'minify';
export default { build: { [k]: false } };
`;
    expect(findMinifyDisabled(src)).toBeUndefined();
  });

  it('returns undefined with no default export', () => {
    expect(findMinifyDisabled(`export const build = { minify: false };\n`)).toBeUndefined();
  });

  it('returns undefined (never throws) on malformed source', () => {
    expect(findMinifyDisabled(`export default {{{`)).toBeUndefined();
    expect(findMinifyDisabled(``)).toBeUndefined();
  });

  it('honors last-wins for duplicate keys, matching JS object semantics', () => {
    expect(
      findMinifyDisabled(`export default { build: { minify: false }, build: { sourcemap: true } };\n`)
    ).toBeUndefined();
    expect(findMinifyDisabled(`export default { build: { sourcemap: true }, build: { minify: false } };\n`)).toEqual({
      line: 1
    });
    expect(findMinifyDisabled(`export default { build: { minify: false, minify: 'esbuild' } };\n`)).toBeUndefined();
  });
});
