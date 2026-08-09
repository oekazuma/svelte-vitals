# seo/json-ld: schema.org vocabulary validation via a schema-dts-derived catalog

Date: 2026-08-09
Status: Design (spike deliverable for issue #421 — answers its four questions; implementation is a
separate, later PR)
Origin: 2026-08-09 v1.0 rule-validity review follow-up; suggested by the maintainer during #417
review.

## The gap (restated)

A typo'd type — `"@type": "Artcle"` — passes every rule in the json-ld family today.
`seo/json-ld-validity` gates parse + `@context` + `@type` _presence_; `seo/json-ld-required-props`
looks types up in its curated Google-requirements table (an unknown type simply has no row); nothing
checks that a declared name exists in the schema.org ontology at all. The ontology has a maintained,
typed distribution — [google/schema-dts](https://github.com/google/schema-dts) — from which a
catalog can be generated and kept current by a normal Renovate bump.

Verified facts about schema-dts (2.0.0, inspected via unpkg):

- Types only: one `dist/schema.d.ts` (~992 KB) and a 77-byte runtime stub. Nothing importable at
  runtime — the catalog must be extracted at build time.
- Every schema.org type is an `export type` alias (`export type Airplane = AirplaneLeaf;`,
  `export type Accommodation = AccommodationLeaf | Apartment | … | string;`) — roughly 1,000
  exported aliases. Property containers (`*Base`) and `@type` discriminators (`*Leaf`) are
  interfaces, not aliases, so the alias namespace is almost exactly the vocabulary. Four generic
  helpers (`WithContext`, `Graph`, `SchemaValue`, `IdReference`) are the exceptions to filter.
- schema.org-level deprecations/supersessions are carried as `@deprecated` JSDoc on the export
  (e.g. Attorney → "LegalService is more inclusive and less ambiguous").

## Decision summary

**Phase 1 (recommended): `@type` existence only, as a new arm of `seo/json-ld-validity`, backed by
a generated name catalog committed in `@svelte-vitals/core` (~800–1,000 names, ~20 KB) with a
drift test.** Property-name and property-domain validation are rejected (not deferred for size
reasons alone — they have a legitimate-use false-positive problem; see below). Ontology
supersession warnings are deferred as a possible phase 2.

## The four spike questions

### 1. Scope: type existence / property existence / property-domain

**Type existence only.**

- `@type` typos are the highest-value class: a typo'd type silently voids the whole node's
  rich-result eligibility, and `json-ld-required-props` goes blind at the same moment (no row
  found). One catalog lookup catches it.
- **Property-name existence is rejected, not just deferred**: schema.org's data model explicitly
  tolerates extension properties and mixed vocabularies — publishers legitimately attach custom or
  third-party-vocabulary properties to schema.org nodes, and Google's parser ignores unknown
  properties rather than penalizing them. A property-existence check therefore flags legitimate
  markup with no eligibility consequence — a false-positive class we would own forever. (The one
  false-positive-free variant — checking only properties that are _almost_ a known name, i.e.
  did-you-mean on properties — needs the full property list anyway and still guesses about intent;
  not worth the bytes.)
- **Property-domain validation** ("is this property valid _on this type_") inherits the same
  false-positive problem plus the largest catalog (per-type property maps, 100 KB+ in core for a
  check Google doesn't perform). Rejected.

### 2. Home: new rule vs. extending `seo/json-ld-validity`

**Extend `seo/json-ld-validity`.** It already owns "malformed at the JSON-LD level" (unparseable
JSON, missing `@context`, missing `@type`), and an unknown `@type` is the same family: the document
is structurally broken as schema.org data, independent of any specific consumer's requirements.
This also keeps the severity story coherent — the rule is registered `warning`, and an unknown type
is exactly as consequential as a missing one (the node drops out of eligibility either way). No
severity split: the new arm fires at the rule's registered severity, so a global
`rules: { 'seo/json-ld-validity': … }` override behaves unsurprisingly.

A second registered rule would need its own docs pages, inventory weight, and severity
narrative for what is one concept; rejected.

Message shape (message text is not part of `findingKey`, so wording stays adjustable):

```
Unknown @type 'Artcle' — not a schema.org type. Did you mean 'Article'?
```

The did-you-mean suggestion is a case-insensitive exact match against the catalog (cheap, no
edit-distance dependency); omitted when nothing matches. Multi-typed nodes
(`"@type": ["Product", "Vehicle"]`) validate each name; one finding per unknown name.

### 3. Case handling and non-schema.org contexts

- **Exact, case-sensitive match.** schema.org names are case-sensitive PascalCase; `"article"` is
  not a valid type and Google's parser treats it as unknown. The case-insensitive pass exists only
  to power the suggestion, never to accept.
- **Non-schema.org `@context` exempts the document.** Custom vocabularies are legal JSON-LD. The
  arm runs only when the node's governing `@context` is schema.org — accepted spellings:
  `http(s)://schema.org` with optional trailing slash (the existing `@context` handling in
  `json-ld-validity` already recognizes these; reuse it). If `@context` is an array or object that
  mentions any non-schema.org vocabulary, the document is exempt — term remapping means a name we
  don't recognize may be perfectly valid. Conservative by construction: silence, never a false
  positive, on exotic contexts.

### 4. Catalog size vs. core bundle budget

- Names only: ~800–1,000 entries × ~13 chars ≈ **20 KB source** as a
  `ReadonlySet<string>` literal in a generated module. Acceptable for `@svelte-vitals/core` (the
  curated tables in `jsonld-engine.ts` set the precedent; this is one order larger but still
  trivial next to the parser).
- The property-domain map (the only expensive option) is rejected under Q1, so no budget question
  remains.

## Catalog + generator design

Follows the repo's committed-generated-file pattern (`packages/cli/src/docs/generated.ts` +
`docs-embed.test.mjs`; `packages/cli/src/ci/action-pin.generated.ts`):

- **Dev dependency**: `schema-dts` added to the workspace catalog (`pnpm-workspace.yaml`) and
  `packages/core`'s devDependencies as `catalog:`. Renovate bumps it like any other dep.
- **Generator**: `packages/core/scripts/gen-schema-vocab.mjs`, run manually via
  `pnpm --filter @svelte-vitals/core run gen:schema-vocab`. Core's no-`node:`/no-I/O rule covers
  `src/` only; dev-time scripts are exempt (same as its test suite). The script:
  1. Locates `schema-dts/dist/schema.d.ts` via `import.meta.resolve`.
  2. Parses it with the TypeScript compiler API (already a workspace devDependency) and collects
     exported **type alias** names — interfaces (`*Base`, `*Leaf`) are excluded by node kind, and
     the four generic helpers (`WithContext`, `Graph`, `SchemaValue`, `IdReference`) by an explicit
     list, not by pattern (a hypothetical future vocabulary type ending in "Leaf" must not be
     silently dropped; the alias-vs-interface distinction does the structural work).
  3. Sanity-asserts the count lands in 700–1,500 — outside that band the upstream shape changed and
     the script fails loudly instead of committing a gutted catalog.
  4. Emits `packages/core/src/rules/seo/schema-vocabulary.generated.ts`: a header naming the
     schema-dts version it was generated from, plus
     `export const SCHEMA_ORG_TYPES: ReadonlySet<string>`.
- **Drift test**: `packages/core/test/schema-vocabulary.test.mjs` re-runs the extraction against
  the installed schema-dts and fails if the committed module differs — so a Renovate bump of
  schema-dts fails CI until the catalog is regenerated and committed, which is the mechanism that
  keeps the catalog current (mirrors `docs-embed.test.mjs`).

## Deferred (phase 2 candidates, each needing its own decision)

- **Supersession warnings**: the generator can also capture `@deprecated` exports into a
  `SUPERSEDED_TYPES` map (name → replacement parsed from the JSDoc). This overlaps conceptually
  with `seo/json-ld-deprecated-type` — whose curated list is about _Google dropping rich-result
  support_ (HowTo, FAQPage), a different statement than _schema.org superseded this term_. Shipping
  both without confusing users needs message design; deferred rather than bundled into phase 1.
- **Vite provider parity**: nothing here is provider-specific — the arm lives in the shared engine,
  so both providers get it for free. Listed only to note there is no extra work.

## Implementation-plan requirements (for the eventual phase-1 PR)

- New penalized findings can appear on existing projects (any typo'd `@type` that was silently
  passing), so under `--fail-on warning` a previously green run can turn red. The changeset must
  declare this movement explicitly, and the review runs the full fixture × `--fail-on` × pre/post
  truth table (established practice since #428).
- The arm adds a per-node set lookup to the existing parse pass — no new I/O, no io-budget effect.
- Docs (en + ja): new "Unknown type" section on the `seo/json-ld-validity` rule pages, including
  the exemption rules for non-schema.org contexts; regenerate rule indexes if the pages' headings
  change.
- `@svelte-vitals/core` changeset: minor (new detection surface).

## Rejected alternatives (record, so this isn't re-litigated)

- **Runtime dependency on schema-dts**: impossible — it ships no runtime values.
- **Fetching the schema.org vocabulary JSON at generation time**: adds a network step and a second
  source of truth; schema-dts already tracks releases and Renovate handles currency.
- **Hand-curating a "common types" subset**: the full name list is only ~20 KB; curation would
  reintroduce exactly the staleness this design eliminates.
- **Property-name / property-domain validation**: see Q1 — legitimate-use false positives
  (extension properties are valid schema.org usage), plus the only expensive catalog. This is the
  standing rejection; revisit only with evidence that unknown-property typos materially hurt
  eligibility.

## Corrections (2026-08-10, phase-1 implementation)

- The "reuse the existing `@context` handling in `json-ld-validity`" claim in Q3 was wrong: no
  schema.org `@context` matcher existed before phase 1 — the rule only checked `'@context' in n`.
  Phase 1 added one. Its semantics: a document is validated only when every `@context` occurrence
  anywhere in it (root, array members, `@graph` members, and nested entities) is schema.org — a
  string matching `/^https?:\/\/schema\.org\/?$/` exactly (case-sensitive, no trailing-slash
  ambiguity), or an array where every member matches that pattern. Any other shape — an object
  context (term remapping), an array with a non-matching or non-string member, or a differently-cased
  URL (`HTTPS://SCHEMA.ORG`) — exempts the whole document from the vocabulary arm.
- The Q2 example `Unknown @type 'Artcle' … Did you mean 'Article'?` cannot fire under the
  case-insensitive-exact-match mechanism the same section specifies: a dropped letter is not a case
  difference, so `'Artcle'` gets no suggestion. The corrected example is a pure casing mismatch —
  `'article'` → `Did you mean 'Article'?`. Distance-1 typo suggestions (which would make `'Artcle'`
  work) are a possible phase-2 refinement, not implemented here.
- The "Verified facts" claim that `*Base`/`*Leaf` names are interfaces, never type aliases, is false
  for the Role family: schema-dts 2.0.0 exports `RoleLeaf`/`EmployeeRoleLeaf`/`LinkRoleLeaf`/
  `OrganizationRoleLeaf`/`PerformanceRoleLeaf` as genuine type aliases (the generic-parameter
  variants), so alias-vs-interface filtering alone does not produce a clean vocabulary. The
  generator's explicit exclusion list carries them (plus `WithActionConstraints`), and the sanity
  band still guards against wholesale shape changes.
