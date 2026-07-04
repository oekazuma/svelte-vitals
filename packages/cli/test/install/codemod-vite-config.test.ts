import { describe, it, expect } from 'vitest';
import { codemodViteConfig } from '../../src/install/codemod-vite-config.js';

describe('codemodViteConfig', () => {
  it('file does not exist → manual, with a snippet', () => {
    const result = codemodViteConfig(undefined);
    expect(result.status).toBe('manual');
    expect(result.content).toBeUndefined();
    expect(result.snippet).toContain("import { svelteVitals } from '@svelte-vitals/vite';");
  });

  it('defineConfig({ plugins: [...] }) → added, plugin unshifted, import added', () => {
    const src = `
import { defineConfig } from 'astro/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()]
});
`;
    const result = codemodViteConfig(src);
    expect(result.status).toBe('added');
    expect(result.content).toContain("import { svelteVitals } from '@svelte-vitals/vite';");
    expect(result.content).toMatch(/plugins:\s*\[svelteVitals\(\), sveltekit\(\)\]/);
  });

  it('plain object export default with plugins array → added', () => {
    const src = `export default { plugins: [] };`;
    const result = codemodViteConfig(src);
    expect(result.status).toBe('added');
    expect(result.content).toContain('svelteVitals()');
  });

  it('svelteVitals already registered → exists, no content', () => {
    const src = `
import { svelteVitals } from '@svelte-vitals/vite';
export default { plugins: [svelteVitals({ failOn: 'critical' }), sveltekit()] };
`;
    const result = codemodViteConfig(src);
    expect(result.status).toBe('exists');
    expect(result.content).toBeUndefined();
  });

  it('no plugins array → manual, original file untouched', () => {
    const src = `export default { server: {} };`;
    const result = codemodViteConfig(src);
    expect(result.status).toBe('manual');
    expect(result.content).toBeUndefined();
  });

  it('a shape magicast cannot parse into a recognizable default export → manual, no throw', () => {
    const src = `export default (() => ({ plugins: [] }))();`;
    expect(() => codemodViteConfig(src)).not.toThrow();
    expect(codemodViteConfig(src).status).toBe('manual');
  });
});
