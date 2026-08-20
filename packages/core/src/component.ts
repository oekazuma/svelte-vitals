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
  /** Set when the block's key expression is its index binding or a trivial coercion of it — `(i)`, `(String(i))`, `(Number(i))`, `` (`${i}`) ``, `(i.toString())`, `(i + '')` — correctness/each-index-key. */
  indexKey?: boolean;
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

/** An `<input type="checkbox">` / `<input type="radio">` element carrying a `bind:value`
 *  directive — `bind:value` observes the DOM `value` property, which checkbox/radio
 *  interaction never changes, so the bound state silently never updates
 *  (correctness/checkable-bind-value). */
export interface CheckableBindValueFact {
  /** Which checkable input type was flagged — selects the message wording. */
  kind: 'checkbox' | 'radio';
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** A root-relative navigation literal — broken when the app is served under `kit.paths.base`
 *  (correctness/base-path-navigation). Shared by the component and Kit-module channels. */
export interface BasePathLinkFact {
  /** Which navigation surface it was written on — selects the message wording. */
  kind: 'href' | 'goto' | 'redirect';
  /** The literal path as written, e.g. '/about'. */
  path: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** An interactive element (e.g. `<button>`) found nested inside another interactive
 *  container (e.g. `<a href>`) (a11y/interactive-nesting). */
export interface InteractiveNestingFact {
  containerTag: string;
  /** The container's literal `role`, when that is what made it a container rather than its tag. */
  containerRole?: string;
  descendantTag: string;
  /** 1-based source line of the descendant, or 0 if unknown. */
  line: number;
}

/** A `button`/`a href`/`input type="image"` with no computable accessible name (a11y/accessible-name). */
export interface UnnamedInteractiveFact {
  tag: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}

/** An element carrying a `role` and/or `aria-*` attribute(s) (a11y ARIA rules). */
export interface AriaElementFact {
  tag: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /** literal role value; undefined = no role attr; { expression: true } = dynamic */
  role?: { literal?: string; expression?: boolean };
  /** every aria-* attribute on the element */
  aria: { name: string; literal?: string; expression?: boolean; line: number }[];
  /** literal `type` of an `<input>`, lowercased; undefined for non-inputs or a dynamic type */
  inputType?: string;
  /** an `<input>` carrying a `list` attribute — its implicit role is `combobox` and the host supplies `aria-expanded` */
  hasList?: true;
  /**
   * A `<select>`'s native role: `combobox` with no `multiple` and no `size` above 1, `listbox`
   * otherwise; absent for a non-select or when a dynamic `size` leaves it unknowable.
   */
  selectKind?: 'combobox' | 'listbox';
  /** Set when the element also carries a spread attribute — its full attribute set is
   *  unknowable, so required-prop presence checks must treat it as satisfied (a11y/required-aria-props). */
  hasSpread?: true;
}

/**
 * Every element in a component with its literal attribute names — the input for the rules that
 * judge against the HTML spec data (a11y/deprecated-element, a11y/deprecated-attr, and the rest of
 * that family). Tag and attribute names are lowercased, matching how HTML parses them.
 */
export interface ElementFact {
  tag: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /**
   * Literal attribute names on the element (directives, spreads and expression-only names excluded).
   * The per-attribute line is not what the deprecation rules anchor to — they anchor at the start
   * tag so a `disable-next-line` directive can reach a multi-line element — but a value-level rule
   * (`invalid-attr`) may want it for its message.
   */
  attrs: { name: string; line: number; value?: string }[];
  /**
   * Inside an `<svg>` subtree, or in a component declaring `<svelte:options namespace="svg" />`.
   * `<foreignObject>` returns to HTML. Names collide across the two namespaces (`a`, `script`,
   * `style`, `title`), so HTML-only rules must skip these.
   */
  inSvg?: true;
  /**
   * Index of the nearest literal ancestor element in the same array (push-before-children DFS
   * keeps it sound), looking through `{#if}`/`{#each}`/`{#await}`/`{#key}`. Absent at template
   * root and after every construct whose rendering position is not lexical — a component,
   * `<svelte:element>`, `<slot>`, `{@render}`, `{@html}`, a custom element or unknown tag,
   * a `{#snippet}` body root, `<svelte:head>` children — so `a11y/permitted-contents` never
   * judges across one.
   */
  parent?: number;
  /** A spread attribute is present — every attribute test on this element is unknowable. */
  hasSpread?: true;
  /**
   * A direct child the static walk cannot see through (component, `{@html}`, `{@render}`,
   * `<slot />`, `<svelte:element>`, a custom element or unknown tag) — `:has(...)` over this
   * element's subtree is unknowable.
   */
  unknownContent?: true;
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
  /**
   * Module specifiers of every `import`, each with its source line (performance/heavy-import,
   * architecture/route-component-import). `type` marks a declaration that contributes **no runtime
   * value binding** — either `import type …`, or one whose every specifier is inline-typed
   * (`import { type A } from …`). A specifier-less side-effect import is not marked: it still loads
   * the module. Optional, so existing external constructors of `ComponentFacts` are unaffected.
   */
  importSpans: { source: string; line: number; type?: true }[];
  /** Value `import * as X from '<bare pkg>'` namespace imports (type-only excluded) — performance/namespace-import. */
  namespaceImports: { source: string; line: number }[];
  /** `$state` declarations never written or escaped anywhere in the component — candidates for const (correctness/unmutated-state). */
  constableStates: { name: string; line: number }[];
  /** Mutations of a non-`$bindable` prop from `$props()`, or a legacy `export let` prop — member writes, `delete`, or a mutating method call (correctness/prop-mutation). `legacy` distinguishes which mode the prop was declared in (absent/false: `$props()`), since the fix differs — optional so existing external constructors of `ComponentFacts` are unaffected. */
  mutatedProps: { name: string; line: number; legacy?: boolean }[];
  /** Top-level const/let bindings computed from a $props() or legacy `export let` prop without $derived (or `$:`), never reassigned or escaped, and referenced (eagerly) in the template — frozen at init (correctness/stale-prop-derivation). `legacy` distinguishes which mode the prop was declared in, since the fix differs — optional so existing external constructors of `ComponentFacts` are unaffected. */
  stalePropDerivations: {
    name: string;
    line: number;
    legacy?: boolean;
  }[];
  /** Object/array-literal $state bindings reassigned at least once but never mutated, escaped, aliased, or item-edited — $state.raw candidates (performance/state-raw). */
  rawableStates: {
    name: string;
    line: number;
  }[];
  /** Plain built-in instances (Map/Set/Date/URL/URLSearchParams) in $state whose type-specific mutations were observed inside functions, with no exempting reassignment — untracked by reactivity (correctness/nonreactive-builtin-state). */
  nonreactiveBuiltinStates: {
    name: string;
    type: string;
    line: number;
  }[];
  /** `<input type="checkbox">` / `<input type="radio">` elements bound with `bind:value`
   * instead of `bind:checked`/`bind:group` (correctness/checkable-bind-value). */
  checkableBindValues: CheckableBindValueFact[];
  /** Root-relative `<a href>` and `goto()` literals in this component (correctness/base-path-navigation). */
  basePathLinks: BasePathLinkFact[];
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
  /** Markdown links `[label](url)` appearing inside a comment (architecture/doc-link-target). */
  commentLinks: { url: string; line: number }[];
  /** Elements carrying a role or any aria-* attribute (a11y ARIA rules). */
  ariaElements?: AriaElementFact[];
  /** Every element with its attribute names and SVG-namespace flag (the HTML spec-data rules). */
  elements?: ElementFact[];
  /** Interactive elements nested inside another interactive container (a11y/interactive-nesting). */
  interactiveNestings?: InteractiveNestingFact[];
  /** `button`/`a href`/`input type="image"` elements with no computable accessible name (a11y/accessible-name). */
  unnamedInteractive?: UnnamedInteractiveFact[];
  /** `<label>` elements with neither a `for` attribute nor a wrapped labelable descendant (a11y/label-has-control). */
  unassociatedLabels?: { line: number }[];
  /** Text nodes whose trimmed content opens with a bullet character followed by whitespace, outside any `li` (a11y/use-list). */
  bulletTexts?: { line: number; char: string }[];
  /** `<select required>` (no `multiple`, display size absent or ≤ 1) whose first `option` element
   *  child is not a placeholder label option (a11y/placeholder-label-option). */
  selectsMissingPlaceholder?: { line: number }[];
  /** `<time>` with no `datetime` attribute whose literal text content is not machine-readable (a11y/require-datetime). */
  timesMissingDatetime?: { line: number; text: string }[];
  /** Set when the file failed to read or parse and these facts are the empty fallback — the file was NOT analyzed. */
  parseFailed?: true;
  /** Set when the file could not be READ — an environment problem (permissions, a descriptor
   *  limit), not a malformed component. Reported separately so one does not masquerade as the other. */
  readFailed?: true;
}

/**
 * Warnings for files a collector could not read or parse: the file contributes empty facts, so any
 * findings it would have produced are simply missing rather than reported as fixed. The two causes
 * are reported separately — an unreadable file is an environment problem (permissions, a descriptor
 * limit) and a malformed one is the author's, and sharing a message is how a descriptor limit once
 * read as hundreds of broken components. Capped at 10 inline paths so one badly-broken directory
 * cannot flood the terminal.
 */
export function skippedFileWarnings(
  facts: readonly { file: string; parseFailed?: true; readFailed?: true }[]
): string[] {
  const list = (files: string[]): string => {
    const shown = files.slice(0, 10);
    return files.length > shown.length
      ? `${shown.join(', ')}, … and ${files.length - shown.length} more`
      : shown.join(', ');
  };
  const names = (pick: (f: { parseFailed?: true; readFailed?: true }) => boolean): string[] =>
    [...new Set(facts.filter(pick).map((f) => f.file))].sort();

  const unread = names((f) => f.readFailed === true);
  const unparsed = names((f) => f.parseFailed === true && f.readFailed !== true);
  const out: string[] = [];
  if (unread.length > 0) {
    out.push(
      `skipped ${unread.length} file(s) that could not be read: ${list(unread)}`,
      'this is an environment problem, not a code one — check file permissions and the open-file limit (`ulimit -n`).'
    );
  }
  if (unparsed.length > 0) {
    out.push(
      `skipped ${unparsed.length} file(s) that could not be parsed: ${list(unparsed)}`,
      'findings for these files are unavailable until they parse.'
    );
  }
  return out;
}
