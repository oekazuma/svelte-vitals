/**
 * Shape of the projected HTML spec data (`generated.ts`). Hand-written rather than imported from
 * `@markuplint/ml-spec`: that package is a devDependency, and a type imported from it would leak
 * into `dist/*.d.ts` and fail `check:publish`.
 */

/** Attribute value type as the dataset writes it: a keyword (`Boolean`, `URL`), a list, or an object (`{ enum, … }`). */
export type HtmlAttrType = string | string[] | Record<string, unknown>;

export interface HtmlAttrSpec {
  type?: HtmlAttrType;
  /** `true`, or a selector / selector list naming when the attribute is required. */
  required?: boolean | string | string[];
  requiredEither?: string[];
  deprecated?: boolean;
  obsolete?: boolean;
  nonStandard?: boolean;
  experimental?: boolean;
  /** Selector(s) under which the attribute has no effect. */
  ineffective?: string | string[];
  /** Selector(s) under which the attribute is permitted at all. */
  condition?: string | string[];
  noUse?: boolean;
}

export interface HtmlElementSpec {
  categories: string[];
  deprecated?: boolean;
  /** WHATWG "obsolete features": non-conforming. */
  obsolete?: boolean;
  /** Content model as the dataset writes it — a small selector DSL, evaluated by `permitted-contents` only. */
  contentModel: Record<string, unknown>;
  aria: {
    /** Absent when the dataset says "no corresponding role" (`false`) — not the same as `generic`. */
    implicitRole?: string;
    /** Role names, or `'any'` — `true` and the AAM-object form both normalize to it. */
    permittedRoles: string[] | 'any';
    /** The element's role does not take a name (`aria-label` & co. are prohibited on it). */
    namingProhibited?: true;
    /**
     * Per-condition outcomes, keyed by the dataset's selector string, which is never evaluated.
     * A key present only when the condition changes the implicit role or adds a naming
     * prohibition; an absent field inherits the element default; `implicitRole: false` is "no
     * corresponding role". Rules judge an implicit fact only when it holds under the default and
     * every outcome here.
     */
    conditions?: Record<string, { implicitRole?: string | false; namingProhibited?: true }>;
  };
  /** Names of the `#globalAttrs` groups this element takes. */
  globalAttrs: string[];
  attributes: Record<string, HtmlAttrSpec>;
}

export interface AriaRoleRow {
  deprecated?: boolean;
  /**
   * Properties the role owns, each with its deprecation flag. Deliberately no `required` field:
   * what a role requires is `aria-query`'s question, and this module cannot answer it.
   */
  ownedProperties: { name: string; deprecated?: boolean }[];
  prohibitedProperties: string[];
}

export interface HtmlSpecData {
  /** Keyed by element name; SVG elements are `svg:<name>`. */
  elements: Record<string, HtmlElementSpec>;
  contentModels: Record<string, string[]>;
  globalAttrs: Record<string, Record<string, HtmlAttrSpec>>;
  aria: {
    /** ARIA 1.3 roles and graphics roles. A role with no row (DPUB-ARIA) gets no judgment. */
    roles: Record<string, AriaRoleRow>;
    deprecatedProps: string[];
  };
}
