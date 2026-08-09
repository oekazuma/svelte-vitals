---
'@svelte-vitals/core': minor
---

seo/json-ld-validity now validates `@type` names against the schema.org vocabulary (generated from schema-dts and updated with its releases): a bare type name that is not an exact, case-sensitive schema.org type — including in nested entities and `@graph` members — produces a warning-level finding, with a did-you-mean hint when only the casing is wrong. IRI (`https://schema.org/Article`) and prefixed (`schema:Article`) forms are never flagged, and any document whose `@context` mentions a non-schema.org vocabulary (or uses an object context) is exempt from this check. Gate movement: projects with a typo'd `@type` that previously passed silently will see new warning findings, so a `--fail-on warning` (or equivalent `--min-health`) run that was green can turn red on upgrade. The default `--fail-on critical` gate is unaffected, and the rule's registered severity and scoring weight are unchanged.
