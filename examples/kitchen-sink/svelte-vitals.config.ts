// Wakes the six Architecture rules that are inert until configured — each option
// block below targets only the misshaped unit tree under src/lib/architecture/**,
// so it does not reach into the perf/seo/correctness/security galleries or the
// clean canary routes.
export default {
  rules: {
    // Declaration-driven: nothing is judged until a project says what it wants. `<h1>` on every
    // route passes across the gallery; the legacy page's override adds `<nav>`, which it lacks.
    'a11y/required-element': { options: { elements: ['h1'] } },
    // The legacy page's <iframe> is the planted occurrence.
    'a11y/disallowed-element': { options: { elements: ['iframe'] } },
    'architecture/directory-naming': {
      options: {
        directories: { 'src/lib/architecture/*': 'PascalCase' }
      }
    },
    'architecture/reserved-directory-names': {
      options: {
        unitScopes: { 'src/lib/architecture/**': 'parts|tests|private' }
      }
    },
    'architecture/reserved-name-placement': {
      options: {
        capitalisedUnitPlacements: { parts: 'src/lib/architecture/Card' }
      }
    },
    'architecture/unit-entry-file': {
      options: {
        pascalCaseUnits: { 'src/lib/architecture/**': '.svelte' }
      }
    },
    'architecture/private-scope-import': {
      options: {
        scopes: ['src/lib/architecture/Card/private']
      }
    },
    'architecture/doc-link-target': {
      options: {
        urlRoots: ['https://example.com/kitchen-sink/']
      }
    }
  },
  // A route-scoped override extends a string-list declaration rather than replacing it: the legacy
  // page must also carry a <nav>, and it does not — the planted a11y/required-element finding.
  overrides: [{ route: '/gallery/a11y/legacy', rules: { 'a11y/required-element': { options: { elements: ['nav'] } } } }]
};
