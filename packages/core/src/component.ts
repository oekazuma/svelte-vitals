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
}

/** A flagged source position in a component (e.g. an `{@html}` tag or a `javascript:` URL). */
export interface SourceSpan {
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** Reactivity/correctness + security + architecture facts parsed from one `.svelte` component. */
export interface ComponentFacts {
  /** Source file the component came from. */
  file: string;
  eachBlocks: EachBlockFact[];
  effects: EffectFact[];
  /** `{@html …}` occurrences — raw-HTML render surfaces (Security SEC001). */
  htmlTags: SourceSpan[];
  /** Element attributes with a literal `javascript:` URL (Security SEC002). */
  javascriptUrls: SourceSpan[];
  /** Source line count of the component file (Architecture ARCH001). */
  loc: number;
  /** Named props destructured from `$props()`; 0 when unknowable (rest / non-destructured) (Architecture ARCH002). */
  propCount: number;
  /** Module specifiers of every `import` in the instance + module scripts (Bundle PERF009). */
  imports: string[];
}
