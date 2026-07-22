/**
 * Component-body facts for the Correctness category — the source-analysis boundary
 * (mirrors images.ts / headings.ts). Collected by the static (CLI) provider only;
 * the rendered provider can't see reactivity, so correctness rules no-op there.
 */

/** An `{#each}` block in a component template. */
export interface EachBlockFact {
  /** True when the block has a key, e.g. `{#each items as item (item.id)}`. */
  hasKey: boolean;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** An `$effect(...)` / `$effect.pre(...)` call in a component's instance script. */
export interface EffectFact {
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /** True when the effect body only assigns to `$state` variables (the "use $derived" smell). */
  assignsOnlyState: boolean;
  /** True when this $effect has a NON-EMPTY body that reads no reactive value and makes no bare call — it never re-runs, so it should be onMount (correctness/effect-as-onmount). */
  mountOnly: boolean;
}

/** A `$effect` guaranteed to run outside component initialisation — it throws `effect_orphan` at runtime (correctness/orphan-effect). */
export interface OrphanEffectFact {
  /** 1-based source line, or 0 if unknown. For 'constructor-instantiated', the module-scope `new` site. */
  line: number;
  /** 'top-level' = runs at module evaluation; 'constructor-instantiated' = module-scope `new` of a same-file class whose constructor creates a bare effect. */
  kind: 'top-level' | 'constructor-instantiated';
  /** Class name when kind is 'constructor-instantiated' (used in the finding message). */
  className?: string;
}

/** A svelte lifecycle/context call guaranteed to run outside component initialisation — it throws `lifecycle_outside_component` at runtime (correctness/orphan-lifecycle). */
export interface OrphanLifecycleCallFact {
  /** Canonical svelte export name (alias-resolved), e.g. 'onMount'. */
  name: string;
  /** 1-based source line, or 0 if unknown. For 'constructor-instantiated', the module-scope `new` site. */
  line: number;
  /** 'top-level' = runs at module evaluation; 'constructor-instantiated' = module-scope `new` of a same-file class whose constructor calls a tracked function. */
  kind: 'top-level' | 'constructor-instantiated';
  /** Class name when kind is 'constructor-instantiated' (used in the finding message). */
  className?: string;
}

/** A browser-only global read in code that runs on the server — SSR crashes with "<name> is not defined" (correctness/server-browser-global, correctness/instance-browser-global). */
export interface BrowserGlobalRefFact {
  /** The global's name, e.g. 'window'. */
  name: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /** 'module' = module evaluation (script module / runes module — correctness/server-browser-global); 'instance' = component-init top level (runs on the server during SSR — correctness/instance-browser-global). */
  context: 'module' | 'instance';
}

/** A flagged source position in a component (e.g. an `{@html}` tag or a `javascript:` URL). */
export interface SourceSpan {
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** An inline `svelte-vitals-disable-next-line` directive found in the component's source (issue #92). */
export interface SuppressionDirective {
  /** 1-based line the directive suppresses (the line immediately after the comment). */
  line: number;
  /** Rule ids suppressed on that line; undefined = suppress every rule on that line. */
  ruleIds?: string[];
}

/** Reactivity/correctness + security + architecture facts parsed from one `.svelte` component. */
export interface ComponentFacts {
  /** Source file the component came from. */
  file: string;
  eachBlocks: EachBlockFact[];
  effects: EffectFact[];
  /** `{@html …}` occurrences — raw-HTML render surfaces (security/raw-html). */
  htmlTags: SourceSpan[];
  /** Element attributes with a literal `javascript:` URL (security/javascript-url). */
  javascriptUrls: SourceSpan[];
  /** Source line count of the component file (architecture/component-size). */
  loc: number;
  /** Named props destructured from `$props()`; 0 when unknowable (rest / non-destructured) (architecture/prop-count). */
  propCount: number;
  /** Module specifiers of every `import` in the instance + module scripts (performance/heavy-import). */
  imports: string[];
  /** Module specifiers of every `import`, each with its source line (performance/heavy-import). */
  importSpans: { source: string; line: number }[];
  /** Value `import * as X from '<bare pkg>'` namespace imports (type-only excluded) — performance/namespace-import. */
  namespaceImports: { source: string; line: number }[];
  /** `$state` declarations never written or escaped anywhere in the component — candidates for const (correctness/unmutated-state). */
  constableStates: { name: string; line: number }[];
  /** Mutations of a non-`$bindable` prop from `$props()` — member writes, `delete`, or a mutating method call (correctness/prop-mutation). */
  mutatedProps: { name: string; line: number }[];
  /** `$effect` calls guaranteed to run outside component initialisation — module scope in `.svelte.ts`/`.svelte.js` or `<script module>` (correctness/orphan-effect). */
  orphanEffects: OrphanEffectFact[];
  /** Svelte lifecycle/context calls guaranteed to run outside component initialisation — module scope in `.svelte.ts`/`.svelte.js` or `<script module>` (correctness/orphan-lifecycle). */
  orphanLifecycleCalls: OrphanLifecycleCallFact[];
  /** Browser-global reads in server-executed positions of this file (correctness/server-browser-global, correctness/instance-browser-global). */
  browserGlobalRefs: BrowserGlobalRefFact[];
  /** Module-scope `$state` declarations in a `.svelte.ts`/`.svelte.js` runes module — on a server, one instance shared by every request (security/shared-state-import). Always empty for `.svelte` files. */
  moduleStateDecls: { name: string; line: number }[];
  /** Inline `svelte-vitals-disable-next-line` directives found in this file's source — component-rule escape hatch (issue #92). Optional: absent is equivalent to no directives, so existing external constructors of `ComponentFacts` are unaffected. */
  suppressions?: SuppressionDirective[];
}
