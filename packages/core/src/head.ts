import type { Presence, Value, Config } from './types.js';
import type { Runtime } from './runtime.js';

/**
 * A normalized head tag. The mode-independent boundary (design §8): both the
 * static SourceHeadProvider and the future RenderedHeadProvider emit these, so
 * rules never need to know which provider produced them.
 */
export interface HeadTag {
  kind: 'title' | 'meta' | 'link' | 'jsonld';
  /** <meta name="...">. */
  name?: string;
  /** <meta property="..."> (e.g. og:image). */
  property?: string;
  /** <link rel="...">. */
  rel?: string;
  /** Where this tag was set relative to the route. Never 'none' (absence = no tag). */
  presence: Exclude<Presence, 'none'>;
  /** Whether the tag's value is static/dynamic/absent (design §4). */
  value: Value;
  /** Source file the tag came from (static mode only). */
  file?: string;
}

/** Resolved effective head for a single route (design §8). */
export interface ResolvedHead {
  /** Route path, e.g. '/blog/[slug]'. */
  route: string;
  /** Which provider produced this. */
  source: 'static' | 'rendered';
  /** Effective head tags after layout-chain composition. */
  tags: HeadTag[];
  /** Representative source file for the route (used for issue locations). */
  file: string;
}

/** Supplies ResolvedHead[] for a project. The only piece that differs per mode. */
export interface HeadProvider {
  mode: 'static' | 'rendered';
  collect(rt: Runtime, cwd: string, config?: Config): Promise<ResolvedHead[]>;
}
