import { describe, it, expect } from 'vitest';
import { parseKitModuleFacts } from '../src/kit-module-parse.js';

const links = (src: string, file = 'src/routes/+page.server.ts') => parseKitModuleFacts(src, file).basePathLinks;
const importRedirect = `import { redirect } from '@sveltejs/kit';`;

describe('basePathLinks — redirect()', () => {
  it('records a root-relative redirect target', () => {
    const src = [importRedirect, `export function load() {`, `  redirect(303, '/login');`, `}`].join('\n');
    expect(links(src)).toEqual([{ kind: 'redirect', path: '/login', line: 3 }]);
  });

  it('records a thrown redirect (the SvelteKit 1 form)', () => {
    const src = [importRedirect, `export function load() {`, `  throw redirect(303, '/login');`, `}`].join('\n');
    expect(links(src)).toEqual([{ kind: 'redirect', path: '/login', line: 3 }]);
  });

  it('records an aliased redirect import', () => {
    const src = [
      `import { redirect as go } from '@sveltejs/kit';`,
      `export function load() {`,
      `  go(307, '/x');`,
      `}`
    ].join('\n');
    expect(links(src)).toEqual([{ kind: 'redirect', path: '/x', line: 3 }]);
  });

  it('records a redirect in a universal load', () => {
    const src = [importRedirect, `export function load() {`, `  redirect(303, '/x');`, `}`].join('\n');
    expect(links(src, 'src/routes/+page.ts')).toEqual([{ kind: 'redirect', path: '/x', line: 3 }]);
  });

  it('does not record a resolve-wrapped or base-prefixed target', () => {
    const wrapped = [importRedirect, `export function load() {`, `  redirect(303, resolve('/x'));`, `}`].join('\n');
    expect(links(wrapped)).toEqual([]);
    const prefixed = [importRedirect, `export function load() {`, '  redirect(303, `${base}/x`);', `}`].join(
      '\n'
    );
    expect(links(prefixed)).toEqual([]);
  });

  it('does not record external, hash, or non-literal targets', () => {
    const external = [importRedirect, `export function load() {`, `  redirect(303, 'https://x.dev');`, `}`].join('\n');
    expect(links(external)).toEqual([]);
    const protocolRelative = [importRedirect, `export function load() {`, `  redirect(303, '//x.dev');`, `}`].join(
      '\n'
    );
    expect(links(protocolRelative)).toEqual([]);
    const variable = [importRedirect, `export function load() {`, `  redirect(303, target);`, `}`].join('\n');
    expect(links(variable)).toEqual([]);
  });

  it('does not record a redirect imported from somewhere else', () => {
    const src = [
      `import { redirect } from './helpers.js';`,
      `export function load() {`,
      `  redirect(303, '/x');`,
      `}`
    ].join('\n');
    expect(links(src)).toEqual([]);
  });

  it('is empty for a module with no redirect', () => {
    expect(links(`export function load() { return {}; }`)).toEqual([]);
  });
});
