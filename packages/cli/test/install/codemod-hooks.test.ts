import { describe, it, expect } from 'vitest';
import { codemodHooksServer } from '../../src/install/codemod-hooks.js';

describe('codemodHooksServer', () => {
  it('file does not exist → created, with a fresh sequence(handle)', () => {
    const result = codemodHooksServer(undefined);
    expect(result.status).toBe('created');
    expect(result.content).toContain("import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';");
    expect(result.content).toMatch(/export const handle = sequence\(svelteVitalsHandle\(\)\)/);
  });

  it('existing sequence(...) call → added, appended as the last argument', () => {
    const src = `
import { sequence } from '@sveltejs/kit/hooks';
import { authHandle } from '$lib/auth';

export const handle = sequence(authHandle);
`;
    const result = codemodHooksServer(src);
    expect(result.status).toBe('added');
    expect(result.content).toContain("import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';");
    expect(result.content).toMatch(/sequence\(authHandle, svelteVitalsHandle\(\)\)/);
  });

  it('svelteVitalsHandle already in the sequence → exists, no content', () => {
    const src = `
import { sequence } from '@sveltejs/kit/hooks';
import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
export const handle = sequence(authHandle, svelteVitalsHandle());
`;
    const result = codemodHooksServer(src);
    expect(result.status).toBe('exists');
    expect(result.content).toBeUndefined();
  });

  it('bare (non-sequence) handle export → updated, wrapped in sequence(...)', () => {
    const src = `export const handle = async ({ event, resolve }) => resolve(event);`;
    const result = codemodHooksServer(src);
    expect(result.status).toBe('updated');
    expect(result.content).toContain("import { sequence } from '@sveltejs/kit/hooks';");
    expect(result.content).toContain("import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';");
    expect(result.content).toMatch(
      /export const handle = sequence\(async \(\{ event, resolve \}\) => resolve\(event\), svelteVitalsHandle\(\)\)/
    );
  });

  it('file exists but has no handle export → added, a fresh handle appended', () => {
    const src = `export function handleError() {}`;
    const result = codemodHooksServer(src);
    expect(result.status).toBe('added');
    expect(result.content).toContain('export function handleError() {}');
    expect(result.content).toMatch(/export const handle = sequence\(svelteVitalsHandle\(\)\)/);
  });

  it('a shape magicast cannot parse → manual, no throw', () => {
    const src = `export const handle = (() => async (e) => e.resolve())();`;
    expect(() => codemodHooksServer(src)).not.toThrow();
    expect(codemodHooksServer(src).status).toBe('manual');
  });
});
