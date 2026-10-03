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

  it('reads an awaited method of an object the load made as filling it, not one of an import', () => {
    const own = [
      'export async function load() {',
      '  const auth = getAuth();',
      '  await auth.initialize();',
      '  await applyLocale(auth.user);',
      '}'
    ].join('\n');
    expect(wf(own)).toEqual({ dependentLines: [4], independentLines: [] });
    const imported = [
      "import { redis, db } from '$lib/server/clients';",
      'export async function load() {',
      '  await redis.ping();',
      '  await db.count(redis);',
      '}'
    ].join('\n');
    expect(wf(imported)).toEqual({ dependentLines: [], independentLines: [4] });
    const aliased = [
      "import { redis, db } from '$lib/server/clients';",
      'export async function load() {',
      '  const client = redis;',
      '  await client.ping();',
      '  await db.count(client);',
      '}'
    ].join('\n');
    expect(wf(aliased)).toEqual({ dependentLines: [], independentLines: [5] });
    const inTry = [
      'export async function load() {',
      '  try {',
      '    const session = createSession();',
      '    await session.initialize();',
      '    await greet(session.user);',
      '  } catch {}',
      '}'
    ].join('\n');
    expect(wf(inTry)).toEqual({ dependentLines: [5], independentLines: [] });
  });

  it('reads a container a callback over an earlier result fills as depending on it', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const lists = await fetch("/api/lists").then((r) => r.json());',
      '  const ids = new Set();',
      '  lists.forEach((l) => l.items.forEach((id) => ids.add(id)));',
      '  const cards = await fetch(`/api/cards?ids=${[...ids].join(",")}`);',
      '  return { cards };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [5], independentLines: [] });
    const mapped = [
      'export async function load({ fetch }) {',
      '  const lists = await fetch("/api/lists").then((r) => r.json());',
      '  const ids = new Set();',
      '  const names = lists.map((l) => { ids.add(l.id); return l.name; });',
      '  const cards = await fetch(`/api/cards?ids=${[...ids].join(",")}`);',
      '  return { cards, names };',
      '}'
    ].join('\n');
    expect(wf(mapped)).toEqual({ dependentLines: [5], independentLines: [] });
    const uncalled = [
      'export async function load({ fetch }) {',
      '  const lists = await fetch("/api/lists").then((r) => r.json());',
      '  const ids = new Set();',
      '  lists.forEach(() => { const later = () => ids.add("x"); });',
      '  const cards = await fetch(`/api/cards?ids=${[...ids].join(",")}`);',
      '  return { cards };',
      '}'
    ].join('\n');
    expect(wf(uncalled)).toEqual({ dependentLines: [], independentLines: [5] });
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

  it('tracks taint through a for…of loop variable pushed into a list', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const space = await fetch("/api/space").then((r) => r.json());',
      '  const going = [];',
      '  for (const r of space.rsvps) {',
      '    if (r.going) going.push(r.did);',
      '  }',
      '  const profiles = await fetch(`/api/profiles?ids=${going.join(",")}`);',
      '  return { profiles };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [7], independentLines: [] });
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

  it('does not treat Promise.all over response-body parses as a hop', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const [a, b] = await Promise.all([fetch("/api/a"), fetch("/api/b")]);',
      '  const [x, y] = await Promise.all([a.json(), b.json()]);',
      '  const posts = await fetch(`/api/posts/${x.id}`);',
      '  return { y, posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [4], independentLines: [] });
    const mixed = src.replace('b.json()', 'fetch("/api/c")');
    expect(wf(mixed)?.dependentLines).toEqual([3, 4]);
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

  it('taints member-expression assignment targets via their root object', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const state = {};',
      '  state.user = await fetch("/api/user").then((r) => r.json());',
      '  const posts = await fetch(`/api/posts/${state.user.id}`);',
      '  return { state, posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [4], independentLines: [] });
  });

  it('propagates taint from assignments inside if blocks without classifying them', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const a = await fetch("/api/a");',
      '  let user;',
      '  if (!a.cached) {',
      '    user = await fetch("/api/user").then((r) => r.json());',
      '  }',
      '  const posts = await fetch(`/api/posts/${user.id}`);',
      '  return { a, posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [7], independentLines: [] });
  });

  it('taints compound-assignment targets', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  let user;',
      '  user ??= await fetch("/api/user").then((r) => r.json());',
      '  const posts = await fetch(`/api/posts/${user.id}`);',
      '  return { user, posts };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [4], independentLines: [] });
  });

  it('anchors a dependent statement at its first dependent await', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const user = await fetch("/api/user").then((r) => r.json());',
      '  return {',
      '    a: await fetch("/api/a"),',
      '    b: await fetch(`/api/b/${user.id}`)',
      '  };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [5], independentLines: [] });
  });

  it('does not flag awaits of pre-started promises', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const aP = fetch("/api/a");',
      '  const bP = fetch("/api/b");',
      '  const a = await aP;',
      '  const b = await bP;',
      '  return { a, b };',
      '}'
    ].join('\n');
    expect(wf(src)).toBeUndefined();
  });

  it('does not count an await of a promise an ancestor load already started as a hop', () => {
    const src = [
      'export async function load({ parent }) {',
      '  const { deferred } = await parent();',
      '  const state = await deferred.state;',
      '  const more = await fetch(`/api/${state.id}`);',
      '  return { state, more };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [4], independentLines: [] });
  });

  it('does not count an await of an in-flight promise copied to a local as a hop', () => {
    const src = [
      'export async function load({ parent }) {',
      '  const { deferred } = await parent();',
      '  const p = deferred.state;',
      '  const state = await p;',
      '  const more = await fetch(`/api/${state.id}`);',
      '  return { state, more };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [5], independentLines: [] });
  });

  it('counts an await of a local copied from a promise started from an earlier result', () => {
    const src = [
      'export async function load({ fetch, parent }) {',
      '  const { id } = await parent();',
      '  const started = id ? fetch(`/api/${id}`) : null;',
      '  const p = started;',
      '  const r = await p;',
      '  return { r };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [5], independentLines: [] });
  });

  it('still counts an await of a promise started from an earlier result', () => {
    const src = [
      'export async function load({ fetch, parent }) {',
      '  const { id } = await parent();',
      '  const p = fetch(`/api/${id}`);',
      '  const r = await p;',
      '  return { r };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [4], independentLines: [] });
  });

  it('does not flag an await of a promise held in a member expression', () => {
    const src = [
      "import { mgr } from '$lib/mgr';",
      'export async function load({ fetch }) {',
      '  const res = await fetch("/api/a");',
      '  await mgr.loading;',
      '  await mgr?.ready;',
      '  return { res: res.status };',
      '}'
    ].join('\n');
    expect(wf(src)).toBeUndefined();
  });

  it('flags work-starting awaits of new, import(), optional calls and tagged templates', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const a = await fetch("/api/a");',
      '  const b = await new Promise((r) => setTimeout(r, 1));',
      '  const c = await import("./c");',
      '  const d = await api?.get("/d");',
      '  const e = await sql`select 1`;',
      '  return { a, b, c, d, e };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [3, 4, 5, 6] });
  });

  it('still flags a work-starting await after a pre-started one', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const aP = fetch("/api/a");',
      '  const a = await aP;',
      '  const b = await fetch("/api/b");',
      '  return { a, b };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [], independentLines: [4] });
  });

  it('counts an await guarded by an earlier result as dependent', () => {
    const src = [
      'export async function load({ fetch }) {',
      '  const list = await fetch("/api/list").then((r) => r.json());',
      '  const org = list[0]?.org ?? (await fetch("/api/org"));',
      '  const isFirst = await fetch("/api/first").then((r) => r.json());',
      '  const extra = isFirst ? await fetch("/api/extra") : null;',
      '  const more = isFirst && (await fetch("/api/more"));',
      '  const other = ok ? null : await fetch("/api/other");',
      '  return { org, extra, more, other };',
      '}'
    ].join('\n');
    expect(wf(src)).toEqual({ dependentLines: [3, 5, 6], independentLines: [4, 7] });
  });

  it('records the csr=false opt-out', () => {
    const src = 'export const csr = false;\nexport async function load({ fetch }) {\n  return {};\n}';
    expect(parseKitModuleFacts(src, 'src/routes/+page.ts').csrDisabled).toEqual({ line: 1 });
  });
});
