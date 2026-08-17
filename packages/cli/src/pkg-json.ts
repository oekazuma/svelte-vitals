import { join } from 'node:path';

/** The package.json fields the dependency probes care about. */
export interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Parse raw package.json text; undefined when missing or malformed. */
export function parsePkg(raw: string | undefined): PkgJson | undefined {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as PkgJson;
  } catch {
    return undefined;
  }
}

/** Read and parse `dir`/package.json through the injected readFile. */
export function readPkg(readFile: (path: string) => string | undefined, dir: string): PkgJson | undefined {
  return parsePkg(readFile(join(dir, 'package.json')));
}

/** Whether `name` is declared in dependencies or devDependencies. */
export function hasDep(pkg: PkgJson | undefined, name: string): boolean {
  return Boolean(pkg?.dependencies?.[name] ?? pkg?.devDependencies?.[name]);
}
