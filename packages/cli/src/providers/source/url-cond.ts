/** A layout's test on the request path, as far as the source fixes it: `u` is a part it does not. */
export type UrlCond =
  | { op: 'eq' | 'starts' | 'ends' | 'includes'; v: string }
  /** `page.route.id` is one of these. */
  | { id: string[] }
  /** A regex `.test()` of the path. */
  | { re: string; flags: string }
  /** The path equals a template literal: a literal segment, or `null` for one built from an expression. */
  | { tpl: (string | null)[] }
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
export function urlHolds(cond: UrlCond | undefined, route: string, routeId = route): boolean | undefined {
  if (!cond) return true;
  if ('k' in cond) return cond.k;
  if ('u' in cond) return undefined;
  if ('not' in cond) {
    const r = urlHolds(cond.not, route, routeId);
    return r === undefined ? undefined : !r;
  }
  if ('and' in cond) {
    const rs = cond.and.map((c) => urlHolds(c, route, routeId));
    return rs.includes(false) ? false : rs.every((r) => r === true) ? true : undefined;
  }
  if ('or' in cond) {
    const rs = cond.or.map((c) => urlHolds(c, route, routeId));
    return rs.includes(true) ? true : rs.every((r) => r === false) ? false : undefined;
  }
  if ('id' in cond) return cond.id.includes(routeId);
  if ('re' in cond) {
    if (DYNAMIC.test(route)) return undefined;
    try {
      // With a trailing slash the path can read either way (`trailingSlash`), so only an answer both agree on holds.
      const bare = new RegExp(cond.re, cond.flags).test(route);
      return route === '/' || new RegExp(cond.re, cond.flags).test(`${route}/`) === bare ? bare : undefined;
    } catch {
      return undefined;
    }
  }
  if ('tpl' in cond) {
    const segments = route.split('/').slice(1);
    if (segments.some((s) => /^\[\[|^\[\.\.\./.test(s))) return undefined;
    if (segments.length !== cond.tpl.length) return false;
    let unknown = false;
    for (const [i, t] of cond.tpl.entries()) {
      const param = DYNAMIC.test(segments[i]!);
      if (t !== null && !param && t !== segments[i]) return false;
      // A segment built from an expression is taken to be the route's parameter in its place.
      if ((t === null) !== param) unknown = true;
    }
    return unknown ? undefined : true;
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
