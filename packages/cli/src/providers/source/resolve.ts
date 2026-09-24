import type { Config } from '@svelte-vitals/core';
import type { BranchStep, ComponentFacts, HeadingInfo, KitAlias, Runtime } from '@svelte-vitals/core/internal';
import {
  attrTextOf,
  collectConstantListExports,
  parseModuleProgram,
  resolveRepoLocalPath
} from '@svelte-vitals/core/internal';
import type { ParsedFile, ParsedTag, PropArgs } from './parse.js';
import { findAdapter } from './adapters/index.js';
import { addImportsFromProgram, importOf, type ImportMap } from './imports.js';
import { argsOf, parseFile, tagsInHead } from './parse.js';

/** Props a heading component conventionally takes its element from (`<Heading tag="h1">`, `as`, `element`, `is`). */
const HEADING_TAG_PROPS = new Set(['tag', 'as', 'element', 'is']);

interface ResolveResult {
  tags: ParsedTag[];
  broad: boolean;
  /**
   * Headings belonging to STRICT descendants reached via layer 3 — never `fileRel`'s
   * own headings (routes.ts already collects those from the chain file directly;
   * including them here too would double-count). Paths are addressed in `fileRel`'s space:
   * groups below `parsed.headingGroups` are its own blocks, each component instance above them.
   */
  headings: HeadingInfo[];
  /** Group numbers `headings` and `fileRel`'s own headings use together. */
  groupSpan: number;
  /** A heading of an undetermined level may render: a descendant's `<svelte:element>`, or an unfollowable component given a literal heading tag. */
  dynamicHeading: boolean;
}

/** What a `.ts`/`.js` barrel forwards: export name → the binding behind it, plus its `export *` sources. */
export interface ModuleExports {
  named: ImportMap;
  stars: string[];
  /** Exports that are constant lists the module never writes (correctness/each-key). */
  lists: Set<string>;
}

/**
 * Per-run read+parse memo, keyed by project-root-relative path (as normalized by
 * chainFiles / resolveExport). Shared across routes so a file imported by
 * many pages (a root layout, a common $lib component) is only parsed once per run.
 * Barrel modules share it so the dev dashboard's per-file invalidation reaches them too.
 */
export type ParseCache = Map<string, Promise<ParsedFile | ModuleExports>>;

/**
 * Read and parse `rel` at most once per cache. The cached value is a Promise (not
 * the resolved ParsedFile) so that concurrent callers racing on the same file
 * (collectRoutes resolves all routes in parallel) share a single in-flight parse
 * instead of triggering duplicate reads/parses.
 *
 * If the read or parse rejects, the rejected promise stays cached: every caller
 * that shares the file sees the same failure. This matches pre-cache behavior,
 * where a single malformed route file already failed the whole run (exit 2, see
 * Plan 002's characterization tests) — the cache does not change that contract.
 */
export function readAndParse(rt: Runtime, cwd: string, rel: string, cache: ParseCache): Promise<ParsedFile> {
  // `.svelte` keys only ever hold a ParsedFile; barrels are `.ts`/`.js`.
  let hit = cache.get(rel) as Promise<ParsedFile> | undefined;
  if (!hit) {
    hit = rt.readFile(rt.join(cwd, rel)).then((source) => parseFile(source, rel));
    cache.set(rel, hit);
  }
  return hit;
}

function nameOf(node: { type: string; name?: string; value?: unknown }): string {
  return node.type === 'Identifier' ? node.name! : String(node.value);
}

/** A barrel's value re-exports. A module that does not parse forwards nothing, so its components stay unresolved. */
function moduleExportsOf(source: string, rel: string): ModuleExports {
  const out: ModuleExports = { named: new Map(), stars: [], lists: new Set() };
  let program;
  try {
    program = parseModuleProgram(source, rel).program;
  } catch {
    return out;
  }
  out.lists = collectConstantListExports(program);
  const imports: ImportMap = new Map();
  addImportsFromProgram(program, imports);
  for (const node of program?.body ?? []) {
    if (node.exportKind === 'type') continue;
    if (node.type === 'ExportAllDeclaration') {
      if (!node.exported) out.stars.push(String(node.source.value));
    } else if (node.type === 'ExportNamedDeclaration') {
      for (const spec of node.specifiers) {
        if (spec.exportKind === 'type') continue;
        const local = nameOf(spec.local);
        const binding = node.source ? { source: String(node.source.value), imported: local } : imports.get(local);
        if (binding) out.named.set(nameOf(spec.exported), binding);
      }
    } else if (node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'Identifier') {
      const binding = imports.get(node.declaration.name);
      if (binding) out.named.set('default', binding);
    }
  }
  return out;
}

/** What component resolution reads through: the run's runtime, parse cache and compiled Kit aliases. */
export interface ResolveCtx {
  rt: Runtime;
  cwd: string;
  cache: ParseCache;
  aliases: readonly KitAlias[] | undefined;
}

function readModuleExports(ctx: ResolveCtx, rel: string): Promise<ModuleExports> {
  let hit = ctx.cache.get(rel) as Promise<ModuleExports> | undefined;
  if (!hit) {
    hit = ctx.rt.readFile(ctx.rt.join(ctx.cwd, rel)).then((source) => moduleExportsOf(source, rel));
    ctx.cache.set(rel, hit);
  }
  return hit;
}

/** Re-export hops followed before giving up; also what ends an `export *` cycle. */
const MAX_REEXPORT_HOPS = 8;

/**
 * The existing `.svelte` file behind export `name` of module `spec`, following barrel re-exports
 * — or, for `target: 'list'`, the module declaring it when it is a constant list.
 * Extensionless specifiers try `.svelte` first (projects that add it to `resolve.extensions`),
 * then Vite's own `.js`/`.ts` and `index` lookups; an explicit `.js` may name its `.ts` source.
 */
async function resolveExport(
  ctx: ResolveCtx,
  spec: string,
  fromRel: string,
  name: string,
  target: 'component' | 'list' = 'component',
  hops = 0,
  // Per lookup, not in the shared ParseCache: the dev dashboard invalidates that per file, which
  // a memo of results spanning several files would outlive. Without it, branching `export *`
  // cycles revisit the same states until the hop limit.
  memo = new Map<string, Promise<string | undefined>>()
): Promise<string | undefined> {
  if (name === '*' || hops > MAX_REEXPORT_HOPS) return undefined;
  const path = resolveRepoLocalPath(spec, fromRel, ctx.aliases);
  if (path === undefined) return undefined;
  const key = `${path}#${name}#${hops}`;
  let hit = memo.get(key);
  if (!hit) {
    hit = resolveExportAt(ctx, path, name, target, hops, memo);
    memo.set(key, hit);
  }
  return hit;
}

async function resolveExportAt(
  ctx: ResolveCtx,
  path: string,
  name: string,
  target: 'component' | 'list',
  hops: number,
  memo: Map<string, Promise<string | undefined>>
): Promise<string | undefined> {
  const exists = (rel: string) => ctx.rt.exists(ctx.rt.join(ctx.cwd, rel));
  const ext = /\.[^./]+$/.exec(path)?.[0];
  const component = target === 'component' && name === 'default';
  let modules: string[];
  if (ext === '.svelte') return component && (await exists(path)) ? path : undefined;
  if (ext === undefined) {
    if (component && (await exists(`${path}.svelte`))) return `${path}.svelte`;
    modules = ['.js', '.ts', '/index.js', '/index.ts'].map((suffix) => path + suffix);
  } else if (ext === '.js') modules = [path, `${path.slice(0, -3)}.ts`];
  else if (ext === '.ts') modules = [path];
  else return undefined;
  for (const mod of modules) {
    if (!(await exists(mod))) continue;
    const exports = await readModuleExports(ctx, mod);
    if (target === 'list' && exports.lists.has(name)) return mod;
    const hit = exports.named.get(name);
    if (hit) return resolveExport(ctx, hit.source, mod, hit.imported, target, hops + 1, memo);
    if (name === 'default') return undefined; // `export *` never forwards a default
    for (const star of exports.stars) {
      const found = await resolveExport(ctx, star, mod, name, target, hops + 1, memo);
      if (found) return found;
    }
    return undefined;
  }
  return undefined;
}

/**
 * The `.svelte` files a component tag may render — several when a local holds one of several
 * components (`parsed.componentBindings`) — and whether that list is everything it may render.
 */
export async function resolveComponentFiles(
  ctx: ResolveCtx,
  name: string,
  parsed: ParsedFile,
  fileRel: string
): Promise<{ files: string[]; complete: boolean }> {
  const files = new Set<string>();
  let complete = true;
  for (const candidate of parsed.componentBindings.get(name) ?? [name]) {
    const info = candidate ? importOf(parsed.imports, candidate) : undefined;
    const file = info ? await resolveExport(ctx, info.source, fileRel, info.imported) : undefined;
    if (file) files.add(file);
    else complete = false;
  }
  return { files: [...files], complete };
}

/**
 * `components` without the `{#each}` blocks whose imported list (`EachBlockFact.importedList`)
 * resolves to a repo-local constant list — the same exemption a same-file constant gets.
 */
export async function dropConstantListEachBlocks(
  ctx: ResolveCtx,
  components: ComponentFacts[]
): Promise<ComponentFacts[]> {
  return Promise.all(
    components.map(async (c) => {
      if (!c.eachBlocks.some((e) => e.importedList)) return c;
      const constant = await Promise.all(
        c.eachBlocks.map(async ({ importedList: list }) =>
          list ? (await resolveExport(ctx, list.source, c.file, list.imported, 'list')) !== undefined : false
        )
      );
      return { ...c, eachBlocks: c.eachBlocks.filter((_, i) => !constant[i]) };
    })
  );
}

export function offsetPath(path: BranchStep[], base: number): BranchStep[] {
  return base === 0 ? path : path.map((step) => ({ group: step.group + base, branch: step.branch }));
}

/** `heading` re-addressed below `prefix`, its own group numbers shifted up by `base`. */
export function nestHeading(heading: HeadingInfo, prefix: BranchStep[], base: number): HeadingInfo {
  const { path: own, ...rest } = heading;
  const path = [...prefix, ...offsetPath(own ?? [], base)];
  return path.length > 0 ? { ...rest, path } : rest;
}

/** A tag one of several exclusive components renders: it may render, with no literal claim (as in `conditionalTags`). */
function maybeTag(tag: ParsedTag): ParsedTag {
  const { text: _text, noindex: _noindex, jsonld: _jsonld, hreflang: _hreflang, ...shape } = tag;
  return { ...shape, value: 'dynamic' };
}

/** Tag kinds a broad (opaque) meta source is assumed to possibly set, all dynamic. */
export const BROAD_KINDS: ParsedTag[] = [
  { kind: 'title', value: 'dynamic' },
  { kind: 'meta', name: 'description', value: 'dynamic' },
  { kind: 'link', rel: 'canonical', value: 'dynamic' },
  { kind: 'meta', property: 'og:title', value: 'dynamic' },
  { kind: 'meta', property: 'og:description', value: 'dynamic' },
  { kind: 'meta', property: 'og:image', value: 'dynamic' },
  { kind: 'meta', property: 'og:url', value: 'dynamic' },
  { kind: 'meta', name: 'twitter:card', value: 'dynamic' },
  { kind: 'meta', name: 'robots', value: 'dynamic' }
  // jsonld is intentionally omitted: structured data is a distinct concern, not a
  // meta-tag family a broad meta source implies (JsonLd has its own adapter).
];

/** Override key for singular tags in routes.ts's composed head (additive kinds never reach it). */
export function tagKey(tag: ParsedTag): string {
  switch (tag.kind) {
    case 'title':
      return 'title';
    case 'meta':
      return `meta:${tag.name ? `name=${tag.name}` : tag.property ? `prop=${tag.property}` : '?'}`;
    case 'link':
      return `link:${tag.rel ?? '?'}`;
    case 'jsonld':
      return 'jsonld';
    case 'script':
      return `script:${tag.href ?? '?'}`;
  }
}

/**
 * Resolve a file's specific head tags (layer 1 + component layers 2/3/4) and whether
 * a broad (opaque) meta source is present. Includes transitive recursion (depth-limited, cycle-guarded).
 */
export async function resolveFileTags(
  rt: Runtime,
  cwd: string,
  fileRel: string,
  parsed: ParsedFile,
  config: Config,
  depth: number,
  visited: Set<string>,
  // Defaults to a fresh, single-call cache so existing direct callers (e.g. unit
  // tests exercising this function in isolation) don't need to pass one; real
  // callers (routes.ts) always pass the shared per-run cache explicitly.
  cache: ParseCache = new Map(),
  // The project's compiled `kitAliases` (undefined -> the `$lib`-only
  // default), forwarded to every layer-3 component resolution, including recursive calls.
  aliases?: readonly KitAlias[],
  // Set when a parent renders this file inside `<svelte:head>`: the literal props it passes.
  inHead?: PropArgs
): Promise<ResolveResult> {
  const tags: ParsedTag[] = [...parsed.headTags, ...(inHead ? tagsInHead(parsed, inHead) : [])];
  const headings: HeadingInfo[] = [];
  let groupSpan = parsed.headingGroups;
  let dynamicHeading = false;
  let broad = false;
  const ctx: ResolveCtx = { rt, cwd, cache, aliases };

  for (const use of parsed.components) {
    const info = importOf(parsed.imports, use.name);

    // Layer 2: known-package adapter.
    const adapter = info ? findAdapter(info) : undefined;
    if (adapter) {
      const result = adapter.resolve(use);
      tags.push(...(use.conditional ? result.tags.map(maybeTag) : result.tags));
      broad = broad || result.broad;
      continue;
    }

    // Layer 3: transitively resolve a user component in src/.
    const found = depth > 0 ? await resolveComponentFiles(ctx, use.name, parsed, fileRel) : undefined;
    const files = found?.files.filter((f) => !visited.has(f)) ?? [];
    if (found && files.length > 0) {
      // Which of several components renders, or whether one renders at all, is runtime state.
      const exclusive = files.length > 1 || !found.complete || files.length < found.files.length;
      const childHead = inHead || use.inHead ? argsOf(parsed, use, inHead ?? new Map()) : undefined;
      const maybe = new Map<string, ParsedTag>();
      for (const childRel of files) {
        const childParsed = await readAndParse(rt, cwd, childRel, cache);
        const childVisited = new Set(visited).add(childRel);
        const child = await resolveFileTags(
          rt,
          cwd,
          childRel,
          childParsed,
          config,
          depth - 1,
          childVisited,
          cache,
          aliases,
          childHead
        );
        broad = broad || child.broad;
        const childHeadings = [...childParsed.headings.map((h) => ({ ...h, file: childRel })), ...child.headings];
        const childDynamic = childParsed.dynamicHeading || child.dynamicHeading;
        // A component in an `{#if}` arm competes for headings through its arm path, and its head tags
        // make no literal claim, like `conditionalTags`.
        if (!exclusive && !use.conditional) tags.push(...child.tags);
        else for (const tag of child.tags.map(maybeTag)) maybe.set(JSON.stringify(tag), tag);
        if (!exclusive) {
          // Each instance gets its own group range, so two instances' arms never fold as one block.
          headings.push(...childHeadings.map((h) => nestHeading(h, use.path, groupSpan)));
          groupSpan += child.groupSpan;
          dynamicHeading = dynamicHeading || childDynamic;
          continue;
        }
        // Counting each candidate's <h1> would invent a second one; any of them may be the page's.
        if (childDynamic || childHeadings.some((h) => h.level === 1)) dynamicHeading = true;
      }
      tags.push(...maybe.values());
      continue;
    }

    // A component we cannot follow may render its heading from a prop (`<Heading tag="h1">`), so,
    // like an undeterminable `<svelte:element>`, it rules out the "no <h1>" claim. Only element props and
    // only h1: `value="h1"` on a toolbar button, or `tag="h3"`, says nothing about the page's <h1>.
    if (
      use.attributes.some(
        (a) => a.type === 'Attribute' && HEADING_TAG_PROPS.has(a.name) && attrTextOf(a)?.trim().toLowerCase() === 'h1'
      )
    ) {
      dynamicHeading = true;
    }

    // Layer 4, a fallback, never an override: a declared meta component is only credited as a
    // broad source when layer 3 could not follow it (bare specifier, missing file, depth limit,
    // cycle cut). A resolvable declaration is a no-op — otherwise declaring a local wrapper
    // would *lose* its resolved tags (e.g. jsonld, which BROAD_KINDS deliberately omits).
    if (config.metaComponents.includes(use.name)) {
      broad = true;
      continue;
    }

    // Unresolved & undeclared components contribute nothing (strict).
  }

  return { tags, broad, headings, groupSpan, dynamicHeading };
}
