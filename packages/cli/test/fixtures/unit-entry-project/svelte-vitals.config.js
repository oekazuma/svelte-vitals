/** Fixture config file declaring a unit convention, for the sourceFiles wiring (design 2026-07-28). */
export default {
  rules: {
    'architecture/unit-entry-file': {
      options: { pascalCaseUnits: { 'src/**': '.svelte' } }
    }
  }
};
