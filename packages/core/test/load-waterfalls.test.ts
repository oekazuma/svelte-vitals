import { describe, it, expect } from 'vitest';
import { parseKitModuleFacts } from '../src/kit-module-parse.js';

const wf = (src: string) => parseKitModuleFacts(src, 'src/routes/+page.ts').loadWaterfalls;

describe('collectLoadWaterfalls — dependent chains', () => {
  it('flags a direct dependent await', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const user = await fetch("/api/user").then((r) => r.json());',
      '  const posts = await fetch(`/api/posts/${user.id}`);',
      '  return { user, posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [3], independentLines: [] });
  });

  it('tracks taint through an intermediate const', () => {
    const src = [
      'export const load = async ({ fetch }) => {',
      '  const res = await fetch("/api/user");',
      '  const id = res.id;',
      '  const posts = await fetch(`/api/posts/${id}`);',
      '  return { posts };',
      '};'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [4], independentLines: [] });
  });

  it('tracks destructured bindings', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const { id } = await fetch("/api/user").then((r) => r.json());',
      '  const posts = await fetch(`/api/posts/${id}`);',
      '  return { posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [3], independentLines: [] });
  });

  it('does not treat a response-body parse as a hop', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const res = await fetch("/api/user");',
      '  const data = await res.json();',
      '  return { data };',
      '}'
    ].join('\n');
    expect(wf(src)).toBeUndefined();
  });

  it('keeps dependency through a body parse', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const res = await fetch("/api/user");',
      '  const data = await res.json();',
      '  const posts = await fetch(`/api/posts/${data.id}`);',
      '  return { posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [4], independentLines: [] });
  });

  it('does not exempt member calls named like body parsers when they take arguments', () => {
    const src = [
      'export async function load() {',
      '  const a = await api.json("users");',
      '  const b = await api.json("posts");',
      '  return { a, b };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3] });
  });

  it('taints assignment targets so try-wrapped chains stay dependent', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  let user;',
      '  try {',
      '    user = await fetch("/api/user").then((r) => r.json());',
      '  } catch {',
      '    user = null;',
      '  }',
      '  const posts = await fetch(`/api/posts/${user.id}`);',
      '  return { user, posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [8], independentLines: [] });
  });

  it('propagates taint through a non-await assignment', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const res = await fetch("/api/a");',
      '  let key;',
      '  key = res.key;',
      '  const b = await fetch(`/api/b/${key}`);',
      '  return { b };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [5], independentLines: [] });
  });
});

describe('collectLoadWaterfalls — independent sites', () => {
  it('flags the second of two unrelated awaits', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const a = await fetch("/api/a");',
      '  const b = await fetch("/api/b");',
      '  return { a, b };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3] });
  });

  it('flags an independent await in a return object', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const user = await fetch("/api/user").then((r) => r.json());',
      '  return { user, posts: await fetch("/api/posts") };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3] });
  });

  it('mixes dependent and independent sites in one load', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const user = await fetch("/api/user").then((r) => r.json());',
      '  const posts = await fetch(`/api/posts/${user.id}`);',
      '  const banner = await fetch("/api/banner");',
      '  return { user, posts, banner };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [3], independentLines: [4] });
  });
});

describe('collectLoadWaterfalls — exclusions and scope', () => {
  it('excludes await parent() but lets its bindings taint', () => {
    const src = [
      'export async function load({ parent, fetch }) {',
      '  const p = await parent();',
      '  const extra = await fetch(`/api/extra/${p.section}`);',
      '  return { extra };',
      '}'
    ].join('\n');
    // parent() is not a site; the fetch depends on p → dependent, and there is no independent site.
    expect(wf(src)).toEqual({ dependentLines: [3], independentLines: [] });
  });

  it('does not count a first await after parent() as independent', () => {
    const src = [
      'export async function load({ parent, fetch }) {',
      '  await parent();',
      '  const a = await fetch("/api/a");',
      '  return { a };',
      '}'
    ].join('\n');
    expect(wf(src)).toBeUndefined();
  });

  it('ignores a shadowing callback parameter', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const items = await fetch("/api/items").then((r) => r.json());',
      '  const names = await fetch("/api/names", { headers: mk((items) => items.h) });',
      '  return { items, names };',
      '}'
    ].join('\n');
    // the inner `items` param shadows the tainted binding → NOT dependent
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3] });
  });

  it('scans direct try-block statements', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  try {',
      '    const a = await fetch("/api/a");',
      '    const b = await fetch("/api/b");',
      '    return { a, b };',
      '  } catch {',
      '    return {};',
      '  }',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [4] });
  });

  it('does not descend into if blocks, loops, or nested functions', () => {
    const src = [
      'export async function load({ fetch, url }) {',
      '  const a = await fetch("/api/a");',
      '  if (url.searchParams.has("x")) {',
      '    const b = await fetch("/api/b");',
      '  }',
      '  for (const p of [1, 2]) {',
      '    await fetch(`/api/${p}`);',
      '  }',
      '  const helper = async () => await fetch("/api/c");',
      '  return { a };',
      '}'
    ].join('\n');
    expect(wf(src)).toBeUndefined();
  });

  it('resolves an alias-exported load', () => {
    const src = [
      'const myLoad = async ({ fetch }) => {',
      '  const a = await fetch("/api/a");',
      '  const b = await fetch("/api/b");',
      '  return { a, b };',
      '};',
      'export { myLoad as load };'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3] });
  });

  it('is unset for single-await loads and no-load files', () => {
    expect(wf('export async function load({ fetch }) {\n  return { a: await fetch("/a") };\n}')).toBeUndefined();
    expect(wf('export const actions = {};')).toBeUndefined();
    // Malformed sources throw at this layer by design — collectKitModuleFacts catches
    // and falls back to emptyKitModuleFacts (already pinned by the existing
    // malformed-file tests), so `loadWaterfalls` stays unset there too.
  });
});
