// Match a route path against a glob (`blog/*`, `**/admin`, `static/**`). An
// undefined glob matches everything. Lives in its own module so `collect-all.ts`
// can use it without importing `index.ts` (which imports `collect-all.ts`).
export function routeMatcher(glob: string | undefined): (route: string) => boolean {
  if (!glob) return () => true;
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ') // globstar placeholder
    .replace(/\*/g, '[^/]*') // single-segment wildcard (placeholder untouched)
    .replace(/\/ $/g, '(?:/.*)?') // trailing /** -> optional subtree
    .replace(/^ \//g, '(?:.*/)?') // leading **/ -> optional prefix
    .replace(/ \//g, '(?:.*/)?') // internal **/ -> optional prefix
    .replace(/\/ /g, '(?:/.*)?') // internal /** -> optional subtree
    .replace(/ /g, '.*'); // bare ** -> .*
  const re = new RegExp(`^${body}$`);
  return (route) => re.test(route.replace(/^\//, ''));
}
