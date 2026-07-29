/** Fixture config declaring a closed set under component units (design 2026-07-29). */
export default {
  rules: {
    'architecture/reserved-directory-names': {
      options: { unitScopes: { 'src/**': 'parts|tests' } }
    }
  }
};
