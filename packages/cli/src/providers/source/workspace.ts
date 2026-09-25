import {
  declaredInstalledPackages,
  declaredLocalPackages,
  packageJsonWorkspaceGlobs,
  pnpmWorkspaceGlobs,
  type Runtime,
  type WorkspacePackage
} from '@svelte-vitals/core/internal';

/** Ancestors searched for the workspace root and `.git`; only a runtime whose `join` never reaches a fixed point needs it. */
const MAX_LEVELS = 32;

async function readIfExists(rt: Runtime, path: string): Promise<string | undefined> {
  try {
    return (await rt.exists(path)) ? await rt.readFile(path) : undefined;
  } catch {
    return undefined;
  }
}

function nameOf(manifest: string | undefined): string | undefined {
  try {
    const name = (JSON.parse(manifest ?? '') as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

/** `.`/`..` resolved, a leading `..` run kept. */
function normalize(path: string): string[] {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..' && out.length > 0 && out[out.length - 1] !== '..') out.pop();
    else out.push(seg);
  }
  return out;
}

/**
 * `path` below the directory `up` levels above the app, relative to the app. The app's own last
 * directory names come off `cwd`, so a package beside it reads `../ui`, not `../../apps/ui`.
 */
function fromApp(cwd: string, up: number, path: string): string {
  const tail = up === 0 ? [] : cwd.split(/[\\/]/).filter(Boolean).slice(-up);
  const segs = normalize(path);
  let shared = 0;
  if (tail.length === up) while (shared < up && tail[shared] === segs[shared]) shared++;
  return [...Array<string>(up - shared).fill('..'), ...segs.slice(shared)].join('/');
}

const isInside = (glob: string) => !glob.startsWith('/') && !glob.split('/').includes('..');

/**
 * The packages of the app's repository that its package.json (`packageJsonSource`) declares with a
 * `workspace:` range, found through the nearest workspace definition above it (`pnpm-workspace.yaml`
 * `packages`, or a package.json `workspaces`) and matched by `name`; and those it declares with a
 * `link:`/`file:` path inside the repository. The search stops at the directory holding `.git`, or
 * the filesystem root without one; a `link:`/`file:` path is followed only when a `.git` was found
 * and the path stays below it. An app that declares no such dependency costs no I/O.
 */
export async function findWorkspacePackages(
  rt: Runtime,
  cwd: string,
  packageJsonSource: string | undefined
): Promise<WorkspacePackage[]> {
  const declared = declaredLocalPackages(packageJsonSource);
  if (declared.size === 0) return [];
  const above = (up: number) => (up === 0 ? cwd : rt.join(cwd, ...Array<string>(up).fill('..')));
  let workspace: { up: number; globs: string[] } | undefined;
  let repoUp: number | undefined;
  for (let up = 0; up < MAX_LEVELS; up++) {
    const dir = above(up);
    if (!workspace) {
      const yaml = await readIfExists(rt, rt.join(dir, 'pnpm-workspace.yaml'));
      const globs =
        yaml !== undefined
          ? pnpmWorkspaceGlobs(yaml)
          : packageJsonWorkspaceGlobs(
              up === 0 ? packageJsonSource : await readIfExists(rt, rt.join(dir, 'package.json'))
            );
      if (globs) workspace = { up, globs };
    }
    if (await rt.exists(rt.join(dir, '.git'))) {
      repoUp = up;
      break;
    }
    if (rt.join(dir, '..') === dir) break;
  }

  const found: WorkspacePackage[] = [];
  if (workspace) {
    const { up, globs } = workspace;
    const root = above(up);
    const manifests = async (patterns: string[]) =>
      new Set(
        (await Promise.all(patterns.map((g) => rt.glob(`${g.replace(/\/+$/, '')}/package.json`, root))))
          .flat()
          .filter((p) => !p.split('/').includes('node_modules'))
      );
    const [included, excluded] = await Promise.all([
      manifests(globs.filter((g) => !g.startsWith('!') && isInside(g))),
      manifests(
        globs
          .filter((g) => g.startsWith('!'))
          .map((g) => g.slice(1))
          .filter(isInside)
      )
    ]);
    const paths = [...included].filter((p) => !excluded.has(p)).sort();
    const read = await Promise.all(paths.map((p) => readIfExists(rt, rt.join(root, p))));
    const byName = new Map<string, WorkspacePackage[]>();
    paths.forEach((p, i) => {
      const manifest = read[i];
      const name = nameOf(manifest);
      if (!name || !declared.get(name)?.startsWith('workspace:')) return;
      const dir = fromApp(cwd, up, p.slice(0, -'/package.json'.length));
      byName.set(name, [...(byName.get(name) ?? []), { name, dir, manifest: manifest! }]);
    });
    // Two directories under one name: which one the install linked is not knowable here.
    for (const pkgs of byName.values()) if (pkgs.length === 1) found.push(pkgs[0]!);
  }

  if (repoUp !== undefined) {
    for (const [name, range] of declared) {
      const target = /^(?:link|file):(.*)$/.exec(range)?.[1]?.replace(/\\/g, '/');
      if (target === undefined || target.startsWith('/') || /^[A-Za-z]:/.test(target)) continue;
      const segs = normalize(target);
      if (segs.length === 0 || segs.filter((s) => s === '..').length > repoUp) continue;
      const dir = segs.join('/');
      const manifest = await readIfExists(rt, rt.join(cwd, dir, 'package.json'));
      if (manifest !== undefined) found.push({ name, dir, manifest });
    }
  }
  return found;
}

/**
 * The packages the app declares from a registry, found as Node finds them: the first
 * `node_modules/<name>/package.json` from the app's directory upward. The walk ends at the directory
 * holding `.git`; without one, only the app's own `node_modules` is read. `dir` is the textual path
 * through `node_modules`, so a pnpm link is read through, as Vite reads it.
 */
export async function findInstalledPackages(
  rt: Runtime,
  cwd: string,
  packageJsonSource: string | undefined
): Promise<WorkspacePackage[]> {
  const names = declaredInstalledPackages(packageJsonSource);
  if (names.length === 0) return [];
  const above = (up: number) => (up === 0 ? cwd : rt.join(cwd, ...Array<string>(up).fill('..')));
  let levels = 1;
  for (let up = 0; up < MAX_LEVELS; up++) {
    const dir = above(up);
    if (await rt.exists(rt.join(dir, '.git'))) {
      levels = up + 1;
      break;
    }
    if (rt.join(dir, '..') === dir) break;
  }
  const found = await Promise.all(
    names.map(async (name): Promise<WorkspacePackage | undefined> => {
      for (let up = 0; up < levels; up++) {
        const manifest = await readIfExists(rt, rt.join(above(up), 'node_modules', name, 'package.json'));
        if (manifest !== undefined) return { name, dir: fromApp(cwd, up, `node_modules/${name}`), manifest };
      }
      return undefined;
    })
  );
  return found.filter((p) => p !== undefined);
}
