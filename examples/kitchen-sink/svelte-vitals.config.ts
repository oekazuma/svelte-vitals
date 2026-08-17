// Wakes the six Architecture rules that are inert until configured — each option
// block below targets only the misshaped unit tree under src/lib/architecture/**,
// so it does not reach into the perf/seo/correctness/security galleries or the
// clean canary routes.
export default {
  rules: {
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
  }
};
