import { describe, it, expect } from 'vitest';
import { parse } from 'svelte/compiler';
import { collectComponentConstantLists, parseComponentFacts } from '../src/component-parse.js';
import { parseKitModuleFacts } from '../src/kit-module-parse.js';

/** An `{#if}` without `{:else}`: its `alternate` is `null`. The component fixture puts one inside each template construct. */
const empty = '{#if on}x{/if}';

const component = [
  '<script lang="ts">',
  "  import { goto } from '$app/navigation';",
  '  declare const VERSION: string;',
  '  let { on = false, items = [], p } = $props();',
  '  let state = $state<string | null>(null);',
  '  const pair = [, VERSION];',
  '  function f() {',
  "    if (on) goto('/x');",
  '    if (on) return;',
  '    for (;;) break;',
  '    try {',
  '      state = null;',
  '    } catch {}',
  '  }',
  '  $effect(() => {',
  '    state = on ? null : VERSION;',
  '  });',
  '</script>',
  `<button>${empty}</button>`,
  `<a href="/x">${empty}</a>`,
  `<label>${empty}<input name="q" /></label>`,
  `<label for="q">${empty}</label>`,
  `<select required>${empty}<option>a</option></select>`,
  `<time>${empty}</time>`,
  `<dl><dt>${empty}</dt><dd>${empty}</dd></dl>`,
  `<p>${empty}- a<br />- b</p>`,
  `<ul><li>${empty}</li></ul>`,
  `<div aria-hidden="true">${empty}<button>b</button></div>`,
  `<video autoplay>${empty}</video>`,
  `<h1>${empty}</h1>`,
  `{#each items as item}${empty}{item}{/each}`,
  `{#await p then v}${empty}{v}{/await}`,
  `{#snippet s()}${empty}{/snippet}`,
  `{#key on}${empty}{/key}`,
  `<Comp>${empty}</Comp>`,
  `<svg>${empty}</svg>`
].join('\n');

describe('empty branches and null fields', () => {
  it('parses a component with an empty branch inside every construct, null literals and a bodiless declaration', () => {
    const links = parseComponentFacts(component, 'src/lib/C.svelte').basePathLinks;
    expect(links.map((l) => `${l.kind} ${l.path}`)).toContain('goto /x');
    expect(collectComponentConstantLists(parse(component, { modern: true }), { sets: true }).has('pair')).toBe(true);
  });

  it('parses a runes module and a load whose expressions hold null literals', () => {
    const module = [
      'declare const VERSION: string;',
      'export const state = $state<string | null>(null);',
      'export function f(x?: string) {',
      '  if (!x) return;',
      '  return x ?? null;',
      '}'
    ].join('\n');
    expect(() => parseComponentFacts(module, 'src/lib/x.svelte.ts')).not.toThrow();
    const load = [
      'export async function load({ fetch }) {',
      "  const user = await fetch('/api/user').then((r) => r.json());",
      '  const avatar = user.avatar ?? null;',
      '  return { user, avatar };',
      '}'
    ].join('\n');
    expect(() => parseKitModuleFacts(load, 'src/routes/+page.ts')).not.toThrow();
  });

  it('parses route modules, endpoints and hooks whose statements leave optional fields null', () => {
    const src = [
      "import { redirect, error } from '@sveltejs/kit';",
      "import { building, browser } from '$app/environment';",
      "import { db } from '$lib/server/db';",
      'declare const VERSION: string;',
      'let count = 0;',
      'let cache: Map<string, string> | null = null;',
      'export const prerender = true;',
      'export const ssr = false;',
      'export const config = { runtime: null };',
      'class Store {',
      '  constructor() {}',
      '}',
      'export async function load({ fetch, locals, url, parent }) {',
      "  if (!locals.user) redirect(302, '/login');",
      '  if (building) return {};',
      '  const title = document.title;',
      "  if (url.searchParams.has('x')) {",
      '  }',
      "  const a = await fetch('/a').then((r) => r.json());",
      '  const b = a.items ?? null;',
      '  const [, c] = [1, 2];',
      '  for (;;) break;',
      '  try {',
      '    count = 1;',
      '  } catch {',
      '    cache = null;',
      '  }',
      '  const d = await parent();',
      '  const e = await db.query(`${b}`);',
      '  label: for (const x of []) {',
      '    if (x) continue label;',
      '  }',
      '  switch (b) {',
      '    case null:',
      '      break;',
      '    default:',
      '  }',
      '  return { a, b, c, d, e, f: null, g: /x/, h: new Store(), v: VERSION };',
      '}',
      'export const actions = {',
      '  default: async ({ request }) => {',
      '    const f = await request.formData();',
      '    if (!f) return;',
      '    return { ok: null };',
      '  }',
      '};',
      'export async function GET() {',
      '  if (browser) return new Response(null);',
      '  return new Response(null);',
      '}',
      'export const handle = async ({ event, resolve }) => {',
      "  if (event.url.pathname === '/') redirect(302, '/a');",
      '  if (!event) error(500);',
      '  return resolve(event);',
      '};'
    ].join('\n');
    for (const file of [
      'src/routes/+page.ts',
      'src/routes/+page.server.ts',
      'src/routes/+layout.ts',
      'src/routes/+layout.server.ts',
      'src/routes/api/+server.ts',
      'src/hooks.server.ts',
      'src/lib/state.svelte.ts'
    ]) {
      expect(
        () => (file.endsWith('.svelte.ts') ? parseComponentFacts(src, file) : parseKitModuleFacts(src, file)),
        file
      ).not.toThrow();
    }
    const rendered = src.replace('export const ssr = false;\n', '');
    for (const file of [
      'src/routes/+page.ts',
      'src/routes/+page.server.ts',
      'src/routes/api/+server.ts',
      'src/hooks.server.ts'
    ]) {
      expect(
        parseKitModuleFacts(rendered, file).browserGlobalRefs.map((r) => r.name),
        file
      ).toContain('document');
    }
  });
});
