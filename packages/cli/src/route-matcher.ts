// Match a route path against a glob (`blog/*`, `**/admin`, `static/**`). An
// undefined glob matches everything. Lives in its own module so `collect-all.ts`
// can use it without importing `index.ts` (which imports `collect-all.ts`).
export function routeMatcher(glob: string | undefined): (route: string) => boolean {
  if (!glob) return () => true;
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0') // globstar placeholder (not a literal space: a glob can contain one)
    .replace(/\*/g, '[^/]*') // single-segment wildcard (placeholder untouched)
    .replace(/\/\0$/g, '(?:/.*)?') // trailing /** -> optional subtree
    .replace(/^\0\//g, '(?:.*/)?') // leading **/ -> optional prefix
    .replace(/\0\//g, '(?:.*/)?') // internal **/ -> optional prefix
    .replace(/\/\0/g, '(?:/.*)?') // internal /** -> optional subtree
    .replace(/\0/g, '.*'); // bare ** -> .*
  const re = new RegExp(`^${body}$`);
  return (route) => re.test(route.replace(/^\//, ''));
}
