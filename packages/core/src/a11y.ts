/** One step of a template branch address: which exclusive block, and which arm of it. */
export interface BranchStep {
  /** index of the {#if}/{#await} block among its file's blocks (document order) */
  group: number;
  /** branch index within the group (if: 0..n consequent→else; await: 0=pending,1=then,2=catch) */
  branch: number;
}

/** Where a folded occurrence sits, for the finding location. */
export interface A11yOccurrenceInfo {
  file: string;
  line: number;
}

/** One reason a route's closed world failed to hold, with the first offending location. */
export interface A11ySkipCause {
  kind: 'component' | 'spread' | 'html' | 'dynamic-id';
  file: string;
  line: number;
  /** for kind 'component': the unresolvable component's name as written */
  detail?: string;
}

/**
 * Route-scoped a11y facts, the mode-independent boundary for the landmark/id rules
 * (mirrors headings.ts). Source mode composes the layout chain plus its resolved
 * components; rendered mode reads the prerendered document.
 */
export interface ResolvedA11y {
  route: string;
  /** representatives per landmark kind after the branch-aware fold ('main' | 'banner' | 'contentinfo' | 'complementary') */
  landmarks: Record<string, A11yOccurrenceInfo[]>;
  /** landmark occurrences nested inside another landmark after composition */
  nestedLandmarks: { kind: string; within: string; file: string; line: number }[];
  /** representatives per literal id */
  ids: Record<string, A11yOccurrenceInfo[]>;
  /** literal id references */
  idRefs: { id: string; attr: string; file: string; line: number }[];
  /** optimistic candidates: every literal id anywhere (all branches, each/snippet bodies, components, app.html) */
  idCandidates: string[];
  /** closed world holds: every component resolved, no depth truncation, no {@html}/spread, no dynamic id */
  fullyResolved: boolean;
  /** Why `fullyResolved` is false — deduped by (kind, file, detail), first occurrence's line kept. Present exactly when `fullyResolved` is false. */
  unresolvedCauses?: A11ySkipCause[];
  /**
   * Distinct tag names in the route's body subtree — layout chain, page, every resolved component,
   * and `app.html`'s `<body>` (static), or the prerendered `<body>` (rendered); optimistic across
   * `{#if}` arms and `{#each}`/snippet bodies. Never `<svelte:head>` content, `<template>` children,
   * or `<svelte:element>`. Absent where a provider does not collect it (a11y/required-element).
   */
  elementTags?: string[];
  /**
   * The closed world for elements: every component descended into (an unresolved, depth-truncated,
   * or — conservatively — cycle-cut one clears it), no `{@html}`, no `<svelte:element>`. Incomparable with `fullyResolved` — a spread or `id={expr}` clears that flag
   * and not this one, since neither can hide an element; a `<svelte:element>` clears this and not
   * that. "Missing" is only reportable when this holds; presence is sound regardless.
   */
  elementsClosed?: boolean;
  /** The file a route-level finding is anchored to: the page file (static) or the prerendered HTML path (rendered). */
  file?: string;
}

type Foldable = { key: string; path: BranchStep[]; repeatable: boolean };

/**
 * Branch-aware occurrence fold (design "Control-flow semantics"): within a branch
 * occurrences sum, across the arms of one exclusive block the arm with the most
 * occurrences wins (tie → lowest branch index) and ITS occurrences are the group's
 * representatives — so a caller's count is always `list.length`, with a location per
 * representative. `{#each}`/`{#snippet}` occurrences render 0..N times and drop out.
 * The max is per key: there is no scalar total to maximize.
 */
export function foldOccurrences<T extends Foldable>(nodes: T[]): Map<string, T[]> {
  const byKey = new Map<string, T[]>();
  for (const node of nodes) {
    if (node.repeatable) continue;
    const list = byKey.get(node.key);
    if (list) list.push(node);
    else byKey.set(node.key, [node]);
  }
  const folded = new Map<string, T[]>();
  for (const [key, list] of byKey) folded.set(key, foldAt(list, 0));
  return folded;
}

function foldAt<T extends Foldable>(nodes: T[], depth: number): T[] {
  const unconditional: T[] = [];
  const groups = new Map<number, Map<number, T[]>>();
  for (const node of nodes) {
    const step = node.path[depth];
    if (!step) {
      unconditional.push(node);
      continue;
    }
    let branches = groups.get(step.group);
    if (!branches) groups.set(step.group, (branches = new Map()));
    const list = branches.get(step.branch);
    if (list) list.push(node);
    else branches.set(step.branch, [node]);
  }

  const representatives = [...unconditional];
  for (const branches of groups.values()) {
    let best: T[] = [];
    let bestBranch = Number.POSITIVE_INFINITY;
    for (const [branch, list] of branches) {
      const arm = foldAt(list, depth + 1);
      if (arm.length > best.length || (arm.length === best.length && branch < bestBranch)) {
        best = arm;
        bestBranch = branch;
      }
    }
    representatives.push(...best);
  }
  return representatives;
}

/**
 * Decode a fragment identifier the way navigation does before matching an element id
 * (`href="#caf%C3%A9"` targets `id="café"`). Malformed escapes are kept verbatim —
 * the browser would also fail to decode them, so the raw text is the comparable form.
 */
export function decodeFragmentId(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/** Whitespace-split tokens of a (possibly undefined) literal attribute value. */
export function splitTokens(value: string | undefined): string[] {
  return value ? value.trim().split(/\s+/).filter(Boolean) : [];
}

/** Explicit `role` values that map to the landmark kinds the route rules inspect. */
export const LANDMARK_ROLES: ReadonlySet<string> = new Set(['main', 'banner', 'contentinfo', 'complementary']);

/**
 * Attributes whose (whitespace-tokenized) values reference element ids: the ARIA id-reference and
 * id-reference-list properties, and HTML's own (`for`, `list`, `headers`, `form`, the popover and
 * command targets). `href="#…"` is handled separately — its value is a URL, not a token list.
 */
export const IDREF_ATTRS: readonly string[] = [
  'for',
  'list',
  'headers',
  'form',
  'popovertarget',
  'commandfor',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-activedescendant',
  'aria-owns',
  'aria-details',
  'aria-errormessage',
  'aria-flowto'
];

/**
 * Whether a decoded URL fragment is HTML's "top of the document" indicator: `#top` (ASCII
 * case-insensitive) scrolls to the top when no element has that id, so it is never a missing
 * reference. Compare AFTER percent-decoding — `#%74op` navigates identically to `#top`.
 */
export function isTopFragment(id: string): boolean {
  return id.toLowerCase() === 'top';
}

/**
 * A fragment with its text directive removed. Everything from the first `:~:` on is user-agent
 * instructions for finding text and names no element, while anything before it is still an
 * ordinary element fragment — `#section:~:text=hi` targets `id="section"`, `#:~:text=hi` targets
 * nothing. Returns an empty string when the fragment is a directive and nothing else.
 */
export function stripTextDirective(fragment: string): string {
  const i = fragment.indexOf(':~:');
  return i === -1 ? fragment : fragment.slice(0, i);
}
