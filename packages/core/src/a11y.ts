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
