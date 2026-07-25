/**
 * The path shape broken by `kit.paths.base` (correctness/base-path-navigation). Pure data
 * predicate — no imports, so both the component and Kit-module parsers can use it freely.
 */

/**
 * Whether a literal path is root-relative — it resolves against the domain root, so under a
 * base path it lands outside the app. `//host/x` is a protocol-relative EXTERNAL URL and is
 * excluded; `#hash`, `?query`, `./rel`, `rel`, and absolute URLs never start with `/`.
 */
export function isRootRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}
