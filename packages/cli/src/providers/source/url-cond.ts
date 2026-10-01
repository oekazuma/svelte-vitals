/** A layout's test on the request path, as far as the source fixes it: `u` is a part it does not. */
export type UrlCond =
  | { op: 'eq' | 'starts' | 'ends' | 'includes'; v: string }
  | { k: boolean }
  | { u: true }
  | { not: UrlCond }
  | { and: UrlCond[] }
  | { or: UrlCond[] };

const DYNAMIC = /\[[^\]]*\]/;

/**
 * Whether `cond` holds on a route (`/blog/[slug]`): true or false when the route's literal segments
 * decide it, undefined when a parameter, or a part of the test the source does not fix, could go either way.
 */
export function urlHolds(cond: UrlCond | undefined, route: string): boolean | undefined {
  if (!cond) return true;
  if ('k' in cond) return cond.k;
  if ('u' in cond) return undefined;
  if ('not' in cond) {
    const r = urlHolds(cond.not, route);
    return r === undefined ? undefined : !r;
  }
  if ('and' in cond) {
    const rs = cond.and.map((c) => urlHolds(c, route));
    return rs.includes(false) ? false : rs.every((r) => r === true) ? true : undefined;
  }
  if ('or' in cond) {
    const rs = cond.or.map((c) => urlHolds(c, route));
    return rs.includes(true) ? true : rs.every((r) => r === false) ? false : undefined;
  }
  const v = cond.v.length > 1 && cond.op === 'eq' ? cond.v.replace(/\/$/, '') : cond.v;
  const param = route.search(DYNAMIC);
  if (param === -1) {
    if (cond.op === 'eq') return route === v;
    if (cond.op === 'starts') return route.startsWith(v);
    if (cond.op === 'ends') return route.endsWith(v);
    return route.includes(v);
  }
  const prefix = route.slice(0, param);
  // An optional or rest parameter may match nothing, so the path can end where its prefix does.
  const mayEnd = /\[\[|\[\.\.\./.test(route);
  if (cond.op === 'starts') {
    if (v.length <= prefix.length) return prefix.startsWith(v);
    return v.startsWith(prefix) ? undefined : false;
  }
  if (cond.op === 'eq') {
    if (!v.startsWith(prefix.slice(0, Math.min(v.length, prefix.length)))) return false;
    return v.length <= prefix.length && !mayEnd ? false : undefined;
  }
  if (cond.op === 'includes') return route.split(DYNAMIC).some((part) => part.includes(v)) ? true : undefined;
  return undefined;
}
