import type { Value } from '@svelte-vitals/core';
import type { ResolvedA11y, ResolvedHead, ResolvedHeadings, ResolvedImages } from '@svelte-vitals/core/internal';
import { createNodeRuntime } from 'svelte-vitals';
import { parseHtmlHead, toOccurrenceMap } from './parse-html.js';

/** Map a prerendered HTML path (relative to pages/, POSIX) to its route. */
export function deriveRouteFromHtmlPath(relPath: string): string {
  let p = relPath.replace(/\\/g, '/').replace(/\.html$/, '');
  if (p === 'index') return '/';
  if (p.endsWith('/index')) p = p.slice(0, -'/index'.length);
  return '/' + p;
}

export interface CollectedHeads {
  heads: ResolvedHead[];
  headings: ResolvedHeadings[];
  images: ResolvedImages[];
  a11y: ResolvedA11y[];
  htmlLang: { presence: 'own' | 'none'; value: Value };
}

/** Read every prerendered HTML page under `prerenderPagesDir` into ResolvedHead[]. */
export async function collectRenderedHeads(prerenderPagesDir: string): Promise<CollectedHeads> {
  const rt = createNodeRuntime();
  const files = (await rt.glob('**/*.html', prerenderPagesDir)).sort();
  // Read + parse in parallel; Promise.all preserves the sorted order so the
  // "first own <html lang>" pick below stays deterministic.
  const parsedFiles = await Promise.all(
    files.map(async (rel) => ({ rel, parsed: parseHtmlHead(await rt.readFile(rt.join(prerenderPagesDir, rel))) }))
  );

  const heads: ResolvedHead[] = [];
  const headings: ResolvedHeadings[] = [];
  const images: ResolvedImages[] = [];
  const a11y: ResolvedA11y[] = [];
  let htmlLang: CollectedHeads['htmlLang'] = { presence: 'none', value: 'absent' };

  for (const { rel, parsed } of parsedFiles) {
    if (htmlLang.presence === 'none' && parsed.htmlLang.presence === 'own') htmlLang = parsed.htmlLang;
    const route = deriveRouteFromHtmlPath(rel);
    heads.push({
      route,
      source: 'rendered',
      tags: parsed.tags,
      file: rel
    });
    headings.push({
      route,
      // Rendered mode does not track source lines (line 0 = unknown); file is the HTML path.
      headings: parsed.headings.map((level) => ({ level, line: 0, file: rel }))
    });
    images.push({ route, images: parsed.images.map((img) => ({ ...img, file: rel })) });
    a11y.push({
      route,
      landmarks: toOccurrenceMap(parsed.landmarks, rel),
      nestedLandmarks: parsed.nestedLandmarks.map((n) => ({ ...n, file: rel, line: 0 })),
      ids: toOccurrenceMap(parsed.ids, rel),
      idRefs: parsed.idRefs.map((r) => ({ ...r, file: rel, line: 0 })),
      idCandidates: [...new Set(parsed.ids)],
      // The prerendered document IS the closed world: every id/landmark/reference it can ever
      // have is already in it, unlike source mode which may hit an unresolved component.
      fullyResolved: true,
      elementTags: parsed.elementTags,
      elementsClosed: true,
      file: rel
    });
  }

  return { heads, headings, images, a11y, htmlLang };
}
