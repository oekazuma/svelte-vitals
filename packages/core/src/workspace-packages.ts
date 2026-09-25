import { DEFAULT_KIT_ALIASES } from './kit-module-parse.js';
import { importTarget, normalizeAliasValue } from './svelte-config-parse.js';
import type { KitAlias } from './types.js';

/** A package of the app's own repository that the app declares: `dir` is relative to the app. */
export interface WorkspacePackage {
  name: string;
  dir: string;
  /** The package's `package.json` source. */
  manifest: string;
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

/**
 * The app's dependencies that link a package of the same repository, name → range: a `workspace:`
 * version range, or a `link:`/`file:` path. A `workspace:` range that renames (`workspace:other@*`)
 * or names a path is left out, since the specifier would not be the package's own name.
 */
export function declaredLocalPackages(packageJsonSource: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  let pkg: Partial<Record<(typeof DEPENDENCY_FIELDS)[number], unknown>>;
  try {
    pkg = JSON.parse(packageJsonSource ?? '');
  } catch {
    return out;
  }
  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg?.[field];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range === 'string' && /^(?:workspace:(?:[\^~*\d]|$)|link:|file:)/.test(range)) out.set(name, range);
    }
  }
  return out;
}

/** The `packages:` globs of a `pnpm-workspace.yaml`, in block (`- 'apps/*'`) or flow (`[a, b]`) form. */
export function pnpmWorkspaceGlobs(yaml: string): string[] {
  const out: string[] = [];
  const item = (raw: string) => {
    const value = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
    if (value) out.push(value);
  };
  let inPackages = false;
  for (const line of yaml.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const key = /^packages\s*:\s*(.*)$/.exec(line);
    if (key) {
      const flow = /^\[(.*)\]/.exec(key[1]!.replace(/\s+#.*$/, ''));
      if (flow) flow[1]!.split(',').forEach(item);
      inPackages = !flow;
      continue;
    }
    if (!inPackages) continue;
    // YAML allows a block sequence at the key's own indentation (`packages:` then `- 'apps/*'`).
    if (/^[^\s-]/.test(line)) break;
    const entry = /^\s*-\s*(.*?)\s*(?:\s#.*)?$/.exec(line);
    if (entry) item(entry[1]!);
  }
  return out;
}

/** A root `package.json`'s `workspaces` globs (an array, or `{ packages }`); undefined when it declares none. */
export function packageJsonWorkspaceGlobs(source: string | undefined): string[] | undefined {
  let workspaces: unknown;
  try {
    workspaces = (JSON.parse(source ?? '') as { workspaces?: unknown }).workspaces;
  } catch {
    return undefined;
  }
  const list = Array.isArray(workspaces) ? workspaces : (workspaces as { packages?: unknown } | undefined)?.packages;
  return Array.isArray(list) ? list.filter((g): g is string => typeof g === 'string') : undefined;
}

/** `dir/rel`, or `dir` itself for an empty `rel`. */
function inDir(dir: string, rel: string): string {
  const tail = normalizeAliasValue(rel);
  return tail ? `${dir}/${tail}` : dir;
}

/**
 * One package's entries, as Node resolves a bare specifier against its `exports`: a key without
 * `*` matches exactly, a `./x/*` key matches the directory's contents; exact keys come first, then
 * patterns by longest prefix. The condition walk is `importTarget`'s, in declaration order over
 * `svelte`/`import`/`module`/`default`. A target this cannot follow — an environment condition,
 * a `null` exclusion, a `*` mid-pattern, a path leaving the package — stays as an opaque entry so
 * a shorter pattern cannot answer in its place. Without `exports`, the package's file layout is
 * read directly.
 */
function entriesOf({ name, dir, manifest }: WorkspacePackage): KitAlias[] {
  let exports: unknown;
  try {
    exports = (JSON.parse(manifest) as { exports?: unknown }).exports;
  } catch {
    return [];
  }
  if (exports === undefined) return [{ find: name, replacement: dir, match: 'prefix', root: dir }];
  const keys = exports && typeof exports === 'object' && !Array.isArray(exports) ? Object.keys(exports) : [];
  const dotted = keys.filter((k) => k.startsWith('.')).length;
  if (dotted > 0 && dotted < keys.length) return [{ find: name, replacement: null, match: 'prefix', root: dir }];
  const subpaths = (dotted > 0 ? exports : { '.': exports }) as Record<string, unknown>;
  const out: KitAlias[] = [];
  for (const [key, value] of Object.entries(subpaths)) {
    const star = key.indexOf('*');
    const target = importTarget(value);
    const local = target?.startsWith('./') && !target.split('/').includes('..') ? target.slice(2) : undefined;
    if (star < 0) {
      const replacement = local === undefined || local.includes('*') ? null : inDir(dir, local);
      out.push({ find: name + key.slice(1), replacement, match: 'exact', root: dir });
      continue;
    }
    const head = key.slice(1, star);
    const trailing = star === key.length - 1 && head.endsWith('/');
    const replacement =
      trailing && local?.endsWith('/*') && local.indexOf('*') === local.length - 1
        ? inDir(dir, local.slice(0, -2))
        : null;
    out.push({ find: name + head.slice(0, head.lastIndexOf('/')), replacement, match: 'contents', root: dir });
  }
  return out.sort((a, b) =>
    a.match === b.match ? (a.match === 'exact' ? 0 : b.find.length - a.find.length) : a.match === 'exact' ? -1 : 1
  );
}

/**
 * `aliases` widened with the app's workspace packages, the way the bundler sees them: an alias
 * whose value points into `node_modules/<package>` names the package's own directory (the link a
 * workspace install creates, readable whether or not it was installed), and every package's
 * `exports` follows the aliases, as Vite resolves a bare specifier only after its alias plugin.
 */
export function withWorkspacePackages(
  aliases: KitAlias[] | undefined,
  packages: readonly WorkspacePackage[]
): KitAlias[] | undefined {
  if (packages.length === 0) return aliases;
  const linked = (entry: KitAlias): KitAlias => {
    for (const { name, dir } of packages) {
      const from = `node_modules/${name}`;
      const r = entry.replacement;
      if (r === from || r?.startsWith(`${from}/`))
        return { ...entry, replacement: dir + r.slice(from.length), root: dir };
    }
    return entry;
  };
  return [...(aliases ?? DEFAULT_KIT_ALIASES).map(linked), ...packages.flatMap(entriesOf)];
}
